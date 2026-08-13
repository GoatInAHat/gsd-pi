# Disposition: Plan 032a rows against today's main

**Ticket:** [Disposition Plan 032a rows against today's main](https://github.com/open-gsd/gsd-pi/issues/1744)
**Map:** [Wayfinder: whole-repo dead-code cleanup program](https://github.com/open-gsd/gsd-pi/issues/1741)
**Primary source:** [Plan 032a — Dead Code & Unused-Dependency Audit](https://github.com/open-gsd/gsd-pi/blob/main/plans/032a-dead-code-audit.md) (`plans/032a-dead-code-audit.md`)
**Tree:** `origin/main` @ `cdc4fd1f23c24db22a0ccacde6495e8e8ec05840` (2026-08-12, `#1719`)
**Method:** file existence via `git ls-files`; deletion provenance via `git log --diff-filter=D` / `git log -S`; remaining-row evidence re-checked with `git grep` over tracked sources (excluding lockfiles / `node_modules` / `dist` / `pkg`). No knip re-run. No net-new knip leads.

**Status vocabulary**

| Status | Meaning |
|---|---|
| **gone** | Path / dep declaration already deleted from HEAD |
| **still valid** | Still present, and the 032a evidence (or the same confidence) still holds |
| **changed** | Still present, but the 032a evidence or confidence no longer matches HEAD |

Section 4 duplicate-implementation rows are **existence-only**. They are not deletion candidates for this hunt ([#1744](https://github.com/open-gsd/gsd-pi/issues/1744)).

---

## Counts

62 named HIGH / MEDIUM / LOW-LEAD rows (including section 4 existence-only rows and §1f named knip leads).

| Status | Count |
|---|---|
| **gone** | 11 |
| **still valid** | 50 |
| **changed** | 1 |

By 032a section:

| Section | Rows | gone | still valid | changed |
|---|---|---|---|---|
| §2a HIGH dead files | 6 | 6 | 0 | 0 |
| §4 HIGH duplicates (existence) | 2 | 0 | 2 | 0 |
| §1d MEDIUM packaging deps | 5 | 0 | 5 | 0 |
| §1e MEDIUM suspect-unused | 5 | 4 | 1 | 0 |
| §2b MEDIUM files / `studio/` | 4 | 0 | 4 | 0 |
| §4 MEDIUM duplicates (existence) | 2 | 1 | 1 | 0 |
| §1b LOW root-duplicate deps | 21 | 0 | 21 | 0 |
| §2c LOW knip false-positive categories | 7 | 0 | 6 | 1 |
| §1f LOW extra knip leads | 6 | 0 | 6 | 0 |
| §4 LOW duplicate families (existence) | 4 | 0 | 4 | 0 |

Wave-2 already executed the six §2a HIGH files and the four §1e suspect-unused deps in `42c6eab29`, merged as [chore: lean cleanup — dead code removal, dep pruning, scripts archival (#1580)](https://github.com/open-gsd/gsd-pi/pull/1580). The 032a plan file was committed immediately after that deletion (`d044ebb41`) as the audit record; it still describes the pre-deletion tree.

§3 (orphaned package.json scripts) recorded **zero** rows ([032a §3](https://github.com/open-gsd/gsd-pi/blob/main/plans/032a-dead-code-audit.md#3-orphaned-packagejson-scripts)). Not counted.

---

## 1. HIGH — dead source files ([032a §2a](https://github.com/open-gsd/gsd-pi/blob/main/plans/032a-dead-code-audit.md#2a-high-confidence--safe-to-remove-6))

All six HIGH files are **gone**. Each was deleted in `42c6eab29` (`chore: remove audit-confirmed dead code and unused deps`, 2026-07-29), ancestor of merge `62079509f` (#1580). `git ls-files` on HEAD returns none of them.

| Row | 032a evidence | HEAD | Status | Citation |
|---|---|---|---|---|
| `src/resources/extensions/gsd/roadmap-mutations.ts` | 4 exports, zero repo-wide refs ([§2a](https://github.com/open-gsd/gsd-pi/blob/main/plans/032a-dead-code-audit.md#2a-high-confidence--safe-to-remove-6)) | absent | **gone** | `git log --diff-filter=D -- src/resources/extensions/gsd/roadmap-mutations.ts` → `42c6eab29`; commit body names this file |
| `src/resources/extensions/gsd/commands-bootstrap.ts` | `registerLazyGSDCommand` unreferenced ([§2a](https://github.com/open-gsd/gsd-pi/blob/main/plans/032a-dead-code-audit.md#2a-high-confidence--safe-to-remove-6)) | absent | **gone** | same commit `42c6eab29` |
| `src/resources/extensions/gsd/triage-ui.ts` | `showTriageConfirmation` / `ConfirmedTriage` unreferenced ([§2a](https://github.com/open-gsd/gsd-pi/blob/main/plans/032a-dead-code-audit.md#2a-high-confidence--safe-to-remove-6)) | absent | **gone** | same commit `42c6eab29` |
| `src/resources/extensions/gsd/tests/resolve-ts-hooks.mjs` | unused sibling of live `resolve-ts.mjs` ([§2a](https://github.com/open-gsd/gsd-pi/blob/main/plans/032a-dead-code-audit.md#2a-high-confidence--safe-to-remove-6)) | absent | **gone** | same commit `42c6eab29`. Live loader still present: `src/resources/extensions/gsd/tests/resolve-ts.mjs`; 16 `package.json` / `scripts/` refs |
| `src/tests/integration/web-mode-runtime-fixtures.ts` | unused sibling of `web-mode-runtime-harness.ts` ([§2a](https://github.com/open-gsd/gsd-pi/blob/main/plans/032a-dead-code-audit.md#2a-high-confidence--safe-to-remove-6)) | absent | **gone** | same commit `42c6eab29`. Live helper still present: `src/tests/integration/web-mode-runtime-harness.ts`, imported by `src/tests/integration/web-mode-onboarding.test.ts` |
| `src/rtk-shared.js` | stale compiled sibling of `src/rtk-shared.ts` ([§2a](https://github.com/open-gsd/gsd-pi/blob/main/plans/032a-dead-code-audit.md#2a-high-confidence--safe-to-remove-6)) | absent | **gone** | same commit `42c6eab29`. `git ls-files src \| grep -E '\.(js\|d\.ts)$'` now returns only `src/types/opengsd-mcp-server.d.ts` |

---

## 2. HIGH — duplicate implementations (existence only) ([032a §4](https://github.com/open-gsd/gsd-pi/blob/main/plans/032a-dead-code-audit.md#4-duplicate-implementations-high-confidence-only))

Not in-scope deletions. Status is whether both sides still exist (and whether the 032a sameness claim still holds).

| Row | 032a evidence | HEAD | Status | Citation |
|---|---|---|---|---|
| `packages/rpc-client/src/jsonl.ts` ≡ `packages/gsd-agent-modes/src/modes/rpc/jsonl.ts` | byte-identical; both export `attachJsonlLineReader` ([§4 HIGH](https://github.com/open-gsd/gsd-pi/blob/main/plans/032a-dead-code-audit.md#4-duplicate-implementations-high-confidence-only)) | both present; `diff` empty | **still valid** | HEAD paths above; both still export `attachJsonlLineReader` (`packages/rpc-client/src/jsonl.ts:21`, `packages/gsd-agent-modes/src/modes/rpc/jsonl.ts:21`) |
| `src/rtk-shared.ts` vs `src/resources/extensions/shared/rtk-shared.ts` | near-identical; `src/` copy adds `prependPathEntry` / `applyRtkProcessEnv` / `buildRtkEnv` ([§4 HIGH](https://github.com/open-gsd/gsd-pi/blob/main/plans/032a-dead-code-audit.md#4-duplicate-implementations-high-confidence-only)) | both present; same extra 20 lines on the `src/` copy (78 vs 58 lines) | **still valid** | HEAD `diff -u src/rtk-shared.ts src/resources/extensions/shared/rtk-shared.ts`; callers still import `./rtk-shared.js` from `src/cli.ts`, `src/loader.ts`, `src/rtk.ts`, `src/resources/extensions/shared/rtk.ts` |

---

## 3. MEDIUM — packaging deps ([032a §1d](https://github.com/open-gsd/gsd-pi/blob/main/plans/032a-dead-code-audit.md#1d-used-via-packaging--deliberate-do-not-remove-casually-5--medium))

All five remain in root `package.json` `dependencies`. Zero `from` / `require` / `import()` of the package names in tracked source. Provenance commit `7faba933b` (2026-05-28, *"fix: make validate-pack pass with pnpm workspace protocol"*) is still the add.

| Dep | HEAD `package.json` | Import/require count | Status | Citation |
|---|---|---|---|---|
| `balanced-match` | `"balanced-match": "^4.0.2"` (`package.json:171`) | 0 | **still valid** | [032a §1d](https://github.com/open-gsd/gsd-pi/blob/main/plans/032a-dead-code-audit.md#1d-used-via-packaging--deliberate-do-not-remove-casually-5--medium); `git log -S '"balanced-match"' -- package.json` → `7faba933b` |
| `brace-expansion` | `"brace-expansion": "^5.0.5"` (`package.json:172`) | 0 | **still valid** | same |
| `graceful-fs` | `"graceful-fs": "^4.2.4"` (`package.json:180`) | 0 | **still valid** | same |
| `retry` | `"retry": "^0.12.0"` (`package.json:193`) | 0 (string hits are English "retry", not the package) | **still valid** | same |
| `signal-exit` | `"signal-exit": "^3.0.2"` (`package.json:195`) | 0 | **still valid** | same |

Removal still needs `pnpm run validate-pack` (npm flat-install path), as 032a stated. Wave 2 kept them on purpose: `42c6eab29` commit body: *"The 5 deliberate flat-install packaging deps … are kept intentionally; rationale in plans/032a-dead-code-audit.md."*

---

## 4. MEDIUM — suspect-unused deps ([032a §1e](https://github.com/open-gsd/gsd-pi/blob/main/plans/032a-dead-code-audit.md#1e-suspect-unused-4--medium))

| Row | 032a evidence | HEAD | Status | Citation |
|---|---|---|---|---|
| `chokidar` (root `dependencies`) | zero import/require ([§1e](https://github.com/open-gsd/gsd-pi/blob/main/plans/032a-dead-code-audit.md#1e-suspect-unused-4--medium)) | not in `package.json` | **gone** | `git log -S '"chokidar"' -- package.json` → `42c6eab29` (removed) / Initial Commit (added). `git grep` for `from 'chokidar'` / `require('chokidar')` → no matches |
| `proxy-agent` (root `dependencies`) | zero usage; proxies via `http(s)-proxy-agent` + undici ([§1e](https://github.com/open-gsd/gsd-pi/blob/main/plans/032a-dead-code-audit.md#1e-suspect-unused-4--medium)) | not in `package.json` | **gone** | same `42c6eab29` |
| `file-type` (root **and** `packages/pi-coding-agent/package.json`) | zero usage either manifest ([§1e](https://github.com/open-gsd/gsd-pi/blob/main/plans/032a-dead-code-audit.md#1e-suspect-unused-4--medium)) | absent from both manifests | **gone** | `git log -S '"file-type"' -- package.json packages/pi-coding-agent/package.json` → `42c6eab29`. No `fileTypeFromBuffer` / `from 'file-type'` on HEAD |
| `ajv-formats` (root `devDependencies`) | zero `addFormats` ([§1e](https://github.com/open-gsd/gsd-pi/blob/main/plans/032a-dead-code-audit.md#1e-suspect-unused-4--medium)) | not in `package.json` | **gone** | same `42c6eab29` |
| `@types/picomatch` (root `devDependencies`) | picomatch only via `_require()` + local `PicomatchFn` types ([§1e](https://github.com/open-gsd/gsd-pi/blob/main/plans/032a-dead-code-audit.md#1e-suspect-unused-4--medium)) | still `"@types/picomatch": "^4.0.2"` (`package.json:206`) | **still valid** | still `_require("picomatch")` + local types at `src/resources/extensions/ttsr/ttsr-manager.ts:16-18` and `src/resources/extensions/gsd/safety/file-change-validator.ts:21-23`; no static `from "picomatch"` |

---

## 5. MEDIUM — files / `studio/` ([032a §2b](https://github.com/open-gsd/gsd-pi/blob/main/plans/032a-dead-code-audit.md#2b-medium-confidence--human-glance-before-removing-4))

| Row | 032a evidence | HEAD | Status | Citation |
|---|---|---|---|---|
| `src/resources/extensions/gsd/tests/integration/headless-command.ts` | unreferenced manual `npx tsx …` harness ([§2b](https://github.com/open-gsd/gsd-pi/blob/main/plans/032a-dead-code-audit.md#2b-medium-confidence--human-glance-before-removing-4)) | present (545 lines); docstring still says `npx tsx …` (`headless-command.ts:15`) | **still valid** | `git ls-files` present; `git grep` for `headless-command` hits only this file + 032a. Does not match `test:integration` glob `*.test.ts` (`package.json:95`) |
| `packages/gsd-agent-core/scripts/generate-session-decomposition.mjs` | zero refs; one-off codegen ([§2b](https://github.com/open-gsd/gsd-pi/blob/main/plans/032a-dead-code-audit.md#2b-medium-confidence--human-glance-before-removing-4)) | present; not in any `package.json` script | **still valid** | `git grep generate-session-decomposition` → only 032a. Script still reads `packages/gsd-agent-core/src/agent-session.ts` (that file still exists; `src/session/*` modules also exist) |
| `packages/pi-ai/scripts/generate-test-image.ts` | zero refs; manual test-image generator ([§2b](https://github.com/open-gsd/gsd-pi/blob/main/plans/032a-dead-code-audit.md#2b-medium-confidence--human-glance-before-removing-4)) | present; imports `canvas` | **still valid** | `git grep generate-test-image` → only 032a. Not in any `package.json` script |
| `studio/` (whole Electron app) | not in workspace / root scripts / CI; docs-only mentions ([§2b](https://github.com/open-gsd/gsd-pi/blob/main/plans/032a-dead-code-audit.md#2b-medium-confidence--human-glance-before-removing-4)) | 20 tracked files; dir exists; `studio/package.json` name `@gsd/studio` | **still valid** | `pnpm-workspace.yaml` still `packages/*`, `extensions/*`, `web` (no `studio`). No `studio` in root `package.json` or `.github/workflows/`. Docs still: `docs/dev/FILE-SYSTEM-MAP.md:874`, `docs/dev/ADR-013-memory-store-consolidation.md:84`, `README.md:198` |

---

## 6. MEDIUM — duplicate implementations (existence only) ([032a §4](https://github.com/open-gsd/gsd-pi/blob/main/plans/032a-dead-code-audit.md#4-duplicate-implementations-high-confidence-only))

| Row | 032a evidence | HEAD | Status | Citation |
|---|---|---|---|---|
| `packages/gsd-cloud/src/cloud-config.ts` vs `packages/daemon/src/cloud-config.ts` | near-duplicate `saveCloudConfig` ([§4 MEDIUM](https://github.com/open-gsd/gsd-pi/blob/main/plans/032a-dead-code-audit.md#4-duplicate-implementations-high-confidence-only)) | both absent; `packages/gsd-cloud/` tree gone | **gone** | `git log --diff-filter=D -- packages/gsd-cloud/src/cloud-config.ts` → `7e9b1ffac` (2026-08-10, [retire unused legacy Cloud v1 products (#1695)](https://github.com/open-gsd/gsd-pi/commit/7e9b1ffaccf3f49d5ec61694befb329cfccac50b)); `packages/daemon/src/cloud-config.ts` → `af2e4a05c` (2026-08-10, [retire legacy Cloud v1 runtime (#1687)](https://github.com/open-gsd/gsd-pi/commit/af2e4a05cba1ed538076acff0901d514ff64562b)). `git ls-files \| grep cloud-config` empty; `saveCloudConfig` gone |
| `findMilestoneIds` / `extractMilestoneSeq` ×3 | three live implementations, different semantics ([§4 MEDIUM](https://github.com/open-gsd/gsd-pi/blob/main/plans/032a-dead-code-audit.md#4-duplicate-implementations-high-confidence-only)) | all three files present; symbols still exported | **still valid** | `src/resources/extensions/gsd/milestone-id-utils.ts:9,19`; `src/resources/extensions/gsd/milestone-ids.ts:53,202`; `packages/mcp-server/src/readers/paths.ts:180` (`findMilestoneIds` only in mcp-server; `extractMilestoneSeq` in the two gsd files) |

---

## 7. LOW-LEAD — root-duplicate deps ([032a §1b](https://github.com/open-gsd/gsd-pi/blob/main/plans/032a-dead-code-audit.md#1b-used-only-inside-packages-which-self-declare-them--root-entry-is-a-duplicate-21--low-removal-confidence))

All 21 still appear in root `package.json` `dependencies`. None have `from` / `require` / `import()` from `src/`, `scripts/`, `tests/`, or `integrations/`. Each still has at least one consuming `packages/*/package.json` that self-declares the same name. Removal still gated on `validate-pack`.

| Dep | Root `package.json` | Consuming package(s) that self-declare | Status |
|---|---|---|---|
| `@anthropic-ai/sdk` | `:158` | `daemon`, `pi-ai` | **still valid** |
| `@anthropic-ai/vertex-sdk` | `:159` | `pi-ai` | **still valid** |
| `@aws-sdk/client-bedrock-runtime` | `:160` | `pi-ai` | **still valid** |
| `@mistralai/mistralai` | `:164` | `pi-ai` | **still valid** |
| `@silvia-odwyer/photon-node` | `:167` | `pi-coding-agent` | **still valid** |
| `@smithy/node-http-handler` | `:169` | `pi-ai` | **still valid** |
| `cross-spawn` | `:174` | `pi-coding-agent` | **still valid** |
| `diff` | `:175` | `pi-coding-agent` (also imported by `packages/gsd-agent-modes/src/modes/interactive/components/diff.ts:1`, which does not self-declare — same at 032a landing `d044ebb41`) | **still valid** |
| `discord.js` | `:176` | `daemon` | **still valid** |
| `get-east-asian-width` | `:178` | `pi-tui` | **still valid** |
| `glob` | `:179` | `pi-coding-agent` | **still valid** |
| `highlight.js` | `:181` | `pi-coding-agent` via `import hljs from "highlight.js/lib/index.js"` (`packages/pi-coding-agent/src/utils/syntax-highlight.ts:1`) | **still valid** |
| `hosted-git-info` | `:182` | `pi-coding-agent` | **still valid** |
| `http-proxy-agent` | `:183` | `pi-ai` | **still valid** |
| `https-proxy-agent` | `:184` | `pi-ai` | **still valid** |
| `ignore` | `:185` | `pi-agent-core`, `pi-coding-agent` | **still valid** |
| `marked` | `:186` | `pi-coding-agent`, `pi-tui` | **still valid** |
| `openai` | `:188` | `pi-ai` | **still valid** |
| `partial-json` | `:189` | `pi-ai` | **still valid** |
| `sql.js` | `:196` | `pi-coding-agent` (`packages/pi-coding-agent/src/resources/extensions/memory/storage.ts:10`). Root `src/` mentions are comments/fixture strings, not imports | **still valid** |
| `typebox` | `:198` | `pi-agent-core`, `pi-ai`, `pi-coding-agent` | **still valid** |

Evidence for the table: `git grep` of `from "<dep>"` / `require("<dep>")` / `import("<dep>")` classified by path prefix; `packages/*/package.json` dependency maps. [032a §1b](https://github.com/open-gsd/gsd-pi/blob/main/plans/032a-dead-code-audit.md#1b-used-only-inside-packages-which-self-declare-them--root-entry-is-a-duplicate-21--low-removal-confidence).

---

## 8. LOW-LEAD — knip false-positive categories ([032a §2c](https://github.com/open-gsd/gsd-pi/blob/main/plans/032a-dead-code-audit.md#2c-lowlead--do-not-remove-knip-false-positives-explained))

These were recorded so wave 2 would not re-litigate them. Status = whether the category still exists and the "not dead" rationale still holds. No new knip leads added.

| Row | 032a evidence | HEAD | Status | Citation |
|---|---|---|---|---|
| `src/resources/extensions/*/index.ts` + tool files (jiti / directory discovery) | discovered at runtime, copied by `copy-resources.cjs` ([§2c](https://github.com/open-gsd/gsd-pi/blob/main/plans/032a-dead-code-audit.md#2c-lowlead--do-not-remove-knip-false-positives-explained)) | 22 bundled `src/resources/extensions/*/index.ts` still present; named 032a set still there (`async-jobs`, `aws-auth`, `bg-shell`, `browser-tools`, `context7`, `github-sync`, `google-cli`, `mac-tools`, `universal-config`, `voice`, `slash-commands`) | **still valid** | `src/extension-discovery.ts` and `scripts/copy-resources.cjs` still tracked. (`google-search/index.ts` is a deprecation stub; it was not in 032a's named list.) |
| `src/resources/skills/create-gsd-extension/templates/*.ts` | copied as text by the skill ([§2c](https://github.com/open-gsd/gsd-pi/blob/main/plans/032a-dead-code-audit.md#2c-lowlead--do-not-remove-knip-false-positives-explained)) | 3 files still present (`extension-skeleton.ts`, `stateful-tool-skeleton.ts`, `templates.test.ts`) | **still valid** | HEAD glob `src/resources/skills/create-gsd-extension/templates/*.ts` |
| `src/resources/extensions/gsd/tests/fixtures/*worker.ts` | spawned as worker processes by tests ([§2c](https://github.com/open-gsd/gsd-pi/blob/main/plans/032a-dead-code-audit.md#2c-lowlead--do-not-remove-knip-false-positives-explained)) | 3 workers still present | **still valid** | `semantic-shadow-worker.ts`, `legacy-import-restore-drill-worker.ts`, `legacy-import-backup-prepare-worker.ts` |
| `packages/pi-coding-agent/examples/**` | shipped example/docs code ([§2c](https://github.com/open-gsd/gsd-pi/blob/main/plans/032a-dead-code-audit.md#2c-lowlead--do-not-remove-knip-false-positives-explained)) | 123 tracked files under that tree | **still valid** | `git ls-files packages/pi-coding-agent/examples` |
| `web/components/ui/*.tsx` + `web/hooks/use-*.ts` | vendored shadcn library ([§2c](https://github.com/open-gsd/gsd-pi/blob/main/plans/032a-dead-code-audit.md#2c-lowlead--do-not-remove-knip-false-positives-explained)) | 55 UI components + `use-toast.ts` / `use-mobile.ts` | **still valid** | HEAD globs |
| `vscode-extension/` | VS Code manifest entry, not import graph ([§2c](https://github.com/open-gsd/gsd-pi/blob/main/plans/032a-dead-code-audit.md#2c-lowlead--do-not-remove-knip-false-positives-explained)) | 38 tracked files; `vscode-extension/package.json` `main` = `dist/extension.js` | **still valid** | `git ls-files vscode-extension` |
| `tests/live/run.ts`, `tests/live-regression/benchmark.ts` | "referenced by package.json scripts (`test:live`, `test:live-regression`). **Not dead.**" ([§2c](https://github.com/open-gsd/gsd-pi/blob/main/plans/032a-dead-code-audit.md#2c-lowlead--do-not-remove-knip-false-positives-explained)) | `tests/live/run.ts` still wired (`package.json:99`). `tests/live-regression/benchmark.ts` still exists (170 lines) but `test:live-regression` runs `tests/live-regression/run.ts` (`package.json:150`); CI (`.github/workflows/npm-publish.yml`) calls that script. `git grep tests/live-regression/benchmark` → only the file itself + 032a | **changed** | Original "not dead because `test:live-regression` references `benchmark.ts`" evidence is false on HEAD. `run.ts` (694 lines) is the live entry. This is **not** a new knip deletion lead — only a correction of 032a's wiring claim. `benchmark.ts` remains a manual harness (`GSD_SMOKE_BINARY=… node --experimental-strip-types tests/live-regression/benchmark.ts`, `benchmark.ts:25-27`) |

---

## 9. LOW-LEAD — extra knip flags ([032a §1f](https://github.com/open-gsd/gsd-pi/blob/main/plans/032a-dead-code-audit.md#1f-knip-corroboration))

032a recorded these as out-of-wave-2-root-scope leads only. Still present; not expanded.

| Row | 032a | HEAD | Status | Citation |
|---|---|---|---|---|
| `web/` radix/shadcn deps | knip flags web UI deps ([§1f](https://github.com/open-gsd/gsd-pi/blob/main/plans/032a-dead-code-audit.md#1f-knip-corroboration)) | `web/components/ui/` still a 55-file vendored set | **still valid** | same as §2c web UI row |
| `canvas` (`packages/pi-ai`) | packages/* devDep lead ([§1f](https://github.com/open-gsd/gsd-pi/blob/main/plans/032a-dead-code-audit.md#1f-knip-corroboration)) | `"canvas": "3.2.3"` in `packages/pi-ai/package.json:115`; only source import is `packages/pi-ai/scripts/generate-test-image.ts:3` (the §2b MEDIUM generator) | **still valid** | HEAD `package.json` + `git grep from 'canvas'` |
| `@types/diff` (`packages/pi-coding-agent`) | packages/* devDep lead ([§1f](https://github.com/open-gsd/gsd-pi/blob/main/plans/032a-dead-code-audit.md#1f-knip-corroboration)) | `"@types/diff": "7.0.2"` in `packages/pi-coding-agent/package.json:65` | **still valid** | HEAD manifest |
| `@types/ms` (`packages/pi-coding-agent`) | packages/* devDep lead ([§1f](https://github.com/open-gsd/gsd-pi/blob/main/plans/032a-dead-code-audit.md#1f-knip-corroboration)) | `"@types/ms": "2.1.0"` in `packages/pi-coding-agent/package.json:67` | **still valid** | HEAD manifest |
| `shx` (`packages/pi-coding-agent`) | packages/* devDep lead ([§1f](https://github.com/open-gsd/gsd-pi/blob/main/plans/032a-dead-code-audit.md#1f-knip-corroboration)) | `"shx": "0.4.0"` in `packages/pi-coding-agent/package.json:70`; no `scripts` entry invokes it | **still valid** | HEAD manifest |
| `@xterm/xterm` | packages/* devDep lead ([§1f](https://github.com/open-gsd/gsd-pi/blob/main/plans/032a-dead-code-audit.md#1f-knip-corroboration)) | `packages/pi-tui/package.json:31` (`5.5.0`) and `web/package.json:51` (`^6.0.0`) — same split at 032a landing | **still valid** | HEAD manifests |

---

## 10. LOW — duplicate families (existence only) ([032a §4](https://github.com/open-gsd/gsd-pi/blob/main/plans/032a-dead-code-audit.md#4-duplicate-implementations-high-confidence-only))

032a: intentional layering, **do not merge in this pass**. Existence only.

| Row | 032a paths | HEAD | Status | Citation |
|---|---|---|---|---|
| compaction | `packages/pi-agent-core/src/harness/compaction/*` ↔ `packages/gsd-agent-core/src/compaction/*` | both dirs present (`compaction.ts`, `utils.ts`, `branch-summarization.ts` on each side) | **still valid** | `git ls-files` those prefixes |
| messages | `packages/pi-agent-core/src/harness/messages.ts` ↔ `packages/pi-coding-agent/src/core/messages.ts` | both files present | **still valid** | HEAD paths |
| `getClaudeCommand` / `buildClaudeSpawnInvocation` ×3 | `src/claude-cli-check.ts`, `src/resources/shared/claude-runtime-floor.ts`, `src/resources/extensions/claude-code-cli/readiness.ts` | all three files present. `buildClaudeSpawnInvocation` exported from all three (`:19`, `:98`, `:28`). `getClaudeCommand` exported from `claude-cli-check.ts:44` and `readiness.ts:50` only — already true at 032a landing `d044ebb41` | **still valid** | HEAD `git grep -n 'export function (getClaudeCommand\|buildClaudeSpawnInvocation)'` |
| `fuzzyFindText` | `packages/native/src/diff/index.ts` ↔ `pi-coding-agent/.../edit-diff.ts` | both present. Ellipsis in 032a resolves to `packages/pi-coding-agent/src/core/tools/edit-diff.ts:96` (never at `src/utils/edit-diff.ts` in this history). Native export: `packages/native/src/diff/index.ts:32` | **still valid** | HEAD paths; `git log -- packages/pi-coding-agent/src/core/tools/edit-diff.ts` |

---

## Out of scope (not counted)

- §1a USED-from-root deps and §1c USED-VIA-SCRIPT devDeps — keep lists, not HIGH/MEDIUM/LOW-LEAD removal rows ([032a §1a](https://github.com/open-gsd/gsd-pi/blob/main/plans/032a-dead-code-audit.md#1a-used-from-root-code-24--keep), [§1c](https://github.com/open-gsd/gsd-pi/blob/main/plans/032a-dead-code-audit.md#1c-used-via-script--build-tooling-devdependencies--keep)).
- §2d working-tree `.js`/`.d.ts` local-disk hazard — operational note, not a ledger row. The committed stale `src/rtk-shared.js` case is the §2a HIGH row (now **gone**).
- §3 orphaned scripts: none at audit time.
- Net-new knip leads (per [#1744](https://github.com/open-gsd/gsd-pi/issues/1744)).
- Live duplicates as deletion work (section 4 existence noted only).

---

## Implications for the 045 program

Wave 2 already cleared every 032a **HIGH dead-file** row and the four **suspect-unused** deps. What remains as live 032a inventory on today's main:

- **MEDIUM keep-or-decide:** 5 packaging deps (§1d), `@types/picomatch`, the two generator scripts, `headless-command.ts`, `studio/`.
- **LOW/LEAD still on the board:** 21 root-duplicate deps (validate-pack-gated), knip false-positive categories (minus the `benchmark.ts` wiring correction), §1f package/web leads.
- **Section 4:** jsonl + rtk-shared + milestone-id triples still exist; the cloud-config pair is gone because Cloud v1 was retired, not because of a dead-code sweep.

No code was deleted in this research ticket.
