// Project/App: gsd-pi
// File Purpose: Public cache-coherent boundary for orphan reservation discard.

import { invalidateAllCaches } from "./cache.js";
import {
  discardOrphanMilestonesAtomic as discardOrphanMilestonesAtomicWriter,
  type OrphanMilestoneDiscardResult,
  type OrphanMilestoneDiscardSnapshot,
} from "./db/writers/orphan-milestone-discard.js";

export type { OrphanMilestoneDiscardResult, OrphanMilestoneDiscardSnapshot };

export function discardOrphanMilestonesAtomic(
  basePath: string,
  milestoneIds: readonly string[],
): OrphanMilestoneDiscardResult {
  const result = discardOrphanMilestonesAtomicWriter(basePath, milestoneIds);
  if (result.ok) invalidateAllCaches();
  return result;
}
