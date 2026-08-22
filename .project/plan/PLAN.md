# Plan — path-fixes (finish ADR-046; keep ruling)

<!-- Written by the planner role. Executed wave-by-wave by /gsd-path-build. -->

Project verify: `pnpm run build:native:test && pnpm run verify:pr`

(`verify:pr` = `build:core` → `typecheck:extensions` → `test:unit` →
`gate:lifecycle-shadow-no-cutover`, package.json:139; `build:native:test`
first for CI parity — the `migrate-safety-audit` fault-injection suite needs
the `--test-fault-injection` addon, ci.yml:184. Honest baseline: the compiled
unit suite at HEAD exits nonzero on exactly two pre-existing, INTENT-vetoed
failures — `prompt golden fixtures meet Phase 2 reduction gate` and the
isolation-sensitive `runReadCli handles global flags before read`. The plan
must not fix them; "green" means no failures beyond that recorded baseline.)

## Config

- max_review_cycles: 3   <!-- review→fix→re-review loops per wave before escalating -->
- review_panel: off      <!-- copied from INTENT.md ("Review panel: off") -->

## Wave 1 — risk burn-down

Goal: Prove the three removal gates still pass at build HEAD and establish
the honest unit-suite baseline (no gate is CI-enforced — evidence freshness
is whatever this wave re-runs), then land the milestone's central deliverable
(gap audit with deletion blocker + re-check trigger) plus both
ruling-independent fix clusters (doc drift, dangling dossier import). If a
gate is red at HEAD, or the unit suite shows failures beyond the two named
pre-existing ones, the audit's satisfied-with-evidence marks are false and
the milestone replans.
Review depth: full   <!-- the gap audit's re-check-trigger wording is the
                          success-criterion-3 deliverable and load-bearing;
                          synthesis requires it be reviewed before closeout -->

| Task | Title | Deps | Files |
|------|-------|------|-------|
| T001 | Re-run removal gates and write the ADR-046 completion gap audit | — | docs/dev/ADR-046-completion-gap-audit.md |
| T002 | Fix cutover-contradicting doc drift (CONTEXT.md split truth, GSD_ALLOW_MARKDOWN_DERIVE_FALLBACK rows, legacy-layout skill rows) | — | CONTEXT.md, gitbook/reference/environment-variables.md, gitbook/core-concepts/auto-mode.md, src/resources/skills/decompose-into-slices/SKILL.md, src/resources/skills/handoff/SKILL.md, src/resources/skills/write-milestone-brief/SKILL.md |
| T003 | Repair dangling semantic-shadow-no-cutover references in dossier tooling | — | scripts/m003-s07-dossier-input.ts, scripts/m003-s07-cutover-dossier.mjs, scripts/__tests__/m003-s07-dossier-input.test.ts, scripts/__tests__/m003-s07-cutover-dossier.test.mjs, docs/dev/m003-s07-cutover-dossier.json |

## Wave 2 — merged-state verification

Goal: Full verify:pr-class run at the merged HEAD. Hard lesson from v1:
import-graph test-impact sweeps missed real breakage twice (transitive-only
importers; a filesystem-scanning test). This wave runs everything for real —
build, typecheck, full compiled unit suite, all three gates, both dossier
test files — and asserts the merged tree is honest-green and veto-clean.
Review depth: verify-only   <!-- no new content; the Verify command
                                 meaningfully covers every criterion -->

| Task | Title | Deps | Files |
|------|-------|------|-------|
| T004 | Full verify:pr-class run and veto sweep at merged HEAD | T001, T002, T003 | (none — verification only) |

## Dependency notes

- T004 → T001 (landed effect): T004's Verify greps the gap-audit path and
  marker strings named in the shared Interface contract, and compares the
  merged unit-suite failure set against the baseline T001 records. Reviewer
  sees `docs/dev/ADR-046-completion-gap-audit.md` in the merged tree.
- T004 → T002 (landed effect): T004's Verify re-asserts T002's end states
  (`gitbook/` free of `GSD_ALLOW_MARKDOWN_DERIVE_FALLBACK`; CONTEXT.md
  carrying the split-truth wording). Reviewer sees T002's doc diff merged.
- T004 → T003 (landed effect): T004's Verify re-runs both dossier test
  files at merged HEAD; they only pass once T003's repair is merged.
- No edges among T001/T002/T003: pairwise disjoint file scopes, no shared
  symbols — they run as parallel same-wave tasks.
