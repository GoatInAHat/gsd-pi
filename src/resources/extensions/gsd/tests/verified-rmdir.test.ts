import {
  mkdirSync,
  mkdtempSync,
  writeFileSync,
  existsSync,
  rmSync,
  rmdirSync,
  readdirSync,
  unlinkSync,
  statSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";
import assert from "node:assert/strict";
import { removeDirectoryVerified, type VerifiedRmdirIo } from "../verified-rmdir.ts";

test("removeDirectoryVerified deletes a nested directory (#1526)", () => {
  const root = mkdtempSync(join(tmpdir(), "gsd-verified-rm-"));
  const dir = join(root, "lock");
  mkdirSync(join(dir, "nested"), { recursive: true });
  writeFileSync(join(dir, "nested", "marker"), "x");
  assert.equal(removeDirectoryVerified(dir), true);
  assert.equal(existsSync(dir), false);
  rmSync(root, { recursive: true, force: true });
});

test("removeDirectoryVerified falls back to rmdir when recursive rm is a no-op (#1526)", () => {
  const root = mkdtempSync(join(tmpdir(), "gsd-verified-rm-noop-"));
  const dir = join(root, ".gsd.lock");
  mkdirSync(join(dir, "nested"), { recursive: true });
  writeFileSync(join(dir, "nested", "marker"), "x");

  const io: VerifiedRmdirIo = {
    existsSync,
    rmSync: () => {
      // Windows Node 24 non-ASCII path: recursive rm returns without deleting.
    },
    rmdirSync,
    readdirSync,
    unlinkSync,
    statSync,
  };

  assert.equal(removeDirectoryVerified(dir, io), true);
  assert.equal(existsSync(dir), false);
  rmSync(root, { recursive: true, force: true });
});
