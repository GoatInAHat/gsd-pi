import assert from "node:assert/strict";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  MAX_ARTIFACT_VERIFICATION_RETRIES,
  postUnitPreVerification,
  type PostUnitContext,
} from "../auto-post-unit.ts";
import { AutoSession } from "../auto/session.ts";
import {
  closeDatabase,
  insertMilestone,
  insertSlice,
  insertTask,
  openDatabase,
} from "../gsd-db.ts";
import { cleanup, makeTempRepo } from "./test-utils.ts";

function createTaskContext(
  basePath: string,
  pauseCalls: string[],
  notifications: string[] = [],
): PostUnitContext {
  const session = new AutoSession();
  session.active = true;
  session.basePath = basePath;
  session.currentUnit = {
    type: "execute-task",
    id: "M001/S01/T01",
    startedAt: Date.now(),
  };

  return {
    s: session,
    ctx: { ui: { notify: (message: string) => notifications.push(message) } } as unknown as PostUnitContext["ctx"],
    pi: {} as PostUnitContext["pi"],
    buildSnapshotOpts: () => ({}),
    lockBase: () => basePath,
    stopAuto: async () => {},
    pauseAuto: async () => {
      pauseCalls.push("pause");
    },
    updateProgressWidget: () => {},
  };
}

function scaffoldDbBackedTask(): string {
  closeDatabase();
  const basePath = makeTempRepo("gsd-post-unit-task-authority-");
  mkdirSync(join(basePath, ".gsd", "milestones", "M001", "slices", "S01", "tasks"), {
    recursive: true,
  });
  openDatabase(":memory:");
  insertMilestone({ id: "M001", title: "Milestone", status: "active" });
  insertSlice({ id: "S01", milestoneId: "M001", title: "Slice", status: "active" });
  insertTask({
    id: "T01",
    milestoneId: "M001",
    sliceId: "S01",
    title: "Task",
    status: "pending",
  });
  return basePath;
}

test("DB-backed execute-task missing an Attempt Result bypasses generic artifact retries", async (t) => {
  const basePath = scaffoldDbBackedTask();
  t.after(() => {
    closeDatabase();
    cleanup(basePath);
  });
  const pauseCalls: string[] = [];
  const pctx = createTaskContext(basePath, pauseCalls);
  pctx.s.pendingVerificationRetry = {
    unitId: "M001/S01/T01",
    failureContext: "Legacy artifact retry",
    attempt: 3,
  };
  pctx.s.verificationRetryCount.set("execute-task:M001/S01/T01", 3);

  const result = await postUnitPreVerification(pctx, {
    skipSettleDelay: true,
    skipWorktreeSync: true,
  });

  assert.equal(result, "continue");
  assert.equal(pctx.s.pendingVerificationRetry, null);
  assert.equal(pctx.s.verificationRetryCount.size, 0);
  assert.deepEqual(pauseCalls, []);
});

test("DB-backed execute-task deterministic errors cannot write an artifact placeholder", async (t) => {
  const basePath = scaffoldDbBackedTask();
  t.after(() => {
    closeDatabase();
    cleanup(basePath);
  });
  const pauseCalls: string[] = [];
  const pctx = createTaskContext(basePath, pauseCalls);
  pctx.s.lastToolInvocationError =
    "gsd_task_complete: Error saving artifact: context write blocked";

  const result = await postUnitPreVerification(pctx, {
    skipSettleDelay: true,
    skipWorktreeSync: true,
  });

  assert.equal(result, "continue");
  assert.equal(
    existsSync(
      join(
        basePath,
        ".gsd",
        "milestones",
        "M001",
        "slices",
        "S01",
        "tasks",
        "T01-SUMMARY.md",
      ),
    ),
    false,
  );
  assert.equal(pctx.s.pendingVerificationRetry, null);
  assert.equal(pctx.s.lastToolInvocationError, null);
  assert.deepEqual(pauseCalls, []);
});

test("DB-backed execute-task evidence blocker is visible and routes a repair retry", async (t) => {
  const basePath = scaffoldDbBackedTask();
  t.after(() => {
    closeDatabase();
    cleanup(basePath);
  });
  const pauseCalls: string[] = [];
  const notifications: string[] = [];
  const pctx = createTaskContext(basePath, pauseCalls, notifications);
  pctx.s.lastToolInvocationError = [
    "gsd_task_complete: EXECUTION_EVIDENCE_MISSING:",
    "expected task-scoped evidence for M001/S01/T01.",
    "Re-run verification for M001/S01/T01 and retry gsd_task_complete.",
  ].join(" ");

  const result = await postUnitPreVerification(pctx, {
    skipSettleDelay: true,
    skipWorktreeSync: true,
  });

  assert.equal(result, "retry");
  assert.equal(pctx.s.pendingVerificationRetry?.unitId, "M001/S01/T01");
  assert.match(pctx.s.pendingVerificationRetry?.failureContext ?? "", /EXECUTION_EVIDENCE_MISSING/);
  assert.match(notifications.join("\n"), /M001\/S01\/T01/);
  assert.deepEqual(pauseCalls, []);
});

test("DB-backed execute-task evidence repair pauses after the retry limit", async (t) => {
  const basePath = scaffoldDbBackedTask();
  t.after(() => {
    closeDatabase();
    cleanup(basePath);
  });
  const pauseCalls: string[] = [];
  const notifications: string[] = [];
  const pctx = createTaskContext(basePath, pauseCalls, notifications);
  pctx.s.verificationRetryCount.set(
    "execute-task:M001/S01/T01",
    MAX_ARTIFACT_VERIFICATION_RETRIES,
  );
  pctx.s.lastToolInvocationError =
    "gsd_task_complete: EXECUTION_EVIDENCE_MISSING for M001/S01/T01";

  const result = await postUnitPreVerification(pctx, {
    skipSettleDelay: true,
    skipWorktreeSync: true,
  });

  assert.equal(result, "dispatched");
  assert.equal(pctx.s.pendingVerificationRetry, null);
  assert.match(notifications.join("\n"), /Pausing auto-mode after 3 repair retries/);
  assert.deepEqual(pauseCalls, ["pause"]);
});
