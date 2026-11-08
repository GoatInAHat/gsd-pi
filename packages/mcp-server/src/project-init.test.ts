import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, realpathSync, readdirSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { initProjectWorkflowState } from './workflow-tools.js';

function makeTempProject(): string {
  return realpathSync(mkdtempSync(join(tmpdir(), 'gsd-project-init-')));
}

describe('initProjectWorkflowState', () => {
  test('creates .gsd and the workflow database in a fresh project', async () => {
    const dir = makeTempProject();
    try {
      const result = await initProjectWorkflowState(dir);
      assert.equal(result.ok, true, result.reason);
      assert.equal(result.created, true);
      assert.equal(existsSync(join(dir, '.gsd', 'gsd.db')), true);
      assert.equal(result.dbPath, join(dir, '.gsd', 'gsd.db'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('is idempotent for an already-initialized project', async () => {
    const dir = makeTempProject();
    try {
      const first = await initProjectWorkflowState(dir);
      assert.equal(first.ok, true, first.reason);
      const second = await initProjectWorkflowState(dir);
      assert.equal(second.ok, true, second.reason);
      assert.equal(second.created, false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('creates only the .gsd database, not a git repo', async () => {
    const dir = makeTempProject();
    try {
      const result = await initProjectWorkflowState(dir);
      assert.equal(result.ok, true, result.reason);
      assert.equal(result.gitRepo, false);
      assert.equal(existsSync(join(dir, '.git')), false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('fails cleanly when the project directory does not exist', async () => {
    const missing = join(tmpdir(), 'gsd-project-init-missing-' + process.pid);
    const result = await initProjectWorkflowState(missing);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'project_dir_missing');
    assert.equal(existsSync(missing), false);
  });

  test('reports an existing .git repo as gitRepo: true', async () => {
    const dir = makeTempProject();
    try {
      mkdirSync(join(dir, '.git'), { recursive: true });
      const result = await initProjectWorkflowState(dir);
      assert.equal(result.ok, true, result.reason);
      assert.equal(result.gitRepo, true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

for (const layout of ['.gsd-worktrees', '.gsd/worktrees']) {
  test(`initializes canonical authority from ${layout} without a second database`, async () => {
    const dir = makeTempProject();
    const worktree = join(dir, layout, 'M001');
    mkdirSync(worktree, { recursive: true });
    try {
      const result = await initProjectWorkflowState(worktree);
      assert.equal(result.ok, true, result.reason);
      assert.equal(result.gsdDir, join(dir, '.gsd'));
      assert.equal(result.dbPath, join(dir, '.gsd', 'gsd.db'));
      assert.equal(existsSync(join(worktree, '.gsd', 'gsd.db')), false);
      assert.equal((await initProjectWorkflowState(worktree)).created, false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}

function findDbFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return findDbFiles(path);
    return entry.name === 'gsd.db' ? [path] : [];
  }).sort();
}

test('initializes one owning-project database through a symlink to a git subdirectory', async () => {
  const fixture = makeTempProject();
  const project = join(fixture, 'project');
  const subdir = join(project, 'pkg', 'src');
  const link = join(fixture, 'linked-src');
  mkdirSync(join(project, '.git'), { recursive: true });
  mkdirSync(subdir, { recursive: true });
  symlinkSync(subdir, link, 'junction');
  try {
    const first = await initProjectWorkflowState(link);
    assert.equal(first.ok, true, first.reason);
    assert.equal(first.created, true);
    assert.equal(first.gsdDir, join(project, '.gsd'));
    assert.equal(first.dbPath, join(project, '.gsd', 'gsd.db'));
    for (const path of [subdir, project, link]) {
      const replay = await initProjectWorkflowState(path);
      assert.equal(replay.ok, true, replay.reason);
      assert.equal(replay.created, false, 'every spelling must reopen the same database');
      assert.equal(replay.dbPath, first.dbPath);
    }
    assert.deepEqual(findDbFiles(project), [first.dbPath]);
    assert.equal(existsSync(join(subdir, '.gsd')), false);
    assert.equal(existsSync(join(fixture, '.gsd')), false);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

for (const layout of ['.gsd-worktrees', '.gsd/worktrees']) {
  test(`resolves a symlink into ${layout} to one owning database`, async () => {
    const fixture = makeTempProject();
    const project = join(fixture, 'project');
    const worktree = join(project, layout, 'M001');
    const link = join(fixture, 'linked-worktree');
    mkdirSync(worktree, { recursive: true });
    symlinkSync(worktree, link, 'junction');
    try {
      const result = await initProjectWorkflowState(link);
      assert.equal(result.ok, true, result.reason);
      assert.equal(result.dbPath, join(project, '.gsd', 'gsd.db'));
      const replay = await initProjectWorkflowState(worktree);
      assert.equal(replay.ok, true, replay.reason);
      assert.equal(replay.created, false);
      assert.equal(replay.dbPath, result.dbPath);
      assert.deepEqual(findDbFiles(project), [result.dbPath]);
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });
}
