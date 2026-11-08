import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

import { projectRoot, withCommandCwd } from "../commands/context.ts";
import { nativeInit } from "../native-git-bridge.ts";
import { gsdRoot } from "../paths.ts";
import { resolveProjectRoot } from "../worktree.ts";

function makeParentRepo(): string {
  const parent = join(tmpdir(), `gsd-root-resolution-${randomUUID()}`);
  mkdirSync(parent, { recursive: true });
  execFileSync("git", ["init"], { cwd: parent, stdio: "ignore" });
  execFileSync("git", ["config", "user.email", "test@test.com"], { cwd: parent });
  execFileSync("git", ["config", "user.name", "Test"], { cwd: parent });
  return realpathSync(parent);
}

test("resolveProjectRoot prefers nearest bootstrapped .gsd before parent git root", () => {
  const parent = makeParentRepo();
  const child = join(parent, "nested-app");
  const nested = join(child, "src", "components");

  try {
    mkdirSync(join(parent, ".gsd", "milestones"), { recursive: true });
    mkdirSync(join(child, ".gsd"), { recursive: true });
    mkdirSync(nested, { recursive: true });
    writeFileSync(join(child, ".gsd", "PREFERENCES.md"), "---\nplanning_depth: deep\n---\n");

    assert.equal(resolveProjectRoot(child), child);
    assert.equal(resolveProjectRoot(nested), child);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("resolveProjectRoot ignores zombie .gsd without bootstrap artifacts", () => {
  const parent = makeParentRepo();
  const child = join(parent, "nested-app");

  try {
    mkdirSync(join(parent, ".gsd", "milestones"), { recursive: true });
    mkdirSync(join(child, ".gsd"), { recursive: true });

    assert.equal(resolveProjectRoot(child), parent);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

// A bootstrapped `.gsd` in a folder that is in no git repository, with an
// empty child folder: the layout of the F3 live-run finding.
function makeBootstrappedParentWithoutGit(): { parent: string; child: string } {
  const parent = realpathSync(mkdtempSync(join(tmpdir(), "gsd-root-no-git-")));
  const child = join(parent, "new-app");
  mkdirSync(join(parent, ".gsd"), { recursive: true });
  writeFileSync(join(parent, ".gsd", "PREFERENCES.md"), "---\nplanning_depth: deep\n---\n");
  mkdirSync(child, { recursive: true });
  return { parent, child };
}

test("resolveProjectRoot does not adopt an ancestor .gsd outside a git working tree", (t) => {
  const { parent, child } = makeBootstrappedParentWithoutGit();
  t.after(() => rmSync(parent, { recursive: true, force: true }));

  assert.equal(resolveProjectRoot(child), child);
  assert.equal(resolveProjectRoot(parent), parent);
});

test("init in a folder outside git acts on that folder, not on an ancestor .gsd", async (t) => {
  const { parent, child } = makeBootstrappedParentWithoutGit();
  t.after(() => rmSync(parent, { recursive: true, force: true }));

  const root = await withCommandCwd(child, async () => projectRoot());
  assert.equal(root, child, "the command root is the workspace folder shown to the user");
  assert.equal(gsdRoot(root), join(child, ".gsd"), "setup files go into the workspace folder");

  nativeInit(root, "main");
  assert.equal(existsSync(join(child, ".git")), true, "git init runs in the workspace folder");
  assert.equal(existsSync(join(parent, ".git")), false, "git init does not touch the ancestor");
});

test("resolveProjectRoot keeps the nearest bootstrapped .gsd when the only git root is the home folder", (t) => {
  const tmp = realpathSync(mkdtempSync(join(tmpdir(), "gsd-root-home-git-")));
  const home = join(tmp, "home");
  const foo = join(home, "projects", "foo");
  const src = join(foo, "src");
  const other = join(home, "other");
  const previousGsdHome = process.env.GSD_HOME;
  t.after(() => {
    if (previousGsdHome === undefined) delete process.env.GSD_HOME;
    else process.env.GSD_HOME = previousGsdHome;
    rmSync(tmp, { recursive: true, force: true });
  });

  mkdirSync(join(home, ".gsd"), { recursive: true });
  process.env.GSD_HOME = join(home, ".gsd");
  execFileSync("git", ["init"], { cwd: home, stdio: "ignore" });
  mkdirSync(join(foo, ".gsd"), { recursive: true });
  writeFileSync(join(foo, ".gsd", "PREFERENCES.md"), "---\nplanning_depth: deep\n---\n");
  mkdirSync(src, { recursive: true });
  mkdirSync(other, { recursive: true });

  assert.equal(resolveProjectRoot(src), foo);
  assert.equal(gsdRoot(src), join(foo, ".gsd"));
  assert.equal(resolveProjectRoot(other), other, "the home folder is never adopted as a project root");
});


test("symlink resolution follows physical project boundaries, not the link's parent repository", (t) => {
  const fixture = realpathSync(mkdtempSync(join(tmpdir(), "gsd-root-symlink-")));
  t.after(() => rmSync(fixture, { recursive: true, force: true }));
  const host = join(fixture, "host");
  const owner = join(fixture, "owner");
  const nested = join(owner, "app");
  const subdir = join(nested, "src");
  mkdirSync(join(host, ".git"), { recursive: true });
  mkdirSync(join(host, ".gsd"));
  writeFileSync(join(host, ".gsd", "PREFERENCES.md"), "---\n---\n");
  mkdirSync(join(owner, ".git"), { recursive: true });
  mkdirSync(subdir, { recursive: true });
  const link = join(host, "linked-src");
  symlinkSync(subdir, link, "junction");

  assert.equal(resolveProjectRoot(link), owner, "do not adopt the link's lexical repository");
  mkdirSync(join(nested, ".gsd"));
  writeFileSync(join(nested, ".gsd", "PREFERENCES.md"), "---\n---\n");
  assert.equal(resolveProjectRoot(link), nested, "keep the nearest bootstrapped physical project");
  mkdirSync(join(subdir, ".git"));
  assert.equal(resolveProjectRoot(link), subdir, "do not cross a nested git boundary");
});

test("a symlink outside git does not adopt its lexical parent's project", (t) => {
  const fixture = realpathSync(mkdtempSync(join(tmpdir(), "gsd-root-symlink-no-git-")));
  t.after(() => rmSync(fixture, { recursive: true, force: true }));
  const host = join(fixture, "host");
  const target = join(fixture, "target");
  mkdirSync(join(host, ".git"), { recursive: true });
  mkdirSync(join(host, ".gsd"));
  writeFileSync(join(host, ".gsd", "PREFERENCES.md"), "---\n---\n");
  mkdirSync(target);
  const link = join(host, "link");
  symlinkSync(target, link, "junction");
  assert.equal(realpathSync(resolveProjectRoot(link)), target);
});
