// Project/App: gsd-pi
// File Purpose: Mirror canonical artifact projection bytes into an active GSD worktree.

import { join } from "node:path";

import { clearParseCache, saveFile } from "./files.js";
import { clearPathCache, resolveGsdPathContract } from "./paths.js";
import { invalidateStateCache } from "./state.js";
import { logWarning } from "./workflow-logger.js";

export async function mirrorArtifactToActiveWorktreeProjection(
  basePath: string,
  relativePath: string,
  content: string,
  throwOnFailure: boolean = false,
): Promise<void> {
  const contract = resolveGsdPathContract(basePath);
  if (!contract.worktreeGsd) return;
  if (contract.worktreeGsd === contract.projectGsd) return;

  const fullPath = join(contract.worktreeGsd, relativePath);
  try {
    await saveFile(fullPath, content);
    clearPathCache();
    clearParseCache();
    invalidateStateCache();
  } catch (err) {
    logWarning("tool", `artifact worktree projection mirror failed: ${(err as Error).message}`, {
      path: relativePath,
    });
    if (throwOnFailure) throw err;
  }
}
