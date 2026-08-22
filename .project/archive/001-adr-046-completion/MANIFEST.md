# Archive — 001-adr-046-completion

<!-- Written at ship time by /gsd-path-ship final. The archive's table of
     contents: a future audit must be able to reconstruct the milestone
     from this file. Append-only once written. The validator requires
     "Final verdict:" to be exactly the string shown below. -->

Milestone: adr-046-completion
Shipped: 2026-08-22
Final verdict: all criteria met; project verify passed
Waves: 2  Tasks: 4 done / 4 total  Review cycles used: 1/1
Carried forward: none

## Success criteria at ship

| Criterion | Verdict | Evidence |
|-----------|---------|----------|
| A gap audit of every ADR-046 removal gate and invariant exists on disk, each marked satisfied-with-evidence or carrying an explicit ruling. | met | docs/dev/ADR-046-completion-gap-audit.md:1-197 |
| The compatibility-window question is settled with evidence: exact Import Preview/Application ship release, stable releases since, days elapsed — and a recorded user ruling on whether legacy import machinery deletion proceeds. | met | docs/dev/ADR-046-completion-gap-audit.md:74-86`; `CHANGELOG.md:238`; `.project/intent/INTENT.md:153 |
| If deletion is authorized: no legacy import/export code paths remain at HEAD, and CI (test:unit:compiled + test:integration) is green. If not: the blocker and its re-check trigger are documented in the repo. | met | docs/dev/ADR-046-completion-gap-audit.md:103-156 |
| The `lifecycle-shadow-no-cutover` gate and `legacy:cleanup:*` scripts have a decided disposition (retired, or kept with a recorded reason). | met | docs/dev/ADR-046-completion-gap-audit.md:176-197`; `package.json:77,80-82,139 |
| No shipped doc in docs/, gitbook/, or mintlify-docs/ still describes the legacy `.gsd/milestones/` layout or otherwise contradicts the completed cutover. | met | CONTEXT.md:7-12`; `src/resources/skills/decompose-into-slices/SKILL.md:83`; `src/resources/skills/handoff/SKILL.md:52`; `src/resources/skills/write-milestone-brief/SKILL.md:72 |

## Contents

- BOARD.md
- intent/INTENT.md
- plan/PLAN.md
- research/DOCS-AUDIT.md
- research/RESEARCH.md
- research/SYNTHESIS.md
- research/evidence-codebase.md
- research/evidence-domain.md
- research/evidence-pitfalls.md
- research/evidence-removal-gates.md
- research/evidence-similar.md
- research/evidence-stack.md
- review/FINAL.md
- review/final-gap-1.md
- review/wave-1.cycle1.md
- review/wave-2.cycle1.md
- tasks/T001-adr046-gap-audit.md
- tasks/T002-cutover-doc-drift.md
- tasks/T003-dossier-semantic-shadow-repair.md
- tasks/T004-full-verify-merged-head.md

## Notes

- Central deliverable: `docs/dev/ADR-046-completion-gap-audit.md` — every ADR-046 removal gate and invariant with its status/evidence, the deletion blocker (compatibility window earliest close 2026-10-02 ADR-literal / 2026-10-07 v1-reading; telemetry and performance legs never built), and the concrete re-check trigger pointing at the four future-deletion sequencing decisions in research/SYNTHESIS.md (utility re-homing, schema trigger carve-out, seam re-pointing, md-importer disposition). The next deletion attempt starts there.
- SC5 passed under the synthesis doc-drift boundary scoping: only cutover-contradicting drift was in scope. The remainder of the DOCS-AUDIT remediation queue (~40 rows) was ruled out of scope by the user on 2026-08-22 and remains for later milestones; residual unmarked `.gsd/milestones/` mentions (e.g. `working-in-teams.md:42-43`) exist outside the scoped fixes.
- Honest-green baseline: the compiled unit suite exits nonzero on exactly two pre-existing, INTENT-vetoed failures (`prompt golden fixtures meet Phase 2 reduction gate`, `runReadCli handles global flags before read`); "green" means no failures beyond that set. One additional un-named flaky unit test appeared once in four full-suite runs and could not be reproduced (wave-2 review warning).
- T003 was blocked once (environmental 60s baseline child-cap timeout under parallel load) and completed on its one granted redispatch; three plan defects were repaired mid-build (two brief-lint prose-path false positives, one Verify whitelist omission) — all logged in the task files and BOARD.md, lessons carried to `.project/LESSONS.md`.
- Gate dispositions recorded in the audit: `lifecycle-shadow-no-cutover` KEPT (carries D005 until a separate explicit lifecycle read-authority cutover decision); `legacy:cleanup:*` KEPT (still gates five other live legacy paths; the telemetry pair fails closed with no producer and passes only on a hand-generated zero file — known debt).
- Program deferrals with re-entry triggers: ADR-046 M9 (rollout telemetry/canary/perf), M11 (completion audit), and the M003 lifecycle read-authority cutover (D005-gated) are NOT done and are untracked by any open issue.
