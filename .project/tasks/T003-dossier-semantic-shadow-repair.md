---
id: T003
title: Repair dangling semantic-shadow-no-cutover references in dossier tooling
wave: 1
deps: []            # task ids whose output or landed effect this task needs
status: pending     # orchestrator-owned: pending | in-progress | done | failed | blocked
agent: null         # orchestrator-owned: set at dispatch
commit: null        # orchestrator-owned: exact task commit SHA
base: null          # orchestrator-owned: clean layer SHA for isolated Verify
worktree: null      # orchestrator-owned: isolated task worktree while active
task_branch: null   # orchestrator-owned: gsd-path-task/<id> while parallel; null when serial
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
