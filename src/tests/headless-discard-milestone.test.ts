import { after, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  _getAdapter,
  closeDatabase,
  getMilestone,
  insertMilestone,
  openDatabase,
} from "../resources/extensions/gsd/gsd-db.ts";
const previousAgentDir = process.env.GSD_AGENT_DIR;
process.env.GSD_AGENT_DIR = join(tmpdir(), `gsd-headless-discard-missing-agent-${process.pid}`);
const { handleDiscardMilestone } = await import("../headless-discard-milestone.ts");
after(() => {
  if (previousAgentDir === undefined) delete process.env.GSD_AGENT_DIR;
  else process.env.GSD_AGENT_DIR = previousAgentDir;
});

function makeFixture(t: test.TestContext): string {
  const base = mkdtempSync(join(tmpdir(), "gsd-headless-discard-"));
  mkdirSync(join(base, ".gsd"), { recursive: true });
  openDatabase(join(base, ".gsd", "gsd.db"));
  insertMilestone({ id: "M001", status: "queued" });
  closeDatabase();
  t.after(() => {
    closeDatabase();
    rmSync(base, { recursive: true, force: true });
  });
  return base;
}

test("headless discard-milestone requires --orphan-only and leaves state unchanged", async (t) => {
  const base = makeFixture(t);
  const output: string[] = [];

  const result = await handleDiscardMilestone(base, ["M001"], (text) => output.push(text));

  assert.equal(result.exitCode, 1);
  const payload = JSON.parse(output.join(""));
  assert.equal(payload.ok, false);
  assert.equal(payload.error.code, "orphan_only_required");
  openDatabase(join(base, ".gsd", "gsd.db"));
  assert.ok(getMilestone("M001"));
});

test("headless discard-milestone emits structured before/after JSON", async (t) => {
  const base = makeFixture(t);
  const output: string[] = [];

  const result = await handleDiscardMilestone(
    base,
    ["M001", "--orphan-only"],
    (text) => output.push(text),
  );

  assert.equal(result.exitCode, 0);
  const payload = JSON.parse(output.join(""));
  assert.equal(payload.ok, true);
  assert.deepEqual(payload.deleted, ["M001"]);
  assert.equal(payload.before[0].canonical.exists, true);
  assert.equal(payload.after[0].canonical.exists, false);
  assert.deepEqual(payload.after[0].refusalReasons, []);
  openDatabase(join(base, ".gsd", "gsd.db"));
  assert.equal(getMilestone("M001"), null);
});

test("headless discard-milestone preserves postflight failure snapshots", async (t) => {
  const base = makeFixture(t);
  openDatabase(join(base, ".gsd", "gsd.db"));
  _getAdapter()!.exec(`
    CREATE TRIGGER inject_artifact_after_milestone_delete
    AFTER DELETE ON milestones
    WHEN OLD.id = 'M001'
    BEGIN
      INSERT INTO artifacts (path, artifact_type, milestone_id, full_content)
      VALUES ('milestones/M001/CONTEXT.md', 'context', OLD.id, '# Concurrent context');
    END
  `);
  closeDatabase();
  const output: string[] = [];

  const result = await handleDiscardMilestone(
    base,
    ["M001", "--orphan-only"],
    (text) => output.push(text),
  );

  assert.equal(result.exitCode, 1);
  const payload = JSON.parse(output.join(""));
  assert.equal(payload.error.code, "orphan_postflight_failed");
  assert.equal(payload.before[0].canonical.exists, true);
  assert.equal(payload.after[0].canonical.exists, false);
  assert.equal(payload.after[0].databaseRows.artifacts, 1);
  openDatabase(join(base, ".gsd", "gsd.db"));
  assert.ok(getMilestone("M001"), "the canonical deletion must roll back");
});
