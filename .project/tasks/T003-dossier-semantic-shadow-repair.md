---
id: T003
title: Repair dangling semantic-shadow-no-cutover references in dossier tooling
wave: 1
deps: []            # task ids whose output or landed effect this task needs
status: blocked     # orchestrator-owned: pending | in-progress | done | failed | blocked
agent: build_T003   # orchestrator-owned: set at dispatch
commit: null        # orchestrator-owned: exact task commit SHA
base: 20dbb856c7a1cdcee3cc5864eae7090fc88d26dc # orchestrator-owned: clean layer SHA for isolated Verify
worktree: /Users/jeremymcspadden/orca/workspaces/gsd-pi/path-fixes.gsd-path/task/T003 # orchestrator-owned: isolated task worktree while active
task_branch: gsd-path-task/T003 # orchestrator-owned: gsd-path-task/<id> while parallel; null when serial
files:              # every file this task may touch — dispatch checks overlap
  - scripts/m003-s07-dossier-input.ts
  - scripts/m003-s07-cutover-dossier.mjs
  - scripts/__tests__/m003-s07-dossier-input.test.ts
  - scripts/__tests__/m003-s07-cutover-dossier.test.mjs
  - docs/dev/m003-s07-cutover-dossier.json
---

# T003 — Repair dangling semantic-shadow-no-cutover references in dossier tooling

## Context

`semantic-shadow-no-cutover-gate.mjs` (formerly under scripts/) was retired in the v1 milestone
(superseded by `scripts/lifecycle-shadow-no-cutover-gate.mjs`), but the
M003/S07 dossier tooling still references it: `scripts/m003-s07-dossier-input.ts:18-21`
imports `runSemanticShadowNoCutoverGate` from the deleted module (used at
line 379), and `scripts/__tests__/m003-s07-dossier-input.test.ts:14-16`
imports `NO_CUTOVER_BEHAVIORAL_WITNESSES` from it — the test file currently
fails to even load (confirmed at HEAD: 0 pass / 1 fail, module resolution).
Additionally `scripts/m003-s07-cutover-dossier.mjs:104-110` lists the retired
`pnpm run gate:semantic-shadow-no-cutover` in COMMAND_INVENTORY as an
observed-pass command. The synthesis decision (## Decisions, "Dangling
semantic-shadow-no-cutover references") settles the repair: remove the dead
import (and its test usage) and correct the retired-command inventory. The
tooling is unreachable from verify:pr/CI, so risk is minimal — but it is a
live landmine that crashes the dossier tooling.

## Approach

- The successor gate `scripts/lifecycle-shadow-no-cutover-gate.mjs` exports
  `runLifecycleShadowNoCutoverGate` (line 739) and
  `LIFECYCLE_SHADOW_BEHAVIORAL_WITNESSES` (line 94) — the natural re-point
  targets if the dossier's no-cutover leg stays meaningful. The coder owns
  the choice: re-point the leg to the successor gate or remove the leg —
  either satisfies the decision, provided no reference to the retired module
  or its exports remains and the dossier tooling loads and runs.
- Correct the COMMAND_INVENTORY entry at
  `scripts/m003-s07-cutover-dossier.mjs:104-110` so it no longer claims
  `pnpm run gate:semantic-shadow-no-cutover` was observed passing — remove
  it, or mark it retired/superseded by `gate:lifecycle-shadow-no-cutover`.
  Keep the dossier schema consistent with whatever
  `scripts/__tests__/m003-s07-cutover-dossier.test.mjs` asserts.
- `docs/dev/m003-s07-cutover-dossier.json` is checked-in generated output:
  the dossier test "bare --check validates and byte-compares the default
  checked dossier" byte-compares it. If COMMAND_INVENTORY or the collector
  output shape changes, regenerate this JSON with the tooling's own
  generation mode so the byte-compare passes (the JSON currently embeds the
  retired command at lines 33-35).
- Update both test files to match the repaired behavior. Run them for real —
  the v1 lesson: never rely on import analysis to decide what a test covers.
- Do NOT edit `scripts/lifecycle-shadow-no-cutover-gate.mjs` itself — the
  shadow gate is KEPT unchanged per its recorded disposition (carries D005).
  Do not touch anything else in `scripts/`.

## Interface contract

- None

## Acceptance criteria

1. No reference to `semantic-shadow-no-cutover-gate.mjs`,
   `runSemanticShadowNoCutoverGate`, or `NO_CUTOVER_BEHAVIORAL_WITNESSES`
   remains in the four dossier source/test files. (Historical mentions in
   `scripts/archive/README.md` and `docs/dev/` research notes stay — they
   describe retired artifacts accurately.)
2. COMMAND_INVENTORY no longer lists the retired
   `pnpm run gate:semantic-shadow-no-cutover` as an observed-pass command.
3. `scripts/m003-s07-dossier-input.ts` loads and its collector runs without
   the deleted module; `docs/dev/m003-s07-cutover-dossier.json` byte-matches
   fresh tool output (the dossier --check test proves this).
4. Both dossier test files pass: 65/65 in
   `m003-s07-cutover-dossier.test.mjs` (count may shift with inventory
   changes — all must pass) and all tests in
   `m003-s07-dossier-input.test.ts` (previously 0-runnable).
5. `node scripts/lifecycle-shadow-no-cutover-gate.mjs` still passes and the
   gate file is unmodified.

## Verify

```bash
! grep -n 'semantic-shadow-no-cutover-gate\|runSemanticShadowNoCutoverGate\|NO_CUTOVER_BEHAVIORAL_WITNESSES' scripts/m003-s07-dossier-input.ts scripts/m003-s07-cutover-dossier.mjs scripts/__tests__/m003-s07-dossier-input.test.ts scripts/__tests__/m003-s07-cutover-dossier.test.mjs && node --experimental-strip-types --no-warnings --test scripts/__tests__/m003-s07-dossier-input.test.ts scripts/__tests__/m003-s07-cutover-dossier.test.mjs && node scripts/lifecycle-shadow-no-cutover-gate.mjs
```

## Log

<!-- Append-only: coder summary, blocks (`NEEDS-ORCHESTRATOR: <question> —
     readings: <candidates>` for contract ambiguity), orchestrator answers,
     review verdicts, fixes. -->
- 2026-08-22 — created by planner
- 2026-08-22 — plan-defect repair (orchestrator): reworded the Context reference to the retired gate script (`semantic-shadow-no-cutover-gate.mjs`, formerly under scripts/) — the brief linter extracted the backticked full path as a token missing at the layer base; the file's absence is the point of the repair. No contract change.
- 2026-08-22 — coder: implemented the re-point repair — `m003-s07-dossier-input.ts` now imports `runLifecycleShadowNoCutoverGate`/`REPO_ROOT` from `scripts/lifecycle-shadow-no-cutover-gate.mjs`; COMMAND_INVENTORY entry replaced by `gate:lifecycle-shadow-no-cutover` (observed pass); no-cutover gate shape updated to the successor's real 7 structural / 11 behavioral checks in `m003-s07-cutover-dossier.mjs` (`requireExactGate(..., 7, ...)`) and both test files; `m003-s07-dossier-input.test.ts` now self-registers `resolve-ts.mjs` and dynamically imports the TS chain so the suite loads under the bare Verify command (without `--import`, strip-types cannot resolve the chain's `./errors.js`-style specifiers — every repo script supplies the loader via `--import`, the Verify command does not). Environment note: this worktree had no `node_modules`; ran `pnpm install --frozen-lockfile --ignore-scripts` (no dependency changes).
- 2026-08-22 — coder Verify results: grep leg clean (no `semantic-shadow-no-cutover-gate`/`runSemanticShadowNoCutoverGate`/`NO_CUTOVER_BEHAVIORAL_WITNESSES` in the four files); `m003-s07-cutover-dossier.test.mjs` 65/65 pass; `node scripts/lifecycle-shadow-no-cutover-gate.mjs` PASS (7/7 structural, 11/11 behavioral, gate file unmodified); `m003-s07-dossier-input.test.ts` 12/13 — the re-pointed leg itself passes end-to-end (the real lifecycle gate runs green inside the CLI test).
- 2026-08-22 — BLOCKED (verification fails outside allowed paths): the one failing test, "CLI runs local reports and emits canonical validator-ready JSON", fail-closes on `Workflow authority baseline must pass` because the `fault-boundary-matrix` invariant exceeds the hardcoded 60s child timeout at `scripts/workflow-authority-baseline.mjs:81` in this environment — `src/resources/extensions/gsd/tests/workflow-authority-faults.test.ts` passes standalone but takes 84–95s wall here (no sleeps; CPU/process-bound; the loader transpiles per-file so no dist build helps). Neither the baseline nor the faults suite is in this task's `files`, and injecting a fake baseline into the CLI test would weaken verification. The same live baseline failure blocks regenerating `docs/dev/m003-s07-cutover-dossier.json` (collector fail-closes before producing input), so the JSON is intentionally left unchanged; it also embeds the retired command until regeneration is possible. Unblock requires an orchestrator decision: expand `files` to cover the baseline timeout (or the faults suite), or re-run Verify in an environment where the faults suite finishes under 60s.
- 2026-08-22 — orchestrator: block recorded. Judged environmental, not a contract defect — T001 ran the identical `workflow-authority-baseline` gate solo in 38s (fault-boundary-matrix 32.5s vs the 60s child timeout) while T003's run coincided with three parallel coders each building native addons. Contract remains valid; one logged redispatch granted. Worktree and branch retained; the retained diff is task-owned (4 declared product files + task file).
