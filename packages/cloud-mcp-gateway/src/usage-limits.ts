import type { UserPlan, UserQuotaOverrides, UserRecord } from "./auth-store.js";
import type { InMemoryUsageStore } from "./usage-store.js";

export interface UsageLimits {
  callsPerMinute?: number;
  callsPerDay?: number;
  callsPerMonth?: number;
}

export interface UsageLimitConfig {
  free: UsageLimits;
  paid: UsageLimits;
  unlimited: UsageLimits;
}

export interface UsageQuotaStatus {
  userId: string;
  plan: UserPlan;
  limits: UsageLimits;
  usage: {
    minute: number;
    day: number;
    month: number;
  };
  remaining: {
    minute?: number;
    day?: number;
    month?: number;
  };
  resetAt: {
    minute?: number;
    day: number;
    month: number;
  };
  allowed: boolean;
  reason?: string;
  retryAfterSeconds?: number;
}

const WINDOW_MS = 60 * 1000;

export class UsageLimiter {
  private readonly minuteCalls = new Map<string, number[]>();
  // In-flight billable reservations per user, keyed by UTC day / month window.
  // Day and month quotas are otherwise derived from the usage store, which is
  // only updated after a tool call finishes; reserving at acceptance stops
  // concurrent calls from all passing check() and overshooting the quota.
  private readonly dayReservations = new Map<string, { key: string; count: number }>();
  private readonly monthReservations = new Map<string, { key: string; count: number }>();

  constructor(private readonly config: UsageLimitConfig) {}

  /**
   * Check whether a tool call may proceed and, on acceptance, record it.
   *
   * Minute throttling applies to every call so spammed, arbitrary tool names
   * are still rate-limited. Day/month billable quota is only checked and
   * reserved for billable calls: passing `billable: false` (e.g. an unknown
   * tool that will be recorded non-billable) skips the day/month gate and never
   * holds a day/month reservation, so spam/typos cannot deny concurrent
   * legitimate calls near a day/month quota boundary.
   */
  check(user: UserRecord, usage: InMemoryUsageStore, now = Date.now(), billable = true): UsageQuotaStatus {
    const limits = resolveLimits(user, this.config);
    const calls = this.prune(user.userId, now);
    const minute = calls.length;
    const billableUsage = usage.getUserBillableUsage(user.userId, now);
    const reserved = this.reservedBillable(user.userId, now);
    const status = buildStatus(user, limits, {
      minute,
      day: billableUsage.day + reserved.day,
      month: billableUsage.month + reserved.month,
    }, now, calls[0] ? calls[0] + WINDOW_MS : undefined, billable);
    if (!status.allowed) return status;
    // Only track per-minute timestamps when a minute limit actually applies. For
    // unlimited plans (or when the minute limit is disabled via env) throttling
    // never fires, so recording timestamps would only grow the per-user
    // minuteCalls array under load and waste CPU in prune()/filter without ever
    // changing a decision.
    const trackMinute = isLimited(limits.callsPerMinute);
    if (trackMinute) this.noteAccepted(user.userId, now);
    if (billable) this.reserveBillable(user.userId, now);
    // Reflect the accepted call's own reservation in the returned status so it is
    // consistent with the limiter's internal state: the minute window counted it
    // (noteAccepted) and, for billable calls, the day/month billable reservation
    // counted it (reserveBillable). Otherwise callers surfacing this status
    // under-report day/month usage by 1 until the call is later recorded in the
    // usage store.
    return {
      ...status,
      usage: {
        ...status.usage,
        minute: trackMinute ? minute + 1 : status.usage.minute,
        day: status.usage.day + (billable ? 1 : 0),
        month: status.usage.month + (billable ? 1 : 0),
      },
      remaining: {
        ...status.remaining,
        ...(status.remaining.minute !== undefined ? { minute: Math.max(0, status.remaining.minute - 1) } : {}),
        ...(billable && status.remaining.day !== undefined ? { day: Math.max(0, status.remaining.day - 1) } : {}),
        ...(billable && status.remaining.month !== undefined ? { month: Math.max(0, status.remaining.month - 1) } : {}),
      },
      resetAt: {
        ...status.resetAt,
        // noteAccepted() just recorded this call, so the minute window is now
        // non-empty even if it was empty pre-acceptance; surface its reset time
        // (oldest call in the window + WINDOW_MS) instead of the stale undefined.
        // Only when a minute limit applies: unlimited plans have no minute window.
        ...(trackMinute ? { minute: (calls[0] ?? now) + WINDOW_MS } : {}),
      },
    };
  }

  inspect(user: UserRecord, usage: InMemoryUsageStore, now = Date.now()): UsageQuotaStatus {
    const limits = resolveLimits(user, this.config);
    const billable = usage.getUserBillableUsage(user.userId, now);
    const calls = this.prune(user.userId, now);
    return buildStatus(user, limits, {
      minute: calls.length,
      day: billable.day,
      month: billable.month,
    }, now, calls[0] ? calls[0] + WINDOW_MS : undefined);
  }

  /**
   * Release a billable reservation held for an in-flight tool call. A caller
   * that passed check() (status.allowed === true) must call this exactly once
   * when the call settles, so the reservation does not outlive the request.
   */
  releaseBillable(userId: string, now = Date.now()): void {
    adjustReservation(this.dayReservations, userId, utcDayKey(now), -1);
    adjustReservation(this.monthReservations, userId, utcMonthKey(now), -1);
  }

  private noteAccepted(userId: string, now: number): void {
    const calls = this.prune(userId, now);
    calls.push(now);
    this.minuteCalls.set(userId, calls);
  }

  private reserveBillable(userId: string, now: number): void {
    adjustReservation(this.dayReservations, userId, utcDayKey(now), 1);
    adjustReservation(this.monthReservations, userId, utcMonthKey(now), 1);
  }

  private reservedBillable(userId: string, now: number): { day: number; month: number } {
    return {
      day: currentReservation(this.dayReservations, userId, utcDayKey(now)),
      month: currentReservation(this.monthReservations, userId, utcMonthKey(now)),
    };
  }

  private prune(userId: string, now: number): number[] {
    const cutoff = now - WINDOW_MS;
    const calls = (this.minuteCalls.get(userId) ?? []).filter((timestamp) => timestamp > cutoff);
    if (calls.length) this.minuteCalls.set(userId, calls);
    else this.minuteCalls.delete(userId);
    return calls;
  }
}

export function parseUsageLimitConfig(env: Record<string, string | undefined> = process.env): UsageLimitConfig {
  return {
    free: {
      callsPerMinute: readLimit(env.GSD_CLOUD_FREE_CALLS_PER_MINUTE, 12),
      callsPerDay: readLimit(env.GSD_CLOUD_FREE_CALLS_PER_DAY, 100),
      callsPerMonth: readLimit(env.GSD_CLOUD_FREE_CALLS_PER_MONTH, 1000),
    },
    paid: {
      callsPerMinute: readLimit(env.GSD_CLOUD_PAID_CALLS_PER_MINUTE, 60),
      callsPerDay: readLimit(env.GSD_CLOUD_PAID_CALLS_PER_DAY, 2000),
      callsPerMonth: readLimit(env.GSD_CLOUD_PAID_CALLS_PER_MONTH, 50000),
    },
    unlimited: {},
  };
}

export function formatQuotaExceeded(status: UsageQuotaStatus): string {
  if (status.reason === "minute") {
    return `Usage limit exceeded: ${status.limits.callsPerMinute} tool calls per minute. Try again in ${status.retryAfterSeconds ?? 60}s.`;
  }
  if (status.reason === "day") {
    return `Usage limit exceeded: ${status.limits.callsPerDay} billable tool calls per day.`;
  }
  if (status.reason === "month") {
    return `Usage limit exceeded: ${status.limits.callsPerMonth} billable tool calls per month.`;
  }
  return "Usage limit exceeded.";
}

function resolveLimits(user: UserRecord, config: UsageLimitConfig): UsageLimits {
  return {
    ...config[user.plan],
    ...normalizeOverrides(user.quotaOverrides),
  };
}

function buildStatus(
  user: UserRecord,
  limits: UsageLimits,
  usage: UsageQuotaStatus["usage"],
  now: number,
  minuteResetAt: number | undefined,
  // Minute throttling always applies; day/month quotas are only enforced for
  // billable calls so non-billable calls (e.g. unknown tools) are rate-limited
  // without consuming or being rejected by the day/month billable budget.
  enforceBillable = true,
): UsageQuotaStatus {
  const resetAt = {
    minute: minuteResetAt,
    day: nextUtcDay(now),
    month: nextUtcMonth(now),
  };
  const remaining = {
    ...(isLimited(limits.callsPerMinute) ? { minute: Math.max(0, limits.callsPerMinute - usage.minute) } : {}),
    ...(isLimited(limits.callsPerDay) ? { day: Math.max(0, limits.callsPerDay - usage.day) } : {}),
    ...(isLimited(limits.callsPerMonth) ? { month: Math.max(0, limits.callsPerMonth - usage.month) } : {}),
  };
  if (isLimited(limits.callsPerMinute) && usage.minute >= limits.callsPerMinute) {
    return {
      userId: user.userId,
      plan: user.plan,
      limits,
      usage,
      remaining,
      resetAt,
      allowed: false,
      reason: "minute",
      retryAfterSeconds: Math.max(1, Math.ceil(((resetAt.minute ?? now + WINDOW_MS) - now) / 1000)),
    };
  }
  if (enforceBillable && isLimited(limits.callsPerDay) && usage.day >= limits.callsPerDay) {
    return {
      userId: user.userId,
      plan: user.plan,
      limits,
      usage,
      remaining,
      resetAt,
      allowed: false,
      reason: "day",
      retryAfterSeconds: Math.max(1, Math.ceil((resetAt.day - now) / 1000)),
    };
  }
  if (enforceBillable && isLimited(limits.callsPerMonth) && usage.month >= limits.callsPerMonth) {
    return {
      userId: user.userId,
      plan: user.plan,
      limits,
      usage,
      remaining,
      resetAt,
      allowed: false,
      reason: "month",
      retryAfterSeconds: Math.max(1, Math.ceil((resetAt.month - now) / 1000)),
    };
  }
  return {
    userId: user.userId,
    plan: user.plan,
    limits,
    usage,
    remaining,
    resetAt,
    allowed: true,
  };
}

function normalizeOverrides(value: UserQuotaOverrides | undefined): UsageLimits {
  if (!value) return {};
  return {
    ...(value.callsPerMinute !== undefined ? { callsPerMinute: value.callsPerMinute } : {}),
    ...(value.callsPerDay !== undefined ? { callsPerDay: value.callsPerDay } : {}),
    ...(value.callsPerMonth !== undefined ? { callsPerMonth: value.callsPerMonth } : {}),
  };
}

function readLimit(value: string | undefined, fallback: number): number | undefined {
  if (value === undefined || value.trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  if (parsed === 0) return undefined;
  return Math.max(1, Math.floor(parsed));
}

function isLimited(limit: number | undefined): limit is number {
  return typeof limit === "number" && limit > 0;
}

type Reservation = { key: string; count: number };

function adjustReservation(map: Map<string, Reservation>, userId: string, key: string, delta: number): void {
  const entry = map.get(userId);
  // A release (negative delta) whose window has already rolled over must not
  // touch the current window's reservation. The stale window's count was
  // discarded when the new window's first reserve reset the entry, so applying
  // the release here would wrongly delete or undercount the live entry and let
  // concurrent calls bypass day/month quotas around midnight/month boundaries.
  if (delta < 0 && entry !== undefined && entry.key !== key) return;
  // A stale window (entry.key !== key) on a reserve has rolled over, so start
  // fresh instead of carrying an old day/month's count into the new window.
  const base = entry && entry.key === key ? entry.count : 0;
  const count = Math.max(0, base + delta);
  if (count > 0) map.set(userId, { key, count });
  else map.delete(userId);
}

function currentReservation(map: Map<string, Reservation>, userId: string, key: string): number {
  const entry = map.get(userId);
  return entry && entry.key === key ? entry.count : 0;
}

function utcDayKey(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

function utcMonthKey(now: number): string {
  return new Date(now).toISOString().slice(0, 7);
}

function nextUtcDay(now: number): number {
  const date = new Date(now);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1);
}

function nextUtcMonth(now: number): number {
  const date = new Date(now);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1);
}
