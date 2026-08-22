# Evidence — removal-gates

<!-- Written by one researcher role. Consumed by the decider. -->

Dimension: custom
Questions assigned:
- `[RESEARCH] Exact Import Preview/Application ship release; stable releases since; days elapsed — does the 2-releases + ≥60-day window hold?`
- `[RESEARCH] Which removal-gate telemetry/performance thresholds exist with real data, and which were never built?`

Environment confirmed 2026-08-22: `date` → 2026-08-22; `gh auth status` → logged in (repo open-gsd/gsd-pi); live web/fetch available. The ADR-046 gate text under test (docs/dev/ADR-046-database-authoritative-workflow-lifecycle.md:253-260): step 8 — "Delete legacy paths only after their replacements, fault and restore gates, production routing closure, structural no-authority-read tests, telemetry thresholds, and performance baselines pass"; window — "two stable releases and at least 60 days, whichever is longer, beginning when Import Preview and Import Application ship. Time alone is not a Removal Gate."

## Finding: Import Preview and Import Application first shipped in v1.12.0 (2026-08-03)

- **Claim**: The entire legacy import compatibility cluster — "compile legacy import preview", "seal public legacy import preview", "freeze import application contract", "compose transactional legacy import application", "route explicit recover through import application", "add typed authority cutover", "add crash-safe live import restore", "add forward import repair", plus the verified-backup entries — first appears in a shipped release at v1.12.0, published to npm 2026-08-03T04:38:49Z. No `import preview`/`import application` entry exists in any earlier CHANGELOG section (≤1.11.0).
- **Source**: `CHANGELOG.md:238-284` (the [1.12.0] - 2026-08-03 `### Added` block); `grep -nE '(?i)import (preview|application)|legacy import' CHANGELOG.md` → first hits all inside the 1.12.0 section; `gh release view v1.12.0 --repo open-gsd/gsd-pi --json body` → 10 matches for import-preview/application/legacy-import; `npm view @opengsd/gsd-pi time --json` → `"1.12.0": "2026-08-03T04:38:49.511Z"`.
- **Confidence**: high
- **Why it matters here**: The ADR-046 window starts "when Import Preview and Import Application ship" — this is the earliest defensible window start, and it drives the compatibility-window math INTENT success criterion 2 demands.

## Finding: the DB-authority cutover (distinct event) shipped in v1.13.0 (2026-08-08)

- **Claim**: The cutover itself — "cut project state over to DB authority (#1627)" — shipped in v1.13.0, published 2026-08-08T00:28:34Z. The v1 milestone's wave-4 closeout used v1.13.0 as the window start ("cutover release v1.13.0 (2026-08-08); subsequent stables v1.14.0 and v1.15.0"), which is a later and more conservative start than the ADR's literal "when Import Preview and Import Application ship" (v1.12.0).
- **Source**: `CHANGELOG.md:217-220`; `gh release view v1.13.0 --json body` (body leads with the #1627 cutover entry); `npm view @opengsd/gsd-pi time --json` → `"1.13.0": "2026-08-08T00:28:34.478Z"`; `.project/archive/v1-state-db-cutover/` closeout quoted in `docs/dev/state-db-cutover-milestone-decision.md:248-250`.
- **Confidence**: high
- **Why it matters here**: INTENT.md records the prior milestone's v1.13.0 assumption; the decider must know the ADR-literal start (v1.12.0) and the v1-milestone start (v1.13.0) differ by 5 days — both readings are shown below and the verdict is identical under each.

## Finding: "stable release" is well-defined — every GitHub release is stable; npm dev builds are `-dev.<sha>` prereleases

- **Claim**: All 19 GitHub releases (v1.0.2 through v1.16.1) have `prerelease=false, draft=false`. npm additionally carries `-dev.<sha>` builds (e.g. `1.16.0-dev.8d166721`) that never become GitHub releases and are cleaned by a dedicated workflow. "Stable release" in the repo's own practice = a non-`-dev` semver version published to npm with a matching GitHub release.
- **Source**: `gh api repos/open-gsd/gsd-pi/releases --jq '.[] | "\(.tag_name) prerelease=\(.prerelease) draft=\(.draft)"'` → all `prerelease=false draft=false`; `npm view @opengsd/gsd-pi versions --json` (dev builds carry `-dev.<sha>`); `.github/workflows/cleanup-dev-versions.yml` exists.
- **Confidence**: high
- **Why it matters here**: INTENT success criterion 2 requires "stable releases since" — this pins the counting rule so the window math is not ambiguous about what counts.

## Finding: window math — the 2-release leg holds under both readings; the 60-day leg fails under both; the window does NOT hold

- **Claim**: As of 2026-08-22. Reading A (ADR-literal start, v1.12.0 = 2026-08-03): 5 stable releases since (1.13.0, 1.14.0, 1.15.0, 1.16.0, 1.16.1), 19 days elapsed. Reading B (v1-milestone start, v1.13.0 = 2026-08-08): 4 stable releases since (1.14.0, 1.15.0, 1.16.0, 1.16.1), 14 days elapsed. The ADR requires "two stable releases AND at least 60 days, whichever is longer" — the longer leg is 60 days in both readings, and it has not elapsed. Earliest possible window close: 2026-10-02 (reading A) or 2026-10-07 (reading B). Separately, "Time alone is not a Removal Gate": even after the calendar leg elapses, the step-8 evidence gates must also pass.
- **Source**: dates from `gh release list --repo open-gsd/gsd-pi` and `npm view @opengsd/gsd-pi time --json` (quoted above); arithmetic from `date` = 2026-08-22; gate text `docs/dev/ADR-046-database-authoritative-workflow-lifecycle.md:253-260`.
- **Confidence**: high
- **Why it matters here**: This is the direct answer to INTENT success criterion 2 and gates the deletion half of the milestone — as of today the compatibility window has not closed, so calendar time alone cannot authorize deletion; a user ruling (the deferred NEEDS-USER item) is required.

## Finding: CHANGELOG [1.15.1] (2026-08-14) was never released — no GitHub release, no npm publish

- **Claim**: The CHANGELOG carries a `[1.15.1] - 2026-08-14` section (four auto-mode closeout fixes), but `gh release list` shows no v1.15.1 and `npm view versions` jumps 1.15.0 → 1.16.0. Counting "stable releases" from the CHANGELOG alone would overcount by one.
- **Source**: `CHANGELOG.md:135-141`; `gh release list --repo open-gsd/gsd-pi --limit 40` (v1.15.0 → v1.16.0, no v1.15.1); `npm view @opengsd/gsd-pi versions --json` (no 1.15.1).
- **Confidence**: high
- **Why it matters here**: Keeps the release count honest for criterion 2 — count published artifacts (GitHub/npm), not changelog headings. The window verdict is unchanged either way.

## Finding: the v1 milestone already waived the 60-day calendar leg once (2026-08-12, project owner)

- **Claim**: The v1 wave-4 closeout record states: "Timebox waiver: cutover release v1.13.0 (2026-08-08); subsequent stables v1.14.0 and v1.15.0; remaining ≥60-day calendar window waived by the project owner ('finish all waves')." The deletion of the legacy *markdown state-derivation* path proceeded on that waiver plus static proof; the explicit legacy *import/export* machinery was not deleted and still ships at HEAD (~35 `legacy-import-*.ts` source files under `src/resources/extensions/gsd/`).
- **Source**: `docs/dev/state-db-cutover-milestone-decision.md:246-260` (closeout evidence table); `.project/archive/v1-state-db-cutover/` (read-only); `Glob src/resources/extensions/gsd/legacy-import*` (files present at HEAD).
- **Confidence**: high
- **Why it matters here**: INTENT's deferred NEEDS-USER ruling asks whether to "delete on static proof (extends the v1 wave-4 calendar waiver)" — this documents that the waiver precedent exists and exactly what it covered (markdown fallback path, not the import machinery).

## Finding: removal-gate telemetry exists but structurally cannot observe the legacy import path — no import-path counter was ever built

- **Claim**: The telemetry subsystem (`legacy-telemetry.ts` + `legacy-cleanup-gate.mjs`) tracks exactly five counters — `legacy.workflowEngineUsed`, `legacy.uokFallbackUsed`, `legacy.mcpAliasUsed`, `legacy.componentFormatUsed`, `legacy.providerDefaultUsed`. None instruments the legacy import/export path: a grep of all `legacy-import-*.ts` sources for `telemetry`/`incrementLegacyTelemetry` returns zero hits, and no `importPreviewUsed`/`importApplicationUsed`-class counter exists anywhere. The `markdownFallbackUsed` precedent holds at HEAD: that string appears only in docs/archive, never in code. `getDeriveTelemetry` records only a process-local `dbDeriveCount`. Persistence is opt-in local-file only (`GSD_LEGACY_TELEMETRY_FILE` env); there is no remote/field telemetry at all — the milestone decision doc admits this verbatim ("R1 — No field telemetry for the installed base"). The v1 wave-3 reviews further documented that all-zero counters were "guaranteed by construction" (report written on `beforeExit` whether or not any legacy path ran).
- **Source**: `src/resources/extensions/gsd/legacy-telemetry.ts:9-29`; `scripts/legacy-cleanup-gate.mjs:9-16`; `grep -rn 'telemetry' src/resources/extensions/gsd/legacy-import-*.ts` → 0 hits; repo-wide `Grep markdownFallbackUsed` → docs/archive only; `src/resources/extensions/gsd/state/derive/cache.ts:15-27`; `docs/dev/state-db-cutover-milestone-decision.md:125-133`; `.project/archive/v1-state-db-cutover/review/wave-3.cycle2.md:373-379`.
- **Confidence**: high
- **Why it matters here**: Direct answer to the second RESEARCH question and to INTENT's top risk — the "telemetry thresholds" leg of ADR-046 step 8 was never built for the thing this milestone would delete; deletion authorization must come from the user ruling, not from telemetry.

## Finding: the legacy:cleanup gate was hardened to fail-closed after the v1 milestone; it blocks on absent telemetry

- **Claim**: At HEAD, `legacy-cleanup-gate.mjs` throws on a missing telemetry file ("No telemetry file provided", "telemetry evidence missing — cannot prove zero usage") and treats stale reports (>24h) as non-evidence; `legacy-cleanup-evidence.mjs` fails closed likewise. This reverses the wave-3-era behavior where the gate "exits 0 with 'No telemetry file provided' rather than proving anything". The gate also and's in the static `legacy-state-path-proof` (symbol-keyed no-caller/no-importer proof).
- **Source**: `scripts/legacy-cleanup-gate.mjs:1-4,56,74-83,126`; `scripts/legacy-cleanup-evidence.mjs:1-5,14`; `scripts/legacy-state-path-proof.mjs:1-25`; contrast `.project/archive/v1-state-db-cutover/review/wave-3.cycle4.md:329-332`.
- **Confidence**: high
- **Why it matters here**: The gate machinery for the removal evidence exists and is honest about its limits — the decider should know the gate now *blocks* rather than rubber-stamps, which shapes the "document the blocker and re-check trigger" branch of success criterion 3.

## Finding: fault, restore, routing-closure, and structural no-authority-read gates EXIST as real test suites/proofs; performance baselines for the import/cutover path were NEVER built

- **Claim**: Per ADR-046 step 8, item by item at HEAD:
  - *Fault gates*: exist — `workflow-authority-faults.test.ts`, `workflow-fault-harness.test.ts`, `legacy-import-application-fault.test.ts` (13 tests), `legacy-import-live-restore-fault.test.ts` (21 tests), `migrate-safety-audit.test.ts` (23 fault-injection checks, requires `build:native:test`); orchestrated by `scripts/workflow-authority-baseline.mjs` / `baseline:workflow-authority`.
  - *Restore gates*: exist — `legacy-import-restore-drill.test.ts` (7 tests), `legacy-import-live-restore.test.ts`, `legacy-import-backup-verification.test.ts`, plus restore-drill worker fixtures.
  - *Production routing closure*: evidenced by the v1.13.0 cutover (#1627), v1.16.0 "delete leftover filesystem-state read path", and the symbol-keyed static proof `legacy-state-path-proof.mjs` (PASS at v1 closeout).
  - *Structural no-authority-read tests*: exist — `derive-seam-authority.test.ts:201` spies on `fs.readFileSync`/`fs.promises.readFile` and asserts the live derive path never opens markdown projections; plus `project-authority-cutover*.test.ts`, `implicit-import-*-authority.test.ts`.
  - *Performance baselines*: NOT built for import/cutover. The only committed baseline artifact is `scripts/baselines/auto-dispatch-73e20e70.json` — a per-dispatch auto-mode counter baseline for issue #442 (synthetic fixture, explicitly relative counters), unrelated to import/cutover performance. No import preview/application or cutover performance baseline exists anywhere; the plan-of-plans lists desired DB perf metrics (derive p95, migration wall time) as aspirations only.
- **Source**: `ls src/resources/extensions/gsd/tests/ | grep authority`; `grep -c 'test('` on the three fault/restore suites; `scripts/workflow-authority-baseline.mjs:9-30`; `src/resources/extensions/gsd/tests/derive-seam-authority.test.ts:198-251`; `ls scripts/baselines/` (single file); `scripts/auto-dispatch-baseline.mjs:1-14`; `docs/dev/2026-05-03-long-running-refactor-plan-of-plans.md:718`.
- **Confidence**: high (existence/non-existence of repo artifacts); medium on whether the existing fault/restore suites satisfy ADR-046's intent for "gates" (they are tests, not release-blocking thresholds — a judgment for the decider)
- **Why it matters here**: Answers the second RESEARCH question's full inventory: four of six step-8 legs have real artifacts; the telemetry-thresholds leg was never built for the import path and the performance-baseline leg was never built at all — both feed the deferred NEEDS-USER ruling.

## Finding: none of the removal-gate scripts are wired into CI — they run only via local `verify:pr`

- **Claim**: No workflow under `.github/workflows/` references `gate:lifecycle-shadow-no-cutover`, `legacy:cleanup:*`, `legacy-state-path-proof`, `baseline:workflow-authority`, or `auto-dispatch-baseline`. `verify:pr` (package.json:139) chains `build:core && typecheck:extensions && test:unit && gate:lifecycle-shadow-no-cutover`, but CI (`ci.yml`) runs the unit suites and fast gates, not `verify:pr` and not the removal gates.
- **Source**: `grep -rin 'shadow|legacy' .github/workflows/` → no matches; `package.json:138-139`; `scripts/ci-fast-gates.sh` (no gate invocations).
- **Confidence**: high
- **Why it matters here**: Removal-gate evidence is only as fresh as the last local run; the decider cannot assume CI continuously enforces any step-8 leg, which matters for the "satisfied-with-evidence vs explicit ruling" audit in success criterion 1.

## Assigned questions — answers

- `[RESEARCH] Exact Import Preview/Application ship release; stable releases since; days elapsed — does the 2-releases + ≥60-day window hold?` → **Ship release: v1.12.0 (2026-08-03)** — first release containing Import Preview and Import Application (CHANGELOG.md:238-284; v1.12.0 GitHub release body; npm publish 2026-08-03T04:38:49Z). The later DB-authority cutover shipped v1.13.0 (2026-08-08), which the v1 milestone used as its window start. "Stable" = non-`-dev` npm version with a GitHub release (all 19 GitHub releases are non-prerelease). Stable releases since: **5** under the ADR-literal start (1.13.0–1.16.1), **4** under the v1-milestone start (1.14.0–1.16.1) — the 2-release leg holds either way. Days elapsed as of 2026-08-22: **19** (from v1.12.0) or **14** (from v1.13.0) — the ≥60-day leg fails either way. **The window does NOT hold**: "whichever is longer" makes 60 days the controlling leg; earliest close is 2026-10-02 (reading A) / 2026-10-07 (reading B), and even then "time alone is not a Removal Gate" — the step-8 evidence legs must also pass. Caveat: a v1 project-owner waiver of the 60-day leg exists (2026-08-12) but covered the markdown-fallback deletion, not the import machinery.
- `[RESEARCH] Which removal-gate telemetry/performance thresholds exist with real data, and which were never built?` → **Telemetry thresholds: infrastructure exists (`legacy-telemetry.ts`, fail-closed `legacy-cleanup-gate.mjs`) but never instrumented the legacy import path** — five counters cover workflow-engine/UOK/MCP-alias/component-format/provider-default paths; zero telemetry references in `legacy-import-*.ts`; no `markdownFallbackUsed`-class counter ever existed (docs-only string); no field telemetry at all (R1 in state-db-cutover-milestone-decision.md:125-133); `getDeriveTelemetry` records only a process-local `dbDeriveCount`. **Performance baselines: never built for import/cutover** — the only committed baseline is the unrelated auto-dispatch counter baseline for issue #442 (`scripts/baselines/auto-dispatch-73e20e70.json`). The other step-8 legs (fault gates, restore gates, production routing closure, structural no-authority-read tests) DO exist as real test suites and static proofs at HEAD. No removal gate is wired into CI.

## Dead ends

- `git log --follow --diff-filter=A` on `legacy-import-preview.ts` / `legacy-import-application.ts` — the clone is shallow (`git rev-parse --is-shallow-repository` → true; oldest visible commit 816eb0614, 2026-08-19), so every file reports "added" at the shallow boundary; file-add archaeology is impossible locally. Used `gh release`/`npm view` instead, which fully answered the ship-date question.
- `gh release view v1.13.0 --json body | grep -i cutover` — returned nothing on the first pass because the body mirrors the CHANGELOG with different casing/phrasing than expected; reading the raw body confirmed the #1627 cutover entry. Not a data gap, but the naive grep pattern misses it.
- Searching for CI enforcement of removal gates (`.github/workflows/`) — no workflow references any of them; the gates exist only as package.json scripts chained into local `verify:pr`. Recorded as a finding rather than assumed.
- v1.15.1 as a "stable release" — CHANGELOG entry exists (2026-08-14) but no GitHub release or npm publish; excluded from the stable count, verdict unaffected.
