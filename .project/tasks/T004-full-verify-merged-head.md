---
id: T004
title: Full verify:pr-class run and veto sweep at merged HEAD
wave: 2
deps: [T001, T002, T003]   # landed effects this task validates at merged HEAD
status: in-progress # orchestrator-owned: pending | in-progress | done | failed | blocked
agent: build_T004   # orchestrator-owned: set at dispatch
commit: null        # orchestrator-owned: exact task commit SHA
base: 60b8e40c505a5961aedccb3c306bac89eaec3ef7 # orchestrator-owned: clean layer SHA for isolated Verify
worktree: /Users/jeremymcspadden/orca/workspaces/gsd-pi/path-fixes # orchestrator-owned: isolated task worktree while active (serial round: primary worktree on the bound branch)
task_branch: null   # orchestrator-owned: gsd-path-task/<id> while parallel; null when serial
files:              # every file this task may touch — dispatch checks overlap
  # none — verification only; this task edits no repo files
---

# T004 — Full verify:pr-class run and veto sweep at merged HEAD

## Context

Hard lesson from the v1 milestone: import-graph-based test-impact sweeps
missed real breakage twice (transitive-only importers; a filesystem-scanning
test that imports nothing statically). This task is the milestone's final
gate: run the full verify:pr-class recipe FOR REAL at the merged HEAD after
T001–T003 land, and confirm the tree is honest-green and veto-clean.
Honest-green means: everything passes EXCEPT the two pre-existing,
INTENT-vetoed failures recorded in the gap audit — `prompt golden fixtures
meet Phase 2 reduction gate` (token-budget gate miss at v1.16.1) and the
isolation-sensitive `runReadCli handles global flags before read`. This task
must not fix them, and must not "fix" anything else either — any unexpected
red is a block, routed back to the responsible wave-1 task.

## Approach

- Run the recipe in CI-parity order (ci.yml:184 runs `build:native:test`
  before `build:core`; `build:core` alone leaves 23 fault-injection tests
  red — that is environmental, not a regression):
  `pnpm run build:native:test` → `pnpm run build:core` →
  `pnpm run typecheck:extensions` → `pnpm run test:compile` →
  `pnpm run test:unit:compiled`.
- The compact reporter (`scripts/test-reporter-compact.mjs`) prints failures
  as `✖ <name>` lines plus a `✖ N passed, M failed, K skipped` summary.
  Extract the failure names and assert the set minus the two named
  pre-existing failures is empty. If `read-cli-args` happens to pass in this
  run (it is isolation-sensitive), that is fine — the filter tolerates its
  absence.
- Re-run all three removal gates and both dossier test files at merged HEAD.
- Re-assert the milestone artifacts: gap-audit markers present, `gitbook/`
  free of `GSD_ALLOW_MARKDOWN_DERIVE_FALLBACK`, CONTEXT.md carrying the
  split-truth wording.
- Veto sweep: `git diff --name-only` against the milestone base must show
  only files from the T001–T003 `files` lists. Anything else — especially
  deletions under `src/resources/extensions/gsd/legacy-import-*`, edits to
  `packages/db`, prompt-golden fixture/baseline edits, gate retirement, or
  `legacy:cleanup:*` changes — is a block.
- Record the run results (counts, failure names, gate verdicts) in this
  task's Log.

## Interface contract

- Gap-audit artifact (produced by T001, consumed by T004):
  `docs/dev/ADR-046-completion-gap-audit.md` — a new Markdown file containing
  these literal, greppable strings: `2026-10-02`, `2026-10-07`, `D005`,
  `legacy:cleanup`, `lifecycle-shadow-no-cutover`, `prompt golden fixtures`,
  `read-cli-args`, `canonicalLegacyImportJson`. T004's Verify greps for
  exactly these strings at this path.

## Acceptance criteria

1. The full recipe runs at merged HEAD and the compiled unit suite shows NO
   failures beyond `prompt golden fixtures meet Phase 2 reduction gate` and
   `runReadCli handles global flags before read`.
2. All three gates pass at merged HEAD: `legacy-state-path-proof.mjs`,
   `workflow-authority-baseline.mjs`, `lifecycle-shadow-no-cutover-gate.mjs`.
3. Both dossier test files pass at merged HEAD.
4. The gap-audit document is present with all contract marker strings;
   `gitbook/` contains zero `GSD_ALLOW_MARKDOWN_DERIVE_FALLBACK` occurrences;
   CONTEXT.md contains `lifecycle read authority` and not the old blanket
   denial.
5. The merged diff contains only files from the T001/T002/T003 `files`
   lists; no vetoed area was touched (no legacy import/export deletion, no
   packages/db, no extension convergence, no plans 033/034, no prompt-golden
   or read-cli-args "fix", no shadow-gate or legacy:cleanup retirement, no
   rollback to disk authority).
6. This task's Log records the observed counts and verdicts.

## Verify

```bash
pnpm run build:native:test && pnpm run build:core && pnpm run typecheck:extensions && pnpm run test:compile && node scripts/legacy-state-path-proof.mjs && node scripts/workflow-authority-baseline.mjs && node scripts/lifecycle-shadow-no-cutover-gate.mjs && node --experimental-strip-types --no-warnings --test scripts/__tests__/m003-s07-dossier-input.test.ts scripts/__tests__/m003-s07-cutover-dossier.test.mjs && ! grep -rn 'GSD_ALLOW_MARKDOWN_DERIVE_FALLBACK' gitbook/ && grep -qi 'lifecycle read authority' CONTEXT.md && for s in 2026-10-02 2026-10-07 D005 legacy:cleanup lifecycle-shadow-no-cutover 'prompt golden fixtures' read-cli-args canonicalLegacyImportJson; do grep -q "$s" docs/dev/ADR-046-completion-gap-audit.md || { echo "MISSING: $s"; exit 1; }; done && ! { { pnpm run test:unit:compiled 2>&1 || true; } | grep '✖' | grep -vF 'prompt golden fixtures meet Phase 2 reduction gate' | grep -vF 'runReadCli handles global flags before read' | grep -vE 'passed, [0-9]+ failed' | grep -vF '✖ failing tests:' | grep -q '✖'; }
```

## Log

<!-- Append-only: coder summary, blocks (`NEEDS-ORCHESTRATOR: <question> —
     readings: <candidates>` for contract ambiguity), orchestrator answers,
     review verdicts, fixes. -->
- 2026-08-22 — created by planner
- 2026-08-22 — T004 full verify at merged HEAD a752a16d4 (base 60b8e40c5). All six criteria satisfied; Verify exit 0.
  - Recipe run in CI-parity order: `build:native:test` (ok, gsd_engine.dev.node, 49.9s) → `build:core` (ok) → `typecheck:extensions` (ok) → `test:compile` (ok, 8029 files) → mirrored `native/addon/*.node` into `dist-test/native/addon/` (ci.yml:226-228 parity) → `test:unit:compiled` with `GSD_NATIVE_PREFER_LOCAL=1`.
  - Unit suite: **14462 passed, 1 failed, 28 skipped**. Only failure: `runReadCli handles global flags before read` (pre-existing, INTENT-vetoed). `prompt golden fixtures meet Phase 2 reduction gate` PASSED this run; failure set minus the two named pre-existing = ∅. No unexpected red.
  - Gates at merged HEAD: `legacy-state-path-proof.mjs` PASS; `workflow-authority-baseline.mjs` PASS (4/4); `lifecycle-shadow-no-cutover-gate.mjs` PASS (7/7 structural, 11/11 behavioral).
  - Dossier tests at merged HEAD: `m003-s07-dossier-input.test.ts` + `m003-s07-cutover-dossier.test.mjs` — 78 pass, 0 fail.
  - Artifacts: `docs/dev/ADR-046-completion-gap-audit.md` present with all 8 contract markers; `gitbook/` has zero `GSD_ALLOW_MARKDOWN_DERIVE_FALLBACK`; CONTEXT.md carries `lifecycle read authority` (line 11).
  - Veto sweep: `git diff --name-only e210e12a...HEAD -- . ':!.project'` = exactly 12 files, all within the T001/T002/T003 `files` lists (CONTEXT.md, ADR-046 audit, cutover-dossier.json, 2 gitbook pages, 3 bundled SKILL.md, 2 dossier scripts, 2 dossier tests). No legacy import/export deletion, no packages/db, no prompt-golden/read-cli-args edits, no gate or legacy:cleanup retirement. Veto-clean.
  - Full Verify command re-run verbatim end-to-end on quiet machine: VERIFY_EXIT=0.
  - Note: an earlier parallel attempt (gates run concurrently with the unit suite) showed `fault-boundary-matrix` ETIMEDOUT (60s spawn timeout under CPU contention) and one cascading dossier-test failure; both re-ran green sequentially on the quiet machine. Environmental load flake, not product red; no files changed in response.
