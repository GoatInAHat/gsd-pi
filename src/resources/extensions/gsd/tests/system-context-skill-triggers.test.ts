// Project/App: gsd-pi
// File Purpose: Regression tests for BUNDLED_SKILL_TRIGGERS path correctness (#668).

import test from "node:test";
import assert from "node:assert/strict";

import { BUNDLED_SKILL_TRIGGERS } from "../bootstrap/system-context.ts";

test("spike-wrap-up trigger references .agents/skills/ not .claude/skills/ (#668)", () => {
  const entry = BUNDLED_SKILL_TRIGGERS.find((t) => t.skill === "spike-wrap-up");
  assert.ok(entry, "expected spike-wrap-up entry in BUNDLED_SKILL_TRIGGERS");
  assert.ok(
    entry.trigger.includes(".agents/skills/"),
    `expected trigger to reference .agents/skills/ but got: ${entry.trigger}`,
  );
  assert.ok(
    !entry.trigger.includes(".claude/skills/"),
    `trigger must not reference legacy .claude/skills/ path: ${entry.trigger}`,
  );
});

test("no BUNDLED_SKILL_TRIGGERS entry references .claude/skills/ as a write target", () => {
  const offenders = BUNDLED_SKILL_TRIGGERS.filter((t) => t.trigger.includes(".claude/skills/"));
  assert.deepEqual(
    offenders,
    [],
    `these triggers still reference .claude/skills/: ${offenders.map((t) => t.skill).join(", ")}`,
  );
});
