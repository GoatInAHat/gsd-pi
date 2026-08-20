import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";
import assert from "node:assert/strict";
import { relocatePhaseDirToCanonical } from "../atomic-write.ts";
import { targetMilestoneFile } from "../paths.ts";

test("relocatePhaseDirToCanonical renames the discuss slug when the title changes (#1526)", () => {
  const base = mkdtempSync(join(tmpdir(), "gsd-phase-rename-"));
  const oldDir = join(base, ".gsd", "phases", "01-new-milestone-m001");
  mkdirSync(oldDir, { recursive: true });
  writeFileSync(join(oldDir, "01-CONTEXT.md"), "# New milestone M001\n");

  const dest = relocatePhaseDirToCanonical(base, "M001", "Web API");
  assert.match(dest, /[/\\]01-web-api$/);
  assert.equal(existsSync(oldDir), false);
  assert.equal(existsSync(join(dest, "01-CONTEXT.md")), true);
  assert.equal(readFileSync(join(dest, "01-CONTEXT.md"), "utf8"), "# New milestone M001\n");
  rmSync(base, { recursive: true, force: true });
});

test("targetMilestoneFile writes into the renamed canonical phase dir (#1526)", () => {
  const base = mkdtempSync(join(tmpdir(), "gsd-phase-target-"));
  const oldDir = join(base, ".gsd", "phases", "01-new-milestone-m001");
  mkdirSync(oldDir, { recursive: true });
  writeFileSync(join(oldDir, "01-ROADMAP.md"), "# leftover\n");

  relocatePhaseDirToCanonical(base, "M001", "Web API");
  const path = targetMilestoneFile(base, "M001", "ROADMAP", "Web API");
  assert.match(path.replace(/\\/g, "/"), /\/01-web-api\/01-ROADMAP\.md$/);
  assert.equal(existsSync(oldDir), false);
  assert.equal(existsSync(path), true);
  rmSync(base, { recursive: true, force: true });
});
