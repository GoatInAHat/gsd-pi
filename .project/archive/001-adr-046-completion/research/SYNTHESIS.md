# Synthesis

<!-- Written by the decider role. The planner treats Decisions as settled. -->

## Settled

- Compatibility window — does NOT hold: Import Preview/Application shipped v1.12.0 (2026-08-03); 19 days elapsed vs the controlling ≥60-day leg; earliest close 2026-10-02 (ADR-literal) / 2026-10-07 (v1-milestone start) — verdict identical under both readings; "time alone is not a Removal Gate" (evidence-removal-gates.md § "window math — the 2-release leg holds under both readings; the 60-day leg fails under both"; ADR-046:253-260)
- Ship-release counting rule — "stable release" = non-`-dev` semver with a GitHub release; count published artifacts, not CHANGELOG headings (v1.15.1 was never released) (evidence-removal-gates.md § "'stable release' is well-defined" and § "CHANGELOG [1.15.1] was never released")
- Import-machinery telemetry thresholds — never built: zero telemetry references in `legacy-import-*.ts`, five existing counters cover other paths, no field telemetry exists at all (R1 accepted in v1) (evidence-removal-gates.md § "removal-gate telemetry exists but structurally cannot observe the legacy import path"; evidence-domain.md § "step-8 gate 'telemetry thresholds'")
- Performance baselines for import/cutover — never built; only an unrelated auto-dispatch counter baseline exists (evidence-removal-gates.md § "fault, restore, routing-closure… performance baselines for the import/cutover path were NEVER built"; evidence-domain.md § "step-8 gate 'performance baselines'")
- Step-8 satisfied legs — replacements landed, fault and restore gates, structural no-authority-read tests all pass with evidence at HEAD (evidence-domain.md § "step-8 gates 'replacements landed' and 'fault and restore gates' — SATISFIED" and § "step-8 gate 'structural no-authority-read tests' — SATISFIED")
- `legacy:cleanup:proof` gives zero signal about import-deletion safety — it keys on the already-retired markdown state-read path (`_deriveStateImpl`, `parsers-legacy`, renamed `parseProjection*` parsers), not the import path (evidence-stack.md § "the `parseLegacy*` proof passed because of a completed rename")
- `parseProjectionRoadmap`/`parseProjectionPlan` — excluded from deletion scope; load-bearing live code that survived a rename (evidence-stack.md § same finding)
- v1 calendar waiver (2026-08-12) — covered only the markdown state-derivation deletion, NOT the import/export machinery; it does not authorize this milestone's deletion half (evidence-removal-gates.md § "the v1 milestone already waived the 60-day calendar leg once"; evidence-domain.md § "compatibility window — import/export machinery fully shipped at HEAD; the wave-4 calendar waiver did NOT cover it")
- Deletion timing — settled by user ruling: the legacy import/export machinery is RETAINED this milestone; the milestone ships the documented blocker + re-check trigger instead (SYNTHESIS.md § User rulings, 2026-08-22)
- Deletion blast radius (recorded for the future deletion milestone) — ~31.5k production LOC (40 `legacy-import-*` modules + 16-file `migrate/` dependent), ~38k test LOC; confined to the gsd extension plus the `src/` host shell; zero consumers in packages/, web/, vscode-extension/, MCP, or tool registries (evidence-stack.md § "the deletion surface is 40 production modules" and § "zero downstream consumers")
- Deletion is surgery, not `git rm` — five non-import modules (`db-workspace.ts`, `db/domain-operation.ts`, `db/writers/authority-recovery.ts`, `project-authority-cutover-domain-operation.ts`, `gsd-db.ts`) hard-import the cluster, and `src/headless-recover.ts` jiti-loads two modules by filename (runtime, invisible to `tsc`) (evidence-stack.md § "core non-import modules import the legacy-import machinery" and § "the host shell outside the extension hard-depends on two legacy-import modules via runtime jiti loads")
- Restore-backup hashing dependency — `canonicalLegacyImportJson`/`hashLegacyImportValue` live in `legacy-import-preview.ts` but are used by must-not-break `gsd db restore-backup`; any future deletion must re-home them first (evidence-stack.md § "canonicalLegacyImportJson/hashLegacyImportValue live in legacy-import-preview.ts but are general-purpose"; INTENT.md "Must not break")
- Downgrade/version-skew — already handled loudly by refuse-newer version stamps (`SchemaTooNewError`) (evidence-pitfalls.md § "Downgrade/version-skew is already handled loudly at HEAD")
- D005 in force — canonical lifecycle read authority remains legacy by explicit decision; retiring the shadow gate by silence is forbidden by recorded milestone governance (evidence-domain.md § "step-8 gate 'production routing closure' — only PARTIALLY satisfied" and § "disposition — retiring the shadow gate without a new explicit decision contradicts a recorded milestone ruling")
- Invariant audit — Invariants 2, 3, 5, 8 satisfied-with-evidence; 1 and 10 not satisfied for the deferred lifecycle surfaces; 4, 6, 7, 9 partially evidenced; the M11 completion audit never ran and is untracked (evidence-domain.md § Invariants findings)
- ADR-047/048 — operational refinements; add no removal-gate or deletion scope (evidence-domain.md § "follow-on ADRs 047/048 are operational refinements")
- No gate is CI-enforced — removal gates run only via local `verify:pr`; evidence freshness is the last local run (evidence-removal-gates.md § "none of the removal-gate scripts are wired into CI")
- Gate doc promises — no doc promises either gate family permanently; promises are scoped to deletion events and D005 (evidence-domain.md § "disposition — no doc promises the gates permanently")
- Verification order — green unit suite requires `build:core` (or `build:native:test` for the fault-injection suite) → `test:compile` → `test:unit:compiled`, in the `verify:pr` order (evidence-codebase.md § "unit suite is green only in the exact order")
- Comparable-practice baselines — minimum windows are hard floors but scheduled removals are advisory; no comparable tool retrofits telemetry at removal time; "deprecated but kept" is a legitimate terminal state; data-migration paths get categorically longer retention than API deprecations (evidence-similar.md § "Synthesis for ruling (a)", § "Synthesis for ruling (c)", K8s/Node/PEP 387/VS Code/Terraform findings)

## Decisions

### Shadow gate (`lifecycle-shadow-no-cutover`) disposition

- **Decision**: KEEP the gate unchanged — it stays in `verify:pr` with its 7 structural checks and 11 behavioral witnesses; no edits. Its recorded disposition is "kept: carries D005's invariants until the separate, explicit lifecycle read-authority cutover decision lands."
- **Runner-up**: Retire — loses because the repo's own governance forbids it: "Gate retirement never contradicts D005 by silence," production routing closure for lifecycle surfaces is still open (9 dossier blockers), and the gate's witnesses assert the legacy-authoritative-on-disagreement behavior that is today's designed state. Retirement is legitimate only after the deferred lifecycle cutover or a new explicit D005-amending ruling.
- **Evidence**: evidence-domain.md § "disposition — retiring the shadow gate without a new explicit decision contradicts a recorded milestone ruling"; § "step-8 gate 'production routing closure' — only PARTIALLY satisfied"; § "disposition — complete consumer inventory for both gate families"
- **Confidence**: high

### `legacy:cleanup:*` trio disposition

- **Decision**: Keep `legacy:cleanup:proof` as-is (it passes honestly on static analysis). Keep `legacy:cleanup:gate`/`legacy:cleanup:evidence` with a recorded reason: they remain the standing deletion blocker for five OTHER live legacy paths (workflow templates, UOK fallback, MCP aliases, component format, provider defaults — 7 production counter call sites); document that they fail closed with no telemetry producer and currently pass only by construction on a hand-generated zero file. No retirement, no re-scoping work in this milestone.
- **Runner-up**: Retire the telemetry pair and keep only the proof — loses because it removes the only deletion gate for five still-shipping non-ADR-046 legacy subsystems and orphans `legacy-telemetry.ts`, expanding scope beyond ADR-046; re-scoping them into honest gates is new telemetry work the evidence shows was never built and this milestone is not chartered to build.
- **Evidence**: evidence-domain.md § "disposition — the `legacy:cleanup:*` gates still guard five OTHER live legacy paths"; § "step-8 gate 'telemetry thresholds' — NOT satisfiable at HEAD"; evidence-removal-gates.md § "the legacy:cleanup gate was hardened to fail-closed"
- **Confidence**: high

### Program scope: ADR-046 Milestones 9–11 and the lifecycle read-authority cutover

- **Decision**: Do NOT absorb M9 (rollout telemetry/canary/performance gates), M11 (completion audit), or the M003 lifecycle read-authority cutover into this milestone. The gap audit (success criterion 1) records each as an explicit deferral ruling with its re-entry trigger: M9/M11 tracked as undone program work (no open issue exists — the audit notes this), and the lifecycle cutover remains gated behind its own separate explicit decision per D005. This milestone's M10 contribution is exactly the retention ruling, doc-drift, and gate-disposition work decided here.
- **Runner-up**: Absorb the undone program work ("let research find the gaps") — loses because the lifecycle cutover is contractually a separate explicit decision (pulling it in would silently amend D005), M9/M11 are telemetry/benchmark construction this milestone has no charter or instrumentation base for, and INTENT scope centers on deletion + residual gates + doc drift.
- **Evidence**: evidence-domain.md § "scope-growth risk CONFIRMED — the twelve-milestone program has undone Milestones 9–11"; § "step-8 gate 'production routing closure'"; § "Invariants 1 and 10 — NOT satisfied for the deferred lifecycle surfaces"; INTENT.md § Scope and Corrections
- **Confidence**: high

### Doc-drift remediation boundary

- **Decision**: In scope for this milestone: (a) all shipped-doc claims in docs/, gitbook/, mintlify-docs/ (plus the zh-CN mirror) that contradict the completed cutover (legacy `.gsd/milestones/` layout and similar); (b) `CONTEXT.md:5-10` rewording to the split truth (state authority cut over; canonical lifecycle read authority NOT — precise wording required, not a blanket removal); (c) the `GSD_ALLOW_MARKDOWN_DERIVE_FALLBACK=1` doc rows in gitbook — the env var has no implementation, so the drift exists and is fixed regardless of other rulings. Out of scope by user ruling (2026-08-22): the remainder of the 52-row remediation queue (stays for later milestones) and the 12 external doc rows ("no ruling needed — external", confirming the v1 precedent).
- **Runner-up**: Fix the entire 52-row queue — lost at the synthesis checkpoint: the user ruled the remainder out of scope (and INTENT had vetoed it pending that ruling); most rows are not cutover contradictions.
- **Evidence**: evidence-pitfalls.md § "The documented markdown-fallback escape hatch GSD_ALLOW_MARKDOWN_DERIVE_FALLBACK=1 has no implementation"; evidence-domain.md § "scope-growth — CONTEXT.md still denies the completed cutover"; INTENT.md § Scope: in / Scope: out; SYNTHESIS.md § User rulings (2026-08-22)
- **Confidence**: high

### Dangling `semantic-shadow-no-cutover` references

- **Decision**: Repair in this milestone: remove the dead import of `runSemanticShadowNoCutoverGate` from `scripts/m003-s07-dossier-input.ts` (and its test), and correct the retired-command inventory in `scripts/m003-s07-cutover-dossier.mjs:104-109`. Small, flagged in v1 review and never fixed; unreachable from verify:pr/CI so risk is minimal.
- **Runner-up**: Defer with a note — loses on cost asymmetry: the fix is a few lines in three files and clears a known live landmine the dossier tooling crashes on.
- **Evidence**: evidence-domain.md § "scope-growth — dangling `semantic-shadow-no-cutover` references at HEAD"
- **Confidence**: high

### Deletion go/no-go — resolved by user ruling: KEEP

- **Decision**: The legacy import/export machinery is NOT deleted this milestone (user ruling, 2026-08-22: "Keep; document re-check trigger"). The milestone instead ships the "If not" branch of INTENT success criterion 3: the blocker and a concrete re-check trigger documented in the repo, homed in the gap-audit document (success criterion 1). The blocker: the compatibility window is open until earliest 2026-10-02 (ADR-literal start, v1.12.0) / 2026-10-07 (v1-milestone start, v1.13.0) — the gap audit must record both readings and state that the controlling ≥60-day leg fails under each — plus the never-built telemetry-threshold and performance-baseline legs of ADR-046 step 8. The re-check trigger must specify: (a) the window-close date disambiguation (2026-10-02 ADR-literal vs 2026-10-07 v1-milestone); (b) the evidence legs that must exist before any future deletion (import-path usage instrumentation or an explicit deprecation-warning stage, performance baselines, and re-run step-8 gates); (c) re-examination of whether any ADR-046 step-7 restore windows are still open in the field; and (d) a pointer to the four sequencing blocks below as the binding deletion plan. "Time alone is not a Removal Gate" applies at re-check.
- **Runner-up**: Delete now on static proof (extending the v1 wave-4 calendar waiver) — lost at the synthesis checkpoint. Against it: the window fails under both readings and the v1 waiver never covered the import machinery; the telemetry/performance legs were never built and no comparable tool retrofits telemetry at removal time; active mid-window users demonstrably exist (post-1.12.0 bug tail: #1868, #1830, #1866); data-migration paths get categorically longer retention than API deprecations (K8s storage-decode rule, Terraform laddering); and "deprecated but kept" is a legitimate terminal state (PEP 387, VS Code `rootPath`).
- **Evidence**: evidence-removal-gates.md § window math and § "removal-gate telemetry exists but structurally cannot observe the legacy import path"; evidence-pitfalls.md § "The import/recover path has a live bug tail at HEAD"; evidence-similar.md § "Synthesis for ruling (a)" and K8s/Terraform/PEP 387/VS Code findings; INTENT.md § Success criterion 3; SYNTHESIS.md § User rulings (2026-08-22)
- **Confidence**: high

### Future deletion sequencing — utility re-homing — MOOT this milestone (user ruled keep, 2026-08-22)

- **Decision**: Retained as binding sequencing for the future deletion milestone. When deletion is authorized, the FIRST task extracts `canonicalLegacyImportJson`, `hashLegacyImportValue`, `isStrictLegacyImportData`, `isValidLegacyImportPreviewArtifact` (and the recovery-action/consent surface `gsd db restore-backup` uses) from `legacy-import-preview.ts`/`legacy-import-restore-assessment.ts`/`legacy-import-recovery-action.ts` into a neutral module (e.g. under `db/`), re-pointing `db/domain-operation.ts`, `db/writers/authority-recovery.ts`, `project-authority-cutover-domain-operation.ts`, `commands-maintenance.ts`, and `migrate/publication-store.ts`. Only then does module deletion begin. `restore-backup` behavior must be bit-identical after re-homing.
- **Runner-up**: Delete-and-repair in one commit — loses because `restore-backup` is on the must-not-break list and a single-step removal couples the riskiest consumer to the largest diff.
- **Evidence**: evidence-stack.md § "canonicalLegacyImportJson/hashLegacyImportValue live in legacy-import-preview.ts"; evidence-pitfalls.md § "Core non-legacy modules import shared utilities from legacy-import-preview.js"; INTENT.md "Must not break"
- **Confidence**: high

### Future deletion sequencing — schema trigger carve-out — MOOT this milestone (user ruled keep, 2026-08-22)

- **Decision**: Retained as binding sequencing for the future deletion milestone. When deletion is authorized: leave `trg_workflow_lifecycle_transition`'s `import.forward_repair` escape hatch (and the three import receipt tables with their triggers) in place as inert historical SQL — NO v49 retirement migration. Post-deletion no code can mint `import.forward_repair`, so the carve-out can never fire; schema is additive and existing user databases keep their receipt tables untouched. Document the inert carve-out in the schema file comment. Schema-pinning tests (e.g. `gsd-recover.test.ts:188`) are updated to match.
- **Runner-up**: Retire the carve-out via a SCHEMA_VERSION 49 migration — loses because it mutates every existing database to remove a trigger that can no longer fire: migration risk on user data for zero behavioral change, against the additive-schema convention.
- **Evidence**: evidence-stack.md § "import-only DB schema is three receipt tables plus triggers baked into the core lifecycle-transition rule"
- **Confidence**: medium ⇒ the future deletion milestone must verify no live code path can still mint `import.forward_repair` post-deletion before locking the no-migration call

### Future deletion sequencing — user-facing seam re-pointing — MOOT this milestone (user ruled keep, 2026-08-22)

- **Decision**: Retained as binding sequencing for the future deletion milestone. When deletion is authorized, the deletion ship must include, in the same change set: (a) re-point the startup drift seam in `migration-auto-check.ts:353-384` (currently tells users to run `/gsd recover`) to an honest dead-end-free message; (b) remove/re-point `/gsd recover` (commands-maintenance.ts + ops.ts registration), `/gsd migrate` (migrate/ cluster + handlers), and headless recover (`src/headless-recover.ts`, `src/headless.ts:462`, `src/tests/headless-recover.test.ts`); (c) edit the four guidance strings (`migration-auto-check.ts:383`, `flat-phase-migration.ts:38`, `doctor-engine-checks.ts:1018`, `state/derive/db-open.ts:52-54`) and their tests; (d) synchronized doc edits across `docs/user-docs/migration.md`, `gitbook/reference/commands.md`, `gitbook/reference/troubleshooting.md`, `mintlify-docs/guides/migration.mdx`, `mintlify-docs/guides/troubleshooting.mdx`, and `docs/zh-CN/user-docs/migration.md`.
- **Runner-up**: Delete code first, fix docs/messages in a follow-up — loses because INTENT success criterion 5 forbids shipped docs contradicting code, and the pitfalls evidence shows the startup seam becomes a guided dead end the moment the code disappears.
- **Evidence**: evidence-pitfalls.md § "A markdown-only pre-cutover project opened at HEAD…", § "/gsd recover is implemented entirely by the legacy-import-* cluster", § "/gsd migrate also depends on the legacy-import cluster", § "All three shipped doc trees plus the zh-CN mirror promise the import/migration path", § "Multiple runtime error/guidance strings point users at the import path"; evidence-stack.md § jiti-load finding
- **Confidence**: high

### Future deletion sequencing — `md-importer.ts` disposition — MOOT this milestone (user ruled keep, 2026-08-22)

- **Decision**: Retained as binding sequencing for the future deletion milestone. When deletion is authorized, delete `md-importer.ts` alongside the import cluster: it is banner-quarantined test-only bypass machinery with zero production callers whose stated sanctioned alternative (the explicit Import Application) is exactly what deletion removes; keeping it would leave an unconsented markdown→DB write path as the only one in the tree.
- **Runner-up**: Keep it quarantined — loses because its purpose is mirroring the import-path contract in tests; with the contract gone it is dead scaffolding carrying a standing "DO NOT WIRE" hazard.
- **Evidence**: evidence-stack.md § "md-importer.ts is an explicitly quarantined test-only markdown→DB path adjacent to the deletion surface"
- **Confidence**: medium ⇒ the future deletion milestone must enumerate its test consumers before scheduling its removal

## For the planner

- **Wave-1 blockers**:
  1. Re-run the gates at build HEAD before writing the gap audit: `node scripts/legacy-state-path-proof.mjs`, `node scripts/workflow-authority-baseline.mjs`, `node scripts/lifecycle-shadow-no-cutover-gate.mjs` — no gate is CI-enforced, so evidence freshness is whatever the planner re-runs (evidence-removal-gates.md § CI finding).
  2. Confirm the green-CI recipe at build HEAD: `build:native:test` (not just `build:core`) is required for the `migrate-safety-audit.test.ts` fault-injection suite; replicate the `verify:pr` order exactly (evidence-codebase.md § unit-suite-order finding). The 23 fault-injection tests stay untouched this milestone (no deletion), but the audit should note their build-flag dependency.
  3. The gap audit's re-check-trigger wording is load-bearing (it is the milestone's success-criterion-3 deliverable): it must carry the 2026-10-02/2026-10-07 disambiguation, the evidence legs that must exist, the step-7 restore-window re-examination, and the pointer to the four moot sequencing blocks above — get it reviewed before closeout.
- **Walking skeleton**: The gap-audit document (success criterion 1) written to disk marking every ADR-046 removal gate and invariant satisfied-with-evidence or carrying its explicit ruling/deferral from this synthesis — including the deletion blocker + re-check trigger — plus the two ruling-independent doc fixes (`GSD_ALLOW_MARKDOWN_DERIVE_FALLBACK` rows, `CONTEXT.md` split-truth wording). Thinnest end-to-end slice; nothing in this milestone depends on further user input.
- **Pitfalls → tasks**:
  - `GSD_ALLOW_MARKDOWN_DERIVE_FALLBACK` documents a nonexistent escape hatch (evidence-pitfalls.md § fallback finding) → doc-drift task: fix or remove both gitbook rows.
  - `CONTEXT.md:5-10` denies the completed cutover (evidence-domain.md § CONTEXT.md finding) → doc-drift task: reword to the split truth (state authority cut over; lifecycle read authority not).
  - Dangling semantic-shadow imports crash dossier tooling (evidence-domain.md § dangling finding) → cleanup task per the decision above.
  - Doc drift contradicting the cutover across 3 trees + zh-CN mirror (INTENT success criterion 5; evidence-pitfalls.md § doc-trees finding for the migrate/recover promises, which remain TRUE under the keep ruling and must NOT be "corrected" away) → doc-drift task: fix only cutover-contradicting rows; the migration/recovery docs stay.
  - Gap-audit + re-check-trigger documentation (evidence-removal-gates.md § window math; evidence-domain.md § gap list) → the milestone's central deliverable per the Deletion go/no-go decision.
  - *For the future deletion milestone* (not tasks now): startup drift seam dead-end (re-point `migration-auto-check.ts`); jiti-loaded headless recover invisible to `tsc`; `/gsd migrate` hidden dependent promised in shipped docs; shared hash utilities in `legacy-import-preview.ts` (re-home first); four user-facing guidance strings; `cross-platform-filesystem-safety.test.ts:85` hardcoded `legacy-import-backup.ts` allowlist entry; permanent stranding of pre-cutover source projects (the re-check trigger must state a floor version for importable state, Terraform-style). All preserved in the four moot sequencing blocks above.

## User rulings

<!-- NEEDS-USER items answered at the synthesis checkpoint. Verbatim-ish. -->

- **Deletion ruling** (deferred from INTENT: removal-gate telemetry/performance baselines never built, and the compatibility window fails — delete on static proof or build evidence first?) → **"Keep; document re-check trigger"** (2026-08-22). The import machinery is retained; the milestone documents the blocker (window open until earliest 2026-10-02 + never-built telemetry/performance legs) and a concrete re-check trigger in the repo gap-audit document. Recorded reasoning (the evidence lean the user followed): every comparable practice treats data-migration paths conservatively, no tool retrofits telemetry at removal time, active mid-window users demonstrably exist, and "deprecated but kept" is a legitimate terminal state (evidence-similar.md § Synthesis for ruling (a), K8s storage-decode rule, PEP 387, VS Code rootPath; evidence-pitfalls.md § bug tail).
- **12 external doc rows** (Docker Desktop 4.58+, claude.ai installer, npx skills CLI, agent-browser CLI: confirm the v1 precedent or review individually) → **"No ruling needed — external"** (2026-08-22) for all 12, confirming the v1 precedent.
- **52-row remediation queue remainder** (in scope for this milestone?) → **"Out of scope"** (2026-08-22). Only cutover-contradicting drift is fixed this milestone; the remainder stays for later milestones.

## Still unknown

- Whether any ADR-046 step-7 restore windows are still open in the field (unverifiable without telemetry). With the keep ruling the restore machinery is retained and any open windows remain serviceable; the recorded re-check trigger must re-examine this question before any future deletion (backups must outlive import machinery by ≥1 stable release).
- Which historical release first shipped the V46 refuse-newer version stamps (shallow clone; unverifiable locally) — accept risk; downgrade safety at HEAD is proven regardless.
- Whether the `read-cli-args` isolation failure and prompt-golden Phase-2 gate miss at v1.16.1 are known/accepted — wave-1 verify at build HEAD (prompt-golden gate is INTENT-vetoed from fixing; only its red/green status matters for the CI-green criterion baseline).
- Which doc tree is canonical — deliberately unanswered; INTENT vetoes the decision. Doc-drift fixes above are per-tree edits that do not require resolving it.
- M11 completion-audit results (negative audit, requirement matrix, final drills) — can never be known without running the audit; deferred per the program-scope decision with re-entry trigger recorded in the gap audit.
