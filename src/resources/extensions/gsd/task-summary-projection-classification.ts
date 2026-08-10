// Project/App: gsd-pi
// File Purpose: Shared classification for DB-backed Task SUMMARY projections.

import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";

import { stripProjectionStamp } from "./markdown-renderer.js";
import { gsdProjectionRoot, gsdRoot, targetTaskFile } from "./paths.js";
import { isClosedStatus } from "./status-guards.js";
import { readLatestTaskAttempt } from "./task-execution-domain-operation.js";
import { readTaskTechnicalVerdict } from "./task-verification-domain-operation.js";

export type TaskSummaryProjectionClassification =
  | "staged-current"
  | "terminal-current"
  | "stale-or-external"
  | "missing-db-task";

export interface TaskSummaryProjectionArtifact {
  path: string;
  milestoneId: string | null;
  sliceId: string | null;
  taskId: string | null;
  fullContent: string;
}

export interface TaskSummaryProjectionTask {
  milestoneId: string;
  sliceId: string;
  taskId: string;
  status: string;
  fullSummaryMd: string;
}

function artifactPathCandidates(basePath: string, artifactPath: string): string[] {
  if (isAbsolute(artifactPath)) return [resolve(artifactPath)];
  const relativePath = artifactPath
    .replaceAll("\\", "/")
    .replace(/^\.gsd\//, "");
  return [
    resolve(join(gsdProjectionRoot(basePath), relativePath)),
    resolve(join(gsdRoot(basePath), relativePath)),
  ];
}

function hasCanonicalContent(
  basePath: string,
  artifact: TaskSummaryProjectionArtifact,
  task: TaskSummaryProjectionTask,
): boolean {
  if (
    artifact.milestoneId !== task.milestoneId ||
    artifact.sliceId !== task.sliceId ||
    artifact.taskId !== task.taskId
  ) {
    return false;
  }

  const canonicalPath = resolve(targetTaskFile(
    basePath,
    task.milestoneId,
    task.sliceId,
    task.taskId,
    "SUMMARY",
  ));
  if (!artifactPathCandidates(basePath, artifact.path).includes(canonicalPath)) return false;
  if (!existsSync(canonicalPath)) return false;
  if (readFileSync(canonicalPath, "utf8") !== artifact.fullContent) return false;
  return stripProjectionStamp(artifact.fullContent) === stripProjectionStamp(task.fullSummaryMd);
}

export function classifyTaskSummaryProjection(
  basePath: string,
  artifact: TaskSummaryProjectionArtifact,
  task: TaskSummaryProjectionTask | null,
): TaskSummaryProjectionClassification {
  if (!task) return "missing-db-task";
  if (!task.fullSummaryMd || !hasCanonicalContent(basePath, artifact, task)) {
    return "stale-or-external";
  }
  if (isClosedStatus(task.status)) return "terminal-current";
  if (task.status !== "in_progress") return "stale-or-external";

  try {
    const attempt = readLatestTaskAttempt({
      milestoneId: task.milestoneId,
      sliceId: task.sliceId,
      taskId: task.taskId,
    });
    if (attempt?.state !== "settled" || attempt.outcome !== "succeeded") {
      return "stale-or-external";
    }
    if (attempt.nextStage === "verify") return "staged-current";
    if (attempt.nextStage !== "route") return "stale-or-external";

    const verdict = readTaskTechnicalVerdict(attempt.attemptId);
    if (verdict && verdict.verdict !== "pass") return "staged-current";
    return "stale-or-external";
  } catch {
    return "stale-or-external";
  }
}
