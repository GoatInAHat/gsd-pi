import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { handleOpsCommand } from "../commands/handlers/ops.ts";
import { withCommandCwd } from "../commands/context.ts";
import {
  closeDatabase,
  getMilestone,
  insertMilestone,
  openDatabase,
} from "../gsd-db.ts";

function makeFixture(t: test.TestContext): string {
  const base = mkdtempSync(join(tmpdir(), "gsd-command-discard-"));
  mkdirSync(join(base, ".gsd"), { recursive: true });
  openDatabase(join(base, ".gsd", "gsd.db"));
  insertMilestone({ id: "M001", status: "queued" });
  t.after(() => {
    closeDatabase();
    rmSync(base, { recursive: true, force: true });
  });
  return base;
}

function makeContext(base: string, confirmed: boolean) {
  const notices: Array<{ message: string; kind: string }> = [];
  return {
    notices,
    ctx: {
      cwd: base,
      ui: {
        confirm: async () => confirmed,
        notify: (message: string, kind: string) => notices.push({ message, kind }),
      },
    } as any,
  };
}

test("/gsd discard confirms and calls the direct discard primitive", async (t) => {
  const base = makeFixture(t);
  const { ctx, notices } = makeContext(base, true);

  const handled = await withCommandCwd(base, () => handleOpsCommand("discard M001", ctx, {} as any));

  assert.equal(handled, true);
  assert.equal(getMilestone("M001"), null);
  assert.ok(notices.some((notice) => /Discarded M001/.test(notice.message)));
});

test("/gsd discard cancellation leaves the milestone unchanged", async (t) => {
  const base = makeFixture(t);
  const { ctx, notices } = makeContext(base, false);

  const handled = await withCommandCwd(base, () => handleOpsCommand("discard M001", ctx, {} as any));

  assert.equal(handled, true);
  assert.ok(getMilestone("M001"));
  assert.ok(notices.some((notice) => /cancelled/i.test(notice.message)));
});
