import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

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
  openDatabaseByWorkspace,
} from "../gsd-db.ts";
import { createWorkspace } from "../workspace.ts";

const V113_SCHEMA_V46_FIXTURE = join(
  dirname(fileURLToPath(import.meta.url)),
  "__fixtures__/legacy-import-corpus/v1/lifecycle-truth-matrix/source/.gsd/gsd.db",
);

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

  const db = _getAdapter();
  assert.ok(db);
  const triggers = db.prepare("SELECT name, sql FROM sqlite_master WHERE type = 'trigger'").all();
  db.exec("PRAGMA foreign_keys = OFF");
  for (const trigger of triggers) db.exec(`DROP TRIGGER ${String(trigger["name"])}`);
  db.exec(`
    INSERT INTO workflow_execution_attempts (
      attempt_id, project_id, lifecycle_id, attempt_number, attempt_state,
      claimed_at, ended_at, claim_operation_id, claim_project_revision,
      claim_authority_epoch, settle_operation_id, settle_project_revision,
      settle_authority_epoch, settle_outcome
    ) VALUES (
      'attempt-1678', 'project-1678', 'lifecycle-1678', 1, 'settled',
      '2026-01-01T00:00:00.000Z', '2026-01-01T00:01:00.000Z', 'claim-1678', 1,
      0, 'settle-1678', 2, 0, 'succeeded'
    );
    INSERT INTO workflow_attempt_results (
      result_id, project_id, lifecycle_id, attempt_id, outcome, created_at,
      operation_id, project_revision, authority_epoch
    ) VALUES (
      'result-1678', 'project-1678', 'lifecycle-1678', 'attempt-1678', 'succeeded',
      '2026-01-01T00:01:00.000Z', 'settle-1678', 2, 0
    );
    INSERT INTO workflow_technical_verdicts (
      verdict_id, project_id, criterion_id, lifecycle_id, attempt_id,
      tested_source_revision, verdict, policy_id, policy_version, rationale,
      created_at, operation_id, project_revision, authority_epoch
    ) VALUES (
      'verdict-1678', 'project-1678', 'criterion-1678', 'lifecycle-1678', 'attempt-1678',
      'revision-1678', 'pass', 'policy-1678', '1', 'release fixture evidence',
      '2026-01-01T00:02:00.000Z', 'verify-1678', 3, 0
    );
    INSERT INTO workflow_verification_evidence (
      evidence_id, project_id, verdict_id, criterion_id, lifecycle_id, attempt_id,
      evidence_class, command_or_tool, working_directory, started_at, ended_at,
      exit_code, observation, source_revision, observed_project_revision,
      content_hash, durable_output_ref, environment_json, created_at,
      operation_id, project_revision, authority_epoch
    ) VALUES (
      'evidence-1678', 'project-1678', 'verdict-1678', 'criterion-1678',
      'lifecycle-1678', 'attempt-1678', 'command', 'pnpm test', '.',
      '2026-01-01T00:01:00.000Z', '2026-01-01T00:02:00.000Z', 0, 'passed',
      'revision-1678', 2,
      'sha256:0000000000000000000000000000000000000000000000000000000000000000',
      'evidence/1678.txt', '{"runner":"fixture"}', '2026-01-01T00:02:00.000Z',
      'verify-1678', 3, 0
    );
  `);
  for (const trigger of triggers) db.exec(String(trigger["sql"]));
  db.exec("PRAGMA foreign_keys = ON");
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

function loadV113Fixture(dbPath: string): void {
  copyFileSync(V113_SCHEMA_V46_FIXTURE, dbPath);
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

  loadV113Fixture(dbPath);
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

test("#1678: cached workspace activation repairs missing liveness schema", (t) => {
  const first = createProject();
  const second = createProject();
  t.after(() => {
    closeDatabase();
    rmSync(first.basePath, { recursive: true, force: true });
    rmSync(second.basePath, { recursive: true, force: true });
  });

  const firstWorkspace = createWorkspace(first.basePath);
  const secondWorkspace = createWorkspace(second.basePath);
  assert.equal(openDatabaseByWorkspace(firstWorkspace), true);
  dropLivenessSchema();
  assert.equal(openDatabaseByWorkspace(secondWorkspace), true);
  assert.equal(openDatabaseByWorkspace(firstWorkspace), true);
  assert.deepEqual(schemaObjects(), expectedSchemaObjects());
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
