---
id: T004
title: Full verify:pr-class run and veto sweep at merged HEAD
wave: 2
deps: [T001, T002, T003]   # landed effects this task validates at merged HEAD
status: pending     # orchestrator-owned: pending | in-progress | done | failed | blocked
agent: null         # orchestrator-owned: set at dispatch
commit: null        # orchestrator-owned: exact task commit SHA
base: null          # orchestrator-owned: clean layer SHA for isolated Verify
worktree: null      # orchestrator-owned: isolated task worktree while active
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
