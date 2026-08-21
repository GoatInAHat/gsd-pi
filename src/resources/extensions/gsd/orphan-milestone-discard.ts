// Project/App: gsd-pi
// File Purpose: Disk/git preflight for bounded DB-only milestone reservation discard.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { invalidateAllCaches } from "./cache.js";
import { getAllMilestones } from "./gsd-db.js";
import { nativeBranchExists } from "./native-git-bridge.js";
import { milestoneDirExists } from "./paths.js";
import { loadQueueOrder } from "./queue-order.js";
import { allWorktreesDirs, listWorktrees } from "./worktree-manager.js";
import {
  discardOrphanMilestoneRows,
  type OrphanMilestoneDiscardResult,
  type OrphanMilestoneExternalState,
} from "./db/writers/orphan-milestone-discard.js";

export type { OrphanMilestoneDiscardResult } from "./db/writers/orphan-milestone-discard.js";

const MAX_PROJECTION_FILES = 1024;

function collectMarkdownProjections(
  root: string,
  relativeRoot: string,
  output: Array<{ path: string; content: string }>,
  depth = 0,
): void {
  if (depth > 12) throw new Error(`projection tree exceeds inspection depth at ${relativeRoot}`);
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const relativePath = `${relativeRoot}/${entry.name}`;
    const absolutePath = join(root, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error(`projection tree contains unsupported symbolic link: ${relativePath}`);
    } else if (entry.isDirectory()) {
      collectMarkdownProjections(absolutePath, relativePath, output, depth + 1);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
      if (statSync(absolutePath).size > 2 * 1024 * 1024) {
        throw new Error(`projection exceeds 2 MiB inspection limit: ${relativePath}`);
      }
      if (output.length >= MAX_PROJECTION_FILES) {
        throw new Error(`projection tree exceeds ${MAX_PROJECTION_FILES} Markdown files`);
      }
      output.push({ path: relativePath, content: readFileSync(absolutePath, "utf8") });
    }
  }
}

/** Inspect every non-DB surface before entering the atomic DB preflight. */
export async function discardOrphanMilestoneReservations(
  basePath: string,
  ids: string[],
): Promise<OrphanMilestoneDiscardResult> {
  const external = new Map<string, OrphanMilestoneExternalState>();
  let worktrees: ReturnType<typeof listWorktrees> = [];
  let worktreeInspectionError: string | null = null;
  let queueOrder: string[] = [];
  let queueInspectionError: string | null = null;
  const rootProjectionContents: Array<{ path: string; content: string }> = [];
  let projectionInspectionError: string | null = null;

  try {
    worktrees = listWorktrees(basePath);
  } catch (error) {
    worktreeInspectionError = `worktree inspection failed: ${error instanceof Error ? error.message : String(error)}`;
  }
  try {
    const loadedQueueOrder = loadQueueOrder(basePath);
    if (loadedQueueOrder === null && existsSync(join(basePath, ".gsd", "QUEUE-ORDER.json"))) {
      queueInspectionError = "queue inspection failed: QUEUE-ORDER.json is unreadable or malformed";
    } else {
      queueOrder = loadedQueueOrder ?? [];
    }
  } catch (error) {
    queueInspectionError = `queue inspection failed: ${error instanceof Error ? error.message : String(error)}`;
  }
  for (const directoryName of [".gsd", ".planning", ".audits"]) {
    const root = join(basePath, directoryName);
    if (!existsSync(root)) continue;
    try {
      collectMarkdownProjections(root, directoryName, rootProjectionContents);
    } catch (error) {
      projectionInspectionError = `root projection inspection failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  for (const id of ids) {
    const inspectionErrors = [worktreeInspectionError, queueInspectionError, projectionInspectionError]
      .filter((value): value is string => value !== null);
    let milestoneBranch = false;
    try {
      milestoneBranch = nativeBranchExists(basePath, `milestone/${id}`);
    } catch (error) {
      inspectionErrors.push(`branch inspection failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    const worktree = worktrees.some((entry) => entry.name === id || entry.branch === `milestone/${id}`)
      || allWorktreesDirs(basePath).some((directory) => existsSync(join(directory, id)));
    const projectionFiles = rootProjectionContents
      .filter((projection) => projection.content.includes(id) || projection.content.includes(id.slice(0, 4)))
      .map((projection) => projection.path);
    external.set(id, {
      milestoneDirectory: milestoneDirExists(basePath, id),
      worktree,
      milestoneBranch,
      queueOrderReference: queueOrder.includes(id),
      projectProjectionReference: projectionFiles.some((path) => path.toLowerCase().endsWith("/project.md")),
      projectionFiles,
      workerStatus: existsSync(join(basePath, ".gsd", "parallel", `${id}.status.json`)),
      inspectionErrors,
    });
  }

  const result = discardOrphanMilestoneRows(ids, external);
  if (!result.ok) return result;

  invalidateAllCaches();
  try {
    const requested = new Set(ids);
    const remainingMilestoneIds = getAllMilestones()
      .map((milestone) => milestone.id)
      .filter((id) => requested.has(id));
    return {
      ...result,
      ok: remainingMilestoneIds.length === 0,
      ...(remainingMilestoneIds.length > 0
        ? { error: "canonical milestone query still contains discarded IDs" }
        : {}),
      after: {
        remainingMilestoneIds,
        canonicalQueryVerified: remainingMilestoneIds.length === 0,
      },
    };
  } catch (error) {
    return {
      ...result,
      ok: false,
      error: `post-discard canonical query failed: ${error instanceof Error ? error.message : String(error)}`,
      after: {
        remainingMilestoneIds: [],
        canonicalQueryVerified: false,
      },
    };
  }
}
