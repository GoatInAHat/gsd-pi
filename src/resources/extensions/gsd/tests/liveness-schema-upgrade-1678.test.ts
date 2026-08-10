import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { getOpenWedge } from "../auto-liveness-backstop.ts";
import { runGSDDoctor } from "../doctor.ts";
import {
  _getAdapter,
  closeDatabase,
  insertArtifact,
  insertMilestone,
  insertSlice,
  insertTask,
  insertVerificationEvidence,
  openDatabase,
} from "../gsd-db.ts";

const LIVENESS_OBJECTS = [
  ["table", "liveness_block_signatures"],
  ["table", "liveness_wedge_records"],
  ["index", "idx_liveness_wedges_open"],
] as const;

const PRESERVED_TABLES = [
  "milestones",
  "slices",
  "tasks",
  "verification_evidence",
  "artifacts",
  "workflow_execution_attempts",
  "workflow_attempt_results",
  "workflow_technical_verdicts",
  "workflow_verification_evidence",
] as const;

function createProject(): { basePath: string; dbPath: string } {
  const basePath = mkdtempSync(join(tmpdir(), "gsd-liveness-upgrade-1678-"));
  mkdirSync(join(basePath, ".gsd"), { recursive: true });
  execFileSync("git", ["init"], { cwd: basePath, stdio: "ignore" });
  return { basePath, dbPath: join(basePath, ".gsd", "gsd.db") };
}

function seedWorkflowRows(): void {
  insertMilestone({ id: "M003", title: "Upgrade safety", status: "active" });
  insertSlice({ milestoneId: "M003", id: "S01", title: "Bootstrap", status: "active" });
  insertTask({ milestoneId: "M003", sliceId: "S01", id: "T05", title: "Preserve state", status: "in_progress" });
  insertVerificationEvidence({
    milestoneId: "M003",
    sliceId: "S01",
    taskId: "T05",
    command: "pnpm test",
    exitCode: 0,
    verdict: "pass",
    durationMs: 42,
  });
  insertArtifact({
    path: "milestones/M003/slices/S01/tasks/T05-SUMMARY.md",
    artifact_type: "SUMMARY",
    milestone_id: "M003",
    slice_id: "S01",
    task_id: "T05",
    full_content: "# Preserved upgrade evidence\n",
  });
}

function dropLivenessSchema(): void {
  const db = _getAdapter();
  assert.ok(db);
  db.exec(`
    DROP INDEX IF EXISTS idx_liveness_wedges_open;
    DROP TABLE IF EXISTS liveness_wedge_records;
    DROP TABLE IF EXISTS liveness_block_signatures;
  `);
}

function schemaObjects(): Array<{ type: unknown; name: unknown }> {
  const db = _getAdapter();
  assert.ok(db);
  return db.prepare(`
    SELECT type, name
    FROM sqlite_master
    WHERE name IN (
      'liveness_block_signatures',
      'liveness_wedge_records',
      'idx_liveness_wedges_open'
    )
    ORDER BY type, name
  `).all().map((row) => ({ type: row["type"], name: row["name"] }));
}

function expectedSchemaObjects(): Array<{ type: string; name: string }> {
  return LIVENESS_OBJECTS
    .map(([type, name]) => ({ type, name }))
    .sort((left, right) => left.type.localeCompare(right.type) || left.name.localeCompare(right.name));
}

function snapshotWorkflowRows(): Record<string, Array<Record<string, unknown>>> {
  const db = _getAdapter();
  assert.ok(db);
  return Object.fromEntries(PRESERVED_TABLES.map((table) => [
    table,
    db.prepare(`SELECT * FROM ${table}`).all(),
  ]));
}

function versionStamps(): Record<string, number> {
  const db = _getAdapter();
  assert.ok(db);
  return {
    schemaVersion: Number(db.prepare("SELECT MAX(version) AS value FROM schema_version").get()?.["value"]),
    userVersion: Number(db.prepare("PRAGMA user_version").get()?.["user_version"]),
    applicationId: Number(db.prepare("PRAGMA application_id").get()?.["application_id"]),
  };
}

test("#1678: opening a pre-v1.14 v46 database bootstraps liveness schema without changing workflow state", (t) => {
  const { basePath, dbPath } = createProject();
  t.after(() => {
    closeDatabase();
    rmSync(basePath, { recursive: true, force: true });
  });

  assert.equal(openDatabase(dbPath), true);
  seedWorkflowRows();
  dropLivenessSchema();
  assert.deepEqual(schemaObjects(), [], "fixture must begin without every v1.14 liveness object");
  const rowsBefore = snapshotWorkflowRows();
  const stampsBefore = versionStamps();
  closeDatabase();

  assert.equal(openDatabase(dbPath), true);
  assert.deepEqual(schemaObjects(), expectedSchemaObjects());
  assert.deepEqual(versionStamps(), stampsBefore, "startup repair must not move any version stamp");
  assert.deepEqual(snapshotWorkflowRows(), rowsBefore, "startup repair must not rewrite workflow-owned rows");
  assert.deepEqual(getOpenWedge(basePath), { ok: true, wedge: null });
});

for (const [name, dropStatement] of [
  ["block-signature table", "DROP TABLE liveness_block_signatures"],
  ["wedge table", "DROP TABLE liveness_wedge_records"],
  ["open-wedge index", "DROP INDEX idx_liveness_wedges_open"],
] as const) {
  test(`#1678: startup repairs a schema missing only the ${name}`, (t) => {
    const { basePath, dbPath } = createProject();
    t.after(() => {
      closeDatabase();
      rmSync(basePath, { recursive: true, force: true });
    });

    assert.equal(openDatabase(dbPath), true);
    _getAdapter()!.exec(dropStatement);
    closeDatabase();

    assert.equal(openDatabase(dbPath), true);
    assert.deepEqual(schemaObjects(), expectedSchemaObjects());
  });
}

test("#1678: same-process doctor fix reports and repairs missing liveness schema", async (t) => {
  const { basePath, dbPath } = createProject();
  t.after(() => {
    closeDatabase();
    rmSync(basePath, { recursive: true, force: true });
  });

  assert.equal(openDatabase(dbPath), true);
  seedWorkflowRows();
  dropLivenessSchema();
  const failedRead = getOpenWedge(basePath);
  assert.equal(failedRead.ok, false);
  if (!failedRead.ok) assert.match(failedRead.error, /no such table: liveness_wedge_records/);
  const rowsBefore = snapshotWorkflowRows();

  const report = await runGSDDoctor(basePath, { fix: true });

  assert.ok(
    report.issues.some((issue) => String(issue.code) === "liveness_backstop_schema_missing"),
    "doctor records the schema defect it encountered",
  );
  assert.ok(
    report.fixesApplied.some((fix) => fix.includes("liveness backstop schema")),
    "doctor records the guarded startup repair",
  );
  assert.deepEqual(schemaObjects(), expectedSchemaObjects());
  assert.deepEqual(getOpenWedge(basePath), { ok: true, wedge: null });
  assert.deepEqual(snapshotWorkflowRows(), rowsBefore, "doctor repair must preserve workflow state and completion timestamps");
});
