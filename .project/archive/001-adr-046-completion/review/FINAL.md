# Final Review — path-fixes (finish ADR-046)

<!-- Written by the final integration reviewer. Each INTENT.md success
     criterion appears exactly once and carries checked evidence. -->

Reviewed HEAD: 0010a26abaedec5442558256d97dbfcbba0a9794
Overall verdict: pass

<!-- pass only when every criterion is met; blocked when any criterion is
     not-met or unverifiable. -->

Method note: all command runs in the verify sidecar
(`path-fixes.gsd-path/verify/review-final`, clean worktree at the reviewed
HEAD, `pnpm install --frozen-lockfile` exit 0). Veto sweep:
`git diff --name-only e210e12a41df85b2f02e1de65a2afc37b348ba12...0010a26abaedec5442558256d97dbfcbba0a9794 -- . ':!.project'`
shows exactly the 12 files from the T001/T002/T003 `files` lists (CONTEXT.md,
the gap-audit doc, the dossier JSON, 2 gitbook files, 4 dossier tooling/test
files, 3 SKILL.md files) — no legacy-import deletion, no vetoed area touched.
Gate re-runs in the sidecar: `legacy-state-path-proof` PASS;
`lifecycle-shadow-no-cutover-gate` exit 0 (18 PASS lines, zero FAIL);
`workflow-authority-baseline` 3/4 legs PASS with `fault-boundary-matrix`
tripping the documented load-sensitive 60s child cap
(`scripts/workflow-authority-baseline.mjs:81`, ETIMEDOUT at 60014–60016ms on
two alone runs; host load average ~29 on 10 cores) — the underlying test file
then passed 8/8 (94.7s) when run directly without the cap, confirming the
gate failure here is the pre-existing environmental flake recorded by both
wave reviews, not a milestone regression. The milestone's own gate re-run
records (gap-audit table, wave-1 isolated sidecar rerun PASS 4/4, wave-2
orchestrator reruns PASS 4/4 at merged HEAD) stand.

## Success criteria

### SC1 — A gap audit of every ADR-046 removal gate and invariant exists on disk, each marked satisfied-with-evidence or carrying an explicit ruling.

- **Verdict**: met
- **Check**: read `docs/dev/ADR-046-completion-gap-audit.md` at the reviewed HEAD; re-ran `node scripts/legacy-state-path-proof.mjs`, `node scripts/lifecycle-shadow-no-cutover-gate.mjs`, `node scripts/workflow-authority-baseline.mjs` in the sidecar
- **Observed**: the audit exists (one of the 12 milestone-diff files) and marks every leg: step-8 removal-gate table (`docs/dev/ADR-046-completion-gap-audit.md:65-72` — replacements/fault+restore/structural **Satisfied**, routing **Partially satisfied** under D005, telemetry and performance **Never built — explicit deferral**); compatibility-window legs (`:74-86`); all ten invariants each with status plus evidence pointer or deferral ruling (`:90-101`); M9/M10/M11/M003 program deferrals with re-entry triggers (`:158-174`); gate-disposition rulings (`:176-197`); gate re-run table with commands, verdicts, and run date 2026-08-22 (`:24-28`). Sidecar re-runs corroborate the satisfied-with-evidence marks (see method note for the environmental baseline caveat).
- **Reference**: `docs/dev/ADR-046-completion-gap-audit.md:1-197`
- **Finding**: none
- **Fix direction**: none

### SC2 — The compatibility-window question is settled with evidence: exact Import Preview/Application ship release, stable releases since, days elapsed — and a recorded user ruling on whether legacy import machinery deletion proceeds.

- **Verdict**: met
- **Check**: `grep -n '^## \[1\.' CHANGELOG.md` in the sidecar; read the audit's compatibility-window section and INTENT/SYNTHESIS ruling records
- **Observed**: audit `:74-86` records ship release **v1.12.0 on 2026-08-03** (verified: `CHANGELOG.md:238` `## [1.12.0] - 2026-08-03`), **19 days elapsed** at ruling time, the 2-stable-release leg HOLDS under the published-artifact counting rule (headings 1.13.0/1.14.0/1.15.0/1.15.1/1.16.0/1.16.1 confirmed; the audit notes v1.15.1 was never released and headings are not counted), and the controlling ≥60-day leg FAILS under both readings (earliest close 2026-10-02 ADR-literal / 2026-10-07 v1-milestone-start). The user ruling is recorded in three places: INTENT.md Corrections (2026-08-22, "Keep; document re-check trigger"), `.project/research/SYNTHESIS.md` ## User rulings, and the audit's Ruling section (`:11-17`).
- **Reference**: `docs/dev/ADR-046-completion-gap-audit.md:74-86`; `CHANGELOG.md:238`; `.project/intent/INTENT.md:153`
- **Finding**: none
- **Fix direction**: none

### SC3 — If deletion is authorized: no legacy import/export code paths remain at HEAD, and CI (test:unit:compiled + test:integration) is green. If not: the blocker and its re-check trigger are documented in the repo.

- **Verdict**: met
- **Check**: read the audit's blocker and re-check-trigger sections; veto sweep `git diff --name-only e210e12a...0010a26a -- . ':!.project'`
- **Observed**: the KEEP ruling (2026-08-22) selects the "If not" branch. The blocker is documented at `docs/dev/ADR-046-completion-gap-audit.md:103-122` (three legs: window open until earliest 2026-10-02/2026-10-07, telemetry-threshold leg never built, performance-baseline leg never built, plus recorded supporting context). The re-check trigger at `:124-156` carries every required element: (a) the 2026-10-02 vs 2026-10-07 window-close disambiguation (`:130-134`); (b) the evidence legs that must exist first — import-path instrumentation or a deprecation-warning stage, performance baselines, fresh step-8 gate re-run (`:135-139`); (c) re-examination of open step-7 restore windows with the ≥1-stable-release backup-outlives-import rule (`:140-142`); (d) the importable-state floor version, Terraform-style (`:143-146`); (e) the pointer to the four binding future-deletion sequencing decisions in `.project/research/SYNTHESIS.md`, naming `canonicalLegacyImportJson`/`hashLegacyImportValue` re-homing, the inert `import.forward_repair` carve-out, seam re-pointing, and `md-importer.ts` disposition (`:147-156`). "Time alone is not a Removal Gate" is stated at `:127-128`. The veto sweep confirms nothing was deleted — consistent with the KEEP ruling.
- **Reference**: `docs/dev/ADR-046-completion-gap-audit.md:103-156`
- **Finding**: none
- **Fix direction**: none

### SC4 — The `lifecycle-shadow-no-cutover` gate and `legacy:cleanup:*` scripts have a decided disposition (retired, or kept with a recorded reason).

- **Verdict**: met
- **Check**: `grep -n 'lifecycle-shadow-no-cutover\|legacy:cleanup' package.json` and `grep -n '"verify:pr"' package.json` in the sidecar; gate re-runs per method note
- **Observed**: both dispositions are decided as KEPT with recorded reasons in the audit (`:176-197`): the shadow gate stays unchanged in `verify:pr` carrying D005's invariants until a separate explicit lifecycle read-authority cutover decision ("retirement by silence is forbidden"); the `legacy:cleanup:*` trio is kept — `gate`/`evidence` remain the standing deletion blocker for five other live legacy paths (with the fail-closed/zero-file caveat recorded) and `proof` is recorded as giving zero import-deletion signal. All four scripts still exist (`package.json:77,80-82`) and `verify:pr` still includes `gate:lifecycle-shadow-no-cutover` (`package.json:139`). The gates pass at the reviewed HEAD (sidecar re-runs, method note).
- **Reference**: `docs/dev/ADR-046-completion-gap-audit.md:176-197`; `package.json:77,80-82,139`
- **Finding**: none
- **Fix direction**: none

### SC5 — No shipped doc in docs/, gitbook/, or mintlify-docs/ still describes the legacy `.gsd/milestones/` layout or otherwise contradicts the completed cutover.

- **Verdict**: met
- **Check**: `grep -rn 'GSD_ALLOW_MARKDOWN_DERIVE_FALLBACK' docs/ gitbook/ mintlify-docs/ CONTEXT.md`; `sed -n '1,20p' CONTEXT.md`; `grep -n '\.gsd/milestones/' src/resources/skills/{decompose-into-slices,handoff,write-milestone-brief}/SKILL.md`; survey `grep -rn '\.gsd/milestones/' docs/ gitbook/ mintlify-docs/` (69 hits) for contradictions
- **Observed**: judged against the synthesis doc-drift boundary decision (three named skill files, CONTEXT.md, the env-var rows). (1) `GSD_ALLOW_MARKDOWN_DERIVE_FALLBACK` appears nowhere in the three doc trees or CONTEXT.md (grep exit 1) — the gitbook env-vars row is removed and auto-mode.md states there is no markdown-derive fallback switch. (2) CONTEXT.md:7-12 carries the split truth: workflow state authority cut over, "Canonical lifecycle read authority for the deferred lifecycle surfaces has NOT cut over and remains legacy under the still-in-force D005 decision." (3) All three SKILL.md files describe the flat-phase `.gsd/phases/NN-slug/` layout as current and mark every `.gsd/milestones/` mention explicitly legacy on its line (`decompose-into-slices/SKILL.md:83`, `handoff/SKILL.md:52`, `write-milestone-brief/SKILL.md:72`). Residual `.gsd/milestones/` mentions in the three trees (e.g. `docs/user-docs/working-in-teams.md:42-43,52`, `docs/user-docs/troubleshooting.md:215,379,397`, zh-CN mirrors, dev PRDs/ADRs) either are explicitly labeled legacy ("legacy milestone artifacts, if the project has not migrated yet") or describe doctor/lock handling for still-supported legacy-layout projects — consistent with code truth (the legacy layout is retained at `paths.ts:667` per wave-1 review) and belonging to the 52-row remainder the user ruled out of scope (2026-08-22).
- **Reference**: `CONTEXT.md:7-12`; `src/resources/skills/decompose-into-slices/SKILL.md:83`; `src/resources/skills/handoff/SKILL.md:52`; `src/resources/skills/write-milestone-brief/SKILL.md:72`
- **Finding**: none blocking. Warning (scoping ambiguity, as the brief anticipated): read literally, SC5's "no shipped doc ... still describes the legacy `.gsd/milestones/` layout" would sweep in the unmarked gitignore-pattern lines in `working-in-teams.md:42-43` and the doctor-behavior entries in `troubleshooting.md`; the milestone passed only under the synthesis boundary decision scoping the criterion to the three skill files, CONTEXT.md, and the env-var rows. The scoping is defensible (those entries describe live legacy-layout handling, and the remainder queue was explicitly ruled out), but a future milestone fixing the 52-row remainder should not treat SC5's passage here as covering them.
- **Fix direction**: none
