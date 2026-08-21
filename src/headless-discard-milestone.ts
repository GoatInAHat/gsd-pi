// Project/App: gsd-pi
// File Purpose: Direct non-interactive entrypoint for bounded orphan reservation discard.

import { ensureDbOpen } from "./resources/extensions/gsd/bootstrap/dynamic-tools.js";
import {
  discardOrphanMilestoneReservations,
  type OrphanMilestoneDiscardResult,
} from "./resources/extensions/gsd/orphan-milestone-discard.js";
import { MILESTONE_ID_RE } from "./resources/extensions/gsd/milestone-ids.js";

export type DiscardMilestoneArgs =
  | { ok: true; ids: string[] }
  | { ok: false; error: string };

export function parseDiscardMilestoneArgs(args: string[]): DiscardMilestoneArgs {
  const orphanOnlyCount = args.filter((arg) => arg === "--orphan-only").length;
  const ids = args.filter((arg) => arg !== "--orphan-only");
  if (orphanOnlyCount !== 1) {
    return { ok: false, error: "Usage: gsd headless discard-milestone <ids...> --orphan-only" };
  }
  if (ids.length === 0) {
    return { ok: false, error: "At least one milestone ID is required" };
  }
  const invalid = ids.find((id) => !MILESTONE_ID_RE.test(id));
  if (invalid) return { ok: false, error: `Invalid milestone ID: ${invalid}` };
  if (new Set(ids).size !== ids.length) {
    return { ok: false, error: "Duplicate milestone IDs are not allowed" };
  }
  return { ok: true, ids };
}

function errorResult(error: string, requestedIds: string[] = []): OrphanMilestoneDiscardResult {
  return {
    command: "discard-milestone",
    orphanOnly: true,
    ok: false,
    error,
    requestedIds,
    discardedIds: [],
    before: [],
    after: null,
  };
}

export async function handleDiscardMilestone(
  basePath: string,
  args: string[],
): Promise<{ exitCode: number; result: OrphanMilestoneDiscardResult }> {
  const parsed = parseDiscardMilestoneArgs(args);
  if (!parsed.ok) return { exitCode: 1, result: errorResult(parsed.error) };
  if (!await ensureDbOpen(basePath)) {
    return {
      exitCode: 1,
      result: errorResult("Canonical GSD database is unavailable", parsed.ids),
    };
  }
  try {
    const result = await discardOrphanMilestoneReservations(basePath, parsed.ids);
    return { exitCode: result.ok ? 0 : 1, result };
  } catch (error) {
    return {
      exitCode: 1,
      result: errorResult(error instanceof Error ? error.message : String(error), parsed.ids),
    };
  }
}
