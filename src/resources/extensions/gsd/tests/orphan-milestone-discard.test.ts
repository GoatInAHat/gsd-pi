// Project/App: gsd-pi
// File Purpose: Safety contract for selectively discarding DB-only milestone reservations.

import { afterEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { discardOrphanMilestoneReservations } from "../orphan-milestone-discard.ts";
import {
  _getAdapter,
  closeDatabase,
  getMilestone,
  insertMilestone,
  insertSlice,
  openDatabase,
} from "../gsd-db.ts";

function createFixture(): string {
  const base = mkdtempSync(join(tmpdir(), "gsd-orphan-discard-"));
  mkdirSync(join(base, ".gsd", "milestones"), { recursive: true });
  writeFileSync(join(base, "README.md"), "# fixture\n", "utf8");
  execFileSync("git", ["init"], { cwd: base, stdio: "ignore" });
  execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: base });
  execFileSync("git", ["config", "user.name", "Test"], { cwd: base });
  execFileSync("git", ["add", "."], { cwd: base });
  execFileSync("git", ["commit", "-m", "fixture"], { cwd: base, stdio: "ignore" });
  execFileSync("git", ["branch", "-M", "main"], { cwd: base });
  openDatabase(join(base, ".gsd", "gsd.db"));
  return base;
}

describe("orphan-only milestone discard (#1548)", () => {
  let base = "";

  afterEach(() => {
    try { closeDatabase(); } catch { /* ignore */ }
    if (base) rmSync(base, { recursive: true, force: true });
    base = "";
  });

  test("deletes multiple reservation-only rows and records a tombstone atomically", async () => {
    base = createFixture();
    insertMilestone({ id: "M001", status: "queued" });
    insertMilestone({ id: "M002", title: "M002", status: "queued" });

    const result = await discardOrphanMilestoneReservations(base, ["M001", "M002"]);

    assert.equal(result.ok, true);
    assert.deepEqual(result.discardedIds, ["M001", "M002"]);
    assert.equal(result.after?.canonicalQueryVerified, true);
    assert.deepEqual(result.after?.remainingMilestoneIds, []);
    assert.equal(getMilestone("M001"), null);
    assert.equal(getMilestone("M002"), null);

    const tombstone = _getAdapter()!.prepare(
      "SELECT payload_json FROM audit_events WHERE type = 'orphan-milestone-reservations-discarded'",
    ).get();
    assert.ok(tombstone, "discard should leave an audit record outside the active registry");
    assert.deepEqual(JSON.parse(String(tombstone["payload_json"])).milestoneIds, ["M001", "M002"]);
  });

  test("a historical tombstone does not block discarding a later reservation with the same ID", async () => {
    base = createFixture();
    insertMilestone({ id: "M001", status: "queued" });
    assert.equal((await discardOrphanMilestoneReservations(base, ["M001"])).ok, true);
    insertMilestone({ id: "M001", status: "queued" });

    const second = await discardOrphanMilestoneReservations(base, ["M001"]);

    assert.equal(second.ok, true);
    assert.equal(getMilestone("M001"), null);
    const tombstones = _getAdapter()!.prepare(
      "SELECT COUNT(*) AS count FROM audit_events WHERE type = 'orphan-milestone-reservations-discarded'",
    ).get();
    assert.equal(Number(tombstones?.["count"]), 2);
  });

  test("preflights every ID and deletes none when one target has a slice", async () => {
    base = createFixture();
    insertMilestone({ id: "M001", status: "queued" });
    insertMilestone({ id: "M002", status: "queued" });
    insertSlice({ milestoneId: "M002", id: "S01", title: "Planned", status: "pending" });

    const result = await discardOrphanMilestoneReservations(base, ["M001", "M002"]);

    assert.equal(result.ok, false);
    assert.ok(result.before.find((entry) => entry.id === "M002")?.dbSurfaces.some((surface) => surface.table === "slices"));
    assert.ok(getMilestone("M001"), "clean target must survive a failed batch preflight");
    assert.ok(getMilestone("M002"), "blocked target must survive a failed batch preflight");
  });

  test("refuses a contentless row whose status is not a queued reservation", async () => {
    base = createFixture();
    insertMilestone({ id: "M001", status: "active" });

    const result = await discardOrphanMilestoneReservations(base, ["M001"]);

    assert.equal(result.ok, false);
    assert.match(result.before[0]?.blockers.join("\n") ?? "", /unexpected milestone status: active/);
    assert.ok(getMilestone("M001"));
  });

  test("fails closed when the bounded projection scan encounters too many files", async () => {
    base = createFixture();
    insertMilestone({ id: "M001", status: "queued" });
    for (let index = 0; index < 1025; index++) {
      writeFileSync(join(base, ".gsd", `projection-${String(index).padStart(4, "0")}.md`), "# projection\n", "utf8");
    }

    const result = await discardOrphanMilestoneReservations(base, ["M001"]);

    assert.equal(result.ok, false);
    assert.match(result.before[0]?.blockers.join("\n") ?? "", /projection tree exceeds 1024 Markdown files/);
    assert.ok(getMilestone("M001"));
  });

  test("fails closed on a symlinked projection", { skip: process.platform === "win32" }, async () => {
    base = createFixture();
    insertMilestone({ id: "M001", status: "queued" });
    writeFileSync(join(base, "projection-source.md"), "# M001 context\n", "utf8");
    mkdirSync(join(base, ".planning"), { recursive: true });
    symlinkSync(join(base, "projection-source.md"), join(base, ".planning", "M001-CONTEXT.md"));

    const result = await discardOrphanMilestoneReservations(base, ["M001"]);

    assert.equal(result.ok, false);
    assert.match(result.before[0]?.blockers.join("\n") ?? "", /unsupported symbolic link/);
    assert.ok(getMilestone("M001"));
  });

  test("fails closed on dependency references and future milestone-keyed tables", async () => {
    base = createFixture();
    insertMilestone({ id: "M001", status: "queued" });
    insertMilestone({ id: "M002", title: "Dependent", status: "pending", depends_on: ["M001"] });
    _getAdapter()!.exec("CREATE TABLE future_milestone_surface (reservation_key TEXT NOT NULL, note TEXT NOT NULL)");
    _getAdapter()!.prepare(
      "INSERT INTO future_milestone_surface (reservation_key, note) VALUES (:mid, 'future')",
    ).run({ ":mid": "M001" });

    const result = await discardOrphanMilestoneReservations(base, ["M001"]);
    const before = result.before[0]!;

    assert.equal(result.ok, false);
    assert.deepEqual(before.dependentMilestoneIds, ["M002"]);
    assert.ok(before.dbSurfaces.some((surface) => surface.table === "future_milestone_surface"));
    assert.deepEqual(before.unexpectedDbTables, ["future_milestone_surface"]);
    assert.match(before.blockers.join("\n"), /dependent milestones reference target/);
    assert.match(before.blockers.join("\n"), /unexpected canonical DB tables/);
    assert.ok(getMilestone("M001"));
  });

  test("refuses canonical and projected PROJECT.md references plus worker status", async () => {
    base = createFixture();
    insertMilestone({ id: "M001-abc123", status: "queued" });
    insertMilestone({ id: "M002", status: "queued" });
    insertMilestone({ id: "M003", status: "queued" });
    insertMilestone({ id: "M004", status: "queued" });
    const project = [
      "# Project",
      "",
      "## Milestone Sequence",
      "",
      "- [ ] M001: Canonical — Reserved stage",
    ].join("\n");
    _getAdapter()!.prepare(
      `INSERT INTO artifacts (path, artifact_type, full_content, imported_at)
       VALUES ('PROJECT.md', 'PROJECT', :content, :now)`,
    ).run({ ":content": project, ":now": new Date().toISOString() });
    writeFileSync(join(base, ".gsd", "PROJECT.md"), project, "utf8");
    writeFileSync(join(base, ".gsd", "STATE.md"), "**Active Milestone:** M002: Projected\n", "utf8");
    mkdirSync(join(base, ".audits", "legacy", "nested"), { recursive: true });
    writeFileSync(join(base, ".audits", "legacy", "nested", "M004-AUDIT.md"), "# M004: Legacy projection\n", "utf8");
    mkdirSync(join(base, ".gsd", "parallel"), { recursive: true });
    writeFileSync(
      join(base, ".gsd", "parallel", "M003.status.json"),
      JSON.stringify({ milestoneId: "M003", pid: process.pid, state: "running" }),
      "utf8",
    );

    const result = await discardOrphanMilestoneReservations(base, ["M001-abc123", "M002", "M003", "M004"]);

    assert.equal(result.ok, false);
    assert.equal(result.before.find((entry) => entry.id === "M001-abc123")?.projectArtifactReference, true);
    assert.deepEqual(result.before.find((entry) => entry.id === "M002")?.disk.projectionFiles, [".gsd/STATE.md"]);
    assert.equal(result.before.find((entry) => entry.id === "M003")?.disk.workerStatus, true);
    assert.deepEqual(result.before.find((entry) => entry.id === "M004")?.disk.projectionFiles, [".audits/legacy/nested/M004-AUDIT.md"]);
    assert.match(result.before.find((entry) => entry.id === "M001-abc123")?.blockers.join("\n") ?? "", /canonical PROJECT\.md artifact/);
    assert.match(result.before.find((entry) => entry.id === "M002")?.blockers.join("\n") ?? "", /disk projections reference milestone/);
    assert.match(result.before.find((entry) => entry.id === "M003")?.blockers.join("\n") ?? "", /worker status exists/);
    assert.match(result.before.find((entry) => entry.id === "M004")?.blockers.join("\n") ?? "", /disk projections reference milestone/);
    assert.ok(getMilestone("M001-abc123"));
    assert.ok(getMilestone("M002"));
    assert.ok(getMilestone("M003"));
    assert.ok(getMilestone("M004"));
  });

  test("refuses canonical artifacts and an active worker lease", async () => {
    base = createFixture();
    insertMilestone({ id: "M001", status: "queued" });
    insertMilestone({ id: "M002", status: "queued" });
    const now = new Date().toISOString();
    _getAdapter()!.prepare(
      `INSERT INTO artifacts (path, artifact_type, milestone_id, full_content, imported_at)
       VALUES ('reserved-context', 'context', 'M001', '# context', :now)`,
    ).run({ ":now": now });
    _getAdapter()!.prepare(
      `INSERT INTO workers (worker_id, host, pid, started_at, version, last_heartbeat_at, status, project_root_realpath)
       VALUES ('worker-1', 'localhost', 1, :now, 'test', :now, 'active', :base)`,
    ).run({ ":now": now, ":base": base });
    _getAdapter()!.prepare(
      `INSERT INTO milestone_leases (milestone_id, worker_id, fencing_token, acquired_at, expires_at, status)
       VALUES ('M002', 'worker-1', 1, :now, :expires, 'held')`,
    ).run({ ":now": now, ":expires": new Date(Date.now() + 60_000).toISOString() });

    const result = await discardOrphanMilestoneReservations(base, ["M001", "M002"]);

    assert.equal(result.ok, false);
    assert.ok(result.before.find((entry) => entry.id === "M001")?.dbSurfaces.some((surface) => surface.table === "artifacts"));
    assert.ok(result.before.find((entry) => entry.id === "M002")?.dbSurfaces.some((surface) => surface.table === "milestone_leases"));
    assert.ok(getMilestone("M001"));
    assert.ok(getMilestone("M002"));
  });

  test("refuses a milestone directory, worktree residue, or milestone branch", async () => {
    base = createFixture();
    insertMilestone({ id: "M001", status: "queued" });
    insertMilestone({ id: "M002", status: "queued" });
    insertMilestone({ id: "M003", status: "queued" });
    mkdirSync(join(base, ".gsd", "milestones", "M001"), { recursive: true });
    mkdirSync(join(base, ".gsd-worktrees", "M002"), { recursive: true });
    execFileSync("git", ["branch", "milestone/M003"], { cwd: base });

    const result = await discardOrphanMilestoneReservations(base, ["M001", "M002", "M003"]);

    assert.equal(result.ok, false);
    assert.equal(result.before.find((entry) => entry.id === "M001")?.disk.milestoneDirectory, true);
    assert.equal(result.before.find((entry) => entry.id === "M002")?.disk.worktree, true);
    assert.equal(result.before.find((entry) => entry.id === "M003")?.git.milestoneBranch, true);
    assert.match(result.before.find((entry) => entry.id === "M001")?.blockers.join("\n") ?? "", /milestone directory exists/);
    assert.match(result.before.find((entry) => entry.id === "M002")?.blockers.join("\n") ?? "", /milestone worktree exists/);
    assert.match(result.before.find((entry) => entry.id === "M003")?.blockers.join("\n") ?? "", /milestone branch exists/);
    assert.ok(getMilestone("M001"));
    assert.ok(getMilestone("M002"));
    assert.ok(getMilestone("M003"));
  });
});
