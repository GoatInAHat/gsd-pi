<!-- Project/App: gsd-pi -->
<!-- File Purpose: ADR-046 completion gap audit — records every ADR-046 step-8 removal-gate leg and all ten invariants as satisfied-with-evidence or carrying an explicit ruling/deferral, the deletion blocker for the retained legacy import/export machinery, the concrete re-check trigger, and the gate dispositions, per the 2026-08-22 user ruling (KEEP). -->

# ADR-046 Completion Gap Audit

**Status:** Recorded — milestone deliverable (no deletion this milestone)
**Date:** 2026-08-22
**Audit HEAD:** `20dbb856c7a1cdcee3cc5864eae7090fc88d26dc` (v1.16.1)
**Related:** [ADR-046](ADR-046-database-authoritative-workflow-lifecycle.md) (Invariants and Migration/cutover, lines 192–260), `.project/research/SYNTHESIS.md` (binding decisions), `.project/research/evidence-*.md`

## Ruling

User ruling, 2026-08-22: **KEEP** — the legacy import/export machinery is
retained this milestone; nothing is deleted. This document is the milestone's
"If not" deliverable: the documented deletion blocker plus a concrete
re-check trigger. All decisions herein are composed from
`.project/research/SYNTHESIS.md` and are not re-litigated.

## Gate evidence re-run at audit HEAD

No removal gate is wired into CI; the evidence below comes from re-runs
performed at the audit HEAD on **2026-08-22**:

| Gate | Command | Verdict |
|---|---|---|
| Legacy state-path proof (`legacy:cleanup:proof`) | `node scripts/legacy-state-path-proof.mjs` | **PASS** (scanned `src/resources/extensions`) |
| Workflow-authority baseline (`baseline:workflow-authority`) | `node scripts/workflow-authority-baseline.mjs` | **PASS (4/4)** — db-authority-fixture, projection-conflict, fault-harness-contract, fault-boundary-matrix |
| Lifecycle shadow no-cutover (`gate:lifecycle-shadow-no-cutover`) | `node scripts/lifecycle-shadow-no-cutover-gate.mjs` | **PASS** — Structural 7/7, Behavioral 11/11 |

## Honest unit-suite baseline at audit HEAD

Recipe (verify:pr / CI-parity order, 2026-08-22): `pnpm run build:native:test`
→ `pnpm run build:core` → `pnpm run test:compile` → copy `native/addon/*.node`
into `dist-test/native/addon/` (the explicit CI step, `.github/workflows/ci.yml:226-228`)
→ `pnpm run test:unit:compiled`.

Result: **14461 passed, 2 failed, 28 skipped.** The two failures are the
pre-existing, INTENT-vetoed-from-fixing pair — recorded here, not fixed:

1. `prompt golden fixtures meet Phase 2 reduction gate`
   (`src/tests/prompt-golden-fixtures.test.ts`) — execute-task prompt ~39.9%
   smaller than the Phase 2 baseline (8600/14320), marginally missing the
   ≥40% token-reduction gate. INTENT vetoes fixing it this milestone.
2. `runReadCli handles global flags before read`
   (`src/tests/read-cli-args.test.ts`, the `read-cli-args` suite) —
   isolation-sensitive: fails in the full run, passes standalone.

A third failure (`complete different-key contention rejects one stale writer
without residue`, `slice-lifecycle-multiprocess-contention.test.ts`) appeared
in one full run, passed standalone (6/6), and did not recur on the confirming
re-run — transient under process isolation, not a baseline failure.

**Build-flag dependency (recorded):** the 23 `migrate-safety-audit`
fault-injection tests call `setMutationBoundaryFaultForTest`, which exists
only when the native addon is built with `--test-fault-injection` —
`pnpm run build:native:test` is required; `build:core` alone leaves those 23
tests red (environmental, not a regression).

## ADR-046 step-8 removal-gate legs

ADR-046 step 8: "Delete legacy paths only after their replacements, fault and
restore gates, production routing closure, structural no-authority-read
tests, telemetry thresholds, and performance baselines pass."

| Leg | Status | Evidence / ruling |
|---|---|---|
| Replacements landed | **Satisfied** | `legacy-state-path-proof.mjs` PASS at audit HEAD (2026-08-22); legacy markdown state-read path deleted |
| Fault and restore gates | **Satisfied** | `workflow-authority-baseline.mjs` PASS 4/4 at audit HEAD; import fault/restore/backup suites present |
| Structural no-authority-read tests | **Satisfied** | `legacy-state-path-proof.mjs` PASS; shadow-gate structural checks 7/7 PASS |
| Production routing closure | **Partially satisfied** | Canonical lifecycle read authority cutover NOT done — D005 in force, 9 dossier blockers; the `lifecycle-shadow-no-cutover` gate's witnesses assert legacy-authoritative-on-disagreement as today's designed state |
| Telemetry thresholds | **Never built — explicit deferral** | Zero telemetry references in `legacy-import-*.ts`; existing counters cover other paths; no field telemetry exists at all |
| Performance baselines | **Never built — explicit deferral** | M3.6 projection benchmark and M9.6 five-surface comparison have no artifacts; only an unrelated auto-dispatch counter baseline exists |

### Compatibility-window legs

Import Preview/Application shipped in **v1.12.0 on 2026-08-03**; 19 days
elapsed at ruling time (2026-08-22).

- **2-stable-release leg: HOLDS** — "stable release" = non-`-dev` semver with
  a GitHub release; published artifacts are counted, not CHANGELOG headings.
- **≥60-day leg: FAILS under both readings.** Earliest window close is
  **2026-10-02** (ADR-literal: 60 days from v1.12.0) vs **2026-10-07**
  (v1-milestone-start reading). The controlling ≥60-day leg fails under BOTH
  readings; the verdict is identical either way. The v1 calendar waiver
  (2026-08-12) covered only the markdown state-derivation deletion and does
  not authorize the import/export machinery.

## ADR-046 invariants

| # | Invariant | Status | Evidence pointer / deferral ruling |
|---|---|---|---|
| 1 | Project DB is the only normal-runtime Workflow Authority | **Not satisfied** for the deferred lifecycle surfaces | Status-response, dispatch-resolution, validation-assessment surfaces are legacy-authoritative on disagreement by design under D005, pending a separate explicit lifecycle read-cutover decision; enforced by the `lifecycle-shadow-no-cutover` gate |
| 2 | Files mutate authority only via explicit, authorized import | **Satisfied with evidence** | `legacy-state-path-proof.mjs` PASS; import machinery is the only ingress |
| 3 | Cross-transport mutations revision-checked, fenced, idempotent | **Satisfied with evidence** | `db/domain-operation.ts` revision-checked write boundary; workflow-authority fault-boundary matrix PASS |
| 4 | At most one active Attempt per work item | **Partially evidenced** | ADR-048 `unit_dispatches`-row identity; completion audit (M11) never ran |
| 5 | Progress survives restart | **Satisfied with evidence** | Durable attempts (`unit_dispatches`, ADR-048); persisted checkpoints; ADR-047 records the v1.12.0 durable-attempt authority cutover |
| 6 | Nothing fabricates completion | **Partially evidenced** | Two filesystem guards retired by recorded decision R5 (SUMMARY-presence and checkbox checks unfailable); M11 negative audit never ran |
| 7 | Evidence/receipts exist before dependency unlock | **Partially evidenced** | Rests on `prepareCloseout`/`settleCloseout`; M11 requirement matrix never ran |
| 8 | Projection failure observable, repairable, non-authoritative | **Satisfied with evidence** | Workflow-authority `projection-conflict` invariant PASS at audit HEAD |
| 9 | Only the approved human-only taxonomy pauses for a person | **Partially evidenced** | Backstopped by ADR-047's liveness invariant; M11 completion audit never ran |
| 10 | Legacy adapters contain no independent policy or authority | **Not satisfied** for the deferred lifecycle surfaces | Same D005 deferral as Invariant 1 — legacy read authority is today's designed state, not drift |

## Deletion blocker (why nothing was deleted)

Deletion of the legacy import/export machinery is blocked on three legs:

1. **Compatibility window open.** The controlling ≥60-day leg fails under
   both readings: the window is open until earliest **2026-10-02**
   (ADR-literal, 60 days from v1.12.0 shipping 2026-08-03) or **2026-10-07**
   (v1-milestone-start reading).
2. **Telemetry-threshold leg never built.** No import-path usage
   instrumentation exists; the removal-gate telemetry structurally cannot
   observe the legacy import path.
3. **Performance-baseline leg never built.** No import/cutover performance
   baselines exist.

Supporting context (recorded, not itself a gate): active mid-window users
demonstrably exist (post-1.12.0 bug tail #1868, #1830, #1866); comparable
practice (K8s storage-decode rule, Terraform laddering, PEP 387, VS Code
`rootPath`) treats data-migration paths conservatively, never retrofits
telemetry at removal time, and accepts "deprecated but kept" as a legitimate
terminal state.

## Re-check trigger for any future deletion milestone

A future deletion milestone MUST re-check ALL of the following before any
deletion is scheduled. Note: **"time alone is not a Removal Gate"** applies at
re-check — the window closing is necessary but not sufficient.

- **(a) Window-close disambiguation.** Confirm the compatibility window has
  closed under the ADR-literal reading (**2026-10-02**) AND record which
  reading controls if work starts between 2026-10-02 and **2026-10-07** (the
  v1-milestone-start reading). The ≥60-day leg must pass under whichever
  reading is controlling at that time.
- **(b) Evidence legs that must exist first.** (i) Import-path usage
  instrumentation OR an explicit deprecation-warning stage proving
  observability of remaining import use; (ii) performance baselines for the
  import/cutover path; (iii) a fresh re-run of all step-8 removal gates at
  that milestone's HEAD.
- **(c) Step-7 restore windows.** Re-examine whether any ADR-046 step-7
  restore windows are still open in the field (unverifiable today without
  telemetry). Backups must outlive the import machinery by ≥1 stable release.
- **(d) Floor version for importable state.** State a floor version
  (Terraform-style laddering) below which pre-cutover projects are no longer
  importable, so permanently stranded source projects are an explicit,
  documented decision rather than an accident.
- **(e) Binding deletion plan.** The four "Future deletion sequencing"
  decisions in `.project/research/SYNTHESIS.md` are the binding plan:
  **utility re-homing** (`canonicalLegacyImportJson`, `hashLegacyImportValue`,
  `isStrictLegacyImportData`, `isValidLegacyImportPreviewArtifact` out of
  `legacy-import-preview.ts` et al. into a neutral module FIRST, with
  `gsd db restore-backup` bit-identical after re-homing), **schema trigger
  carve-out** (`import.forward_repair` left inert, no v49 migration),
  **user-facing seam re-pointing** (startup drift seam, `/gsd recover`,
  `/gsd migrate`, headless recover, four guidance strings, synchronized docs),
  and **`md-importer.ts` disposition** (deleted alongside the import cluster).

## Program deferrals (M9 / M10 / M11) with re-entry triggers

- **M9 (rollout telemetry / canary / performance gates):** undone program
  work — recorded as an explicit deferral. No open issue tracks it; this
  audit is the record. Re-entry trigger: the re-check above, element (b).
- **M10 (compatibility retirement / deletion):** this milestone's M10
  contribution is exactly the retention ruling (KEEP), the doc-drift
  remediation, and the gate-disposition work recorded here. The deletion
  half is deferred per the user ruling; re-entry trigger: the full re-check
  trigger above.
- **M11 (completion audit):** never ran, untracked, no open issue — recorded
  as undone program work. Re-entry trigger: the lifecycle cutover decision
  below, or any future deletion milestone, must first run the M11 negative
  audit, requirement matrix, and final drills.
- **M003 lifecycle read-authority cutover:** remains gated behind its own
  separate, explicit decision per **D005**. It is NOT absorbed into this
  milestone; pulling it in would silently amend D005.

## Gate dispositions

- **`lifecycle-shadow-no-cutover` gate: KEPT, unchanged**, in `verify:pr`
  with its 7 structural checks and 11 behavioral witnesses. Recorded
  disposition: it carries D005's invariants until the separate, explicit
  lifecycle read-authority cutover decision lands. **Retirement by silence is
  forbidden** — gate retirement never contradicts D005 by silence. Retirement
  is legitimate only after the deferred lifecycle cutover or a new explicit
  D005-amending ruling.
- **`legacy:cleanup:*` trio: KEPT, no retirement, no re-scoping.**
  - `legacy:cleanup:gate` / `legacy:cleanup:evidence` remain the standing
    deletion blocker for five OTHER live legacy paths — workflow templates,
    UOK fallback, MCP aliases, component format, provider defaults (7
    production counter call sites). Recorded caveat: they fail closed with no
    telemetry producer and currently pass only by construction on a
    hand-generated zero file. Retiring them would remove the only deletion
    gate for five still-shipping non-ADR-046 legacy subsystems.
  - `legacy:cleanup:proof` passes honestly on static analysis, but it keys on
    the already-retired markdown state-read path (`_deriveStateImpl`,
    `parsers-legacy`, the renamed `parseProjection*` parsers) — it gives
    **zero signal about import-deletion safety**. Recorded so no future
    milestone cites it as deletion evidence.
