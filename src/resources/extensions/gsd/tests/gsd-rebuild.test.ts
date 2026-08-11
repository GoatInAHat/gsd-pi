import test from "node:test";
import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { handleRebuild } from "../commands-maintenance.ts";
import { getCurrentProjectStateVersion } from "../markdown-renderer.ts";
import { preserveProjectionChanges } from "../projection-worker.ts";
import { saveDecisionToDb } from "../db-writer.ts";
import { _setProjectionMutationBeforeClaimForTest } from "../database-maintenance-fence.ts";
import {
  closeDatabase,
  getTask,
  insertArtifact,
  insertMilestone,
  insertSlice,
  insertTask,
  openDatabase,
  setSliceSummaryMd,
} from "../gsd-db.ts";
import { invalidateStateCache } from "../state.ts";

type Note = { message: string; kind: string };

function makeBase(): string {
  const base = mkdtempSync(join(tmpdir(), "gsd-rebuild-"));
  mkdirSync(join(base, ".gsd", "milestones", "M001", "slices", "S01", "tasks"), {
    recursive: true,
  });
  return base;
}

function cleanup(base: string): void {
  closeDatabase();
  invalidateStateCache();
  rmSync(base, { recursive: true, force: true });
}

function makeCtx(): { ctx: any; notes: Note[] } {
  const notes: Note[] = [];
  return {
    ctx: {
      ui: {
        notify: (message: string, kind: string) => notes.push({ message, kind }),
      },
    },
    notes,
  };
}

function seedOpenTask(): void {
  insertMilestone({ id: "M001", title: "Milestone", status: "active" });
  insertSlice({
    id: "S01",
    milestoneId: "M001",
    title: "Slice",
    status: "in_progress",
    risk: "low",
    depends: [],
  });
  insertTask({
    id: "T01",
    sliceId: "S01",
    milestoneId: "M001",
    title: "Task",
    status: "pending",
  });
}

function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else {
        out.push(full);
      }
    }
  }
  return out.sort();
}

test("handleRebuild quarantines stale completion projections without mutating DB state", async () => {
  const base = makeBase();
  try {
    openDatabase(join(base, ".gsd", "gsd.db"));
    seedOpenTask();

    const summaryPath = join(
      base,
      ".gsd",
      "milestones",
      "M001",
      "slices",
      "S01",
      "tasks",
      "T01-SUMMARY.md",
    );
    writeFileSync(summaryPath, "# T01 Summary\n\nDisk-only completion.\n", "utf-8");

    const { ctx, notes } = makeCtx();
    await handleRebuild(ctx, base, "markdown");

    assert.equal(existsSync(summaryPath), false, "stale SUMMARY projection should be moved aside");
    const task = getTask("M001", "S01", "T01");
    assert.equal(task?.status, "pending", "DB task status remains authoritative");
    assert.equal(task?.full_summary_md, "", "disk summary must not be imported into DB");

    const quarantined = listFiles(join(base, ".gsd", "quarantine", "projections"));
    assert.equal(quarantined.length, 1);
    assert.match(readFileSync(quarantined[0]!, "utf-8"), /Disk-only completion/);
    assert.match(notes.at(-1)?.message ?? "", /Quarantined:\s+1/);
    assert.equal(notes.at(-1)?.kind, "success");
  } finally {
    cleanup(base);
  }
});

test("handleRebuild re-renders missing task summary projections from DB", async () => {
  const base = makeBase();
  try {
    openDatabase(join(base, ".gsd", "gsd.db"));
    seedOpenTask();
    insertTask({
      id: "T01",
      sliceId: "S01",
      milestoneId: "M001",
      title: "Task",
      status: "complete",
      oneLiner: "Task complete",
      narrative: "Finished through the DB.",
      verificationResult: "passed",
      fullSummaryMd: "# T01 Summary\n\nRendered from DB.\n",
    });

    const summaryPath = join(
      base,
      ".gsd",
      "milestones",
      "M001",
      "slices",
      "S01",
      "tasks",
      "T01-SUMMARY.md",
    );
    rmSync(summaryPath, { force: true });

    const { ctx, notes } = makeCtx();
    await handleRebuild(ctx, base);

    assert.equal(existsSync(summaryPath), true, "missing SUMMARY projection should be regenerated");
    // T008: rendered projections carry the state-version stamp line; assert the
    // exact stamped bytes (markdown-renderer.test.ts pattern) rather than
    // stripping the stamp, keeping this a byte-exact re-render check.
    const { revision, authorityEpoch } = getCurrentProjectStateVersion();
    assert.equal(
      readFileSync(summaryPath, "utf-8"),
      `# T01 Summary\n\nRendered from DB.\n<!-- gsd:state-version=${revision}:${authorityEpoch} -->\n`,
    );
    assert.match(notes.at(-1)?.message ?? "", /rebuilt markdown projections from the canonical DB/);
    assert.match(notes.at(-1)?.message ?? "", /Quarantined:\s+0/);
  } finally {
    cleanup(base);
  }
});

test("handleRebuild preserves an edited completed summary before restoring the DB projection", async (t) => {
  const base = makeBase();
  t.after(() => cleanup(base));
  openDatabase(join(base, ".gsd", "gsd.db"));
  seedOpenTask();
  insertTask({
    id: "T01",
    sliceId: "S01",
    milestoneId: "M001",
    title: "Task",
    status: "complete",
    oneLiner: "Task complete",
    narrative: "Canonical narrative.",
    verificationResult: "passed",
    fullSummaryMd: "# T01 Summary\n\nCanonical summary.\n",
  });

  const summaryPath = join(
    base,
    ".gsd",
    "milestones",
    "M001",
    "slices",
    "S01",
    "tasks",
    "T01-SUMMARY.md",
  );
  const { ctx } = makeCtx();
  await handleRebuild(ctx, base, "markdown");
  writeFileSync(summaryPath, "# T01 Summary\n\nExternally edited evidence.\n", "utf-8");

  await handleRebuild(ctx, base, "markdown");

  const quarantined = listFiles(join(base, ".gsd", "quarantine", "projections"));
  assert.equal(quarantined.length, 1);
  assert.equal(
    readFileSync(quarantined[0]!, "utf-8"),
    "# T01 Summary\n\nExternally edited evidence.\n",
  );
  assert.match(readFileSync(summaryPath, "utf-8"), /Canonical summary/);
});

test("handleRebuild preserves every unbaselined renderer-owned edit", async (t) => {
  const base = makeBase();
  t.after(() => cleanup(base));
  openDatabase(join(base, ".gsd", "gsd.db"));
  insertMilestone({ id: "M001", title: "Milestone", status: "active" });
  insertSlice({
    id: "S01",
    milestoneId: "M001",
    title: "Slice",
    status: "complete",
    risk: "low",
    depends: [],
  });
  setSliceSummaryMd(
    "M001",
    "S01",
    "# Canonical slice summary\n",
    "# Canonical slice UAT\n",
  );
  insertTask({
    id: "T01",
    sliceId: "S01",
    milestoneId: "M001",
    title: "Task",
    status: "complete",
    fullSummaryMd: "# Canonical task summary\n",
  });
  insertArtifact({
    path: "milestones/M001/M001-CONTEXT.md",
    artifact_type: "CONTEXT",
    milestone_id: "M001",
    slice_id: null,
    task_id: null,
    full_content: "# Canonical stored context\n",
  });
  await saveDecisionToDb({
    scope: "architecture",
    decision: "Use canonical projection intent",
    choice: "Database authority",
    rationale: "Preserve durable state",
  }, base);

  const { ctx } = makeCtx();
  await handleRebuild(ctx, base, "markdown");
  const editedFiles = new Map<string, string>([
    [
      join(base, ".gsd", "milestones", "M001", "slices", "S01", "tasks", "T01-SUMMARY.md"),
      "# External task summary\n",
    ],
    [
      join(base, ".gsd", "milestones", "M001", "slices", "S01", "S01-UAT.md"),
      "# External slice UAT\n",
    ],
    [
      join(base, ".gsd", "milestones", "M001", "M001-CONTEXT.md"),
      "# External stored context\n",
    ],
    [join(base, ".gsd", "DECISIONS.md"), "# External decisions\n"],
  ]);
  for (const [path, content] of editedFiles) writeFileSync(path, content, "utf-8");
  rmSync(join(base, ".gsd", ".compat.json"), { force: true });

  await handleRebuild(ctx, base, "markdown");

  const quarantined = listFiles(join(base, ".gsd", "quarantine", "projections"))
    .map((path) => readFileSync(path, "utf-8"));
  assert.deepEqual(new Set(quarantined), new Set(editedFiles.values()));
  for (const [path, edited] of editedFiles) {
    assert.notEqual(readFileSync(path, "utf-8"), edited);
  }
});

test("trusted marker baselines do not misclassify pending DB renders", async (t) => {
  const base = makeBase();
  t.after(() => cleanup(base));
  openDatabase(join(base, ".gsd", "gsd.db"));
  seedOpenTask();
  const { ctx } = makeCtx();
  await handleRebuild(ctx, base, "markdown");
  const roadmapPath = join(base, ".gsd", "milestones", "M001", "M001-ROADMAP.md");
  const renderedBytes = readFileSync(roadmapPath);
  insertSlice({
    id: "S01",
    milestoneId: "M001",
    title: "Updated canonical slice",
    status: "in_progress",
    risk: "low",
    depends: [],
  });

  const observation = await preserveProjectionChanges(base);

  assert.equal(observation.preserved.length, 0);
  assert.deepEqual(readFileSync(roadmapPath), renderedBytes);
  assert.equal(existsSync(join(base, ".gsd", "quarantine", "projections")), false);
});

test("projection preservation retains observed bytes across a renderer race", async (t) => {
  const base = makeBase();
  t.after(() => {
    _setProjectionMutationBeforeClaimForTest(null);
    cleanup(base);
  });
  openDatabase(join(base, ".gsd", "gsd.db"));
  seedOpenTask();
  const { ctx } = makeCtx();
  await handleRebuild(ctx, base, "markdown");
  const roadmapPath = join(base, ".gsd", "milestones", "M001", "M001-ROADMAP.md");
  const canonicalBytes = readFileSync(roadmapPath);
  const editedBytes = Buffer.from("# External roadmap evidence\n");
  writeFileSync(roadmapPath, editedBytes);
  _setProjectionMutationBeforeClaimForTest(() => {
    writeFileSync(roadmapPath, canonicalBytes);
  });

  const observation = await preserveProjectionChanges(base);

  assert.equal(observation.preserved.length, 1);
  assert.deepEqual(readFileSync(roadmapPath), canonicalBytes);
  assert.deepEqual(
    readFileSync(observation.preserved[0]!.quarantinePath),
    editedBytes,
  );
});

test("handleRebuild database target is reserved and does not import markdown", async () => {
  const base = makeBase();
  try {
    openDatabase(join(base, ".gsd", "gsd.db"));
    seedOpenTask();

    const summaryPath = join(
      base,
      ".gsd",
      "milestones",
      "M001",
      "slices",
      "S01",
      "tasks",
      "T01-SUMMARY.md",
    );
    writeFileSync(summaryPath, "# T01 Summary\n\nShould not import.\n", "utf-8");

    const { ctx, notes } = makeCtx();
    await handleRebuild(ctx, base, "database");

    assert.equal(existsSync(summaryPath), true, "reserved DB rebuild must not move projection files");
    const task = getTask("M001", "S01", "T01");
    assert.equal(task?.status, "pending", "reserved DB rebuild must not mutate task status");
    assert.equal(task?.full_summary_md, "", "reserved DB rebuild must not import markdown");
    assert.match(notes.at(-1)?.message ?? "", /reserved/);
    assert.match(notes.at(-1)?.message ?? "", /\/gsd recover/);
    assert.equal(notes.at(-1)?.kind, "warning");
  } finally {
    cleanup(base);
  }
});
