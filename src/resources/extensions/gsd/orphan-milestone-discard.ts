// Project/App: gsd-pi
// File Purpose: Fail-closed, set-atomic deletion of DB-only milestone reservations.

import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { basename, join } from "node:path";

import { invalidateAllCaches } from "./cache.js";
import {
  _getAdapter,
  deleteMilestoneReservationRows,
  immediateTransaction,
  insertAuditEvent,
} from "./gsd-db.js";
import { MILESTONE_ID_RE } from "./milestone-ids.js";
import { nativeBranchExists, nativeIsRepo } from "./native-git-bridge.js";
import { milestoneDirExists, gsdRoot } from "./paths.js";
import { loadQueueOrder } from "./queue-order.js";
import { listWorktrees } from "./worktree-manager.js";

type DbRow = Record<string, unknown>;

export interface OrphanMilestoneSnapshot {
  id: string;
  canonical: {
    exists: boolean;
    title?: string;
    status?: string;
    createdAt?: string;
    hasPlanningPayload?: boolean;
  };
  databaseRows: Record<string, number>;
  dependentMilestones: string[];
  malformedDependencyMilestones: string[];
  activeWorkerIds: string[];
  projection: {
    milestoneDirectory: boolean;
    queueOrderReference: boolean;
    queueOrderUnreadable: boolean;
  };
  git: {
    milestoneBranch: boolean;
    worktrees: string[];
  };
  refusalReasons: string[];
}

export interface OrphanMilestoneDiscardResult {
  command: "discard-milestone";
  ok: true;
  orphanOnly: true;
  requested: string[];
  deleted: string[];
  auditEventId: string;
  before: OrphanMilestoneSnapshot[];
  after: OrphanMilestoneSnapshot[];
}

export class OrphanMilestoneDiscardRefusedError extends Error {
  readonly code = "orphan_preflight_failed";

  constructor(
    message: string,
    readonly before: OrphanMilestoneSnapshot[],
  ) {
    super(message);
    this.name = "OrphanMilestoneDiscardRefusedError";
  }
}

export class OrphanMilestoneDiscardPostflightError extends Error {
  readonly code = "orphan_postflight_failed";

  constructor(
    message: string,
    readonly before: OrphanMilestoneSnapshot[],
    readonly after: OrphanMilestoneSnapshot[],
  ) {
    super(message);
    this.name = "OrphanMilestoneDiscardPostflightError";
  }
}

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function hasNonEmptyJsonArray(value: unknown): boolean {
  if (typeof value !== "string") return value != null;
  try {
    const parsed = JSON.parse(value);
    return !Array.isArray(parsed) || parsed.length > 0;
  } catch {
    return true;
  }
}

function hasPlanningPayload(id: string, row: DbRow): boolean {
  const textFields = [
    "vision",
    "verification_contract",
    "verification_integration",
    "verification_operational",
    "verification_uat",
    "requirement_coverage",
    "boundary_map_markdown",
  ];
  const arrayFields = [
    "depends_on",
    "success_criteria",
    "key_risks",
    "proof_strategy",
    "definition_of_done",
  ];
  const title = String(row["title"] ?? "").trim();
  return (title !== "" && title !== id)
    || textFields.some((field) => String(row[field] ?? "").trim() !== "")
    || arrayFields.some((field) => hasNonEmptyJsonArray(row[field]))
    || row["completed_at"] != null
    || Number(row["sequence"] ?? 0) !== 0;
}

function malformedDependencyMilestones(requestedIds: readonly string[]): string[] {
  const db = _getAdapter()!;
  const params: Record<string, string> = {};
  const placeholders = requestedIds.map((requestedId, index) => {
    const key = `:requested_${index}`;
    params[key] = requestedId;
    return key;
  });
  const rows = db.prepare(`
    SELECT id FROM milestones
    WHERE id NOT IN (${placeholders.join(", ")})
      AND json_valid(depends_on) = 0
    ORDER BY id
  `).all(params) as DbRow[];
  return rows.map((row) => String(row["id"]));
}

interface MilestoneBearingTables {
  direct: string[];
  scoped: string[];
}

function milestoneBearingTables(): MilestoneBearingTables {
  const db = _getAdapter()!;
  const tables = db.prepare(
    "SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  ).all() as DbRow[];
  const result: MilestoneBearingTables = { direct: [], scoped: [] };
  for (const row of tables) {
    const table = String(row["name"] ?? "");
    const columns = new Set(
      (db.prepare(`PRAGMA table_info(${quoteIdentifier(table)})`).all() as DbRow[])
        .map((column) => String(column["name"] ?? "")),
    );
    if (columns.has("milestone_id")) result.direct.push(table);
    if (columns.has("scope") && columns.has("scope_id")) result.scoped.push(table);
  }
  return result;
}

function databaseRowCounts(id: string, tables: MilestoneBearingTables): Record<string, number> {
  const db = _getAdapter()!;
  const counts: Record<string, number> = {};
  for (const table of tables.direct) {
    const row = db.prepare(
      `SELECT COUNT(*) AS count FROM ${quoteIdentifier(table)} WHERE milestone_id = :milestone_id`,
    ).get({ ":milestone_id": id }) as DbRow | undefined;
    const count = Number(row?.["count"] ?? 0);
    if (count > 0) counts[table] = count;
  }
  for (const table of tables.scoped) {
    const row = db.prepare(
      `SELECT COUNT(*) AS count FROM ${quoteIdentifier(table)} WHERE scope = 'milestone' AND scope_id = :milestone_id`,
    ).get({ ":milestone_id": id }) as DbRow | undefined;
    const count = Number(row?.["count"] ?? 0);
    if (count > 0) counts[`${table}[scope=milestone]`] = count;
  }
  return counts;
}

function activeWorkerIds(id: string): string[] {
  const db = _getAdapter()!;
  const rows = db.prepare(`
    SELECT DISTINCT worker.worker_id
    FROM workers worker
    WHERE worker.status IN ('active', 'stopping')
      AND (
        EXISTS (
          SELECT 1 FROM milestone_leases lease
          WHERE lease.milestone_id = :milestone_id
            AND lease.worker_id = worker.worker_id
            AND lease.status = 'held'
        )
        OR EXISTS (
          SELECT 1 FROM unit_dispatches dispatch
          WHERE dispatch.milestone_id = :milestone_id
            AND dispatch.worker_id = worker.worker_id
            AND dispatch.status IN ('pending', 'claimed', 'running', 'paused')
        )
      )
    ORDER BY worker.worker_id
  `).all({ ":milestone_id": id }) as DbRow[];
  return rows.map((row) => String(row["worker_id"]));
}

function dependentMilestones(id: string, requestedIds: readonly string[]): string[] {
  const db = _getAdapter()!;
  const params: Record<string, string> = { ":milestone_id": id };
  const requestedPlaceholders = requestedIds.map((requestedId, index) => {
    const key = `:requested_${index}`;
    params[key] = requestedId;
    return key;
  });
  const rows = db.prepare(`
    SELECT milestone.id
    FROM milestones milestone
    WHERE milestone.id NOT IN (${requestedPlaceholders.join(", ")})
      AND json_valid(milestone.depends_on) = 1
      AND EXISTS (
        SELECT 1 FROM json_each(milestone.depends_on) dependency
        WHERE CAST(dependency.value AS TEXT) = :milestone_id
      )
    ORDER BY milestone.id
  `).all(params) as DbRow[];
  return rows.map((row) => String(row["id"]));
}

function captureSnapshots(
  basePath: string,
  ids: readonly string[],
  missingCanonicalIsRefusal = true,
): OrphanMilestoneSnapshot[] {
  const db = _getAdapter()!;
  const tables = milestoneBearingTables();
  const queueOrderPath = join(gsdRoot(basePath), "QUEUE-ORDER.json");
  const queueOrderExists = existsSync(queueOrderPath);
  const queueOrder = loadQueueOrder(basePath);
  const queueOrderUnreadable = queueOrderExists && queueOrder === null;
  const isRepo = nativeIsRepo(basePath);
  const managedWorktrees = isRepo ? listWorktrees(basePath) : [];
  const malformedDependencies = malformedDependencyMilestones(ids);

  return ids.map((id) => {
    const row = db.prepare("SELECT * FROM milestones WHERE id = :id").get({ ":id": id }) as DbRow | undefined;
    const databaseRows = databaseRowCounts(id, tables);
    const dependents = dependentMilestones(id, ids);
    const workers = activeWorkerIds(id);
    const branch = `milestone/${id}`;
    const worktrees = managedWorktrees
      .filter((worktree) => worktree.name === id || worktree.branch === branch || basename(worktree.path) === id)
      .filter((worktree) => worktree.exists && !worktree.orphan)
      .map((worktree) => worktree.path)
      .sort();
    const milestoneDirectory = milestoneDirExists(basePath, id);
    const queueOrderReference = queueOrder?.includes(id) ?? false;
    const milestoneBranch = isRepo && nativeBranchExists(basePath, branch);
    const planningPayload = row ? hasPlanningPayload(id, row) : false;

    const refusalReasons: string[] = [];
    if (!row && missingCanonicalIsRefusal) refusalReasons.push("canonical milestone row is missing");
    if (planningPayload) refusalReasons.push("canonical milestone row contains planning or completion data");
    for (const [table, count] of Object.entries(databaseRows)) {
      refusalReasons.push(`${table} contains ${count} milestone row${count === 1 ? "" : "s"}`);
    }
    if (dependents.length > 0) refusalReasons.push(`referenced by milestone dependencies: ${dependents.join(", ")}`);
    if (malformedDependencies.length > 0) {
      refusalReasons.push(`cannot prove dependency safety because depends_on is malformed for: ${malformedDependencies.join(", ")}`);
    }
    if (workers.length > 0) refusalReasons.push(`active workers: ${workers.join(", ")}`);
    if (milestoneDirectory) refusalReasons.push("milestone directory exists");
    if (queueOrderReference) refusalReasons.push("QUEUE-ORDER.json references the milestone");
    if (queueOrderUnreadable) refusalReasons.push("QUEUE-ORDER.json exists but cannot be validated");
    if (milestoneBranch) refusalReasons.push(`branch ${branch} exists`);
    if (worktrees.length > 0) refusalReasons.push(`milestone worktree exists: ${worktrees.join(", ")}`);

    return {
      id,
      canonical: {
        exists: row !== undefined,
        ...(row ? {
          title: String(row["title"] ?? ""),
          status: String(row["status"] ?? ""),
          createdAt: String(row["created_at"] ?? ""),
          hasPlanningPayload: planningPayload,
        } : {}),
      },
      databaseRows,
      dependentMilestones: dependents,
      malformedDependencyMilestones: [...malformedDependencies],
      activeWorkerIds: workers,
      projection: { milestoneDirectory, queueOrderReference, queueOrderUnreadable },
      git: { milestoneBranch, worktrees },
      refusalReasons,
    };
  });
}

function validateIds(ids: readonly string[]): string[] {
  if (ids.length === 0) {
    throw new Error("discard-milestone requires at least one milestone ID");
  }
  const normalized = ids.map((id) => id.trim());
  const invalid = normalized.filter((id) => !MILESTONE_ID_RE.test(id));
  if (invalid.length > 0) {
    throw new Error(`invalid milestone ID${invalid.length === 1 ? "" : "s"}: ${invalid.join(", ")}`);
  }
  if (new Set(normalized).size !== normalized.length) {
    throw new Error("discard-milestone milestone IDs must be unique");
  }
  return normalized;
}

/**
 * Delete DB-only milestone reservations after proving the entire requested set
 * is orphaned. All database preconditions are rechecked under one IMMEDIATE
 * transaction, and any failed target rolls back the whole set.
 */
export function discardOrphanedMilestoneReservations(
  basePath: string,
  requestedIds: readonly string[],
): OrphanMilestoneDiscardResult {
  const ids = validateIds(requestedIds);

  const result = immediateTransaction(() => {
    const before = captureSnapshots(basePath, ids);
    const refused = before.filter((entry) => entry.refusalReasons.length > 0);
    if (refused.length > 0) {
      const detail = refused
        .map((entry) => `${entry.id}: ${entry.refusalReasons.join("; ")}`)
        .join(" | ");
      throw new OrphanMilestoneDiscardRefusedError(
        `orphan-only discard refused — ${detail}`,
        before,
      );
    }

    if (deleteMilestoneReservationRows(ids) !== ids.length) {
      throw new Error("orphan-only discard did not delete the complete requested set");
    }

    const after = captureSnapshots(basePath, ids, false);
    const unexpectedAfter = after.filter((entry) =>
      entry.canonical.exists
      || entry.refusalReasons.length > 0
    );
    if (unexpectedAfter.length > 0) {
      const detail = unexpectedAfter
        .map((entry) => `${entry.id}: ${entry.refusalReasons.join("; ") || "canonical milestone row remains"}`)
        .join(" | ");
      throw new OrphanMilestoneDiscardPostflightError(
        `orphan-only discard postflight verification failed — ${detail}`,
        before,
        after,
      );
    }

    const auditEventId = randomUUID();
    insertAuditEvent({
      eventId: auditEventId,
      traceId: auditEventId,
      category: "workflow",
      type: "orphan-milestone-reservations-discarded",
      ts: new Date().toISOString(),
      payload: {
        milestoneIds: [...ids],
        reservations: before.map((entry) => ({
          id: entry.id,
          title: entry.canonical.title ?? "",
          status: entry.canonical.status ?? "",
          createdAt: entry.canonical.createdAt ?? "",
        })),
      },
    });

    return {
      command: "discard-milestone" as const,
      ok: true as const,
      orphanOnly: true as const,
      requested: [...ids],
      deleted: [...ids],
      auditEventId,
      before,
      after,
    };
  });

  invalidateAllCaches();
  return result;
}
