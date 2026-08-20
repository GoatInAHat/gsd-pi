import {
  existsSync,
  readdirSync,
  rmdirSync,
  rmSync,
  statSync,
  unlinkSync,
} from "node:fs";
import { join } from "node:path";

export type VerifiedRmdirIo = {
  existsSync: typeof existsSync;
  rmSync: typeof rmSync;
  rmdirSync: typeof rmdirSync;
  readdirSync: typeof readdirSync;
  unlinkSync: typeof unlinkSync;
  statSync: typeof statSync;
};

const DEFAULT_IO: VerifiedRmdirIo = {
  existsSync,
  rmSync,
  rmdirSync,
  readdirSync,
  unlinkSync,
  statSync,
};

/**
 * Remove a directory and verify it is gone.
 *
 * On Windows + Node 24, `rmSync({ recursive: true })` can return without
 * throwing while leaving the directory in place when the path contains
 * non-ASCII characters (#1526). `rmdirSync` on an emptied directory still
 * works, so fall back to a walk + rmdir when the recursive rm is a no-op.
 */
export function removeDirectoryVerified(dir: string, io: VerifiedRmdirIo = DEFAULT_IO): boolean {
  if (!io.existsSync(dir)) return true;
  try {
    io.rmSync(dir, { recursive: true, force: true });
  } catch {
    // Fall through to rmdir walk.
  }
  if (!io.existsSync(dir)) return true;
  try {
    removeTreeWithRmdir(dir, io);
  } catch {
    // Caller inspects existsSync.
  }
  return !io.existsSync(dir);
}

function removeTreeWithRmdir(dir: string, io: VerifiedRmdirIo): void {
  let names: string[] = [];
  try {
    names = io.readdirSync(dir);
  } catch {
    io.rmdirSync(dir);
    return;
  }
  for (const name of names) {
    const full = join(dir, name);
    let isDir = false;
    try {
      isDir = io.statSync(full).isDirectory();
    } catch {
      isDir = false;
    }
    if (isDir) {
      removeTreeWithRmdir(full, io);
    } else {
      try {
        io.unlinkSync(full);
      } catch {
        // Keep draining siblings.
      }
    }
  }
  io.rmdirSync(dir);
}
