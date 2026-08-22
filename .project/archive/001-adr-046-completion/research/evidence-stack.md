# Evidence — stack

<!-- Written by one researcher role. Consumed by the decider. -->

Dimension: stack
Questions assigned: none

Scope of this pass: measured blast radius of deleting the explicit legacy
import/export machinery (`legacy-import-*.ts` + dependents) at HEAD. Every
claim below was verified against the working tree; the static proof gate was
re-run live (`node scripts/legacy-state-path-proof.mjs` → PASS, exit 0).

## Finding: the deletion surface is 40 production modules / ~25.4k LOC, plus a 6,075-LOC `migrate/` dependent

- **Claim**: The explicit import path is 39 `legacy-import-*.ts` files at the extension root plus `db/writers/legacy-import-application.ts`, totaling 25,399 LOC (`wc -l src/resources/extensions/gsd/legacy-import-*.ts src/resources/extensions/gsd/db/writers/legacy-import-application.ts`). The `migrate/` directory (16 files, 6,075 LOC) is a dependent, not import-named: `migrate/execution.ts:15-63`, `migrate/audit.ts:20-26`, `migrate/command.ts:23`, and `migrate/publication-store.ts:19-20` all import legacy-import modules, and `handleMigrate` is reachable as a CLI command via `commands/handlers/ops.ts:243` and `guided-flow.ts:1964`.
- **Source**: `ls`/`wc -l` on the enumerated paths; import statements at the cited lines.
- **Confidence**: high
- **Why it matters here**: The milestone's deletion scope ("`legacy-import-*.ts` and dependents") is ~31.5k production LOC once `migrate/` is counted — the decider needs the real number, and the planner needs to know `migrate/` cannot survive deletion unchanged.

## Finding: core non-import modules import the legacy-import machinery — deletion is surgery, not directory removal

- **Claim**: Five non-legacy modules have hard static imports of legacy-import modules: (1) `db-workspace.ts` (1,144 LOC, the workspace-facing DB interface) imports from 9 legacy-import modules at lines 35-78 and owns the recover/migrate orchestration with idempotency keys `legacy-import/recover/*` (db-workspace.ts:560, 847) and `legacy-import/migrate/*` (db-workspace.ts:1020, 1137); (2) `db/domain-operation.ts` — the revision-checked domain write boundary — embeds operation types `import.apply`/`import.restore`/`import.forward_repair` (lines 55, 90, 98) with dedicated validation branches (lines 482-484, 1214-1224, 1249-1263, 1318-1319) and `executeImportDomainOperation`; (3) `db/writers/authority-recovery.ts:11-17` imports forward-repair plan types, `LEGACY_IMPORT_TARGET_ADAPTERS`, and the canonical-JSON/hash utilities; (4) `project-authority-cutover-domain-operation.ts:27-33` imports legacy-import-application, -evidence, and -preview-base; (5) `gsd-db.ts:76-77` (the single-writer barrel everything imports) re-exports `legacy-import-restore-assessment.js` and `legacy-import-live-restore.js`.
- **Source**: import blocks at the cited file:line locations.
- **Confidence**: high
- **Why it matters here**: Deleting the directory breaks the domain-operation core, the DB barrel, and the authority-cutover operation at compile/typecheck time; the deletion commit must include coordinated edits to all five, so CI-green-after-deletion (success criterion 3) is a multi-module change, not a `git rm`.

## Finding: `canonicalLegacyImportJson`/`hashLegacyImportValue` live in `legacy-import-preview.ts` but are general-purpose hash utilities used by must-not-break code

- **Claim**: `canonicalLegacyImportJson` (legacy-import-preview.ts:161), `hashLegacyImportValue` (:169), `isStrictLegacyImportData` (:240), and `isValidLegacyImportPreviewArtifact` are consumed outside the import path: `db/domain-operation.ts:12-17` (core operation provenance checks, e.g. :343-344, :643), `db/writers/authority-recovery.ts:17,337-338,517-518`, `migrate/publication-store.ts` (10 call sites), and — critically — `commands-maintenance.ts:1130-1166, 1575-1629`, where the **backup/restore command `gsd db restore-backup`** (commands-maintenance.ts:1408) uses them to hash restore intents, consent, and verification. Restore-backup also parses recovery actions via `parseLegacyImportRecoveryAction`/`executeLegacyImportRecoveryAction` (commands-maintenance.ts:26-28, 576-604) and consent types from `legacy-import-restore-assessment.ts` (:34, 497).
- **Source**: cited lines; `grep -n 'canonicalLegacyImportJson\|hashLegacyImportValue'` across non-test sources.
- **Confidence**: high
- **Why it matters here**: INTENT lists backup/restore as "must not break". These utilities must be extracted to a neutral module (or the restore-backup dependency edges severed) **before** `legacy-import-preview.ts` can be deleted — this is the single hardest sequencing constraint in the deletion.

## Finding: import-only DB schema is three receipt tables plus triggers baked into the core lifecycle-transition rule

- **Claim**: Tables existing solely for import: `workflow_import_applications` (db-projection-import-kernel-closeout-foundation-schema.ts:247 — also where sealed Previews are persisted, per the `preview_json` provenance match in db/domain-operation.ts:753-800), `workflow_import_restores` (db-authority-recovery-schema.ts:64), and `workflow_import_forward_repairs` (db-authority-recovery-schema.ts:189), each with immutability/causality triggers, plus `trg_workflow_authority_recovery_operation_update` (:305-319) freezing referenced `workflow_operations` rows. Additionally, the core `trg_workflow_lifecycle_transition` trigger on `workflow_item_lifecycles` permits a `completed → cancelled` transition **only** when a matching `import.forward_repair` operation exists (db-authority-recovery-schema.ts:364-373). Current `SCHEMA_VERSION = 48` (db/engine.ts:163); a comment at db-base-schema.ts:423 notes "the schema-version boundary the legacy-import contract pins at v46".
- **Source**: the two schema files read in full; db/engine.ts:163.
- **Confidence**: high
- **Why it matters here**: Schema is additive (`CREATE TABLE IF NOT EXISTS`), so deleting code never drops user data — but post-deletion databases keep a lifecycle trigger whose only escape hatch references an operation type no code can mint anymore. Whether that carve-out is retired (v49 migration) or left as historical inert SQL is a deletion-time decision the decider must make explicitly; schema-pinning tests (gsd-recover.test.ts:188 expects `workflow_import_applications` in the table list) will also need rewriting.

## Finding: the host shell outside the extension hard-depends on two legacy-import modules via runtime jiti loads

- **Claim**: `src/headless-recover.ts:52-53` dynamically loads `legacy-import-recovery-action.ts` and `legacy-import-forward-repair-choice-token.ts` by filename through jiti and builds the headless `recover` flow on their exports (`executeLegacyImportRecoveryAction`, `parseLegacyImportRecoveryAction`, `formatLegacyImportForwardRepairChoice`, `parseLegacyImportForwardRepairChoices`; used at :194, :245, :256, :273-275). It is wired into the CLI at `src/headless.ts:462` (`handleRecover`). The interactive surface is `/gsd recover` → `handleRecover` in commands-maintenance.ts:549, registered at commands/handlers/ops.ts:134-135.
- **Source**: src/headless-recover.ts (full grep), src/headless.ts:462, ops.ts:134-135.
- **Confidence**: high
- **Why it matters here**: Because these are runtime jiti loads of files shipped as uncompiled source (evidence-codebase.md), deleting the files would not fail `tsc` — it would fail headless `recover` at runtime. The deletion must remove/rewire `src/headless-recover.ts`, its `src/headless.ts:462` call site, and `src/tests/headless-recover.test.ts` (783 LOC) in the same change.

## Finding: test coupling is 42 import-named test files (~28.4k LOC) plus ~9.4k LOC of adjacent suites, including the native fault-injection gate file

- **Claim**: Import-named test/helper/fixture files under `src/resources/extensions/gsd/tests/`: 42 files, 28,432 LOC (`legacy-import-*.test.ts`, `tests/helpers/legacy-import-corpus.ts`, `tests/fixtures/legacy-import-*-worker.ts`, two `*-child.ts` subprocess helpers, and a classification-fixtures data file). Adjacent suites that exercise the import path and would need deletion or rewrite: `gsd-recover.test.ts` (1,160 LOC), `migrate-safety-audit.test.ts` (4,783 LOC — the file carrying the 23 fault-injection native-build failures noted in evidence-codebase.md), `project-authority-cutover.test.ts` + `-filesystem-state.test.ts` (711+500), `db-authority-recovery-schema.test.ts` (501), `implicit-import-{startup,render,dispatch}-authority.test.ts` (251+153+338), `domain-operation.test.ts`, `silent-catch-diagnostics.test.ts`, `gsd-sync-fail-closed.test.ts`, `lifecycle-projection-kind-remediation-1661.test.ts`, `db-projection-closeout-foundation.test.ts`, `parsers-legacy-importers.test.ts` (the test-side mirror of the proof regexes), and in `src/tests/`: `headless-recover.test.ts` (783), `legacy-cleanup-gate.test.ts` (205), and `cross-platform-filesystem-safety.test.ts` which pins a hardcoded allowlist entry naming `legacy-import-backup.ts` at line 85.
- **Source**: `wc -l` runs enumerated above; per-file grep hits for `legacy-import`/`LegacyImport`.
- **Confidence**: high
- **Why it matters here**: Success criterion 3 requires `test:unit:compiled` + `test:integration` green after deletion; the deletion diff removes or rewrites roughly 38k LOC of tests, and the 23 currently-failing fault-injection audit tests live inside the deleted surface — their disposition (deleted vs. preserved invariants moved elsewhere) is a planner decision, not an accident to discover in CI.

## Finding: zero downstream consumers in packages/, web/, vscode-extension/, MCP, or the agent tool registry

- **Claim**: Repo-wide searches for `legacy-import`/`legacyImport`/`LegacyImport`/`importPreview`/`ImportApplication` return no matches in `packages/` (including `packages/mcp-server`), `web/`, or `vscode-extension/`, and no matches in the extension's own tool-registration surfaces (`bootstrap/`, `ecosystem/`). The only non-extension references are the `src/` host shell (`headless.ts`, `headless-recover.ts`, three test files) and `scripts/legacy-state-path-proof.mjs`.
- **Source**: Grep over `packages/`, `web/`, `vscode-extension/`, `src/resources/extensions/gsd/bootstrap/`, `src/resources/extensions/gsd/ecosystem/` — all empty.
- **Confidence**: high
- **Why it matters here**: The import path is CLI-command-only (`/gsd recover`, `gsd migrate`, headless recover); no published API, MCP tool, or satellite surface exposes it, so deletion has no cross-repo or cross-surface contract to retire — the blast radius is confined to the extension plus the `src/` host shell.

## Finding: the `parseLegacy*` proof passed because of a completed rename, and keys on nothing in the import path

- **Claim**: `scripts/legacy-state-path-proof.mjs` (run live: PASS, exit 0) scans `src/resources/extensions` for three things (lines 23-33): callers of `_deriveStateImpl`, any `parsers-legacy` module specifier, and the symbols `parseLegacyRoadmap`/`parseLegacyPlan`. All three are vacuous at HEAD: `_deriveStateImpl` has zero non-test occurrences, `parsers-legacy.ts` does not exist (Glob: no matches), and `parseLegacyRoadmap`/`parseLegacyPlan` exist only inside the proof regexes themselves and the mirror registry `tests/parsers-legacy-importers.test.ts:58`. The v1 blocker was resolved by T020's rename: the parsers now live as `parseProjectionRoadmap`/`parseProjectionPlan` at `schemas/parsers.ts:409` and `:518` (relocation comment at :371-372), and they are **not** import-only — live non-import consumers include `doctor-engine-checks.ts:34`, `migration-auto-check.ts:12`, `artifact-verification.ts:7`, `markdown-renderer.ts:53,1402,1514`, `md-importer.ts:51`, and `state-reconciliation/drift/{roadmap,sketch-flag}.ts`. The unrelated `parseLegacyImportRecoveryAction`/`parseLegacyImportForwardRepairChoices` family belongs to the import path itself (legacy-import-recovery-action.ts, legacy-import-forward-repair-choice-token.ts) and dies with it.
- **Source**: proof script read in full and executed; grep for all three banned patterns; consumer grep for the renamed symbols.
- **Confidence**: high
- **Why it matters here**: Two implications: (a) the green `legacy:cleanup:proof` gate provides **zero signal** about whether the legacy import machinery is safe to delete — it keys on the already-retired markdown state-read path, not the import path; (b) the projection parsers must be excluded from deletion scope — they are load-bearing live code that merely survived a rename.

## Finding: the `legacy:cleanup:*` telemetry gate never measured import usage

- **Claim**: `scripts/legacy-cleanup-gate.mjs:10-16` defines exactly five counters — `legacy.workflowEngineUsed`, `legacy.uokFallbackUsed`, `legacy.mcpAliasUsed`, `legacy.componentFormatUsed`, `legacy.providerDefaultUsed` — none related to import; the gate's static component is the same state-path proof above. `legacy-cleanup-evidence.mjs:15` generates evidence by running `baseline:refactor:gate`. Neither script references any `legacy-import` module.
- **Source**: both scripts read in full.
- **Confidence**: high
- **Why it matters here**: If the removal-gate ruling requires evidence that the import path is unused, no such telemetry exists in the cleanup gates — consistent with INTENT's risk that removal-gate telemetry "may never have been built"; the deletion decision cannot lean on these gates and the gates need no import-related update when deletion lands.

## Finding: `md-importer.ts` is an explicitly quarantined test-only markdown→DB path adjacent to the deletion surface

- **Claim**: `md-importer.ts` (header lines 1-12) carries a "⚠ TEST-ONLY EXPORTS — DO NOT WIRE INTO PRODUCTION PATHS ⚠" banner: `migrateHierarchyToDb`/`migrateFromMarkdown` are an unconsented, unverified markdown→DB write path with "ZERO production callers", and the header mandates that every production import go through the crash-safe Import Application (`workflow_import_applications`). It parses via the live `parseProjectionRoadmap`/`parseProjectionPlan` (:51).
- **Source**: md-importer.ts header and imports.
- **Confidence**: high (banner is explicit); medium on whether the decider wants it deleted alongside (it is not `legacy-import-*`-named)
- **Why it matters here**: It is a scope boundary the decider should rule on explicitly: it is unconsented bypass machinery whose only sanctioned alternative (the explicit Import Application) is exactly what this milestone may delete — after deletion it becomes the *only* markdown→DB write path in the tree, still wired to nothing.

## Assigned questions — answers

- none (dispatched for migration-cost risk per RESEARCH.md) → n/a

## Dead ends

- `packages/`, `web/`, `vscode-extension/`, `packages/mcp-server` — searched for all import symbol families; zero references, so no cross-surface contract analysis was possible or needed.
- Extension agent-tool registries (`bootstrap/*.ts`, `ecosystem/gsd-extension-api.ts`) — no legacy-import tools registered; the import path is reachable only via CLI commands, so there is no tool-registry surface to enumerate.
- Local git archaeology for the Import Preview/Application ship release — the clone is shallow (57 commits) and its oldest visible commits (`9912cb55e`, `4c7e09cf4`, `0db1a6ef7`) already seal the preview contract; ship-date evidence is unobtainable locally and belongs to the removal-gates dimension via remote history.
- `legacy:cleanup:gate` / `legacy:cleanup:evidence` as a source of import-usage evidence — their counter set predates and ignores the import path (see finding above); no import telemetry to mine there.
- `parseLegacyRoadmap`/`parseLegacyPlan` consumer hunt — the symbols no longer exist in any source file; the interesting story is the rename to `parseProjection*`, covered in the proof finding.
