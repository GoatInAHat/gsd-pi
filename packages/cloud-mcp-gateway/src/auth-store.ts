import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export type UserRole = "admin" | "member";
export type UserPlan = "free" | "paid" | "unlimited";

export interface UserQuotaOverrides {
  callsPerMinute?: number;
  callsPerDay?: number;
  callsPerMonth?: number;
}

export interface UserRecord {
  userId: string;
  clerkUserId?: string;
  email?: string;
  name?: string;
  role: UserRole;
  plan: UserPlan;
  quotaOverrides?: UserQuotaOverrides;
  createdAt: number;
  lastSeenAt?: number;
  disabled?: boolean;
}

export interface CreateUserInput {
  userId?: string;
  clerkUserId?: string;
  email?: string;
  name?: string;
  role?: UserRole;
  plan?: UserPlan;
  quotaOverrides?: UserQuotaOverrides;
}

export interface UserTokenRecord {
  userId: string;
  tokenId: string;
  label?: string;
  createdAt: number;
  lastUsedAt?: number;
  revoked?: boolean;
}

export interface PublicUserTokenRecord {
  tokenId: string;
  userId: string;
  label?: string;
  createdAt: number;
  lastUsedAt?: number;
  revoked?: boolean;
}

export interface DeviceTokenRecord {
  userId: string;
  runtimeId: string;
  runtimeName?: string;
  createdAt?: number;
  lastUsedAt?: number;
  revoked?: boolean;
}

export interface PairingCodeRecord {
  userId: string;
  expiresAt: number;
}

export interface UserTokenIssue {
  userId: string;
  tokenId: string;
  userToken: string;
}

export interface DeviceTokenIssue {
  userId: string;
  runtimeId: string;
  deviceToken: string;
}

export interface AuthStoreSnapshot {
  version: 1;
  users: UserRecord[];
  userTokens: Array<UserTokenRecord & SecretHashRecord>;
  deviceTokens: Array<DeviceTokenRecord & SecretHashRecord>;
  pairingCodes: Array<PairingCodeRecord & SecretHashRecord>;
}

export interface SecretHashRecord {
  secretHash: string;
  secretSalt: string;
}

interface SeedUserToken {
  token: string;
  userId: string;
  email?: string;
  name?: string;
  role?: UserRole;
  plan?: UserPlan;
  label?: string;
}

const USER_TOKEN_PREFIX = "gsd_usr_";
const ACCESS_PERSIST_INTERVAL_MS = 60 * 1000;
const ACCESS_FLUSH_DELAY_MS = 5 * 1000;

export class InMemoryAuthStore {
  protected readonly users = new Map<string, UserRecord>();
  protected readonly userTokens = new Map<string, UserTokenRecord & SecretHashRecord>();
  protected readonly deviceTokens = new Map<string, DeviceTokenRecord & SecretHashRecord>();
  protected readonly pairingCodes = new Map<string, PairingCodeRecord & SecretHashRecord>();
  private readonly lastAccessPersistedAt = new Map<string, number>();
  // O(1) lookup acceleration for the hot auth paths. Maps a deterministic hash of
  // the raw (high-entropy, random) token to the record's map key so authentication
  // does not linear-scan and recompute salted scrypt for every stored token. The
  // salted scrypt hash remains the actual verification; these indexes only narrow
  // the candidate set, live in memory only (never persisted), and self-heal for
  // snapshot-loaded tokens on their first authentication.
  private readonly userTokenIndex = new Map<string, string>();
  private readonly deviceTokenIndex = new Map<string, string>();

  constructor(seedUserToken?: SeedUserToken, snapshot?: AuthStoreSnapshot) {
    if (snapshot) this.loadSnapshot(snapshot);
    if (seedUserToken) {
      this.upsertUser({
        userId: seedUserToken.userId,
        email: seedUserToken.email,
        name: seedUserToken.name,
        role: seedUserToken.role ?? "admin",
        plan: seedUserToken.plan ?? "unlimited",
      });
      this.addUserToken(seedUserToken.token, seedUserToken.userId, {
        label: seedUserToken.label ?? "seed",
      });
    }
  }

  createUser(input: CreateUserInput = {}): UserRecord {
    const user = this.upsertUser({
      ...input,
      userId: input.userId ?? `usr_${randomUUID()}`,
      role: input.role ?? "member",
    });
    this.afterMutation();
    return { ...user };
  }

  updateUser(
    userId: string,
    input: Partial<Pick<UserRecord, "email" | "name" | "role" | "plan" | "quotaOverrides" | "disabled">>,
  ): UserRecord {
    const existing = this.users.get(userId);
    if (!existing) throw new Error(`Unknown user: ${userId}`);
    const next: UserRecord = {
      ...existing,
      ...(input.email !== undefined ? { email: cleanOptionalString(input.email) } : {}),
      ...(input.name !== undefined ? { name: cleanOptionalString(input.name) } : {}),
      ...(input.role !== undefined ? { role: normalizeRole(input.role) } : {}),
      ...(input.plan !== undefined ? { plan: normalizePlan(input.plan) } : {}),
      ...(input.quotaOverrides !== undefined
        ? { quotaOverrides: optionalQuotaOverrides(input.quotaOverrides) }
        : {}),
      ...(input.disabled !== undefined ? { disabled: input.disabled } : {}),
    };
    this.users.set(userId, next);
    this.afterMutation();
    return { ...next };
  }

  listUsers(): UserRecord[] {
    return Array.from(this.users.values())
      .map((user) => ({ ...user }))
      .sort((a, b) => {
        const aName = a.email ?? a.name ?? a.userId;
        const bName = b.email ?? b.name ?? b.userId;
        return aName.localeCompare(bName);
      });
  }

  getUser(userId: string): UserRecord | undefined {
    const user = this.users.get(userId);
    return user ? { ...user } : undefined;
  }

  getUserByClerkUserId(clerkUserId: string): UserRecord | undefined {
    for (const user of this.users.values()) {
      if (user.clerkUserId === clerkUserId) return { ...user };
    }
    return undefined;
  }

  listUserTokens(userId?: string): PublicUserTokenRecord[] {
    return Array.from(this.userTokens.values())
      .filter((record) => !userId || record.userId === userId)
      .map(({ tokenId, userId: recordUserId, label, createdAt, lastUsedAt, revoked }) => ({
        tokenId,
        userId: recordUserId,
        ...(label ? { label } : {}),
        createdAt,
        ...(lastUsedAt ? { lastUsedAt } : {}),
        ...(revoked ? { revoked } : {}),
      }))
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  issueUserToken(userId: string, options: { label?: string } = {}): UserTokenIssue {
    // Do not mint tokens for a disabled user: authenticateUser() rejects them,
    // so the token could never be used, only confuse operators and bloat the
    // persisted snapshot. Mirrors the createPairingCode() gate below.
    const user = this.users.get(userId);
    if (!user || user.disabled) throw new Error(`Unknown or disabled user: ${userId}`);
    const userToken = `${USER_TOKEN_PREFIX}${randomBytes(32).toString("hex")}`;
    const record = this.addUserToken(userToken, userId, options);
    return { userId, tokenId: record.tokenId, userToken };
  }

  addUserToken(token: string, userId: string, options: { label?: string } = {}): UserTokenRecord {
    this.ensureUser(userId);
    const existing = this.findIndexedEntry(this.userTokens, this.userTokenIndex, token)?.[1];
    if (existing) {
      // The same raw token must never map to two users, and re-adding it must be
      // idempotent: inserting a fresh salted hash would bloat the snapshot with a
      // duplicate record that findSecretEntry() can never reach (auth matches the
      // older entry first). Reuse the existing record instead.
      if (existing.userId !== userId) {
        throw new Error("User token is already assigned to a different user");
      }
      let mutated = false;
      if (existing.revoked) {
        delete existing.revoked;
        mutated = true;
      }
      const label = cleanOptionalString(options.label);
      if (label && existing.label !== label) {
        existing.label = label;
        mutated = true;
      }
      if (mutated) this.afterMutation();
      return publicTokenRecord(existing);
    }
    const key = deriveSecretHash(token);
    const record: UserTokenRecord & SecretHashRecord = {
      ...key,
      userId,
      tokenId: `tok_${randomUUID()}`,
      ...(cleanOptionalString(options.label) ? { label: cleanOptionalString(options.label) } : {}),
      createdAt: Date.now(),
    };
    this.userTokens.set(key.secretHash, record);
    this.userTokenIndex.set(lookupKeyFor(token), key.secretHash);
    this.afterMutation();
    return publicTokenRecord(record);
  }

  authenticateUser(token: string | undefined): string | null {
    if (!token) return null;
    const entry = this.findIndexedEntry(this.userTokens, this.userTokenIndex, token);
    if (!entry) return null;
    const [secretHash, record] = entry;
    const user = this.users.get(record.userId);
    if (record.revoked || user?.disabled) return null;
    const now = Date.now();
    record.lastUsedAt = now;
    if (user) user.lastSeenAt = now;
    this.persistAccessIfDue(secretHash, now);
    return record.userId;
  }

  authenticateDevice(token: string | undefined): DeviceTokenRecord | null {
    if (!token) return null;
    const entry = this.findIndexedEntry(this.deviceTokens, this.deviceTokenIndex, token);
    if (!entry) return null;
    const [secretHash, record] = entry;
    const user = this.users.get(record.userId);
    if (record.revoked || user?.disabled) return null;
    const now = Date.now();
    record.lastUsedAt = now;
    if (user) user.lastSeenAt = now;
    this.persistAccessIfDue(secretHash, now);
    return publicDeviceTokenRecord(record);
  }

  createPairingCode(userId: string, ttlMs = 10 * 60 * 1000): { code: string; expiresAt: number } {
    const user = this.users.get(userId);
    if (!user || user.disabled) throw new Error(`Unknown or disabled user: ${userId}`);
    this.sweepExpiredPairingCodes();
    // One live pairing code per user: a new code invalidates any prior un-redeemed
    // one, so the guessable set never grows beyond a single code per user (and the
    // per-exchange scrypt cost stays bounded).
    for (const [hash, record] of this.pairingCodes) {
      if (record.userId === userId) this.pairingCodes.delete(hash);
    }
    // 64 bits of entropy (16 hex chars). Endpoint-level request rate limiting is the
    // complementary defense and belongs at the HTTP layer, not here.
    const code = randomBytes(8).toString("hex").toUpperCase();
    const expiresAt = Date.now() + ttlMs;
    const key = deriveSecretHash(code);
    this.pairingCodes.set(key.secretHash, { ...key, userId, expiresAt });
    this.afterMutation();
    return { code, expiresAt };
  }

  exchangePairingCode(code: string, runtimeName?: string): DeviceTokenIssue {
    this.sweepExpiredPairingCodes();
    const normalized = code.trim().toUpperCase();
    const codeEntry = findSecretEntry(this.pairingCodes, normalized);
    if (!codeEntry || codeEntry[1].expiresAt < Date.now()) {
      if (codeEntry) this.pairingCodes.delete(codeEntry[0]);
      this.afterMutation();
      throw new Error("Pairing code is invalid or expired");
    }
    const [codeHash, record] = codeEntry;
    const user = this.users.get(record.userId);
    if (!user || user.disabled) {
      this.pairingCodes.delete(codeHash);
      this.afterMutation();
      throw new Error("Pairing code is invalid or expired");
    }
    this.pairingCodes.delete(codeHash);
    const runtimeId = `rt_${randomUUID()}`;
    const deviceToken = `gsd_dev_${randomBytes(32).toString("hex")}`;
    const key = deriveSecretHash(deviceToken);
    this.deviceTokens.set(key.secretHash, {
      ...key,
      userId: record.userId,
      runtimeId,
      runtimeName,
      createdAt: Date.now(),
    });
    this.deviceTokenIndex.set(lookupKeyFor(deviceToken), key.secretHash);
    this.afterMutation();
    return { userId: record.userId, runtimeId, deviceToken };
  }

  revokeUserTokenById(tokenId: string): boolean {
    for (const record of this.userTokens.values()) {
      if (record.tokenId !== tokenId) continue;
      record.revoked = true;
      this.afterMutation();
      return true;
    }
    return false;
  }

  revokeDeviceToken(deviceToken: string): boolean {
    const record = this.findIndexedEntry(this.deviceTokens, this.deviceTokenIndex, deviceToken)?.[1];
    if (!record) return false;
    record.revoked = true;
    this.afterMutation();
    return true;
  }

  snapshot(): AuthStoreSnapshot {
    // Return shallow copies so a caller can't mutate live in-memory auth records
    // (and thus what gets persisted) by editing the returned snapshot.
    return {
      version: 1,
      // Deep-copy quotaOverrides so a caller can't mutate the nested override
      // object on a live user record through the returned snapshot.
      users: Array.from(this.users.values(), (record) => ({
        ...record,
        ...(record.quotaOverrides ? { quotaOverrides: { ...record.quotaOverrides } } : {}),
      })),
      userTokens: Array.from(this.userTokens.values(), (record) => ({ ...record })),
      deviceTokens: Array.from(this.deviceTokens.values(), (record) => ({ ...record })),
      pairingCodes: Array.from(this.pairingCodes.values(), (record) => ({ ...record })),
    };
  }

  protected afterMutation(): void {
    // Extension point for persistent stores.
  }

  // Access-timestamp updates (lastUsedAt/lastSeenAt) are best-effort telemetry on
  // the hot auth path. Persistent stores debounce these instead of doing a full
  // synchronous snapshot write per authenticated request; the default falls back
  // to afterMutation() so the in-memory store keeps its no-op behavior.
  protected afterAccessMutation(): void {
    this.afterMutation();
  }

  close(): void {
    // No persistence to flush for the in-memory store.
  }

  // Drop expired pairing codes so a long-lived gateway does not accumulate codes
  // that were generated but never redeemed. Best-effort: callers persist via their
  // own afterMutation() after the create/exchange that triggered the sweep.
  private sweepExpiredPairingCodes(now = Date.now()): void {
    for (const [hash, record] of this.pairingCodes) {
      if (record.expiresAt < now) this.pairingCodes.delete(hash);
    }
  }

  private ensureUser(userId: string): void {
    if (this.users.has(userId)) return;
    this.users.set(userId, {
      userId,
      role: "member",
      plan: "free",
      createdAt: Date.now(),
    });
  }

  private upsertUser(input: CreateUserInput & { userId: string }): UserRecord {
    const existing = this.users.get(input.userId);
    const role = normalizeRole(input.role ?? existing?.role ?? "member");
    const user: UserRecord = {
      userId: input.userId,
      ...(cleanOptionalString(input.clerkUserId ?? existing?.clerkUserId)
        ? { clerkUserId: cleanOptionalString(input.clerkUserId ?? existing?.clerkUserId) }
        : {}),
      role,
      plan: normalizePlan(input.plan ?? existing?.plan ?? (role === "admin" ? "unlimited" : "free")),
      createdAt: existing?.createdAt ?? Date.now(),
      ...(existing?.lastSeenAt ? { lastSeenAt: existing.lastSeenAt } : {}),
      ...(existing?.disabled ? { disabled: existing.disabled } : {}),
      ...(optionalQuotaOverrides(input.quotaOverrides ?? existing?.quotaOverrides)
        ? { quotaOverrides: optionalQuotaOverrides(input.quotaOverrides ?? existing?.quotaOverrides) }
        : {}),
      ...(cleanOptionalString(input.email ?? existing?.email) ? { email: cleanOptionalString(input.email ?? existing?.email) } : {}),
      ...(cleanOptionalString(input.name ?? existing?.name) ? { name: cleanOptionalString(input.name ?? existing?.name) } : {}),
    };
    this.users.set(user.userId, user);
    return user;
  }

  // Resolve a token via its in-memory lookup index (O(1)) before falling back to a
  // full scan. The salted scrypt hash is still the authority: an index hit is only
  // trusted after secretMatches() verifies it. A miss (e.g. a snapshot-loaded token
  // whose index entry was never built) scans once and back-fills the index so the
  // next authentication is O(1).
  private findIndexedEntry<T extends SecretHashRecord>(
    records: Map<string, T>,
    index: Map<string, string>,
    secret: string,
  ): [string, T] | undefined {
    const lookupKey = lookupKeyFor(secret);
    const mappedKey = index.get(lookupKey);
    if (mappedKey !== undefined) {
      const record = records.get(mappedKey);
      if (record && secretMatches(record, secret)) return [mappedKey, record];
      // Stale index entry (record removed or rotated): fall through to a scan.
    }
    const entry = findSecretEntry(records, secret);
    if (entry) index.set(lookupKey, entry[0]);
    return entry;
  }

  private persistAccessIfDue(secretHash: string, now: number): void {
    const lastPersistedAt = this.lastAccessPersistedAt.get(secretHash) ?? 0;
    if (now - lastPersistedAt < ACCESS_PERSIST_INTERVAL_MS) return;
    this.lastAccessPersistedAt.set(secretHash, now);
    this.afterAccessMutation();
  }

  private loadSnapshot(snapshot: AuthStoreSnapshot): void {
    for (const record of snapshot.users ?? []) {
      if (!record.userId) continue;
      this.users.set(record.userId, {
        userId: record.userId,
        ...(typeof record.clerkUserId === "string" && record.clerkUserId.trim()
          ? { clerkUserId: record.clerkUserId.trim() }
          : {}),
        role: normalizeRole(record.role),
        plan: normalizePlan(record.plan ?? (normalizeRole(record.role) === "admin" ? "unlimited" : "free")),
        createdAt: typeof record.createdAt === "number" ? record.createdAt : Date.now(),
        ...(typeof record.email === "string" && record.email.trim() ? { email: record.email.trim() } : {}),
        ...(typeof record.name === "string" && record.name.trim() ? { name: record.name.trim() } : {}),
        ...(optionalQuotaOverrides(record.quotaOverrides) ? { quotaOverrides: optionalQuotaOverrides(record.quotaOverrides) } : {}),
        ...(typeof record.lastSeenAt === "number" ? { lastSeenAt: record.lastSeenAt } : {}),
        ...(record.disabled ? { disabled: true } : {}),
      });
    }
    for (const record of snapshot.userTokens ?? []) {
      if (!record.userId) continue;
      this.ensureUser(record.userId);
      this.userTokens.set(record.secretHash, {
        ...record,
        tokenId: typeof record.tokenId === "string" ? record.tokenId : `tok_${randomUUID()}`,
        createdAt: typeof record.createdAt === "number" ? record.createdAt : Date.now(),
        ...(typeof record.label === "string" && record.label.trim() ? { label: record.label.trim() } : {}),
      });
    }
    for (const record of snapshot.deviceTokens ?? []) {
      if (!record.userId) continue;
      this.ensureUser(record.userId);
      this.deviceTokens.set(record.secretHash, {
        ...record,
        createdAt: typeof record.createdAt === "number" ? record.createdAt : Date.now(),
      });
    }
    for (const record of snapshot.pairingCodes ?? []) {
      if (record.expiresAt >= Date.now()) {
        this.ensureUser(record.userId);
        this.pairingCodes.set(record.secretHash, record);
      }
    }
  }
}

export class FileAuthStore extends InMemoryAuthStore {
  private readonly filePath: string;
  private readonly accessFlushDelayMs: number;
  private accessFlushTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    filePath: string,
    seedUserToken?: SeedUserToken,
    options: { accessFlushDelayMs?: number } = {},
  ) {
    super(undefined, readSnapshot(filePath));
    this.filePath = filePath;
    this.accessFlushDelayMs = Math.max(0, options.accessFlushDelayMs ?? ACCESS_FLUSH_DELAY_MS);
    if (seedUserToken) {
      this.createUser({
        userId: seedUserToken.userId,
        email: seedUserToken.email,
        name: seedUserToken.name,
        role: seedUserToken.role ?? "admin",
        plan: seedUserToken.plan ?? "unlimited",
      });
      this.addUserToken(seedUserToken.token, seedUserToken.userId, {
        label: seedUserToken.label ?? "seed",
      });
    }
    this.persist();
  }

  protected override afterMutation(): void {
    // A structural mutation writes the full snapshot (which already includes the
    // latest access timestamps), so drop any pending access-only flush.
    this.clearAccessFlush();
    this.persist();
  }

  protected override afterAccessMutation(): void {
    // Coalesce per-request access-timestamp writes into a single debounced flush
    // so the hot auth path isn't blocked by a synchronous write+rename each time.
    if (this.accessFlushTimer) return;
    this.accessFlushTimer = setTimeout(() => {
      this.accessFlushTimer = undefined;
      // Access timestamps are best-effort telemetry. Swallow persist failures
      // (disk full, permissions, etc.) here so they can't surface as an
      // unhandled exception on the event loop and take down the gateway; a
      // later structural mutation or close() re-persists the full snapshot,
      // which already carries the latest access timestamps.
      try {
        this.persist();
      } catch {
        // best-effort access-timestamp flush; ignore
      }
    }, this.accessFlushDelayMs);
    this.accessFlushTimer.unref?.();
  }

  override close(): void {
    if (!this.accessFlushTimer) return;
    this.clearAccessFlush();
    this.persist();
  }

  private clearAccessFlush(): void {
    if (!this.accessFlushTimer) return;
    clearTimeout(this.accessFlushTimer);
    this.accessFlushTimer = undefined;
  }

  private persist(): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    writeFileSync(tmp, `${JSON.stringify(this.snapshot(), null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    renameSync(tmp, this.filePath);
  }
}

export function extractBearerToken(header: string | string[] | undefined): string | undefined {
  const value = Array.isArray(header) ? header[0] : header;
  if (!value || value.length <= "Bearer ".length) return undefined;
  if (value.slice(0, "Bearer".length).toLowerCase() !== "bearer") return undefined;

  const firstSeparator = value.charCodeAt("Bearer".length);
  if (firstSeparator !== 0x20 && firstSeparator !== 0x09) return undefined;

  let tokenStart = "Bearer".length + 1;
  while (tokenStart < value.length) {
    const char = value.charCodeAt(tokenStart);
    if (char !== 0x20 && char !== 0x09) break;
    tokenStart += 1;
  }

  return tokenStart < value.length ? value.slice(tokenStart) : undefined;
}

export function deriveSecretHash(secret: string, secretSalt = randomBytes(16).toString("hex")): SecretHashRecord {
  return {
    secretHash: scryptSync(secret, secretSalt, 32).toString("hex"),
    secretSalt,
  };
}

function publicDeviceTokenRecord(record: DeviceTokenRecord & SecretHashRecord): DeviceTokenRecord {
  // Never spread the stored record: it carries secretHash/secretSalt, and a raw
  // spread makes it trivial to log or serialize hash material downstream.
  return {
    userId: record.userId,
    runtimeId: record.runtimeId,
    ...(record.runtimeName ? { runtimeName: record.runtimeName } : {}),
    ...(record.createdAt !== undefined ? { createdAt: record.createdAt } : {}),
    ...(record.lastUsedAt !== undefined ? { lastUsedAt: record.lastUsedAt } : {}),
    ...(record.revoked ? { revoked: true } : {}),
  };
}

function publicTokenRecord(record: UserTokenRecord): UserTokenRecord {
  return {
    userId: record.userId,
    tokenId: record.tokenId,
    ...(record.label ? { label: record.label } : {}),
    createdAt: record.createdAt,
    ...(record.lastUsedAt ? { lastUsedAt: record.lastUsedAt } : {}),
    ...(record.revoked ? { revoked: true } : {}),
  };
}

function normalizeRole(value: unknown): UserRole {
  return value === "admin" ? "admin" : "member";
}

function normalizePlan(value: unknown): UserPlan {
  if (value === "paid" || value === "unlimited") return value;
  return "free";
}

function optionalQuotaOverrides(value: unknown): UserQuotaOverrides | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const input = value as Partial<Record<keyof UserQuotaOverrides, unknown>>;
  const overrides: UserQuotaOverrides = {};
  for (const key of ["callsPerMinute", "callsPerDay", "callsPerMonth"] as const) {
    const normalized = normalizeLimit(input[key]);
    if (normalized !== undefined) overrides[key] = normalized;
  }
  return Object.keys(overrides).length ? overrides : undefined;
}

function normalizeLimit(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;
  // 0 is the explicit "unlimited" sentinel; any positive value clamps to a
  // minimum of 1 so fractional inputs (e.g. 0.5) don't floor to 0 and
  // accidentally disable the quota, matching readLimit() in usage-limits.ts.
  if (parsed === 0) return 0;
  return Math.max(1, Math.floor(parsed));
}

function cleanOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

// Deterministic, fast index key over the raw (high-entropy, random) token. Used
// only to narrow the candidate set for an O(1) lookup; the per-record salted
// scrypt hash remains the actual verification, so this never weakens auth.
function lookupKeyFor(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

function findSecretEntry<T extends SecretHashRecord>(records: Map<string, T>, secret: string): [string, T] | undefined {
  for (const entry of records) {
    if (secretMatches(entry[1], secret)) return entry;
  }
  return undefined;
}

function secretMatches(record: SecretHashRecord, secret: string): boolean {
  const candidate = Buffer.from(deriveSecretHash(secret, record.secretSalt).secretHash, "hex");
  const expected = Buffer.from(record.secretHash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

function readSnapshot(filePath: string): AuthStoreSnapshot | undefined {
  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8")) as Partial<AuthStoreSnapshot>;
    if (parsed.version !== 1) return undefined;
    return {
      version: 1,
      users: Array.isArray(parsed.users) ? parsed.users as UserRecord[] : [],
      userTokens: Array.isArray(parsed.userTokens) ? parsed.userTokens as AuthStoreSnapshot["userTokens"] : [],
      deviceTokens: Array.isArray(parsed.deviceTokens) ? parsed.deviceTokens as AuthStoreSnapshot["deviceTokens"] : [],
      pairingCodes: Array.isArray(parsed.pairingCodes) ? parsed.pairingCodes as AuthStoreSnapshot["pairingCodes"] : [],
    };
  } catch {
    return undefined;
  }
}
