// Project/App: gsd-pi
// File Purpose: Fail-closed, transactional deletion of DB-only milestone reservations.

import { getDb, immediateTransaction, readTransaction } from "../engine.js";

export interface OrphanMilestoneDbSnapshot {
  id: string;
  milestone: {
    title: string;
    status: string;
    dependsOn: string[];
  } | null;
  relatedRows: Record<string, number>;
  dependentMilestones: string[];
  dependencyStateErrors: string[];
}

export interface OrphanMilestoneDbFailure {
  id: string;
  reasons: string[];
}

export class OrphanMilestoneDbRefusalError extends Error {
  readonly snapshots: OrphanMilestoneDbSnapshot[];
  readonly failures: OrphanMilestoneDbFailure[];

  constructor(
    snapshots: OrphanMilestoneDbSnapshot[],
    failures: OrphanMilestoneDbFailure[],
  ) {
    super("One or more milestone reservations are not DB-only orphans");
    this.name = "OrphanMilestoneDbRefusalError";
    this.snapshots = snapshots;
    this.failures = failures;
  }
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function milestoneLinkedTables(): string[] {
  const db = getDb();
  const tables = db.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  ).all();
  return tables
    .map((row) => String(row["name"] ?? ""))
    .filter((table) => table !== "milestones")
    .filter((table) => db.prepare(`PRAGMA table_info(${quoteIdentifier(table)})`).all()
      .some((column) => column["name"] === "milestone_id"));
}

function parseDependencies(value: unknown): string[] | null {
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every((entry) => typeof entry === "string")
      ? parsed
      : null;
  } catch {
    return null;
  }
}

function inspectDbSnapshots(ids: readonly string[]): OrphanMilestoneDbSnapshot[] {
  const db = getDb();
  const targetIds = new Set(ids);
  const linkedTables = milestoneLinkedTables();
  const allMilestones = db.prepare(
    "SELECT id, title, status, depends_on FROM milestones ORDER BY id",
  ).all();
  const malformedDependencyRows = allMilestones
    .filter((row) => !targetIds.has(String(row["id"] ?? "")))
    .filter((row) => parseDependencies(row["depends_on"]) === null)
    .map((row) => String(row["id"] ?? ""));

  return ids.map((id) => {
    const row = allMilestones.find((candidate) => candidate["id"] === id);
    const relatedRows: Record<string, number> = {};
    for (const table of linkedTables) {
      const count = db.prepare(
        `SELECT COUNT(*) AS count FROM ${quoteIdentifier(table)} WHERE milestone_id = :id`,
      ).get({ ":id": id })?.["count"];
      relatedRows[table] = Number(count ?? 0);
    }

    // runtime_kv intentionally has no milestone_id column, but milestone-scoped
    // entries are still target-owned state and make a reservation non-orphaned.
    if (db.prepare(
      "SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = 'runtime_kv'",
    ).get()) {
      const count = db.prepare(
        "SELECT COUNT(*) AS count FROM runtime_kv WHERE scope = 'milestone' AND scope_id = :id",
      ).get({ ":id": id })?.["count"];
      relatedRows["runtime_kv"] = Number(count ?? 0);
    }

    const dependentMilestones = allMilestones.flatMap((candidate) => {
      const candidateId = String(candidate["id"] ?? "");
      if (targetIds.has(candidateId)) return [];
      const dependencies = parseDependencies(candidate["depends_on"]);
      return dependencies?.includes(id) ? [candidateId] : [];
    });
    const dependencies = row ? parseDependencies(row["depends_on"]) : [];
    const dependencyStateErrors = [
      ...malformedDependencyRows,
      ...(row && dependencies === null ? [id] : []),
    ];

    return {
      id,
      milestone: row ? {
        title: String(row["title"] ?? ""),
        status: String(row["status"] ?? ""),
        dependsOn: dependencies ?? [],
      } : null,
      relatedRows,
      dependentMilestones,
      dependencyStateErrors,
    };
  });
}

export function orphanMilestoneDbFailures(
  snapshots: readonly OrphanMilestoneDbSnapshot[],
): OrphanMilestoneDbFailure[] {
  return snapshots.flatMap((snapshot) => {
    const reasons: string[] = [];
    if (!snapshot.milestone) reasons.push("milestone DB row does not exist");
    for (const [table, count] of Object.entries(snapshot.relatedRows)) {
      if (count > 0) reasons.push(`${table} contains ${count} target row${count === 1 ? "" : "s"}`);
    }
    if (snapshot.dependentMilestones.length > 0) {
      reasons.push(`referenced by milestone dependencies: ${snapshot.dependentMilestones.join(", ")}`);
    }
    if (snapshot.dependencyStateErrors.length > 0) {
      reasons.push(`cannot verify malformed dependency state in: ${snapshot.dependencyStateErrors.join(", ")}`);
    }
    return reasons.length > 0 ? [{ id: snapshot.id, reasons }] : [];
  });
}

/** Capture a consistent, read-only preflight snapshot for user-facing output. */
export function inspectOrphanMilestoneRows(ids: readonly string[]): OrphanMilestoneDbSnapshot[] {
  return readTransaction(() => inspectDbSnapshots(ids));
}

/**
 * Recheck every target under one reserved-writer transaction, delete only the
 * milestone rows, and verify the canonical query before committing.
 */
export function deleteOrphanMilestoneRows(
  ids: readonly string[],
  assertExternalState?: () => void,
): OrphanMilestoneDbSnapshot[] {
  return immediateTransaction(() => {
    const db = getDb();
    const snapshots = inspectDbSnapshots(ids);
    const failures = orphanMilestoneDbFailures(snapshots);
    if (failures.length > 0) throw new OrphanMilestoneDbRefusalError(snapshots, failures);
    assertExternalState?.();

    const placeholders = ids.map(() => "?").join(",");
    db.prepare(`DELETE FROM milestones WHERE id IN (${placeholders})`).run(...ids);
    const remaining = db.prepare(
      `SELECT id FROM milestones WHERE id IN (${placeholders}) ORDER BY id`,
    ).all(...ids);
    if (remaining.length > 0) {
      throw new Error(`Canonical milestone query still returned: ${remaining.map((row) => row["id"]).join(", ")}`);
    }
    // The reserved-writer transaction prevents canonical milestone admission
    // while external state is checked on both sides of the delete. A failure
    // here rolls back every requested milestone row.
    assertExternalState?.();
    return snapshots;
  });
}
