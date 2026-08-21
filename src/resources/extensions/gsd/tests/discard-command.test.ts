import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { handleWorkflowCommand } from "../commands/handlers/workflow.ts";
import { withCommandCwd } from "../commands/context.ts";
import { closeDatabase, getMilestone, insertMilestone, openDatabase } from "../gsd-db.ts";

test("/gsd discard confirms and directly removes a DB-only milestone", async (t) => {
  const base = mkdtempSync(join(tmpdir(), "gsd-discard-command-"));
  t.after(() => {
    closeDatabase();
    rmSync(base, { recursive: true, force: true });
  });
  mkdirSync(join(base, ".gsd"), { recursive: true });
  const notifications: Array<{ message: string; level?: string }> = [];
  assert.ok(openDatabase(join(base, ".gsd", "gsd.db")));
  insertMilestone({ id: "M001", title: "Abandoned reservation", status: "queued" });
  const ctx = {
    cwd: base,
    hasUI: true,
    ui: {
      notify(message: string, level?: string) {
        notifications.push({ message, level });
      },
      async custom(factory: any) {
        let resolved = false;
        const component = factory(
          { requestRender() {} },
          { fg: (_color: string, text: string) => text, bold: (text: string) => text },
          null,
          (value: boolean) => { resolved = value; },
        );
        component.handleInput("y");
        return resolved;
      },
    },
  };

  const handled = await withCommandCwd(base, () => (
    handleWorkflowCommand("discard M001", ctx as any, {} as any)
  ));

  assert.equal(handled, true);
  assert.equal(getMilestone("M001"), null);
  assert.deepEqual(notifications.at(-1), { message: "Discarded M001.", level: "info" });
});
