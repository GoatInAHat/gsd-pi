import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  closeDatabase,
  _getAdapter,
  getMilestone,
  insertArtifact,
  insertMilestone,
  insertSlice,
  openDatabase,
} from "../gsd-db.ts";
import {
  discardOrphanedMilestoneReservations,
  OrphanMilestoneDiscardRefusedError,
} from "../orphan-milestone-discard.ts";
import { registerAutoWorker } from "../db/auto-workers.ts";
import { claimMilestoneLease } from "../db/milestone-leases.ts";
import { normalizeRealPath } from "../paths.ts";

function makeFixture(t: test.TestContext): string {
  const base = mkdtempSync(join(tmpdir(), "gsd-orphan-discard-"));
  mkdirSync(join(base, ".gsd", "milestones"), { recursive: true });
  openDatabase(join(base, ".gsd", "gsd.db"));
  t.after(() => {
    closeDatabase();
    rmSync(base, { recursive: true, force: true });
  });
  return base;
}

test("orphan-only discard removes a preflighted set atomically and verifies canonical state", (t) => {
  const base = makeFixture(t);
  insertMilestone({ id: "M001", status: "queued" });
  insertMilestone({ id: "M002", status: "queued" });
  insertMilestone({ id: "M003", title: "Unaffected", status: "active" });

  const result = discardOrphanedMilestoneReservations(base, ["M001", "M002"]);

  assert.deepEqual(result.deleted, ["M001", "M002"]);
  assert.deepEqual(result.before.map((entry) => entry.id), ["M001", "M002"]);
  assert.ok(result.before.every((entry) => entry.canonical.exists));
  assert.ok(result.after.every((entry) => !entry.canonical.exists));
  assert.ok(result.after.every((entry) => entry.refusalReasons.length === 0));
  assert.equal(getMilestone("M001"), null);
  assert.equal(getMilestone("M002"), null);
  assert.equal(getMilestone("M003")?.title, "Unaffected");
  const audit = _getAdapter()!.prepare(
    "SELECT type, payload_json FROM audit_events WHERE event_id = :event_id",
  ).get({ ":event_id": result.auditEventId });
  assert.equal(audit?.["type"], "orphan-milestone-reservations-discarded");
  assert.deepEqual(JSON.parse(String(audit?.["payload_json"])).milestoneIds, ["M001", "M002"]);
});

test("orphan-only discard rolls back when an unexpected surface appears during deletion", (t) => {
  const base = makeFixture(t);
  insertMilestone({ id: "M001", status: "queued" });
  _getAdapter()!.exec(`
    CREATE TRIGGER inject_artifact_after_milestone_delete
    AFTER DELETE ON milestones
    WHEN OLD.id = 'M001'
    BEGIN
      INSERT INTO artifacts (path, artifact_type, milestone_id, full_content)
      VALUES ('milestones/M001/CONTEXT.md', 'context', OLD.id, '# Concurrent context');
    END
  `);

  assert.throws(
    () => discardOrphanedMilestoneReservations(base, ["M001"]),
    /postflight verification failed.*artifacts contains 1 milestone row/,
  );
  assert.ok(getMilestone("M001"), "the canonical deletion must roll back");
  const artifact = _getAdapter()!.prepare(
    "SELECT 1 FROM artifacts WHERE milestone_id = :milestone_id",
  ).get({ ":milestone_id": "M001" });
  assert.equal(artifact, undefined, "the unexpected transactional surface must roll back too");
});

test("orphan-only discard preflights every ID before deleting any", (t) => {
  const base = makeFixture(t);
  insertMilestone({ id: "M001", status: "queued" });
  insertMilestone({ id: "M002", status: "queued" });
  insertSlice({
    milestoneId: "M002",
    id: "S01",
    title: "Existing work",
    status: "pending",
    risk: "low",
    depends: [],
  });

  assert.throws(
    () => discardOrphanedMilestoneReservations(base, ["M001", "M002"]),
    (error: unknown) => {
      assert.ok(error instanceof OrphanMilestoneDiscardRefusedError);
      assert.match(error.message, /M002/);
      assert.equal(error.before.find((entry) => entry.id === "M002")?.databaseRows.slices, 1);
      return true;
    },
  );
  assert.ok(getMilestone("M001"), "the valid target must survive another target's failed preflight");
  assert.ok(getMilestone("M002"));
});

test("orphan-only discard refuses planning payloads and artifact rows", (t) => {
  const base = makeFixture(t);
  insertMilestone({
    id: "M001",
    status: "queued",
    planning: { vision: "Existing milestone plan" },
  });
  insertMilestone({ id: "M002", status: "queued" });
  insertArtifact({
    path: "milestones/M002/CONTEXT.md",
    artifact_type: "context",
    milestone_id: "M002",
    slice_id: null,
    task_id: null,
    full_content: "# Existing context\n",
  });

  assert.throws(
    () => discardOrphanedMilestoneReservations(base, ["M001", "M002"]),
    (error: unknown) => {
      assert.ok(error instanceof OrphanMilestoneDiscardRefusedError);
      assert.equal(error.before.find((entry) => entry.id === "M001")?.canonical.hasPlanningPayload, true);
      assert.equal(error.before.find((entry) => entry.id === "M002")?.databaseRows.artifacts, 1);
      return true;
    },
  );
  assert.ok(getMilestone("M001"));
  assert.ok(getMilestone("M002"));
});

test("orphan-only discard refuses indirect milestone-scoped database rows", (t) => {
  const base = makeFixture(t);
  insertMilestone({ id: "M001", status: "queued" });
  _getAdapter()!.prepare(`
    INSERT INTO runtime_kv (scope, scope_id, key, value_json, updated_at)
    VALUES ('milestone', 'M001', 'resume', '{}', '')
  `).run();
  _getAdapter()!.prepare(`
    INSERT INTO cancellation_requests (
      requested_at, requested_by, scope, scope_id, reason, status
    ) VALUES ('', 'test', 'milestone', 'M001', 'test', 'pending')
  `).run();

  assert.throws(
    () => discardOrphanedMilestoneReservations(base, ["M001"]),
    (error: unknown) => {
      assert.ok(error instanceof OrphanMilestoneDiscardRefusedError);
      assert.equal(error.before[0]?.databaseRows["runtime_kv[scope=milestone]"], 1);
      assert.equal(error.before[0]?.databaseRows["cancellation_requests[scope=milestone]"], 1);
      return true;
    },
  );
  assert.ok(getMilestone("M001"));
});

test("orphan-only discard refuses missing rows, projections, queue references, and dependents", (t) => {
  const base = makeFixture(t);
  insertMilestone({ id: "M001", status: "queued" });
  insertMilestone({ id: "M002", status: "queued", depends_on: ["M001"] });
  mkdirSync(join(base, ".gsd", "milestones", "M001"), { recursive: true });
  writeFileSync(
    join(base, ".gsd", "QUEUE-ORDER.json"),
    JSON.stringify({ order: ["M001"], updatedAt: new Date().toISOString() }),
  );

  assert.throws(
    () => discardOrphanedMilestoneReservations(base, ["M001", "M999"]),
    (error: unknown) => {
      assert.ok(error instanceof OrphanMilestoneDiscardRefusedError);
      const target = error.before.find((entry) => entry.id === "M001");
      assert.equal(target?.projection.milestoneDirectory, true);
      assert.equal(target?.projection.queueOrderReference, true);
      assert.deepEqual(target?.dependentMilestones, ["M002"]);
      assert.equal(error.before.find((entry) => entry.id === "M999")?.canonical.exists, false);
      return true;
    },
  );
  assert.ok(getMilestone("M001"));
});

test("orphan-only discard refuses milestone leases and their worker", (t) => {
  const base = makeFixture(t);
  insertMilestone({ id: "M001", status: "queued" });
  const workerId = registerAutoWorker({ projectRootRealpath: normalizeRealPath(base) });
  assert.equal(claimMilestoneLease(workerId, "M001").ok, true);

  assert.throws(
    () => discardOrphanedMilestoneReservations(base, ["M001"]),
    (error: unknown) => {
      assert.ok(error instanceof OrphanMilestoneDiscardRefusedError);
      assert.equal(error.before[0]?.databaseRows.milestone_leases, 1);
      assert.deepEqual(error.before[0]?.activeWorkerIds, [workerId]);
      return true;
    },
  );
  assert.ok(getMilestone("M001"));
});

test("orphan-only discard refuses a milestone branch", (t) => {
  const base = makeFixture(t);
  writeFileSync(join(base, "README.md"), "fixture\n");
  execFileSync("git", ["init"], { cwd: base, stdio: "ignore" });
  execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: base });
  execFileSync("git", ["config", "user.name", "Test User"], { cwd: base });
  execFileSync("git", ["add", "README.md"], { cwd: base });
  execFileSync("git", ["commit", "-m", "fixture"], { cwd: base, stdio: "ignore" });
  execFileSync("git", ["branch", "milestone/M001"], { cwd: base });
  insertMilestone({ id: "M001", status: "queued" });

  assert.throws(
    () => discardOrphanedMilestoneReservations(base, ["M001"]),
    (error: unknown) => {
      assert.ok(error instanceof OrphanMilestoneDiscardRefusedError);
      assert.equal(error.before[0]?.git.milestoneBranch, true);
      return true;
    },
  );
  assert.ok(getMilestone("M001"));
});

test("orphan-only discard refuses a managed milestone worktree", (t) => {
  const base = makeFixture(t);
  writeFileSync(join(base, "README.md"), "fixture\n");
  execFileSync("git", ["init"], { cwd: base, stdio: "ignore" });
  execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: base });
  execFileSync("git", ["config", "user.name", "Test User"], { cwd: base });
  execFileSync("git", ["add", "README.md"], { cwd: base });
  execFileSync("git", ["commit", "-m", "fixture"], { cwd: base, stdio: "ignore" });
  const worktreePath = join(base, ".gsd-worktrees", "M001");
  mkdirSync(join(base, ".gsd-worktrees"), { recursive: true });
  execFileSync("git", ["worktree", "add", "-b", "worktree/M001", worktreePath], {
    cwd: base,
    stdio: "ignore",
  });
  insertMilestone({ id: "M001", status: "queued" });

  assert.throws(
    () => discardOrphanedMilestoneReservations(base, ["M001"]),
    (error: unknown) => {
      assert.ok(error instanceof OrphanMilestoneDiscardRefusedError);
      assert.deepEqual(error.before[0]?.git.worktrees, [worktreePath]);
      return true;
    },
  );
  assert.ok(getMilestone("M001"));
});
