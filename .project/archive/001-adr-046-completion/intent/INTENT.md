# Intent — path-fixes

<!-- Written by /gsd-path-define. Every downstream agent reads this first.
     Constraints and vetoes here override everything downstream. -->

Lane: standard   <!-- scope spans deletion + gates + docs with RESEARCH and
                      deferred NEEDS-USER items; not quick, not a program
                      milestone -->

Review panel: off

## Summary

Finish ADR-046 (database-authoritative workflow lifecycle). The v1 milestone
shipped the cutover itself — SQLite is the sole runtime workflow authority at
HEAD and both cleanup gates pass — but the program was never declared
finished: the explicit legacy import/export compatibility machinery still
ships, the status of the ADR's removal-gate evidence (telemetry/performance
thresholds) is unknown, the shadow/no-cutover gate's final disposition is
undecided, and shipped docs still describe the legacy pre-cutover layout.
This milestone closes whatever research finds undone, including deleting the
legacy import machinery if the compatibility-window ruling authorizes it.

## Problem

ADR-046 promised bounded lifetime for legacy paths with explicit deletion
gates ("Legacy complexity has explicit deletion gates and a bounded
lifetime"). Today nobody can say whether the program is done: the remaining
work is scattered across the compatibility window math, residual gates,
telemetry thresholds, and doc drift. For maintainers this means continued
dual-machinery maintenance burden; for users on pre-cutover versions, the
import path's lifetime is undefined.

## Users

GSD Pi maintainers (primary — they carry the legacy machinery and gates) and
GSD Pi users who migrated from pre-cutover versions (they rely on the import
compatibility window being honored or explicitly ruled on). Highly technical
audience; they use the shipped CLI at v1.16.1.

## Success criteria

<!-- Observable statements. The final review checks these one by one. -->
1. A gap audit of every ADR-046 removal gate and invariant exists on disk,
   each marked satisfied-with-evidence or carrying an explicit ruling.
2. The compatibility-window question is settled with evidence: exact Import
   Preview/Application ship release, stable releases since, days elapsed —
   and a recorded user ruling on whether legacy import machinery deletion
   proceeds.
3. If deletion is authorized: no legacy import/export code paths remain at
   HEAD, and CI (test:unit:compiled + test:integration) is green. If not:
   the blocker and its re-check trigger are documented in the repo.
4. The `lifecycle-shadow-no-cutover` gate and `legacy:cleanup:*` scripts have
   a decided disposition (retired, or kept with a recorded reason).
5. No shipped doc in docs/, gitbook/, or mintlify-docs/ still describes the
   legacy `.gsd/milestones/` layout or otherwise contradicts the completed
   cutover.

## Scope: in

- Research-phase gap audit of ADR-046's removal gates, invariants, and
  twelve-milestone program against HEAD; scope grows to cover what it finds
  undone (user selected "let research find the gaps").
- Compatibility-window and removal-gate evidence determination (ship dates,
  release counts, telemetry/performance threshold status).
- Deletion of the explicit legacy import/export machinery
  (`legacy-import-*.ts` and dependents), contingent on the deferred ruling.
- Closure or recorded disposition of residual gates and telemetry
  (`lifecycle-shadow-no-cutover`, `legacy:cleanup:*`).
- Fixes for doc drift that contradicts the completed cutover (legacy
  `.gsd/milestones/` layout claims and similar) across all three doc trees.

## Scope: out (vetoes)

<!-- Hard constraints. Nothing in research, plans, or tasks may include these. -->
- `packages/db` extraction — mapper-flagged half-built area; adjacent, not ADR-046.
- Bundled vs published extension convergence (`src/resources/extensions/*` vs `extensions/*`) — adjacent half-built area.
- Lost plans 033/034 and `plans/` backlog disposition — not ADR-046.
- The prompt-golden-fixtures Phase 2 gate failure (~0.1% miss) — pre-existing, not ADR-046.
- Declaring one canonical doc tree / restructuring the three doc trees — bigger decision, stays out.
- No rollback to disk authority, ever — ADR-046 invariant.
- No deletion of legacy import machinery before the deferred window/telemetry
  ruling is recorded.
- The 52-row remediation queue beyond cutover-contradicting drift, pending
  the NEEDS-USER ruling below.

## Constraints

- ADR-046's invariants and removal gates are binding on every downstream
  artifact; "time alone is not a Removal Gate."
- All ADR-046 design issues (#1405–#1415, #1408) are CLOSED; the contracts
  are settled — this milestone implements/verifies, it does not redesign.
- Branch will bind as `gsd-path/M001` at build; the bound branch is never main.
- Green CI required before ship: `test:unit:compiled` + `test:integration`.
- `.project/archive/v1-state-db-cutover/` is read-only historical reference.
- Repo conventions are binding on the planner (see evidence-codebase.md).

## Current state (brownfield only)

- **What exists**: GSD Pi v1.16.1, TS 5.9 strict ESM pnpm monorepo; domain
  engine is ~1925 TS resource files under `src/resources/extensions/gsd/`
  (not `packages/`). Cutover shipped: `state.ts` derives from the DB only
  ("Markdown is never a live-path fallback"), `legacy:cleanup:proof` PASS,
  `lifecycle-shadow-no-cutover` gate PASS (15/15 checks) at e210e12a.
- **Must not break**: DB-authoritative runtime behavior; the explicit Import
  Preview/Application path until the ruling lands; backup/restore; the
  currently-green cleanup gates.
- **Doc-vs-code rulings**: v1 rulings carried forward verbatim in
  DOCS-AUDIT.md `## User rulings` (ADR status-label fixes — now verified in
  code; ci-cd-pipeline.md fix — now verified; vendored `packages/pi-*`
  upstream wording — accept-drift; external vendor/tool references — no
  ruling needed). 12 new external NEEDS-USER rows pending (below).
- **Ground truth**: `.project/research/evidence-codebase.md`, `.project/research/DOCS-AUDIT.md`

## Risks

<!-- What the user is most unsure about. Research prioritizes these. -->
- The removal-gate telemetry/performance thresholds may never have been
  built (v1 precedent: `markdownFallbackUsed` telemetry never existed) —
  deletion scope then hinges on a fresh user ruling.
- The compatibility window may not have elapsed, blocking the deletion half
  of the milestone.
- Research may find more undone ADR-046 work than the visible residue
  (scope growth).
- The 52-row doc remediation queue is larger than the cutover-contradicting
  subset; the boundary needs a ruling.

## Open questions

- [RESEARCH] Exact Import Preview/Application ship release; stable releases since; days elapsed — does the 2-releases + ≥60-day window hold?
- [RESEARCH] Which removal-gate telemetry/performance thresholds exist with real data, and which were never built?
- [RESEARCH] Full gap list: every ADR-046 removal gate and invariant not yet satisfied at HEAD, with evidence.
- [RESEARCH] Disposition options for the "lifecycle-shadow-no-cutover" gate and "legacy:cleanup:*" scripts after deletion (or after a no-delete ruling).
- [NEEDS-USER] If removal-gate evidence was never built: delete on static
  proof (extends the v1 wave-4 calendar waiver) or build the evidence first?
  Deferred until research reports.
- [NEEDS-USER] The 12 new external NEEDS-USER doc rows (Docker Desktop
  4.58+, claude.ai installer, npx skills CLI, agent-browser CLI): confirm
  the v1 precedent "no ruling needed — external" or review individually.
- [NEEDS-USER] Is the remainder of the 52-row remediation queue (beyond
  cutover-contradicting drift) in scope for this milestone?

## Corrections

<!-- Verbatim user corrections from playback and later phases. Append-only. -->
- 2026-08-22: milestone goal, user's words: "to finish adr046"
- 2026-08-22: scope selection (multi-select, all four): "Retire legacy import
  machinery, Close residual gates and telemetry, Fix legacy-layout doc drift,
  Let research find the gaps"
- 2026-08-22: compatibility-window ruling: "Research it first" — determine
  import-ship date, release count, and telemetry threshold status, then
  decide with evidence on the table.
- 2026-08-22: deletion ruling (synthesis checkpoint): "Keep; document re-check trigger" — legacy import/export machinery is NOT deleted this milestone; blocker + re-check trigger documented instead (INTENT success criterion 3 "If not" branch).
- 2026-08-22: external doc rows ruling: "No ruling needed — external" — all 12 rows disposed; recorded in DOCS-AUDIT.md ## User rulings.
- 2026-08-22: remediation-queue ruling: "Out of scope" — only cutover-contradicting drift is fixed this milestone; the remainder of the 52-row queue stays for later milestones.
