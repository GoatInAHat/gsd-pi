// Project/App: gsd-pi
// File Purpose: Fail-closed, atomic deletion of DB-only milestone reservations.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { MILESTONE_ID_RE } from "../../milestone-ids.js";
import { gsdRoot, milestoneDirExists } from "../../paths.js";
import { loadQueueOrder } from "../../queue-order.js";
import { nativeBranchExists } from "../../native-git-bridge.js";
import { allWorktreesDirs, listWorktrees } from "../../worktree-manager.js";
import { getDb, immediateTransaction } from "../engine.js";

export interface OrphanMilestoneDiscardSnapshot {
  id: string;
  exists: boolean;
  title?: string;
  status?: string;
  relatedRows: Record<string, number>;
  dependentMilestones: string[];
  planningFields: string[];
  diskProjection: boolean;
  queueReference: boolean;
  worktree: boolean;
  milestoneBranch: boolean;
  activeWorkers: string[];
  workerStatusFile: boolean;
  reasons: string[];
}

export interface OrphanMilestoneDiscardResult {
  operation: "discard-milestone";
  orphanOnly: true;
  ok: boolean;
  requestedIds: string[];
  before: OrphanMilestoneDiscardSnapshot[];
  after: Array<{ id: string; exists: boolean }>;
  errors: Array<{ id: string; reasons: string[] }>;
}

const PLANNING_COLUMNS = [
  "vision",
  "success_criteria",
  "key_risks",
  "proof_strategy",
  "verification_contract",
  "verification_integration",
  "verification_operational",
  "verification_uat",
  "definition_of_done",
  "requirement_coverage",
  "boundary_map_markdown",
] as const;

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function hasStructuredContent(value: unknown): boolean {
  const text = String(value ?? "").trim();
  if (!text || text === "[]" || text === "{}" || text === "null") return false;
  return true;
}

function milestoneRelatedTables(): string[] {
  const db = getDb();
  const tables = db.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  ).all() as Array<{ name: string }>;

  return tables
    .filter(({ name }) => {
      const columns = db.prepare(`PRAGMA table_info(${quoteIdentifier(name)})`).all() as Array<{ name: string }>;
      return columns.some((column) => column.name === "milestone_id");
    })
    .map(({ name }) => name);
}

function isPidAlive(pid: number): boolean | null {
  if (!Number.isInteger(pid) || pid <= 0) return null;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ESRCH") return false;
    if (code === "EPERM") return true;
    return null;
  }
}

function persistedWorkerEvidence(
  basePath: string,
  milestoneId: string,
): { activeWorkers: string[]; errors: string[] } {
  const activeWorkers: string[] = [];
  const errors: string[] = [];

  for (const filename of ["orchestrator.json", "slice-orchestrator.json"]) {
    const path = join(gsdRoot(basePath), filename);
    if (!existsSync(path)) continue;

    let workers: unknown;
    try {
      const parsed = JSON.parse(readFileSync(path, "utf-8")) as { workers?: unknown };
      workers = parsed?.workers;
    } catch {
      errors.push(`cannot verify worker state in ${filename}`);
      continue;
    }
    if (!Array.isArray(workers)) {
      errors.push(`cannot verify worker state in ${filename}`);
      continue;
    }

    for (const candidate of workers) {
      if (!candidate || typeof candidate !== "object" || !("milestoneId" in candidate)) {
        errors.push(`cannot verify worker entry in ${filename}`);
        continue;
      }
      const worker = candidate as { milestoneId?: unknown; pid?: unknown; state?: unknown; sliceId?: unknown };
      if (typeof worker.milestoneId !== "string") {
        errors.push(`cannot verify worker entry in ${filename}`);
        continue;
      }
      if (worker.milestoneId !== milestoneId) continue;
      if (worker.state !== "running" && worker.state !== "paused"
        && worker.state !== "stopped" && worker.state !== "error") {
        errors.push(`cannot verify ${milestoneId} worker state in ${filename}`);
        continue;
      }
      if (worker.state === "stopped" || worker.state === "error") continue;

      const alive = isPidAlive(Number(worker.pid));
      if (alive === null) {
        errors.push(`cannot verify ${milestoneId} worker PID in ${filename}`);
      } else if (alive) {
        const suffix = typeof worker.sliceId === "string" ? `/${worker.sliceId}` : "";
        activeWorkers.push(`${filename}:${milestoneId}${suffix}:${String(worker.pid)}`);
      }
    }
  }

  return { activeWorkers, errors };
}

function worktreeTargetsMilestone(
  worktree: { name: string; branch: string },
  milestoneId: string,
): boolean {
  return worktree.name === milestoneId
    || worktree.name.startsWith(`${milestoneId}-S`)
    || worktree.branch === `milestone/${milestoneId}`
    || worktree.branch === `worktree/${milestoneId}`
    || worktree.branch.startsWith(`slice/${milestoneId}/`);
}

function inspectTarget(
  basePath: string,
  milestoneId: string,
  relatedTables: readonly string[],
  worktreeIds: ReadonlySet<string>,
  queueOrder: readonly string[],
): OrphanMilestoneDiscardSnapshot {
  const db = getDb();
  const row = db.prepare("SELECT * FROM milestones WHERE id = :id").get({ ":id": milestoneId }) as
    | Record<string, unknown>
    | undefined;
  const relatedRows: Record<string, number> = {};
  const dependentMilestones: string[] = [];
  const planningFields: string[] = [];
  const reasons: string[] = [];
  const canonicalWorkers = (db.prepare(
    `SELECT worker_id FROM milestone_leases
     WHERE milestone_id = :id AND status = 'held'
     UNION
     SELECT worker_id FROM unit_dispatches
     WHERE milestone_id = :id AND status IN ('claimed', 'running')
     ORDER BY worker_id`,
  ).all({ ":id": milestoneId }) as Array<{ worker_id: string }>).map((worker) => worker.worker_id);
  const persistedWorkers = persistedWorkerEvidence(basePath, milestoneId);
  const activeWorkers = [...new Set([...canonicalWorkers, ...persistedWorkers.activeWorkers])];

  if (!row) {
    reasons.push("database row is missing");
  } else {
    for (const column of PLANNING_COLUMNS) {
      if (hasStructuredContent(row[column])) planningFields.push(column);
    }
    if (hasStructuredContent(row["depends_on"])) planningFields.push("depends_on");
    if (row["completed_at"] !== null && row["completed_at"] !== undefined) planningFields.push("completed_at");

    const candidates = db.prepare("SELECT id, depends_on FROM milestones WHERE id != :id ORDER BY sequence, id")
      .all({ ":id": milestoneId }) as Array<{ id: string; depends_on: string }>;
    for (const candidate of candidates) {
      let dependencies: unknown;
      try {
        dependencies = JSON.parse(candidate.depends_on || "[]");
      } catch {
        reasons.push(`cannot verify malformed depends_on for ${candidate.id}`);
        continue;
      }
      if (Array.isArray(dependencies) && dependencies.includes(milestoneId)) {
        dependentMilestones.push(candidate.id);
      }
    }

    for (const table of relatedTables) {
      const count = Number(db.prepare(
        `SELECT COUNT(*) AS count FROM ${quoteIdentifier(table)} WHERE milestone_id = :id`,
      ).get({ ":id": milestoneId })?.["count"] ?? 0);
      if (count > 0) relatedRows[table] = count;
    }
  }

  const diskProjection = milestoneDirExists(basePath, milestoneId);
  const queueReference = queueOrder.includes(milestoneId);
  const physicalWorktree = allWorktreesDirs(basePath).some((directory) =>
    existsSync(join(directory, milestoneId))
  );
  const worktree = physicalWorktree || worktreeIds.has(milestoneId);
  const milestoneBranch = nativeBranchExists(basePath, `milestone/${milestoneId}`);
  const workerStatusFile = existsSync(join(gsdRoot(basePath), "parallel", `${milestoneId}.status.json`));

  if (planningFields.length > 0) reasons.push(`planning or lifecycle fields exist: ${planningFields.join(", ")}`);
  if (Object.keys(relatedRows).length > 0) {
    reasons.push(`related database rows exist: ${Object.entries(relatedRows).map(([table, count]) => `${table}=${count}`).join(", ")}`);
  }
  if (dependentMilestones.length > 0) reasons.push(`dependent milestones exist: ${dependentMilestones.join(", ")}`);
  if (diskProjection) reasons.push("milestone projection exists on disk");
  if (queueReference) reasons.push("QUEUE-ORDER.json references the milestone");
  if (worktree) reasons.push("milestone worktree exists");
  if (milestoneBranch) reasons.push("milestone branch exists");
  if (activeWorkers.length > 0) reasons.push(`active project workers exist: ${activeWorkers.join(", ")}`);
  if (workerStatusFile) reasons.push("parallel worker status exists for the milestone");
  reasons.push(...persistedWorkers.errors);

  return {
    id: milestoneId,
    exists: row !== undefined,
    title: row ? String(row["title"] ?? "") : undefined,
    status: row ? String(row["status"] ?? "") : undefined,
    relatedRows,
    dependentMilestones,
    planningFields,
    diskProjection,
    queueReference,
    worktree,
    milestoneBranch,
    activeWorkers: [...activeWorkers],
    workerStatusFile,
    reasons,
  };
}

/**
 * Delete a set of DB-only milestone reservations. Every target is inspected
 * inside one BEGIN IMMEDIATE transaction before any row is deleted. A single
 * failed precondition refuses the whole set.
 */
export function discardOrphanMilestonesAtomic(
  basePath: string,
  milestoneIds: readonly string[],
): OrphanMilestoneDiscardResult {
  const requestedIds = [...milestoneIds];
  if (requestedIds.length === 0) throw new Error("at least one milestone ID is required");
  if (new Set(requestedIds).size !== requestedIds.length) throw new Error("duplicate milestone IDs are not allowed");
  const invalidId = requestedIds.find((id) => !MILESTONE_ID_RE.test(id));
  if (invalidId) throw new Error(`invalid milestone ID: ${invalidId}`);

  return immediateTransaction((): OrphanMilestoneDiscardResult => {
    const db = getDb();
    const relatedTables = milestoneRelatedTables();
    const worktrees = listWorktrees(basePath);
    const worktreeIds = new Set(
      requestedIds.filter((milestoneId) =>
        worktrees.some((worktree) => worktreeTargetsMilestone(worktree, milestoneId))
      ),
    );
    const queueOrder = loadQueueOrder(basePath) ?? [];
    const before = requestedIds.map((id) =>
      inspectTarget(basePath, id, relatedTables, worktreeIds, queueOrder)
    );
    const errors = before
      .filter((snapshot) => snapshot.reasons.length > 0)
      .map((snapshot) => ({ id: snapshot.id, reasons: snapshot.reasons }));

    if (errors.length > 0) {
      return {
        operation: "discard-milestone",
        orphanOnly: true,
        ok: false,
        requestedIds,
        before,
        after: requestedIds.map((id) => ({ id, exists: before.find((snapshot) => snapshot.id === id)?.exists ?? false })),
        errors,
      };
    }

    const placeholders = requestedIds.map((_, index) => `:id${index}`);
    const params = Object.fromEntries(requestedIds.map((id, index) => [`:id${index}`, id]));
    const deleted = db.prepare(`DELETE FROM milestones WHERE id IN (${placeholders.join(", ")})`).run(params) as {
      changes?: number;
    };
    if (Number(deleted.changes ?? 0) !== requestedIds.length) {
      throw new Error(`canonical delete count mismatch: expected ${requestedIds.length}, deleted ${Number(deleted.changes ?? 0)}`);
    }

    const after = requestedIds.map((id) => ({
      id,
      exists: db.prepare("SELECT 1 AS present FROM milestones WHERE id = :id").get({ ":id": id }) !== undefined,
    }));
    if (after.some((snapshot) => snapshot.exists)) {
      throw new Error("canonical verification failed after milestone deletion");
    }

    return {
      operation: "discard-milestone",
      orphanOnly: true,
      ok: true,
      requestedIds,
      before,
      after,
      errors: [],
    };
  });
}
