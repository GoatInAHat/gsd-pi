---
id: T001
title: Re-run removal gates and write the ADR-046 completion gap audit
wave: 1
deps: []            # task ids whose output or landed effect this task needs
status: in-progress # orchestrator-owned: pending | in-progress | done | failed | blocked
agent: build_T001   # orchestrator-owned: set at dispatch
commit: null        # orchestrator-owned: exact task commit SHA
base: 20dbb856c7a1cdcee3cc5864eae7090fc88d26dc # orchestrator-owned: clean layer SHA for isolated Verify
worktree: /Users/jeremymcspadden/orca/workspaces/gsd-pi/path-fixes.gsd-path/task/T001 # orchestrator-owned: isolated task worktree while active
task_branch: gsd-path-task/T001 # orchestrator-owned: gsd-path-task/<id> while parallel; null when serial
files:              # every file this task may touch — dispatch checks overlap
  - docs/dev/ADR-046-completion-gap-audit.md
---

# T001 — Re-run removal gates and write the ADR-046 completion gap audit

## Context

The user ruled 2026-08-22: KEEP the legacy import/export machinery — nothing
is deleted this milestone. The milestone's central deliverable (INTENT
success criteria 1 and 3-"If not") is a gap-audit document on disk marking
every ADR-046 removal gate and invariant satisfied-with-evidence or carrying
its explicit ruling/deferral, including the deletion blocker and a concrete
re-check trigger. All decisions are settled in
`.project/research/SYNTHESIS.md` — treat it as binding and compose from it;
do not re-litigate. No removal gate is wired into CI, so the gate evidence
the audit cites must come from re-runs you perform at build HEAD in this
task.

## Approach

- Re-run the three gates at build HEAD BEFORE writing the audit, and record
  verbatim verdicts (command, pass/fail, date) in the audit:
  `node scripts/legacy-state-path-proof.mjs` (= `legacy:cleanup:proof`),
  `node scripts/workflow-authority-baseline.mjs` (= `baseline:workflow-authority`),
  `node scripts/lifecycle-shadow-no-cutover-gate.mjs` (= `gate:lifecycle-shadow-no-cutover`).
  If any gate is red, BLOCK — do not write "satisfied" over red evidence.
- Establish the honest unit-suite baseline at build HEAD:
  `pnpm run build:native:test` (required — the 23 `migrate-safety-audit`
  fault-injection tests need the `--test-fault-injection` addon; `build:core`
  alone is insufficient) then `pnpm run test:compile && pnpm run test:unit:compiled`.
  Record pass/fail counts and name the failures. Expected: only the two
  pre-existing, INTENT-vetoed failures — `prompt golden fixtures meet Phase 2
  reduction gate` and the isolation-sensitive `runReadCli handles global
  flags before read`. Do NOT fix them. Note in the audit that the
  fault-injection suite has a `build:native:test` build-flag dependency.
- Write `docs/dev/ADR-046-completion-gap-audit.md` (new; naming follows the
  `docs/dev/ADR-045-flat-phase-layout-completion.md` precedent). Required
  content, composed from `.project/research/SYNTHESIS.md` (## Settled,
  ## Decisions, ## Still unknown) and ADR-046
  (`docs/dev/ADR-046-database-authoritative-workflow-lifecycle.md:192-260`):
  - Every ADR-046 step-8 removal-gate leg with its status and evidence:
    replacements landed (satisfied), fault and restore gates (satisfied),
    structural no-authority-read tests (satisfied), production routing
    closure (partially satisfied — 9 dossier blockers), telemetry thresholds
    (never built — explicit deferral), performance baselines (never built —
    explicit deferral). Also the compatibility-window legs: 2-stable-release
    leg holds, ≥60-day leg fails (Import Preview/Application shipped v1.12.0
    on 2026-08-03; 19 days elapsed at ruling time).
  - All ten ADR-046 invariants: 2, 3, 5, 8 satisfied-with-evidence; 1 and 10
    not satisfied for the deferred lifecycle surfaces; 4, 6, 7, 9 partially
    evidenced — each carrying its evidence pointer or deferral ruling.
  - The deletion blocker (success criterion 3 "If not" branch): the window
    is open until earliest 2026-10-02 (ADR-literal: 60 days from v1.12.0)
    vs 2026-10-07 (v1-milestone-start reading) — state that the controlling
    ≥60-day leg fails under BOTH readings — plus the never-built
    telemetry-threshold and performance-baseline legs.
  - The concrete re-check trigger, which MUST carry: (a) the
    2026-10-02/2026-10-07 window-close disambiguation; (b) the evidence legs
    that must exist before any future deletion (import-path usage
    instrumentation or an explicit deprecation-warning stage; performance
    baselines; re-run of the step-8 gates); (c) re-examination of whether
    any ADR-046 step-7 restore windows are still open in the field (backups
    must outlive the import machinery by ≥1 stable release); (d) a floor
    version for importable state (Terraform-style); (e) a pointer to the
    four "Future deletion sequencing" decisions in
    `.project/research/SYNTHESIS.md` (utility re-homing, schema trigger
    carve-out, user-facing seam re-pointing, md-importer disposition) as the
    binding deletion plan. Note that "time alone is not a Removal Gate"
    applies at re-check.
  - The M9/M10/M11 program deferrals with re-entry triggers: M9 (rollout
    telemetry/canary/performance gates) and M11 (completion audit — never
    ran, untracked, no open issue) recorded as undone program work; the
    M003 lifecycle read-authority cutover remains gated behind its own
    separate explicit decision per D005. This milestone's M10 contribution
    is exactly the retention ruling, doc-drift, and gate-disposition work.
  - Gate dispositions (INTENT success criterion 4): the
    `lifecycle-shadow-no-cutover` gate is KEPT unchanged in `verify:pr` —
    it carries D005's invariants until the separate, explicit lifecycle
    read-authority cutover decision lands; retirement by silence is
    forbidden. The `legacy:cleanup:*` trio is KEPT with the recorded reason:
    `cleanup:gate`/`cleanup:evidence` remain the standing deletion blocker
    for five OTHER live legacy paths (workflow templates, UOK fallback, MCP
    aliases, component format, provider defaults) and fail closed with no
    telemetry producer (currently passing only by construction on a
    hand-generated zero file); `cleanup:proof` passes honestly on static
    analysis but keys on the retired markdown state-read path, giving zero
    signal about import-deletion safety.
- Do not touch any other file. No code changes, no gate edits, no deletions.
- Vetoes: no legacy import/export machinery deletion; no packages/db; no
  extension convergence; no plans 033/034; no prompt-golden gate fix; no
  shadow-gate or `legacy:cleanup:*` retirement/re-scoping; no rollback to
  disk authority.

## Interface contract

- Gap-audit artifact (produced by T001, consumed by T004):
  `docs/dev/ADR-046-completion-gap-audit.md` — a new Markdown file containing
  these literal, greppable strings: `2026-10-02`, `2026-10-07`, `D005`,
  `legacy:cleanup`, `lifecycle-shadow-no-cutover`, `prompt golden fixtures`,
  `read-cli-args`, `canonicalLegacyImportJson`. T004's Verify greps for
  exactly these strings at this path.

## Acceptance criteria

1. All three gates re-run at build HEAD pass, and the audit records each
   command, verdict, and run date.
2. `docs/dev/ADR-046-completion-gap-audit.md` exists and marks every ADR-046
   step-8 removal-gate leg and all ten invariants satisfied-with-evidence or
   carrying an explicit ruling/deferral with re-entry trigger.
3. The audit records the deletion blocker with the 2026-10-02/2026-10-07
   disambiguation, the never-built telemetry/performance legs, and a
   re-check trigger carrying elements (a)–(e) from Approach.
4. The audit records the M9/M11 deferrals, the D005-gated lifecycle-cutover
   deferral, and both gate dispositions (shadow gate kept carrying D005;
   `legacy:cleanup:*` kept with recorded reason).
5. The audit records the honest unit-suite baseline at build HEAD, naming
   `prompt golden fixtures meet Phase 2 reduction gate` and
   `runReadCli handles global flags before read` as the pre-existing,
   vetoed-from-fixing failures, and notes the fault-injection suite's
   `build:native:test` dependency.
6. The diff contains no file other than `docs/dev/ADR-046-completion-gap-audit.md`.

## Verify

```bash
node scripts/legacy-state-path-proof.mjs && node scripts/workflow-authority-baseline.mjs && node scripts/lifecycle-shadow-no-cutover-gate.mjs && for s in 2026-10-02 2026-10-07 D005 legacy:cleanup lifecycle-shadow-no-cutover 'prompt golden fixtures' read-cli-args canonicalLegacyImportJson; do grep -q "$s" docs/dev/ADR-046-completion-gap-audit.md || { echo "MISSING: $s"; exit 1; }; done
```

## Log

<!-- Append-only: coder summary, blocks (`NEEDS-ORCHESTRATOR: <question> —
     readings: <candidates>` for contract ambiguity), orchestrator answers,
     review verdicts, fixes. -->
- 2026-08-22 — created by planner
