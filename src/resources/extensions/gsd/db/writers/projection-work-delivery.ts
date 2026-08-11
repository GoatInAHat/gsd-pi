// Project/App: gsd-pi
// File Purpose: Single-writer transitions for durable Projection Work delivery.

import { getDbOrNull, immediateTransaction } from "../engine.js";

export type ProjectionDeliveryAttempt =
  | { outcome: "rendered"; contentHash: string }
  | { outcome: "failed"; error: string };

type ProjectionWorkRow = {
  projection_work_id: string;
  updated_at: string;
};

function nextIso(after: string, candidate = new Date()): string {
  const afterMs = Date.parse(after);
  const nextMs = Number.isFinite(afterMs)
    ? Math.max(candidate.getTime(), afterMs + 1)
    : candidate.getTime();
  return new Date(nextMs).toISOString();
}

/**
 * Settle one synchronous full-render attempt for every due current head.
 * Claim and settlement share one immediate transaction: interruption before
 * this writer leaves work pending, and interruption inside it rolls back both
 * transitions. The one-millisecond timestamps are the minimum distinct values
 * representable by the schema, not a retry budget.
 */
export function settleCurrentProjectionWork(attempt: ProjectionDeliveryAttempt): number {
  const db = getDbOrNull();
  if (!db) return 0;
  return immediateTransaction(() => {
    const selectedAt = new Date();
    const rows = db.prepare(`
      SELECT work.projection_work_id, work.updated_at
      FROM workflow_projection_work work
      WHERE work.delivery_state = 'pending'
        AND (work.next_attempt_at = '' OR julianday(work.next_attempt_at) <= julianday(:now))
        AND NOT EXISTS (
          SELECT 1 FROM workflow_projection_work successor
          WHERE successor.supersedes_projection_work_id = work.projection_work_id
        )
      ORDER BY work.source_project_revision, work.projection_work_id
    `).all({ ":now": selectedAt.toISOString() }) as ProjectionWorkRow[];

    const claim = db.prepare(`
      UPDATE workflow_projection_work
      SET delivery_state = 'claimed', claim_owner = 'projection-worker',
          claim_fencing_token = claim_fencing_token + 1,
          claimed_at = :claimed_at, claim_expires_at = :claim_expires_at,
          state_version = state_version + 1, updated_at = :claimed_at
      WHERE projection_work_id = :id AND delivery_state = 'pending'
    `);
    const rendered = db.prepare(`
      UPDATE workflow_projection_work
      SET delivery_state = 'rendered', claim_owner = NULL,
          claimed_at = NULL, claim_expires_at = NULL,
          attempt_count = attempt_count + 1,
          rendered_content_hash = :hash, rendered_at = :settled_at,
          state_version = state_version + 1, updated_at = :settled_at
      WHERE projection_work_id = :id AND delivery_state = 'claimed'
        AND claim_owner = 'projection-worker'
    `);
    const retry = db.prepare(`
      UPDATE workflow_projection_work
      SET delivery_state = 'pending', claim_owner = NULL,
          claimed_at = NULL, claim_expires_at = NULL,
          attempt_count = attempt_count + 1,
          next_attempt_at = :retry_at, last_error = :error,
          state_version = state_version + 1, updated_at = :settled_at
      WHERE projection_work_id = :id AND delivery_state = 'claimed'
        AND claim_owner = 'projection-worker'
    `);

    for (const row of rows) {
      const claimedAt = nextIso(row.updated_at, selectedAt);
      const claimExpiresAt = nextIso(claimedAt);
      const settledAt = nextIso(claimExpiresAt);
      claim.run({
        ":id": row.projection_work_id,
        ":claimed_at": claimedAt,
        ":claim_expires_at": claimExpiresAt,
      });
      if (attempt.outcome === "rendered") {
        rendered.run({
          ":id": row.projection_work_id,
          ":hash": attempt.contentHash,
          ":settled_at": settledAt,
        });
      } else {
        retry.run({
          ":id": row.projection_work_id,
          ":error": attempt.error,
          ":settled_at": settledAt,
          ":retry_at": nextIso(settledAt),
        });
      }
    }
    return rows.length;
  });
}
