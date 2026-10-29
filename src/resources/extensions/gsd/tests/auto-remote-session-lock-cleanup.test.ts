import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { checkRemoteAutoSession, cleanupAfterLoopExit, forceStopAutoRemote, stopAuto, _registerAutoWorkerForSessionForTest } from "../auto.ts";
import { autoSession } from "../auto-runtime-state.ts";
import { openDatabase, closeDatabase, isDbAvailable, _getAdapter } from "../gsd-db.ts";
import { getAutoWorker, markWorkerStopped, markWorkerStopping, registerAutoWorker } from "../db/auto-workers.ts";
import { claimMilestoneLease, forceReleaseLeasesForWorker, getMilestoneLease } from "../db/milestone-leases.ts";
import { normalizeRealPath } from "../paths.ts";
import { readCrashLock } from "../crash-recovery.ts";

function makeBase(): string {
  const base = mkdtempSync(join(tmpdir(), "gsd-remote-lock-cleanup-"));
  mkdirSync(join(base, ".gsd"), { recursive: true });
  return base;
}

function cleanup(base: string): void {
  try { closeDatabase(); } catch {}
  try { rmSync(base, { recursive: true, force: true }); } catch {}
}

function expireWorker(workerId: string): void {
  const db = _getAdapter()!;
  db.prepare(
    `UPDATE workers SET last_heartbeat_at = '1970-01-01T00:00:00.000Z' WHERE worker_id = :worker_id`,
  ).run({ ":worker_id": workerId });
}

function setWorkerPid(workerId: string, pid: number): void {
  const db = _getAdapter()!;
  db.prepare(
    `UPDATE workers SET pid = :pid WHERE worker_id = :worker_id`,
  ).run({ ":pid": pid, ":worker_id": workerId });
}

function insertMilestone(id: string): void {
  const db = _getAdapter()!;
  db.prepare(
    `INSERT INTO milestones (id, title, status, created_at)
     VALUES (:id, :title, 'active', :created_at)`,
  ).run({
    ":id": id,
    ":title": id,
    ":created_at": new Date().toISOString(),
  });
}

function insertDispatch(workerId: string, status: string, unitId: string): number {
  const result = _getAdapter()!.prepare(
    `INSERT INTO unit_dispatches (
       trace_id, worker_id, milestone_lease_token, milestone_id,
       unit_type, unit_id, status, attempt_n, started_at
     ) VALUES (
       :trace_id, :worker_id, 1, 'M001', 'run-task', :unit_id, :status, 1, :started_at
     )`,
  ).run({
    ":trace_id": `worker-stop/${unitId}`,
    ":worker_id": workerId,
    ":unit_id": unitId,
    ":status": status,
    ":started_at": new Date().toISOString(),
  });
  return Number((result as { lastInsertRowid?: unknown }).lastInsertRowid);
}

function writeLegacyLock(base: string, pid: number): void {
  const now = new Date().toISOString();
  writeFileSync(join(base, ".gsd", "auto.lock"), JSON.stringify({
    pid,
    startedAt: now,
    unitType: "execute-task",
    unitId: "M001/S01/T01",
    unitStartedAt: now,
  }));
}

function findDeadPidCandidate(): number {
  const candidates = [99_999, 199_999, 299_999, 399_999];
  for (const pid of candidates) {
    try {
      process.kill(pid, 0);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ESRCH") return pid;
    }
  }
  throw new Error("Could not find a dead PID candidate for stale-lock test");
}

test("checkRemoteAutoSession clears stale lock state when lock PID is dead", (t) => {
  const base = makeBase();
  t.after(() => cleanup(base));

  openDatabase(join(base, ".gsd", "gsd.db"));
  const workerId = registerAutoWorker({ projectRootRealpath: normalizeRealPath(base) });
  setWorkerPid(workerId, findDeadPidCandidate());
  expireWorker(workerId);

  assert.ok(readCrashLock(base), "precondition: stale lock exists before remote session check");

  const remote = checkRemoteAutoSession(base);
  assert.deepEqual(remote, { running: false });
  assert.equal(readCrashLock(base), null, "stale lock should be cleared by remote session check");
});

test("forceStopAutoRemote escalates a live remote PID and releases worker state", (t) => {
  const base = makeBase();
  t.after(() => cleanup(base));

  openDatabase(join(base, ".gsd", "gsd.db"));
  const workerId = registerAutoWorker({ projectRootRealpath: normalizeRealPath(base) });
  const pid = 424_242;
  setWorkerPid(workerId, pid);
  insertMilestone("M001");
  writeLegacyLock(base, pid);
  const lease = claimMilestoneLease(workerId, "M001");
  assert.equal(lease.ok, true, "precondition: worker holds a milestone lease");

  const signals: Array<NodeJS.Signals | 0> = [];
  const originalKill = process.kill;
  process.kill = ((target: number, signal?: NodeJS.Signals | number) => {
    assert.equal(target, pid);
    signals.push((signal ?? 0) as NodeJS.Signals | 0);
    return true;
  }) as typeof process.kill;
  t.after(() => {
    process.kill = originalKill;
  });

  const result = forceStopAutoRemote(base);

  assert.deepEqual(result, { found: true, pid });
  assert.ok(signals.includes("SIGTERM"), "force stop should request graceful termination first");
  assert.ok(signals.includes("SIGKILL"), "force stop should escalate when the PID is still alive");
  assert.equal(getAutoWorker(workerId)?.status, "stopping");
  assert.equal(
    getMilestoneLease("M001")?.status,
    "released",
    "force stop should release held milestone leases",
  );
  assert.equal(readCrashLock(base), null, "force stop should remove the visible remote lock");
});

test("cleanupAfterLoopExit marks an idle worker stopped after coordination cleanup", async (t) => {
  const base = makeBase();
  t.after(() => cleanup(base));
  autoSession.reset();
  t.after(() => autoSession.reset());

  openDatabase(join(base, ".gsd", "gsd.db"));
  _registerAutoWorkerForSessionForTest(autoSession, normalizeRealPath(base));
  const workerId = autoSession.workerId;
  assert.ok(workerId, "precondition: worker registration succeeded");
  autoSession.active = true;

  await cleanupAfterLoopExit({
    hasUI: false,
    ui: { setStatus: () => {}, setWidget: () => {} },
  } as any);

  assert.equal(getAutoWorker(workerId)?.status, "stopped");
});

test("markWorkerStopped waits until a stopping worker releases its held lease", (t) => {
  const base = makeBase();
  t.after(() => cleanup(base));

  openDatabase(join(base, ".gsd", "gsd.db"));
  const activeWorkerId = registerAutoWorker({ projectRootRealpath: normalizeRealPath(base) });
  assert.equal(markWorkerStopped(activeWorkerId), false);
  assert.equal(getAutoWorker(activeWorkerId)?.status, "active");

  const workerId = registerAutoWorker({ projectRootRealpath: normalizeRealPath(base) });
  insertMilestone("M001");
  assert.equal(claimMilestoneLease(workerId, "M001").ok, true);
  markWorkerStopping(workerId);

  assert.equal(markWorkerStopped(workerId), false);
  assert.equal(getAutoWorker(workerId)?.status, "stopping");

  assert.equal(forceReleaseLeasesForWorker(workerId), 1);
  assert.equal(markWorkerStopped(workerId), true);
  assert.equal(getAutoWorker(workerId)?.status, "stopped");
  assert.equal(markWorkerStopped(workerId), false, "terminal transition is idempotent");
});

test("forceStopAutoRemote with no open DB still reports the killed PID and removes the lock", (t) => {
  const base = makeBase();
  t.after(() => cleanup(base));

  // The /gsd auto and /gsd next guards run before the workflow DB is opened,
  // so the forcing process reads the remote session from auto.lock only.
  assert.equal(isDbAvailable(), false, "precondition: no workflow DB is open");
  const pid = 626_262;
  writeLegacyLock(base, pid);

  const signals: Array<NodeJS.Signals | 0> = [];
  const originalKill = process.kill;
  process.kill = ((target: number, signal?: NodeJS.Signals | number) => {
    assert.equal(target, pid);
    signals.push((signal ?? 0) as NodeJS.Signals | 0);
    return true;
  }) as typeof process.kill;
  t.after(() => {
    process.kill = originalKill;
  });

  const result = forceStopAutoRemote(base);

  assert.ok(signals.includes("SIGKILL"), "precondition: the PID was escalated to SIGKILL");
  assert.deepEqual(result, { found: true, pid });
  assert.equal(readCrashLock(base), null, "force stop should remove the visible remote lock");
});

test("forceStopAutoRemote does not SIGKILL a PID that exits during the grace window", (t) => {
  const base = makeBase();
  t.after(() => cleanup(base));

  openDatabase(join(base, ".gsd", "gsd.db"));
  const workerId = registerAutoWorker({ projectRootRealpath: normalizeRealPath(base) });
  const pid = 525_252;
  setWorkerPid(workerId, pid);
  writeLegacyLock(base, pid);

  // The process is alive until it receives SIGTERM, then exits cooperatively
  // (liveness probe throws ESRCH) — so the grace loop should break before SIGKILL.
  const signals: Array<NodeJS.Signals | 0> = [];
  let alive = true;
  const originalKill = process.kill;
  process.kill = ((target: number, signal?: NodeJS.Signals | number) => {
    assert.equal(target, pid);
    if (signal === 0) {
      if (!alive) {
        const err = new Error("no such process") as NodeJS.ErrnoException;
        err.code = "ESRCH";
        throw err;
      }
      return true;
    }
    signals.push((signal ?? 0) as NodeJS.Signals | 0);
    if (signal === "SIGTERM") alive = false; // cooperative exit on SIGTERM
    return true;
  }) as typeof process.kill;
  t.after(() => {
    process.kill = originalKill;
  });

  const result = forceStopAutoRemote(base);

  assert.deepEqual(result, { found: true, pid });
  assert.ok(signals.includes("SIGTERM"), "force stop should request graceful termination first");
  assert.ok(!signals.includes("SIGKILL"), "force stop must not escalate when the PID exits during the grace window");
  assert.equal(readCrashLock(base), null, "force stop should remove the visible remote lock");
});

test("#2532: force stop releases leases for every worker row sharing the pid, not just the oldest", (t) => {
  const base = makeBase();
  t.after(() => cleanup(base));

  openDatabase(join(base, ".gsd", "gsd.db"));
  const db = _getAdapter()!;
  // Two rows share the same pid + project root: an older retired row from a
  // previous step-mode run and the current active lease holder.
  const olderId = registerAutoWorker({ projectRootRealpath: normalizeRealPath(base) });
  const holderId = registerAutoWorker({ projectRootRealpath: normalizeRealPath(base) });
  for (const w of [olderId, holderId]) setWorkerPid(w, 434_343);
  db.prepare(`UPDATE workers SET status = 'stopping' WHERE worker_id = :w`).run({ ":w": olderId });

  insertMilestone("M002");
  const lease = claimMilestoneLease(holderId, "M002");
  assert.equal(lease.ok, true, "precondition: current holder owns the milestone lease");
  writeLegacyLock(base, 434_343);

  const originalKill = process.kill;
  process.kill = (() => true) as typeof process.kill;
  t.after(() => {
    process.kill = originalKill;
  });

  const result = forceStopAutoRemote(base);

  assert.deepEqual(result, { found: true, pid: 434_343 });
  assert.equal(getAutoWorker(olderId)?.status, "stopping", "older worker remains stopping");
  assert.equal(getAutoWorker(holderId)?.status, "stopping", "current holder remains stopping");
  assert.equal(
    getMilestoneLease("M002")?.status,
    "released",
    "current holder's lease must be released, not the oldest row's",
  );
});

for (const status of ["pending", "claimed", "running"] as const) {
  test(`markWorkerStopped waits for its own ${status} dispatch to become terminal`, (t) => {
    const base = makeBase();
    t.after(() => cleanup(base));

    openDatabase(join(base, ".gsd", "gsd.db"));
    const workerId = registerAutoWorker({ projectRootRealpath: normalizeRealPath(base) });
    const dispatchId = insertDispatch(workerId, status, `M001/S01/T-${status}`);
    markWorkerStopping(workerId);

    assert.equal(markWorkerStopped(workerId), false);
    assert.equal(getAutoWorker(workerId)?.status, "stopping");

    _getAdapter()!.prepare(
      `UPDATE unit_dispatches SET status = 'completed' WHERE id = :id`,
    ).run({ ":id": dispatchId });
    assert.equal(markWorkerStopped(workerId), true);
    assert.equal(getAutoWorker(workerId)?.status, "stopped");
  });
}

test("markWorkerStopped ignores another worker's active dispatch", (t) => {
  const base = makeBase();
  t.after(() => cleanup(base));

  openDatabase(join(base, ".gsd", "gsd.db"));
  const retiringWorkerId = registerAutoWorker({ projectRootRealpath: normalizeRealPath(base) });
  const otherWorkerId = registerAutoWorker({ projectRootRealpath: normalizeRealPath(base) });
  insertDispatch(otherWorkerId, "running", "M001/S01/T-other-worker");
  markWorkerStopping(retiringWorkerId);

  assert.equal(markWorkerStopped(retiringWorkerId), true);
  assert.equal(getAutoWorker(retiringWorkerId)?.status, "stopped");
  assert.equal(getAutoWorker(otherWorkerId)?.status, "active");
});

test("stopAuto preserves worker retirement context through loop-exit cleanup", async (t) => {
  const originalCwd = process.cwd();
  const base = makeBase();
  t.after(() => {
    process.chdir(originalCwd);
    cleanup(base);
    assert.equal(process.cwd(), originalCwd);
  });
  t.after(() => autoSession.reset());

  openDatabase(join(base, ".gsd", "gsd.db"));
  const workerId = registerAutoWorker({ projectRootRealpath: normalizeRealPath(base) });
  const dispatchId = insertDispatch(workerId, "pending", "M001/S01/T-stop-auto");
  autoSession.active = true;
  autoSession.basePath = base;
  autoSession.originalBasePath = base;
  autoSession.workerId = workerId;

  await stopAuto({
    hasUI: false,
    ui: { notify: () => {}, setStatus: () => {}, setWidget: () => {}, setHeader: () => {} },
  } as any, undefined, "test stop");

  assert.equal(autoSession.workerId, null, "stopAuto resets the session's cached worker id");
  assert.equal(isDbAvailable(), false, "stopAuto closes the workflow database");
  openDatabase(join(base, ".gsd", "gsd.db"));
  assert.equal(getAutoWorker(workerId)?.status, "stopping");
  _getAdapter()!.prepare(
    `UPDATE unit_dispatches SET status = 'completed' WHERE id = :id`,
  ).run({ ":id": dispatchId });
  closeDatabase();

  await cleanupAfterLoopExit({
    hasUI: false,
    ui: { setStatus: () => {}, setWidget: () => {} },
  } as any);

  assert.equal(isDbAvailable(), false, "cleanup restores the previously closed DB state");
  openDatabase(join(base, ".gsd", "gsd.db"));
  assert.equal(getAutoWorker(workerId)?.status, "stopped");
});

test("stopAuto finalizes an idle worker after orchestration shutdown without loop cleanup", async (t) => {
  const originalCwd = process.cwd();
  const base = makeBase();
  t.after(() => {
    process.chdir(originalCwd);
    cleanup(base);
    assert.equal(process.cwd(), originalCwd);
  });
  t.after(() => autoSession.reset());

  openDatabase(join(base, ".gsd", "gsd.db"));
  const workerId = registerAutoWorker({ projectRootRealpath: normalizeRealPath(base) });
  autoSession.active = true;
  autoSession.basePath = base;
  autoSession.originalBasePath = base;
  autoSession.workerId = workerId;

  await stopAuto({
    hasUI: false,
    ui: { notify: () => {}, setStatus: () => {}, setWidget: () => {}, setHeader: () => {} },
  } as any, undefined, "test stop");

  assert.equal(isDbAvailable(), false, "stopAuto restores its closed DB state");
  openDatabase(join(base, ".gsd", "gsd.db"));
  assert.equal(getAutoWorker(workerId)?.status, "stopped");
});

test("worker finalization preserves an unrelated open in-memory database", async (t) => {
  const originalCwd = process.cwd();
  const base = makeBase();
  t.after(() => {
    process.chdir(originalCwd);
    cleanup(base);
    assert.equal(process.cwd(), originalCwd);
  });
  t.after(() => autoSession.reset());

  openDatabase(join(base, ".gsd", "gsd.db"));
  const workerId = registerAutoWorker({ projectRootRealpath: normalizeRealPath(base) });
  const dispatchId = insertDispatch(workerId, "pending", "M001/S01/T-memory-db");
  autoSession.active = true;
  autoSession.basePath = base;
  autoSession.originalBasePath = base;
  autoSession.workerId = workerId;
  await stopAuto({
    hasUI: false,
    ui: { notify: () => {}, setStatus: () => {}, setWidget: () => {}, setHeader: () => {} },
  } as any, undefined, "test stop");

  openDatabase(join(base, ".gsd", "gsd.db"));
  _getAdapter()!.prepare(
    `UPDATE unit_dispatches SET status = 'completed' WHERE id = :id`,
  ).run({ ":id": dispatchId });
  closeDatabase();

  openDatabase(":memory:");
  const memoryWorkerId = registerAutoWorker({ projectRootRealpath: "/tmp/memory-project" });
  await cleanupAfterLoopExit({
    hasUI: false,
    ui: { setStatus: () => {}, setWidget: () => {} },
  } as any);

  assert.equal(getAutoWorker(memoryWorkerId)?.status, "active", "the existing memory DB must remain intact");
  assert.equal(getAutoWorker(workerId), null, "the retiring file DB must not replace the memory DB");

  closeDatabase();
  openDatabase(join(base, ".gsd", "gsd.db"));
  await cleanupAfterLoopExit({
    hasUI: false,
    ui: { setStatus: () => {}, setWidget: () => {} },
  } as any);
  assert.equal(getAutoWorker(workerId)?.status, "stopped", "the retained finalizer can retry with the right DB open");
});
