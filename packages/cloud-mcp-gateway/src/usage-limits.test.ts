import assert from "node:assert/strict";
import { test } from "node:test";
import type { UserRecord } from "./auth-store.js";
import { UsageLimiter, parseUsageLimitConfig } from "./usage-limits.js";
import { InMemoryUsageStore } from "./usage-store.js";

test("usage limiter enforces per-minute free limits", () => {
  const user = makeUser("u1");
  const usage = new InMemoryUsageStore();
  const limiter = new UsageLimiter({
    free: { callsPerMinute: 2 },
    paid: {},
    unlimited: {},
  });
  const now = Date.parse("2026-06-01T12:00:00.000Z");

  assert.equal(limiter.check(user, usage, now).allowed, true);
  assert.equal(limiter.check(user, usage, now + 1).allowed, true);
  const denied = limiter.check(user, usage, now + 2);
  assert.equal(denied.allowed, false);
  assert.equal(denied.reason, "minute");
});

test("usage limiter enforces billable day and month limits", () => {
  const user = makeUser("u1");
  const usage = new InMemoryUsageStore();
  usage.recordToolCall({
    userId: "u1",
    toolName: "gsd_status",
    startedAt: Date.parse("2026-06-01T12:00:00.000Z"),
    durationMs: 1,
    ok: true,
  });
  usage.recordToolCall({
    userId: "u1",
    toolName: "gsd_status",
    startedAt: Date.parse("2026-06-01T12:00:01.000Z"),
    durationMs: 1,
    ok: false,
    billable: false,
    throttled: true,
  });
  const limiter = new UsageLimiter({
    free: { callsPerDay: 1, callsPerMonth: 1 },
    paid: {},
    unlimited: {},
  });

  const denied = limiter.check(user, usage, Date.parse("2026-06-01T12:00:02.000Z"));
  assert.equal(denied.allowed, false);
  assert.equal(denied.reason, "day");
  assert.equal(denied.usage.day, 1);
  assert.equal(denied.usage.month, 1);
});

test("usage limiter reserves billable day quota for in-flight calls until released", () => {
  const user = makeUser("u1");
  const usage = new InMemoryUsageStore();
  const limiter = new UsageLimiter({
    free: { callsPerDay: 1 },
    paid: {},
    unlimited: {},
  });
  const now = Date.parse("2026-06-01T12:00:00.000Z");

  // First call is accepted and reserves the single billable day slot before any
  // usage is recorded to the store.
  assert.equal(limiter.check(user, usage, now).allowed, true);
  // A concurrent second call (store still empty, first not yet recorded) is
  // denied because the in-flight reservation already consumed the day quota.
  const denied = limiter.check(user, usage, now + 1);
  assert.equal(denied.allowed, false);
  assert.equal(denied.reason, "day");

  // Releasing the in-flight reservation frees the slot again.
  limiter.releaseBillable(user.userId, now + 2);
  assert.equal(limiter.check(user, usage, now + 3).allowed, true);
});

test("non-billable calls are minute-throttled but skip the day/month billable gate", () => {
  const user = makeUser("u1");
  const usage = new InMemoryUsageStore();
  const limiter = new UsageLimiter({
    free: { callsPerMinute: 2, callsPerDay: 1, callsPerMonth: 1 },
    paid: {},
    unlimited: {},
  });
  const now = Date.parse("2026-06-01T12:00:00.000Z");

  // A non-billable call (e.g. an unknown tool) is accepted without consuming or
  // reserving the day/month billable quota.
  const first = limiter.check(user, usage, now, false);
  assert.equal(first.allowed, true);
  assert.equal(first.usage.day, 0, "non-billable call must not count against day usage");
  assert.equal(first.usage.month, 0, "non-billable call must not count against month usage");

  // Because the non-billable call reserved nothing, a concurrent billable call
  // near the single day/month slot is still allowed.
  assert.equal(limiter.check(user, usage, now + 1, true).allowed, true);

  // Non-billable calls are still minute-throttled: the third call in the window
  // (limit 2) is rejected on the minute reason, not the day/month reason.
  const throttled = limiter.check(user, usage, now + 2, false);
  assert.equal(throttled.allowed, false);
  assert.equal(throttled.reason, "minute");
});

test("non-billable calls are not rejected by an exhausted day quota", () => {
  const user = makeUser("u1");
  const usage = new InMemoryUsageStore();
  usage.recordToolCall({
    userId: "u1",
    toolName: "gsd_status",
    startedAt: Date.parse("2026-06-01T12:00:00.000Z"),
    durationMs: 1,
    ok: true,
  });
  const limiter = new UsageLimiter({
    free: { callsPerDay: 1, callsPerMonth: 1 },
    paid: {},
    unlimited: {},
  });
  const at = Date.parse("2026-06-01T12:00:01.000Z");

  // A billable call is denied because the day quota is exhausted.
  assert.equal(limiter.check(user, usage, at, true).reason, "day");
  // A non-billable call at the same moment is allowed because it skips the
  // day/month billable gate.
  assert.equal(limiter.check(user, usage, at + 1, false).allowed, true);
});

test("unlimited plan bypasses configured free limits", () => {
  const user = makeUser("u1", "unlimited");
  const usage = new InMemoryUsageStore();
  const limiter = new UsageLimiter({
    free: { callsPerMinute: 0, callsPerDay: 1, callsPerMonth: 1 },
    paid: {},
    unlimited: {},
  });

  assert.equal(limiter.check(user, usage).allowed, true);
  assert.equal(limiter.check(user, usage).allowed, true);
});

test("readLimit treats fractional values as limit of 1, not unlimited", () => {
  const config = parseUsageLimitConfig({
    GSD_CLOUD_FREE_CALLS_PER_MINUTE: "0.5",
    GSD_CLOUD_FREE_CALLS_PER_DAY: "0.9",
    GSD_CLOUD_FREE_CALLS_PER_MONTH: "0",
  });
  assert.equal(config.free.callsPerMinute, 1, "0.5 should floor to 1, not unlimited");
  assert.equal(config.free.callsPerDay, 1, "0.9 should floor to 1, not unlimited");
  assert.equal(config.free.callsPerMonth, undefined, "explicit 0 should remain unlimited");
});

test("usage limit config parses environment values", () => {
  const config = parseUsageLimitConfig({
    GSD_CLOUD_FREE_CALLS_PER_MINUTE: "3",
    GSD_CLOUD_FREE_CALLS_PER_DAY: "4",
    GSD_CLOUD_FREE_CALLS_PER_MONTH: "5",
    GSD_CLOUD_PAID_CALLS_PER_MINUTE: "0",
    GSD_CLOUD_PAID_CALLS_PER_DAY: "not-a-number",
    GSD_CLOUD_PAID_CALLS_PER_MONTH: "7",
  });

  assert.deepEqual(config.free, {
    callsPerMinute: 3,
    callsPerDay: 4,
    callsPerMonth: 5,
  });
  assert.deepEqual(config.paid, {
    callsPerMinute: undefined,
    callsPerDay: 2000,
    callsPerMonth: 7,
  });
});

function makeUser(userId: string, plan: UserRecord["plan"] = "free"): UserRecord {
  return {
    userId,
    role: "member",
    plan,
    createdAt: Date.now(),
  };
}
