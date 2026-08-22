# Lessons

<!-- One line per repeat-offender criterion or board escalation, written at
     ship time. Stays active across milestones; the planner reads it. -->

- 001-adr-046-completion — Task-brief prose: the brief linter extracts backticked strings containing `/` as path tokens; legacy-layout strings (e.g. .gsd/milestones/) and retired-script paths must stay unbackticked in Context/Approach/Interface sections or lint fails before dispatch.
- 001-adr-046-completion — A task Verify with a `git diff --name-only` whitelist clause must include the task file itself; the role-mandated append-only Log edit otherwise fails the orchestrator's authoritative post-Log rerun (T002 plan defect).
- 001-adr-046-completion — `workflow-authority-baseline.mjs`'s hardcoded 60s child timeout is load-sensitive: it ETIMEDOUTs under parallel agent load (hit T003's dispatch and the final reviewer) and passes solo in 31–38s. Serialize heavy gate/suite runs; never dispatch two full-suite runners concurrently.
- 001-adr-046-completion — Fresh-checkout verify runs must interpose the ci.yml:226-228 addon copy (`cp native/addon/*.node dist-test/native/addon/`) between `test:compile` and `test:unit:compiled` or 23 fault-injection tests fail environmentally against the published binary; PLAN Project-verify commands should spell this out.
- 001-adr-046-completion — Landing conflicts: orchestrator appends to a task file's Log tail while a coder is in flight collide with the coder's own Log append in the landing cherry-pick; defer orchestrator Log lines to post-landing bookkeeping commits.
