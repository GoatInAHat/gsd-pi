// Project/App: gsd-pi
// File Purpose: Public headless and slash-command routing for orphan milestone discard.

import { afterEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { handleDiscardMilestone, parseDiscardMilestoneArgs } from "../headless-discard-milestone.ts";
import { parseHeadlessArgs } from "../headless.ts";
import { handleWorkflowCommand } from "../resources/extensions/gsd/commands/handlers/workflow.ts";
import { withCommandCwd } from "../resources/extensions/gsd/commands/context.ts";
import {
  closeDatabase,
  getMilestone,
  insertMilestone,
  openDatabase,
} from "../resources/extensions/gsd/gsd-db.ts";

function createFixture(): string {
  const base = mkdtempSync(join(tmpdir(), "gsd-public-discard-"));
  mkdirSync(join(base, ".gsd", "milestones"), { recursive: true });
  writeFileSync(join(base, "README.md"), "# fixture\n", "utf8");
  execFileSync("git", ["init"], { cwd: base, stdio: "ignore" });
  execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: base });
  execFileSync("git", ["config", "user.name", "Test"], { cwd: base });
  execFileSync("git", ["add", "."], { cwd: base });
  execFileSync("git", ["commit", "-m", "fixture"], { cwd: base, stdio: "ignore" });
  execFileSync("git", ["branch", "-M", "main"], { cwd: base });
  openDatabase(join(base, ".gsd", "gsd.db"));
  return base;
}

describe("headless discard-milestone (#1548)", () => {
  let base = "";

  afterEach(() => {
    try { closeDatabase(); } catch { /* ignore */ }
    if (base) rmSync(base, { recursive: true, force: true });
    base = "";
  });

  test("requires --orphan-only and one or more unique milestone IDs", () => {
    assert.deepEqual(parseDiscardMilestoneArgs(["M001", "--orphan-only"]), { ok: true, ids: ["M001"] });
    assert.equal(parseDiscardMilestoneArgs(["M001"]).ok, false);
    assert.equal(parseDiscardMilestoneArgs(["--orphan-only"]).ok, false);
    assert.equal(parseDiscardMilestoneArgs(["M001", "M001", "--orphan-only"]).ok, false);
    assert.equal(parseDiscardMilestoneArgs(["not-an-id", "--orphan-only"]).ok, false);
  });

  test("the public headless parser forwards the bounded command and its flag", () => {
    const options = parseHeadlessArgs([
      "node", "gsd", "headless", "discard-milestone", "M001", "M002", "--orphan-only",
    ]);

    assert.equal(options.command, "discard-milestone");
    assert.deepEqual(options.commandArgs, ["M001", "M002", "--orphan-only"]);
  });

  test("returns structured before/after JSON data from the bounded direct route", async () => {
    base = createFixture();
    insertMilestone({ id: "M001", status: "queued" });

    const handled = await handleDiscardMilestone(base, ["M001", "--orphan-only"]);

    assert.equal(handled.exitCode, 0);
    assert.equal(handled.result.ok, true);
    assert.equal(handled.result.before[0]?.id, "M001");
    assert.equal(handled.result.after?.canonicalQueryVerified, true);
    assert.equal(getMilestone("M001"), null);
  });

  test("/gsd discard confirms and calls the selective discard primitive directly", async () => {
    base = createFixture();
    insertMilestone({ id: "M001", status: "queued" });
    const notifications: Array<{ message: string; level?: string }> = [];
    let confirmations = 0;
    const ctx = {
      cwd: base,
      ui: {
        notify(message: string, level?: string) { notifications.push({ message, level }); },
        async confirm() { confirmations++; return true; },
      },
    };

    const handled = await withCommandCwd(base, () => handleWorkflowCommand("discard M001", ctx as any, {} as any));

    assert.equal(handled, true);
    assert.equal(confirmations, 1);
    assert.equal(getMilestone("M001"), null);
    assert.match(notifications.at(-1)?.message ?? "", /Discarded M001/);
  });

  test("/gsd discard cancellation leaves the milestone untouched", async () => {
    base = createFixture();
    insertMilestone({ id: "M001", status: "queued" });
    const ctx = {
      cwd: base,
      ui: {
        notify() {},
        async confirm() { return false; },
      },
    };

    await withCommandCwd(base, () => handleWorkflowCommand("discard M001", ctx as any, {} as any));

    assert.ok(getMilestone("M001"));
  });
});
