# Research Handoff

<!-- Written by the research orchestrator and consumed by decide. -->

Phase: research
Status: complete
Intent: `.project/intent/INTENT.md`

## Dispatch

<!-- Include every standard dimension exactly once. A custom dimension may
     supplement these rows, never replace a standard row. -->
- `domain` — dispatched → `.project/research/evidence-domain.md` — ADR-046 is the domain contract; owns the full gap list and gate-disposition questions; covers the scope-growth intent risk
- `stack` — dispatched → `.project/research/evidence-stack.md` — brownfield migration cost: blast radius and test coupling of deleting the legacy-import-* machinery (no RESEARCH question; dispatched for migration-cost risk)
- `pitfalls` — dispatched → `.project/research/evidence-pitfalls.md` — failure modes of premature compatibility-window deletion (downgrade, mid-migration users, backup/restore interplay) and which already exist in the mapped codebase
- `similar` — dispatched → `.project/research/evidence-similar.md` — comparable CLI/tool deprecation and compatibility-retirement practices; lessons that inform the deferred NEEDS-USER deletion ruling
- `removal-gates` — dispatched → `.project/research/evidence-removal-gates.md` — custom fifth dimension (supplements domain): compatibility-window math and removal-gate telemetry/performance threshold status

## Question assignments

<!-- Copy every [RESEARCH] question from INTENT.md exactly once. Use `- none`
     only when INTENT.md has no [RESEARCH] questions. -->
- `[RESEARCH] Exact Import Preview/Application ship release; stable releases since; days elapsed — does the 2-releases + ≥60-day window hold?` → `removal-gates`
- `[RESEARCH] Which removal-gate telemetry/performance thresholds exist with real data, and which were never built?` → `removal-gates`
- `[RESEARCH] Full gap list: every ADR-046 removal gate and invariant not yet satisfied at HEAD, with evidence.` → `domain`
- `[RESEARCH] Disposition options for the "lifecycle-shadow-no-cutover" gate and "legacy:cleanup:*" scripts after deletion (or after a no-delete ruling).` → `domain`
