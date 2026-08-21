/** Headless `discard-milestone` — bounded deletion of DB-only reservations. */

import { openExistingWorkflowDatabase } from './resources/extensions/gsd/db-workspace.js'
import {
  discardOrphanMilestoneReservations,
  OrphanMilestoneDiscardRefusalError,
} from './resources/extensions/gsd/orphan-milestone-discard.js'
import { getMilestone } from './resources/extensions/gsd/gsd-db.js'

export interface HeadlessDiscardMilestoneResponse {
  exitCode: number
  payload: Record<string, unknown>
}

export async function handleDiscardMilestone(
  basePath: string,
  args: readonly string[],
): Promise<HeadlessDiscardMilestoneResponse> {
  const orphanOnlyCount = args.filter((arg) => arg === '--orphan-only').length
  const unknownFlags = args.filter((arg) => arg.startsWith('--') && arg !== '--orphan-only')
  const ids = args.filter((arg) => !arg.startsWith('--'))
  if (orphanOnlyCount !== 1 || unknownFlags.length > 0 || ids.length === 0) {
    return {
      exitCode: 1,
      payload: {
        ok: false,
        command: 'discard-milestone',
        orphanOnly: orphanOnlyCount === 1,
        requestedIds: ids,
        before: [],
        after: [],
        error: 'Usage: gsd headless discard-milestone <ids...> --orphan-only',
        ...(unknownFlags.length > 0 ? { unknownFlags } : {}),
      },
    }
  }

  const opened = openExistingWorkflowDatabase(basePath)
  if (!opened.ok) {
    return {
      exitCode: 1,
      payload: {
        ok: false,
        command: 'discard-milestone',
        orphanOnly: true,
        requestedIds: ids,
        before: [],
        after: [],
        error: opened.error?.message ?? 'Canonical GSD database is unavailable',
      },
    }
  }

  try {
    return {
      exitCode: 0,
      payload: { ...discardOrphanMilestoneReservations(basePath, ids) },
    }
  } catch (error) {
    if (error instanceof OrphanMilestoneDiscardRefusalError) {
      return {
        exitCode: 1,
        payload: {
          ok: false,
          command: 'discard-milestone',
          orphanOnly: true,
          requestedIds: ids,
          before: error.before,
          after: ids.map((id) => ({ id, canonicalMilestone: getMilestone(id) })),
          failures: error.failures,
          error: error.message,
        },
      }
    }
    return {
      exitCode: 1,
      payload: {
        ok: false,
        command: 'discard-milestone',
        orphanOnly: true,
        requestedIds: ids,
        before: [],
        after: [],
        error: error instanceof Error ? error.message : String(error),
      },
    }
  }
}
