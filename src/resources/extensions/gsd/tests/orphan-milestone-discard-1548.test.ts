// Regression coverage for #1548: bounded deletion of DB-only reservations.

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  closeDatabase,
  getMilestone,
  getDb,
  insertArtifact,
  insertMilestone,
  insertSlice,
  insertTask,
  openDatabase,
} from "../gsd-db.ts";
import { discardOrphanMilestonesAtomic } from "../orphan-milestone-discard.ts";
import { handleWorkflowCommand } from "../commands/handlers/workflow.ts";
import { withCommandCwd } from "../commands/context.ts";

function createProject(): string {
  const base = mkdtempSync(join(tmpdir(), "gsd-orphan-discard-"));
  mkdirSync(join(base, ".gsd"), { recursive: true });
  execFileSync("git", ["init", "-q", base]);
  execFileSync("git", ["-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "--allow-empty", "-qm", "initial"], { cwd: base });
  openDatabase(join(base, ".gsd", "gsd.db"));
  return base;
}

function cleanup(base: string): void {
  closeDatabase();
  rmSync(base, { recursive: true, force: true });
}

test("orphan-only discard deletes every preflighted reservation in one operation", (t) => {
  const base = createProject();
  t.after(() => cleanup(base));
  insertMilestone({ id: "M015", status: "queued" });
  insertMilestone({ id: "M016", status: "queued" });

  const result = discardOrphanMilestonesAtomic(base, ["M015", "M016"]);

  assert.equal(result.ok, true);
  assert.deepEqual(result.before.map(({ id, exists, reasons }) => ({ id, exists, reasons })), [
    { id: "M015", exists: true, reasons: [] },
    { id: "M016", exists: true, reasons: [] },
  ]);
  assert.deepEqual(result.after, [
    { id: "M015", exists: false },
    { id: "M016", exists: false },
  ]);
  assert.equal(getMilestone("M015"), null);
  assert.equal(getMilestone("M016"), null);
});

test("preflight failure for one ID prevents deletion of the entire set", (t) => {
  const base = createProject();
  t.after(() => cleanup(base));
  insertMilestone({ id: "M015", status: "queued" });
  insertMilestone({ id: "M016", status: "queued" });
  insertSlice({ milestoneId: "M016", id: "S01" });
  insertTask({ milestoneId: "M016", sliceId: "S01", id: "T01" });
  insertArtifact({
    path: ".gsd/milestones/M016/M016-CONTEXT.md",
    artifact_type: "CONTEXT",
    milestone_id: "M016",
    slice_id: null,
    task_id: null,
    full_content: "reserved context",
  });

  const result = discardOrphanMilestonesAtomic(base, ["M015", "M016"]);

  assert.equal(result.ok, false);
  assert.deepEqual(result.errors.map((error) => error.id), ["M016"]);
  assert.match(result.errors[0].reasons.join("\n"), /slices=1/);
  assert.match(result.errors[0].reasons.join("\n"), /tasks=1/);
  assert.match(result.errors[0].reasons.join("\n"), /artifacts=1/);
  assert.ok(getMilestone("M015"), "valid target must remain when a sibling target fails");
  assert.ok(getMilestone("M016"), "invalid target must remain");
});

test("orphan-only discard refuses incoming dependency references", (t) => {
  const base = createProject();
  t.after(() => cleanup(base));
  insertMilestone({ id: "M015", status: "queued" });
  insertMilestone({ id: "M016", status: "queued", depends_on: ["M015"] });

  const result = discardOrphanMilestonesAtomic(base, ["M015"]);

  assert.equal(result.ok, false);
  assert.deepEqual(result.before[0].dependentMilestones, ["M016"]);
  assert.ok(getMilestone("M015"));
});

test("orphan-only discard refuses disk projections and alternate-leaf worktrees", (t) => {
  const base = createProject();
  t.after(() => cleanup(base));
  insertMilestone({ id: "M015", status: "queued" });
  mkdirSync(join(base, ".gsd", "milestones", "M015"), { recursive: true });
  mkdirSync(join(base, ".gsd-worktrees"), { recursive: true });
  execFileSync("git", ["worktree", "add", "-q", "-b", "milestone/M015", join(base, ".gsd-worktrees", "alternate-leaf")], { cwd: base });

  const result = discardOrphanMilestonesAtomic(base, ["M015"]);

  assert.equal(result.ok, false);
  assert.equal(result.before[0].diskProjection, true);
  assert.equal(result.before[0].worktree, true);
  assert.equal(result.before[0].milestoneBranch, true);
  assert.ok(getMilestone("M015"));
});

test("orphan-only discard refuses slice worktrees without canonical slice rows", (t) => {
  const base = createProject();
  t.after(() => cleanup(base));
  insertMilestone({ id: "M015", status: "queued" });
  mkdirSync(join(base, ".gsd-worktrees"), { recursive: true });
  execFileSync("git", [
    "worktree",
    "add",
    "-q",
    "-b",
    "slice/M015/S01",
    join(base, ".gsd-worktrees", "M015-S01"),
  ], { cwd: base });

  const result = discardOrphanMilestonesAtomic(base, ["M015"]);

  assert.equal(result.ok, false);
  assert.equal(result.before[0].worktree, true);
  assert.deepEqual(result.before[0].relatedRows, {});
  assert.ok(getMilestone("M015"));
});

test("orphan-only discard refuses active leases and canonical workers", (t) => {
  const base = createProject();
  t.after(() => cleanup(base));
  insertMilestone({ id: "M015", status: "queued" });
  const now = new Date().toISOString();
  getDb().prepare(
    `INSERT INTO workers (
      worker_id, host, pid, started_at, version, last_heartbeat_at, status, project_root_realpath
    ) VALUES (
      'worker-1', 'localhost', :pid, :now, 'test', :now, 'active', :root
    )`,
  ).run({ ":pid": process.pid, ":now": now, ":root": base });
  getDb().prepare(
    `INSERT INTO milestone_leases (
      milestone_id, worker_id, fencing_token, acquired_at, expires_at, status
    ) VALUES ('M015', 'worker-1', 1, :now, :now, 'held')`,
  ).run({ ":now": now });

  const result = discardOrphanMilestonesAtomic(base, ["M015"]);

  assert.equal(result.ok, false);
  assert.deepEqual(result.before[0].activeWorkers, ["worker-1"]);
  assert.equal(result.before[0].relatedRows.milestone_leases, 1);
  assert.ok(getMilestone("M015"));
});

test("orphan-only discard refuses a parallel worker status before lease acquisition", (t) => {
  const base = createProject();
  t.after(() => cleanup(base));
  insertMilestone({ id: "M015", status: "queued" });
  mkdirSync(join(base, ".gsd", "parallel"), { recursive: true });
  writeFileSync(join(base, ".gsd", "parallel", "M015.status.json"), JSON.stringify({
    milestoneId: "M015",
    pid: process.pid,
    state: "running",
    lastHeartbeat: Date.now(),
  }));

  const result = discardOrphanMilestonesAtomic(base, ["M015"]);

  assert.equal(result.ok, false);
  assert.equal(result.before[0].workerStatusFile, true);
  assert.ok(getMilestone("M015"));
});

test("orphan-only discard refuses a live worker recorded only in orchestrator state", (t) => {
  const base = createProject();
  t.after(() => cleanup(base));
  insertMilestone({ id: "M015", status: "queued" });
  writeFileSync(join(base, ".gsd", "orchestrator.json"), JSON.stringify({
    active: true,
    workers: [{
      milestoneId: "M015",
      title: "Reserved milestone",
      pid: process.pid,
      worktreePath: join(base, ".gsd-worktrees", "M015"),
      startedAt: Date.now(),
      state: "running",
      cost: 0,
    }],
    totalCost: 0,
    startedAt: Date.now(),
    configSnapshot: { max_workers: 1 },
  }));

  const result = discardOrphanMilestonesAtomic(base, ["M015"]);

  assert.equal(result.ok, false);
  assert.match(result.before[0].activeWorkers.join("\n"), /orchestrator\.json:M015/);
  assert.ok(getMilestone("M015"));
});

test("/gsd discard confirms and invokes the direct milestone action", async (t) => {
  const base = createProject();
  t.after(() => cleanup(base));
  insertMilestone({ id: "M015", status: "queued" });
  let confirmed = false;
  const notifications: string[] = [];
  const handled = await withCommandCwd(base, () => handleWorkflowCommand("discard M015", {
    cwd: base,
    ui: {
      confirm: async () => {
        confirmed = true;
        return true;
      },
      notify: (message: string) => notifications.push(message),
    },
  } as any, {} as any));

  assert.equal(handled, true);
  assert.equal(confirmed, true);
  assert.equal(getMilestone("M015"), null);
  assert.ok(notifications.includes("Discarded M015."));
});
