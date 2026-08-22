# Review — wave 1, cycle 1

Wave verdict: pass
Cycle: 1
Depth: full
Tasks reviewed: 3

Method note: verify sidecar at review base `1dba69a2e` (post-landing). For
each task the declared product files were restored to the recorded task base
`20dbb856`, the complete binary patch `commit^..commit` for exactly the
declared `files` was applied with `git apply`, and the result was confirmed
byte-identical to the landed commit (`git diff <commit> -- <files>` empty)
before running the task's Verify verbatim from the sidecar root. Heavy legs
were run sequentially (load-sensitive 60s child cap in
`workflow-authority-baseline.mjs`). Interface contract T001↔T004: the
`## Interface contract` sections of the two task files were diffed —
verbatim identical (8 marker strings, same path, same wording).

## T001 — Re-run removal gates and write the ADR-046 completion gap audit: pass

- ✅ 1. All three gates re-run pass; audit records each command, verdict, run
  date — isolated Verify rerun PASS in sidecar: `legacy-state-path-proof`
  PASS; `workflow-authority-baseline` PASS 4/4 (fault-boundary-matrix
  29.8s, under the 60s cap); `lifecycle-shadow-no-cutover-gate` PASS 7/7
  structural + 11/11 behavioral. Audit gate table with commands, verdicts,
  and run date 2026-08-22 at
  `docs/dev/ADR-046-completion-gap-audit.md:24-28`.
- ✅ 2. Audit exists, marks every step-8 removal-gate leg and all ten
  invariants — step-8 leg table (`:65-72`: replacements/fault+restore/
  structural satisfied, routing partially satisfied, telemetry and
  performance never-built deferrals), compatibility-window legs (`:74-86`),
  ten-invariant table each with status + evidence/deferral (`:90-101`).
- ✅ 3. Deletion blocker with 2026-10-02/2026-10-07 disambiguation,
  never-built telemetry/performance legs, re-check trigger (a)–(e) —
  `:103-115` (three blocking legs, both window-close readings), `:124-156`
  ((a) window disambiguation, (b) evidence legs, (c) step-7 restore windows,
  (d) floor version, (e) binding SYNTHESIS deletion plan incl.
  `canonicalLegacyImportJson`; "time alone is not a Removal Gate" noted
  `:127-128`).
- ✅ 4. M9/M11 deferrals, D005-gated lifecycle-cutover deferral, both gate
  dispositions — `:158-174` (M9, M10 contribution, M11, M003 cutover gated
  per D005), `:176-197` (shadow gate KEPT unchanged carrying D005 —
  corroborated: `package.json:139` verify:pr still includes
  `gate:lifecycle-shadow-no-cutover`; `legacy:cleanup:*` trio KEPT with the
  recorded fail-closed/zero-file and zero-signal reasons).
- ✅ 5. Honest unit baseline naming both vetoed failures + build-flag
  dependency — `:30-57`: 14461 passed / 2 failed / 28 skipped; names
  `prompt golden fixtures meet Phase 2 reduction gate` and `runReadCli
  handles global flags before read` (`read-cli-args` suite); records the
  `build:native:test` `--test-fault-injection` dependency for the 23
  fault-injection tests. (Baseline numbers are the coder's recorded run;
  Verify does not re-run the unit suite — the criterion is a documentation
  criterion and the record is internally consistent with the Log.)
- ✅ 6. Diff contains no file other than the gap-audit doc —
  `git show --stat a89c363d`: only `docs/dev/ADR-046-completion-gap-audit.md`
  (new, 197 lines) plus the role-mandated append-only Log line in the task
  file (standing exception per brief).

Warnings (non-blocking):
- T001's Verify re-runs the three gates and greps the 8 marker strings but
  does not re-verify the unit-baseline counts in criterion 5 (doc-content
  criterion; accepted on the recorded evidence). Criterion could be
  tightened only by making Verify run the full unit recipe — likely
  intentionally left to T004.

Contract violations (blocking):
- none

## T002 — Fix cutover-contradicting doc drift: pass

Reviewed against the REPAIRED Verify text in the current task file (task-file
whitelist includes the T002 task file itself; repair per orchestrator
`51adfd2e8`, recorded in the task Log).

- ✅ 1. `gitbook/` free of `GSD_ALLOW_MARKDOWN_DERIVE_FALLBACK`; auto-mode
  passage states DB authoritative, no fallback switch — sidecar grep:
  `grep -rn 'GSD_ALLOW_MARKDOWN_DERIVE_FALLBACK' gitbook/` → no matches
  (exit 1). Patch removes the env-vars table row
  (`gitbook/reference/environment-variables.md`) and rewrites
  `gitbook/core-concepts/auto-mode.md` to "The database is authoritative…
  there is no markdown-derive fallback switch." Full repaired Verify as
  written: PASS (`T002 VERIFY OK (as written)`).
- ✅ 2. CONTEXT.md blanket denial replaced with split truth containing
  `lifecycle read authority` — old string absent (grep exit 1); new wording
  at `CONTEXT.md:7-12` distinguishes cut-over workflow state authority from
  still-legacy canonical lifecycle read authority under D005; phrase present
  at `CONTEXT.md:11`.
- ✅ 3. Three SKILL.md files describe flat-phase layout as current; remaining
  `.gsd/milestones/` mentions explicitly marked legacy — Verify legacy-grep
  leg passes (every retained mention carries "legacy" on its line). Claim
  check against code truth: flat-phase naming `NN-SUFFIX.md` confirmed in
  `src/resources/extensions/gsd/paths.ts:206-211` (`buildMilestoneFileName`)
  and slice naming `NN-MM-SUFFIX.md` via `targetSliceFile`/`planFileName`
  (`paths.ts:1115-1136`); legacy `milestones/<MID>/` layout retained at
  `paths.ts:667`. Docs match.
- ✅ 4. Import/migration/recovery docs byte-untouched — `git diff
  20dbb856..4235bfed -- docs/user-docs/migration.md
  gitbook/reference/troubleshooting.md mintlify-docs/guides/migration.mdx
  mintlify-docs/guides/troubleshooting.mdx docs/zh-CN` empty.
- ✅ 5. Diff touches only the six listed files — `git show --stat 4235bfed`:
  exactly the six `files` entries plus the append-only Log line in the task
  file. Row 39 (`gsd_milestone_new`) untouched.

Warnings (non-blocking):
- The Verify's final git-diff clause is load-bearing only when HEAD is the
  task base; at a post-landing tree (like this sidecar) the worktree matches
  HEAD and the clause passes vacuously. Not a task defect — the
  commit-scoped `git show --stat` check above is the substantive evidence —
  but worth knowing when re-running this Verify on merged trees.

Contract violations (blocking):
- none

## T003 — Repair dangling semantic-shadow-no-cutover references in dossier tooling: pass

- ✅ 1. No retired-module references in the four dossier files — sidecar grep
  leg clean (exit 1, no matches) for `semantic-shadow-no-cutover-gate`,
  `runSemanticShadowNoCutoverGate`, `NO_CUTOVER_BEHAVIORAL_WITNESSES` across
  all four files; the patch re-points to `runLifecycleShadowNoCutoverGate` /
  `LIFECYCLE_SHADOW_BEHAVIORAL_WITNESSES`.
- ✅ 2. COMMAND_INVENTORY no longer lists the retired command as observed
  pass — `scripts/m003-s07-cutover-dossier.mjs:104-109` now lists
  `gate:lifecycle-shadow-no-cutover` (a real script, `package.json:77`);
  `grep 'gate:semantic-shadow-no-cutover'` finds nothing in the .mjs or the
  regenerated JSON.
- ✅ 3. Collector loads and runs without the deleted module; JSON
  byte-matches fresh tool output — the `bare --check validates and
  byte-compares the default checked dossier` test passes in the sidecar
  rerun (the criterion's designated proof); `CLI runs local reports and
  emits canonical validator-ready JSON` passes end-to-end (67.5s, real
  lifecycle gate + authority baseline inside).
- ✅ 4. Both dossier test files pass — sidecar rerun: `tests 78, pass 78,
  fail 0` (65 cutover-dossier + 13 dossier-input, the latter previously
  0-runnable). The dossier-input suite self-registers `resolve-ts.mjs` so it
  loads under the bare strip-types Verify command.
- ✅ 5. Lifecycle gate still passes and the gate file is unmodified — gate
  rerun PASS (7/7 structural, 11/11 behavioral); `git diff 20dbb856..4d9e1ea
  -- scripts/lifecycle-shadow-no-cutover-gate.mjs` empty, and the gate file
  is absent from the commit's file list.

Warnings (non-blocking):
- The hardcoded 60s child timeout at `scripts/workflow-authority-baseline.mjs:81`
  remains environmentally load-sensitive (it caused T003's first block; the
  heaviest leg took 29.8s in this quiet rerun). Not a defect in this task's
  diff, but a recurring flake source for any Verify that embeds the
  baseline.
- The regenerated `docs/dev/m003-s07-cutover-dossier.json` embeds current
  live evidence (authority revision 447, M003/S07 completed), so the checked
  dossier drifts with live project state; the byte-compare test still passes
  today. Acceptable per the task's own runbook, but future live drift may
  require regeneration.

Contract violations (blocking):
- none

## Fixed since last cycle

- n/a (cycle 1)

## Summary for orchestrator

- pass — no fix tasks needed.
- repeat offenders: none.
- warnings worth a human eye: (1) the 60s child cap in
  `workflow-authority-baseline.mjs:81` is a standing load-flake for any
  Verify embedding the baseline — already caused one false T003 block;
  (2) T002's git-diff Verify clause is vacuous on post-landing trees;
  (3) the T003 checked-in dossier JSON embeds live evidence and will drift.
- Interface contract T001↔T004 verified verbatim-consistent (diff of both
  `## Interface contract` sections: identical).
- All three task commits touch only declared `files` plus append-only task
  Log lines; no contract-body changes in any task commit.
