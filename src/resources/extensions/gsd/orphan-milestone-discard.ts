// Project/App: gsd-pi
// File Purpose: Bounded orphan-reservation discard across DB, git, projections, and caches.

import { existsSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";

import { invalidateAllCaches } from "./cache.js";
import {
  deleteOrphanMilestoneRows,
  getMilestone,
  inspectOrphanMilestoneRows,
  orphanMilestoneDbFailures,
  OrphanMilestoneDbRefusalError,
  type OrphanMilestoneDbFailure,
  type OrphanMilestoneDbSnapshot,
} from "./gsd-db.js";
import { MILESTONE_ID_RE } from "./milestone-ids.js";
import { nativeBranchExists, nativeIsRepo, nativeWorktreeList } from "./native-git-bridge.js";
import { clearPathCache, gsdRoot, milestoneDirExists } from "./paths.js";
import { loadQueueOrder } from "./queue-order.js";
import { worktreesDirs } from "./worktree-placement.js";

export interface OrphanMilestoneSnapshot extends OrphanMilestoneDbSnapshot {
  milestoneDirectory: boolean;
  worktrees: string[];
  branches: string[];
  workerSurfaces: string[];
  queueOrderReference: boolean;
  queueOrderInspectionError?: string;
  gitInspectionError?: string;
  workerInspectionError?: string;
}

export interface OrphanMilestoneDiscardResult {
  ok: true;
  command: "discard-milestone";
  orphanOnly: true;
  requestedIds: string[];
  before: OrphanMilestoneSnapshot[];
  after: Array<{ id: string; canonicalMilestone: null }>;
}

export class OrphanMilestoneDiscardRefusalError extends Error {
  readonly before: OrphanMilestoneSnapshot[];
  readonly failures: OrphanMilestoneDbFailure[];

  constructor(
    before: OrphanMilestoneSnapshot[],
    failures: OrphanMilestoneDbFailure[],
  ) {
    super("One or more targets failed orphan-only preflight");
    this.name = "OrphanMilestoneDiscardRefusalError";
    this.before = before;
    this.failures = failures;
  }
}

export function validateOrphanMilestoneIds(ids: readonly string[]): string[] {
  if (ids.length === 0) throw new Error("At least one milestone ID is required");
  const unique = [...new Set(ids)];
  if (unique.length !== ids.length) throw new Error("Milestone IDs must not be repeated");
  const invalid = unique.filter((id) => !MILESTONE_ID_RE.test(id));
  if (invalid.length > 0) throw new Error(`Invalid milestone ID${invalid.length === 1 ? "" : "s"}: ${invalid.join(", ")}`);
  return unique;
}

function inspectGit(basePath: string, id: string): {
  worktrees: string[];
  branches: string[];
  gitInspectionError?: string;
} {
  const physical = worktreesDirs(basePath)
    .map((directory) => join(directory, id))
    .filter((path) => existsSync(path));
  try {
    if (!nativeIsRepo(basePath)) return { worktrees: physical, branches: [] };
    const branchCandidates = [`milestone/${id}`, `worktree/${id}`];
    const branches = branchCandidates.filter((branch) => nativeBranchExists(basePath, branch));
    const registered = nativeWorktreeList(basePath)
      .filter((entry) => (
        basename(entry.path) === id
        || branchCandidates.includes(entry.branch)
      ))
      .map((entry) => entry.path);
    return { worktrees: [...new Set([...registered, ...physical])], branches };
  } catch (error) {
    return {
      worktrees: physical,
      branches: [],
      gitInspectionError: error instanceof Error ? error.message : String(error),
    };
  }
}

function externalFailures(before: readonly OrphanMilestoneSnapshot[]): OrphanMilestoneDbFailure[] {
  return before.flatMap((snapshot) => {
    const reasons: string[] = [];
    if (snapshot.milestoneDirectory) reasons.push("milestone directory exists");
    if (snapshot.worktrees.length > 0) reasons.push(`milestone worktree exists: ${snapshot.worktrees.join(", ")}`);
    if (snapshot.branches.length > 0) reasons.push(`milestone branch exists: ${snapshot.branches.join(", ")}`);
    if (snapshot.workerSurfaces.length > 0) reasons.push(`parallel worker state exists: ${snapshot.workerSurfaces.join(", ")}`);
    if (snapshot.queueOrderReference) reasons.push("QUEUE-ORDER.json references milestone");
    if (snapshot.queueOrderInspectionError) reasons.push(snapshot.queueOrderInspectionError);
    if (snapshot.gitInspectionError) reasons.push(`git state could not be inspected: ${snapshot.gitInspectionError}`);
    if (snapshot.workerInspectionError) reasons.push(snapshot.workerInspectionError);
    return reasons.length > 0 ? [{ id: snapshot.id, reasons }] : [];
  });
}

function inspectWorkerState(basePath: string, id: string): {
  workerSurfaces: string[];
  workerInspectionError?: string;
} {
  const directory = join(gsdRoot(basePath), "parallel");
  if (!existsSync(directory)) return { workerSurfaces: [] };
  try {
    const workerSurfaces = readdirSync(directory)
      .filter((entry) => entry === id || entry.startsWith(`${id}.`))
      .map((entry) => join(directory, entry));
    return { workerSurfaces };
  } catch (error) {
    return {
      workerSurfaces: [],
      workerInspectionError: `parallel worker state could not be inspected: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function inspectExternalState(
  basePath: string,
  dbSnapshots: readonly OrphanMilestoneDbSnapshot[],
): OrphanMilestoneSnapshot[] {
  // Repeated guards must observe projections created after the first
  // preflight rather than directory-listing cache entries from that pass.
  clearPathCache();
  const queueOrder = loadQueueOrder(basePath);
  const queueOrderExists = existsSync(join(gsdRoot(basePath), "QUEUE-ORDER.json"));
  return dbSnapshots.map((snapshot) => ({
    ...snapshot,
    milestoneDirectory: milestoneDirExists(basePath, snapshot.id),
    ...inspectGit(basePath, snapshot.id),
    ...inspectWorkerState(basePath, snapshot.id),
    queueOrderReference: queueOrder?.includes(snapshot.id) ?? false,
    ...(queueOrderExists && queueOrder === null
      ? { queueOrderInspectionError: "QUEUE-ORDER.json exists but could not be inspected" }
      : {}),
  }));
}

function mergeFailures(...groups: readonly OrphanMilestoneDbFailure[][]): OrphanMilestoneDbFailure[] {
  const reasonsById = new Map<string, string[]>();
  for (const failure of groups.flat()) {
    reasonsById.set(failure.id, [...(reasonsById.get(failure.id) ?? []), ...failure.reasons]);
  }
  return [...reasonsById].map(([id, reasons]) => ({ id, reasons }));
}

/**
 * Delete only DB-only milestone reservations. Every requested ID is inspected
 * before any write; the DB writer repeats its checks under BEGIN IMMEDIATE.
 */
export function discardOrphanMilestoneReservations(
  basePath: string,
  requestedIds: readonly string[],
): OrphanMilestoneDiscardResult {
  const ids = validateOrphanMilestoneIds(requestedIds);
  const dbSnapshots = inspectOrphanMilestoneRows(ids);
  const before = inspectExternalState(basePath, dbSnapshots);
  const failures = mergeFailures(orphanMilestoneDbFailures(dbSnapshots), externalFailures(before));
  if (failures.length > 0) throw new OrphanMilestoneDiscardRefusalError(before, failures);

  try {
    deleteOrphanMilestoneRows(ids, () => {
      const refreshed = inspectExternalState(basePath, dbSnapshots);
      const refreshedFailures = externalFailures(refreshed);
      if (refreshedFailures.length > 0) {
        throw new OrphanMilestoneDiscardRefusalError(refreshed, refreshedFailures);
      }
    });
  } catch (error) {
    if (error instanceof OrphanMilestoneDbRefusalError) {
      const refreshed = before.map((snapshot) => ({
        ...snapshot,
        ...(error.snapshots.find((candidate) => candidate.id === snapshot.id) ?? {}),
      }));
      throw new OrphanMilestoneDiscardRefusalError(refreshed, error.failures);
    }
    throw error;
  }

  invalidateAllCaches();

  const after = ids.map((id) => ({ id, canonicalMilestone: getMilestone(id) }));
  if (after.some((snapshot) => snapshot.canonicalMilestone !== null)) {
    throw new Error("Canonical milestone verification failed after orphan reservation discard");
  }
  return {
    ok: true,
    command: "discard-milestone",
    orphanOnly: true,
    requestedIds: ids,
    before,
    after: after as Array<{ id: string; canonicalMilestone: null }>,
  };
}
