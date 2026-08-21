// Project/App: gsd-pi
// File Purpose: Atomic, fail-closed deletion of reservation-only milestone rows.

import { randomUUID } from "node:crypto";

import { getDb, immediateTransaction } from "../engine.js";

export interface OrphanMilestoneExternalState {
  milestoneDirectory: boolean;
  worktree: boolean;
  milestoneBranch: boolean;
  queueOrderReference: boolean;
  projectProjectionReference: boolean;
  projectionFiles: string[];
  workerStatus: boolean;
  inspectionErrors: string[];
}

export interface OrphanMilestoneDbSurface {
  table: string;
  count: number;
}

export interface OrphanMilestoneDiscardBefore {
  id: string;
  milestone: {
    title: string;
    status: string;
    createdAt: string;
  } | null;
  disk: {
    milestoneDirectory: boolean;
    worktree: boolean;
    queueOrderReference: boolean;
    projectProjectionReference: boolean;
    projectionFiles: string[];
    workerStatus: boolean;
  };
  git: {
    milestoneBranch: boolean;
  };
  dbSurfaces: OrphanMilestoneDbSurface[];
  dependencyMilestoneIds: string[];
  dependentMilestoneIds: string[];
  projectArtifactReference: boolean;
  unexpectedDbTables: string[];
  planningFields: string[];
  blockers: string[];
}

export interface OrphanMilestoneDiscardResult {
  command: "discard-milestone";
  orphanOnly: true;
  ok: boolean;
  error?: string;
  requestedIds: string[];
  discardedIds: string[];
  before: OrphanMilestoneDiscardBefore[];
  after: {
    remainingMilestoneIds: string[];
    canonicalQueryVerified: boolean;
  } | null;
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function parseStringArray(value: unknown): string[] | null {
  try {
    const parsed = JSON.parse(String(value ?? "[]"));
    return Array.isArray(parsed) && parsed.every((item) => typeof item === "string")
      ? parsed
      : null;
  } catch {
    return null;
  }
}

function hasJsonContent(value: unknown): boolean {
  try {
    const parsed = JSON.parse(String(value ?? "[]"));
    return !Array.isArray(parsed) || parsed.length > 0;
  } catch {
    return true;
  }
}

function populatedPlanningFields(row: Record<string, unknown>, id: string): string[] {
  const fields: string[] = [];
  const title = String(row["title"] ?? "").trim();
  if (title !== "" && title !== id) fields.push("title");
  for (const key of ["vision", "verification_contract", "verification_integration", "verification_operational", "verification_uat", "requirement_coverage", "boundary_map_markdown"]) {
    if (String(row[key] ?? "").trim() !== "") fields.push(key);
  }
  for (const key of ["success_criteria", "key_risks", "proof_strategy", "definition_of_done"]) {
    if (hasJsonContent(row[key])) fields.push(key);
  }
  if (row["completed_at"] != null && String(row["completed_at"]).trim() !== "") fields.push("completed_at");
  if (Number(row["sequence"] ?? 0) !== 0) fields.push("sequence");
  return fields;
}

const KNOWN_CANONICAL_TABLES = new Set([
  "artifacts", "assessments", "audit_events", "audit_turn_index", "cancellation_requests",
  "command_queue", "decisions", "gate_runs", "liveness_block_signatures", "liveness_wedge_records",
  "memories", "memory_embeddings", "memory_processed_units", "memory_relations", "memory_sources",
  "milestone_commit_attributions", "milestone_leases", "milestones", "project_authority", "quality_gates",
  "quality_gates_new", "replan_history", "requirements", "rework_brief_findings", "rework_briefs",
  "runtime_kv", "schema_version", "slice_dependencies", "slices", "tasks", "turn_git_transactions",
  "unit_claims", "unit_dispatches", "verification_evidence", "workers", "workflow_acceptance_criteria",
  "workflow_answers", "workflow_attempt_results", "workflow_authority_cutovers", "workflow_blockers",
  "workflow_closeout_effects", "workflow_closeout_plans", "workflow_conversation_decisions",
  "workflow_decision_impacts", "workflow_domain_events", "workflow_execution_attempts",
  "workflow_failure_observations", "workflow_human_acceptances", "workflow_import_applications",
  "workflow_import_forward_repairs", "workflow_import_restores", "workflow_interaction_options",
  "workflow_interactions", "workflow_item_lifecycles", "workflow_kernel_checkpoints",
  "workflow_milestone_contexts", "workflow_open_questions", "workflow_operations", "workflow_outbox",
  "workflow_projection_work", "workflow_question_dependencies", "workflow_recovery_actions",
  "workflow_recovery_budgets", "workflow_remediation_links", "workflow_requirement_dispositions",
  "workflow_settlement_receipts", "workflow_technical_verdicts", "workflow_verification_evidence",
  "workflow_waivers", "workflow_work_checkpoints",
]);
const NON_ACTIVE_HISTORY_TABLES = new Set(["audit_events", "audit_turn_index"]);

function inspectMilestoneReferenceTables(): {
  referenceTables: Array<{ table: string; conditions: string[] }>;
  unexpectedTables: string[];
} {
  const db = getDb();
  const tables = db.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  ).all();
  const result: Array<{ table: string; conditions: string[] }> = [];
  const unexpectedTables: string[] = [];

  for (const tableRow of tables) {
    const table = String(tableRow["name"] ?? "");
    if (!table || table === "milestones") continue;
    if (table.startsWith("memories_fts")) continue;
    if (!KNOWN_CANONICAL_TABLES.has(table)) {
      unexpectedTables.push(table);
    }
    if (NON_ACTIVE_HISTORY_TABLES.has(table)) continue;
    const columns = db.prepare(`PRAGMA table_info(${quoteIdentifier(table)})`).all()
      .map((row) => String(row["name"]))
      .filter(Boolean);
    const conditions = columns.map(
      (column) => `instr(CAST(${quoteIdentifier(column)} AS TEXT), :mid) > 0`,
    );
    if (conditions.length > 0) result.push({ table, conditions });
  }
  return { referenceTables: result, unexpectedTables };
}

function countDbSurfaces(
  id: string,
  referenceTables: Array<{ table: string; conditions: string[] }>,
): OrphanMilestoneDbSurface[] {
  const db = getDb();
  const surfaces: OrphanMilestoneDbSurface[] = [];
  for (const { table, conditions } of referenceTables) {
    const row = db.prepare(
      `SELECT COUNT(*) AS count FROM ${quoteIdentifier(table)} WHERE ${conditions.map((condition) => `(${condition})`).join(" OR ")}`,
    ).get({ ":mid": id });
    const count = Number(row?.["count"] ?? 0);
    if (count > 0) surfaces.push({ table, count });
  }
  return surfaces;
}

/**
 * Preflight every requested ID, then delete the complete set in one IMMEDIATE
 * transaction. Any known or future canonical milestone reference blocks the
 * entire batch; the only permitted row is the reservation in `milestones`.
 */
export function discardOrphanMilestoneRows(
  ids: string[],
  externalState: ReadonlyMap<string, OrphanMilestoneExternalState>,
): OrphanMilestoneDiscardResult {
  return immediateTransaction<OrphanMilestoneDiscardResult>(() => {
    const db = getDb();
    const { referenceTables, unexpectedTables } = inspectMilestoneReferenceTables();
    const milestoneRows = db.prepare("SELECT * FROM milestones ORDER BY id").all();
    const rowById = new Map(milestoneRows.map((row) => [String(row["id"]), row]));
    const dependenciesById = new Map<string, string[] | null>();
    for (const row of milestoneRows) {
      dependenciesById.set(String(row["id"]), parseStringArray(row["depends_on"]));
    }
    const projectArtifact = db.prepare(
      "SELECT full_content FROM artifacts WHERE path = 'PROJECT.md'",
    ).get();
    const projectArtifactContent = String(projectArtifact?.["full_content"] ?? "");

    const before: OrphanMilestoneDiscardBefore[] = ids.map((id) => {
      const row = rowById.get(id);
      const external = externalState.get(id) ?? {
        milestoneDirectory: false,
        worktree: false,
        milestoneBranch: false,
        queueOrderReference: false,
        projectProjectionReference: false,
        projectionFiles: [],
        workerStatus: false,
        inspectionErrors: ["external state was not inspected"],
      };
      const dependencyMilestoneIds = row ? (dependenciesById.get(id) ?? null) : [];
      const dependentMilestoneIds = milestoneRows
        .filter((candidate) => dependenciesById.get(String(candidate["id"]))?.includes(id))
        .map((candidate) => String(candidate["id"]));
      const dbSurfaces = row ? countDbSurfaces(id, referenceTables) : [];
      const projectArtifactReference = projectArtifactContent.includes(id)
        || projectArtifactContent.includes(id.slice(0, 4));
      const planningFields = row ? populatedPlanningFields(row, id) : [];
      const blockers = [...external.inspectionErrors];
      if (unexpectedTables.length > 0) blockers.push(`unexpected canonical DB tables: ${unexpectedTables.join(", ")}`);
      if (!row) blockers.push("milestone DB row does not exist");
      else if (String(row["status"] ?? "") !== "queued") blockers.push(`unexpected milestone status: ${String(row["status"] ?? "")}`);
      if (external.milestoneDirectory) blockers.push("milestone directory exists");
      if (external.worktree) blockers.push("milestone worktree exists");
      if (external.milestoneBranch) blockers.push("milestone branch exists");
      if (external.queueOrderReference) blockers.push("QUEUE-ORDER.json references milestone");
      if (external.projectionFiles.length > 0) blockers.push(`disk projections reference milestone: ${external.projectionFiles.join(", ")}`);
      if (external.workerStatus) blockers.push("milestone worker status exists");
      if (projectArtifactReference) blockers.push("canonical PROJECT.md artifact references milestone");
      if (dependencyMilestoneIds === null) blockers.push("milestone depends_on is malformed");
      else if (dependencyMilestoneIds.length > 0) blockers.push(`milestone depends on: ${dependencyMilestoneIds.join(", ")}`);
      if (dependentMilestoneIds.length > 0) blockers.push(`dependent milestones reference target: ${dependentMilestoneIds.join(", ")}`);
      if (planningFields.length > 0) blockers.push(`milestone contains planning state: ${planningFields.join(", ")}`);
      if (dbSurfaces.length > 0) blockers.push(`canonical DB surfaces exist: ${dbSurfaces.map((surface) => surface.table).join(", ")}`);

      return {
        id,
        milestone: row ? {
          title: String(row["title"] ?? ""),
          status: String(row["status"] ?? ""),
          createdAt: String(row["created_at"] ?? ""),
        } : null,
        disk: {
          milestoneDirectory: external.milestoneDirectory,
          worktree: external.worktree,
          queueOrderReference: external.queueOrderReference,
          projectProjectionReference: external.projectProjectionReference,
          projectionFiles: external.projectionFiles,
          workerStatus: external.workerStatus,
        },
        git: { milestoneBranch: external.milestoneBranch },
        dbSurfaces,
        dependencyMilestoneIds: dependencyMilestoneIds ?? [],
        dependentMilestoneIds,
        projectArtifactReference,
        unexpectedDbTables: unexpectedTables,
        planningFields,
        blockers,
      };
    });

    if (before.some((entry) => entry.blockers.length > 0)) {
      return {
        command: "discard-milestone",
        orphanOnly: true,
        ok: false,
        error: "orphan-only preflight failed; no milestones were deleted",
        requestedIds: ids,
        discardedIds: [],
        before,
        after: null,
      };
    }

    const bindings: Record<string, string> = {};
    const placeholders = ids.map((id, index) => {
      bindings[`:id${index}`] = id;
      return `:id${index}`;
    });
    const deletion = db.prepare(
      `DELETE FROM milestones WHERE id IN (${placeholders.join(", ")})`,
    ).run(bindings) as { changes?: number };
    if (Number(deletion.changes ?? 0) !== ids.length) {
      throw new Error("orphan milestone discard deleted an unexpected number of rows");
    }

    const discardedAt = new Date().toISOString();
    const eventId = randomUUID();
    db.prepare(
      `INSERT INTO audit_events (event_id, trace_id, category, type, ts, payload_json)
       VALUES (:event_id, :trace_id, 'milestone', 'orphan-milestone-reservations-discarded', :ts, :payload_json)`,
    ).run({
      ":event_id": eventId,
      ":trace_id": `orphan-discard:${eventId}`,
      ":ts": discardedAt,
      ":payload_json": JSON.stringify({
        milestoneIds: ids,
        discardedAt,
        before: before.map((entry) => ({ id: entry.id, milestone: entry.milestone })),
      }),
    });

    const remainingMilestoneIds = db.prepare(
      `SELECT id FROM milestones WHERE id IN (${placeholders.join(", ")}) ORDER BY id`,
    ).all(bindings).map((row) => String(row["id"]));

    return {
      command: "discard-milestone",
      orphanOnly: true,
      ok: remainingMilestoneIds.length === 0,
      requestedIds: ids,
      discardedIds: ids,
      before,
      after: {
        remainingMilestoneIds,
        canonicalQueryVerified: false,
      },
    };
  });
}
