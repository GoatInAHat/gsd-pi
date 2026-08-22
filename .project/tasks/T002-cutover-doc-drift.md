---
id: T002
title: Fix cutover-contradicting doc drift (CONTEXT.md, GSD_ALLOW_MARKDOWN_DERIVE_FALLBACK, legacy-layout skill rows)
wave: 1
deps: []            # task ids whose output or landed effect this task needs
status: in-progress # orchestrator-owned: pending | in-progress | done | failed | blocked
agent: build_T002   # orchestrator-owned: set at dispatch
commit: null        # orchestrator-owned: exact task commit SHA
base: 20dbb856c7a1cdcee3cc5864eae7090fc88d26dc # orchestrator-owned: clean layer SHA for isolated Verify
worktree: /Users/jeremymcspadden/orca/workspaces/gsd-pi/path-fixes.gsd-path/task/T002 # orchestrator-owned: isolated task worktree while active
task_branch: gsd-path-task/T002 # orchestrator-owned: gsd-path-task/<id> while parallel; null when serial
files:              # every file this task may touch — dispatch checks overlap
  - CONTEXT.md
  - gitbook/reference/environment-variables.md
  - gitbook/core-concepts/auto-mode.md
  - src/resources/skills/decompose-into-slices/SKILL.md
  - src/resources/skills/handoff/SKILL.md
  - src/resources/skills/write-milestone-brief/SKILL.md
---

# T002 — Fix cutover-contradicting doc drift

## Context

The v1 milestone shipped the ADR-046 state-authority cutover, but shipped
docs still contradict it in three ruled-in-scope places (synthesis
"Doc-drift remediation boundary" decision): (a) the three bundled-skill
files flagged in `.project/research/DOCS-AUDIT.md` remediation queue rows
37, 38, 40 present the legacy `.gsd/milestones/<MID>/` layout as current;
(b) `CONTEXT.md:7-10` blanket-denies the completed cutover; (c) two gitbook
pages document `GSD_ALLOW_MARKDOWN_DERIVE_FALLBACK=1`, an escape hatch with
no implementation anywhere in the repo (evidence-pitfalls.md). The user
ruled 2026-08-22 that the remainder of the 52-row remediation queue is OUT
of scope. The import/migration/recovery doc promises stay — they remain TRUE
under the keep ruling and must not be "corrected" away.

## Approach

- Queue rows 37, 38, 40 (the ONLY in-scope queue rows): update
  `src/resources/skills/decompose-into-slices/SKILL.md`,
  `src/resources/skills/handoff/SKILL.md`, and
  `src/resources/skills/write-milestone-brief/SKILL.md` so the flat-phase
  layout (`phases/NN-slug/NN-*.md`) is described as current — code truth:
  `paths.ts:208,905` and `auto-artifact-paths.ts:70-71` under
  `src/resources/extensions/gsd/`; the legacy layout code is at
  `paths.ts:659-667,817`. Any retained .gsd/milestones/ mention must be
  explicitly marked as the legacy pre-flat-phase layout on its line.
  Verify each fixed row by re-running the audit's claim check: confirm the
  doc's claim now matches those code locations. Row 39 (same file as row
  40, `gsd_milestone_new` naming) is NOT cutover-contradicting and stays
  untouched per the out-of-scope ruling.
- `CONTEXT.md:7-10`: replace the blanket "do not describe current runtime
  authority until the relevant cutover has completed" denial with the split
  truth — precise wording required, not a blanket removal: workflow STATE
  authority HAS cut over (state.ts derives from the DB only; markdown is
  never a live-path fallback), while canonical LIFECYCLE READ authority for
  the deferred lifecycle surfaces has NOT cut over and remains legacy per
  the still-in-force D005 decision. The phrase `lifecycle read authority`
  must appear.
- `GSD_ALLOW_MARKDOWN_DERIVE_FALLBACK`: REMOVE both gitbook rows —
  `gitbook/reference/environment-variables.md:13` (table row) and
  `gitbook/core-concepts/auto-mode.md:54-55` (prose). The env var has no
  implementation; documenting it is the drift. Reword the surrounding
  auto-mode passage to state the plain truth: the database is authoritative
  and there is no markdown-derive fallback switch. Do not add the var
  anywhere else.
- Check the mirrors before editing: the zh-CN tree and the
  docs//mintlify-docs trees contain .gsd/milestones/ mentions, but the
  audit verified them as correctly qualified ("legacy", "until migrated") —
  do NOT touch them. Do not touch `docs/user-docs/migration.md`,
  `gitbook/reference/troubleshooting.md`, `mintlify-docs/guides/migration.mdx`,
  `mintlify-docs/guides/troubleshooting.mdx`, or the zh-CN migration doc —
  their import/recovery promises remain true under the keep ruling.
- Vetoes: no other remediation-queue rows; no declaring a canonical doc
  tree; no restructuring across the three doc trees.

## Interface contract

- None

## Acceptance criteria

1. `gitbook/` contains zero occurrences of `GSD_ALLOW_MARKDOWN_DERIVE_FALLBACK`;
   the auto-mode passage now states the database is authoritative with no
   markdown-derive fallback switch.
2. `CONTEXT.md` no longer claims the ADR-046 vocabulary "do[es] not describe
   current runtime authority until the relevant cutover has completed"; the
   replacement wording distinguishes cut-over state authority from the
   still-legacy canonical lifecycle read authority (D005) and contains the
   phrase `lifecycle read authority`.
3. The three named SKILL.md files describe the flat-phase layout as current;
   every remaining `.gsd/milestones/` mention in them is explicitly marked
   legacy.
4. The import/migration/recovery docs (docs/user-docs/migration.md, gitbook
   and mintlify troubleshooting/migration pages, zh-CN mirrors) are
   byte-untouched.
5. The diff touches only the six files listed in `files` — no other
   remediation-queue row is fixed.

## Verify

```bash
! grep -rn 'GSD_ALLOW_MARKDOWN_DERIVE_FALLBACK' gitbook/ && ! grep -q 'do not describe current runtime authority until the relevant cutover' CONTEXT.md && grep -qi 'lifecycle read authority' CONTEXT.md && ! { grep -h '\.gsd/milestones' src/resources/skills/decompose-into-slices/SKILL.md src/resources/skills/handoff/SKILL.md src/resources/skills/write-milestone-brief/SKILL.md | grep -iv legacy | grep -q .; } && git diff --name-only HEAD | grep -vE '^(CONTEXT.md|gitbook/reference/environment-variables.md|gitbook/core-concepts/auto-mode.md|src/resources/skills/decompose-into-slices/SKILL.md|src/resources/skills/handoff/SKILL.md|src/resources/skills/write-milestone-brief/SKILL.md)$' | (! grep .)
```

## Log

<!-- Append-only: coder summary, blocks (`NEEDS-ORCHESTRATOR: <question> —
     readings: <candidates>` for contract ambiguity), orchestrator answers,
     review verdicts, fixes. -->
- 2026-08-22 — created by planner
- 2026-08-22 — plan-defect repair (orchestrator): removed backticks around two .gsd/milestones/ prose mentions in Approach — the brief linter extracted them as path tokens missing at the layer base; the string names a legacy layout, not a repo path. No contract change.
