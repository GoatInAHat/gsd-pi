/**
 * unborn-branch.test.ts — Regression test for #1771.
 *
 * Verifies that nativeBranchExists returns true for the current branch
 * in a repo with zero commits (unborn branch). Previously, show-ref
 * would fail for unborn branches, causing a dispatch deadlock when
 * the branch was recorded as integration branch but could never be
 * verified.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

import {
  nativeBranchExists,
  nativeDetectMainBranch,
} from "../native-git-bridge.ts";
import { enterBranchModeForMilestone } from "../auto-worktree-branch-lifecycle.ts";

function git(args: string[], cwd: string): string {
  return execFileSync("git", args, {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf-8",
  }).trim();
}

test("nativeBranchExists: returns true for unborn branch (zero commits)", () => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "unborn-branch-test-")));
  try {
    git(["init"], dir);
    git(["config", "user.email", "test@test.com"], dir);
    git(["config", "user.name", "Test"], dir);

    // Repo has zero commits — HEAD exists but points to refs/heads/main
    // which does not yet exist in the ref store.
    const currentBranch = git(["branch", "--show-current"], dir);
    assert.ok(currentBranch, "git branch --show-current should return a branch name");

    // This is the bug: nativeBranchExists would return false because
    // show-ref --verify fails on an unborn branch.
    const exists = nativeBranchExists(dir, currentBranch);
    assert.strictEqual(exists, true, "unborn current branch should be treated as existing");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("nativeBranchExists: returns false for non-existent branch in unborn repo", () => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "unborn-branch-test-")));
  try {
    git(["init"], dir);
    git(["config", "user.email", "test@test.com"], dir);
    git(["config", "user.name", "Test"], dir);

    // A branch that is NOT the current unborn branch should still return false.
    const exists = nativeBranchExists(dir, "nonexistent-branch");
    assert.strictEqual(exists, false, "non-current branch should not exist in unborn repo");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("branch isolation enters the milestone branch in an unborn repo", () => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "unborn-branch-test-")));
  const previousCwd = process.cwd();
  const previousGsdHome = process.env.GSD_HOME;
  const gsdHome = realpathSync(mkdtempSync(join(tmpdir(), "unborn-branch-home-")));
  try {
    process.chdir(dir);
    process.env.GSD_HOME = gsdHome;
    git(["init", "--initial-branch=main"], dir);
    writeFileSync(join(dir, "project.txt"), "untracked project content\n");
    mkdirSync(join(dir, ".gsd"));
    writeFileSync(
      join(dir, ".gsd", "M001-META.json"),
      JSON.stringify({ integrationBranch: "main" }),
    );

    assert.equal(nativeDetectMainBranch(dir), "");

    enterBranchModeForMilestone(dir, "M001");

    assert.equal(git(["branch", "--show-current"], dir), "milestone/M001");

    // Re-entry while the repo is still unborn must not fail: the milestone
    // branch has no commit-backed ref yet, so a plain checkout would abort
    // with "pathspec did not match".
    enterBranchModeForMilestone(dir, "M001");

    assert.equal(git(["branch", "--show-current"], dir), "milestone/M001");
    assert.equal(
      git(["status", "--short"], dir),
      "?? .gsd/\n?? project.txt",
      "branch creation should preserve untracked project content",
    );
  } finally {
    process.chdir(previousCwd);
    if (previousGsdHome === undefined) delete process.env.GSD_HOME;
    else process.env.GSD_HOME = previousGsdHome;
    rmSync(dir, { recursive: true, force: true });
    rmSync(gsdHome, { recursive: true, force: true });
  }
});

test("nativeBranchExists: still works for real branches with commits", () => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "unborn-branch-test-")));
  try {
    git(["init"], dir);
    git(["config", "user.email", "test@test.com"], dir);
    git(["config", "user.name", "Test"], dir);
    writeFileSync(join(dir, "file.txt"), "test\n");
    git(["add", "."], dir);
    git(["commit", "-m", "init"], dir);

    // After a commit, the branch exists in refs and should return true.
    const currentBranch = git(["branch", "--show-current"], dir);
    const exists = nativeBranchExists(dir, currentBranch);
    assert.strictEqual(exists, true, "branch with commits should exist");

    // Non-existent branch should still return false.
    const noExists = nativeBranchExists(dir, "no-such-branch");
    assert.strictEqual(noExists, false, "non-existent branch should not exist");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
