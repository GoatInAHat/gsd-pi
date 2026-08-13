# Draft: sectioned HIGH / MEDIUM / LOW-LEAD dead-code ledger

**Ticket:** [Draft the sectioned HIGH/MEDIUM/LOW-LEAD dead-code ledger](https://github.com/open-gsd/gsd-pi/issues/1745)
**Map:** [Wayfinder: whole-repo dead-code cleanup program](https://github.com/open-gsd/gsd-pi/issues/1741)
**Status:** **DRAFT — not approved.** No deletions. No `plans/045-*.md`. Approval is [Approve the dated cleanup program in plans/](https://github.com/open-gsd/gsd-pi/issues/1746).
**Tree:** `origin/main` @ `cdc4fd1f23c24db22a0ccacde6495e8e8ec05840` (same commit as the three input reports)
**Method:** Classify the knip unused-file / unused-dep lists against the published-root inventory and the 032a disposition. Re-check leftover candidates with `git grep` / `git ls-files` on this tree. No knip re-run. No code deleted.

**Inputs (primary sources)**

| Input | Source |
|---|---|
| Entry-point inventory | [045-entry-point-roots.md](https://github.com/open-gsd/gsd-pi/blob/research/entry-point-roots/.project/research/045-entry-point-roots.md) on `research/entry-point-roots` |
| 032a disposition | [045-032a-disposition.md](https://github.com/open-gsd/gsd-pi/blob/research/032a-disposition/.project/research/045-032a-disposition.md) on `research/032a-disposition` |
| knip leads | [045-knip-leads.md](https://github.com/open-gsd/gsd-pi/blob/research/knip-leads/.project/research/045-knip-leads.md) + [045-knip-leads.raw.txt](https://github.com/open-gsd/gsd-pi/blob/research/knip-leads/.project/research/045-knip-leads.raw.txt) on `research/knip-leads` |
| 032a plan | [plans/032a-dead-code-audit.md](https://github.com/open-gsd/gsd-pi/blob/main/plans/032a-dead-code-audit.md) on `main` |

**Tier rules** (from the [map](https://github.com/open-gsd/gsd-pi/issues/1741) and [ticket 1745](https://github.com/open-gsd/gsd-pi/issues/1745))

| Tier | Meaning |
|---|---|
| **HIGH** | Unreachable after false-positive disposition, with unreachability evidence **and** a named verify gate (`build:core`, `typecheck:extensions`, `validate-pack` when deps) |
| **MEDIUM** | Needs a human glance |
| **LOW-LEAD** | Do not remove; record so the next hunt does not re-litigate |

**Excluded from this ledger as deletion work:** dead branches inside live functions; `studio/` as an automatic root; live duplicate implementations ([map out of scope](https://github.com/open-gsd/gsd-pi/issues/1741); [032a disposition §2 / §10](https://github.com/open-gsd/gsd-pi/blob/research/032a-disposition/.project/research/045-032a-disposition.md)).

---

## Counts

### Ledger rows (actionable)

| Tier | Rows | What they are |
|---|---|---|
| **HIGH** | **6** | Unreachable files (one pair counted as one row) |
| **MEDIUM** | **22** | 9 files/dirs + 12 deps + 1 unused-export remainder |
| **LOW-LEAD** | **220 files + 55 deps** | knip unused-file false positives + 032a keep-classes |

knip unused-file coverage of the 240 leads ([raw L1](https://github.com/open-gsd/gsd-pi/blob/research/knip-leads/.project/research/045-knip-leads.raw.txt)): **7 HIGH paths + 13 MEDIUM paths + 220 LOW-LEAD paths = 240**.

### Per section (ledger rows)

| Section | HIGH | MEDIUM | LOW-LEAD (summary) |
|---|---|---|---|
| `src/` | 0 | 0 file rows (unused-export remainder is the 1 MEDIUM bucket below) | CLI modules are live roots |
| `packages/*` | 2 | 2 (the two generator scripts; package unused *deps* are counted under deps) | published `exports` / examples / vitest config |
| extensions | 4 | 1 (`headless-command.ts`) | jiti-loaded entries, skill templates, worker fixtures |
| scripts | 0 | 0 | no new archive candidates; already-archived + live transitive roots |
| tests | 0 | 1 (`benchmark.ts`; `headless-command.ts` is counted under extensions) | live `package.json` script roots + workers |
| deps | 0 | 12 | 21 root-duplicates + 2 used-from-root knip FPs + web/shadcn + 032a §1f |
| other surfaces (not a named section) | 0 | 5 | `studio/` leftover; 3 unused `web/components/gsd/*`; leftover `web/styles/globals.css` |
| unused-export remainder | 0 | 1 | published / jiti / shadcn unused exports |

Section MEDIUM rows (2+1+1+12+5+1) = **22**. Section HIGH rows (2+4) = **6**.

032a leftover roll-forward ([disposition counts](https://github.com/open-gsd/gsd-pi/blob/research/032a-disposition/.project/research/045-032a-disposition.md)): **11 gone / 50 still valid / 1 changed**. The changed row is `tests/live-regression/benchmark.ts` (see [Tests](#5-tests)).

---

## 1. `src/`

Root CLI. Published bins compile from `src/loader.ts` → `src/cli.ts` ([entry-point inventory §1a](https://github.com/open-gsd/gsd-pi/blob/research/entry-point-roots/.project/research/045-entry-point-roots.md)). No `exports` map ([`package.json` has `bin` + `files`, no `exports`](https://github.com/open-gsd/gsd-pi/blob/cdc4fd1f23c24db22a0ccacde6495e8e8ec05840/package.json)).

### HIGH

None. knip unused files under `src/` that survived false-positive disposition all live under `src/resources/extensions/` and are listed in [Extensions](#3-extensions).

### MEDIUM

None at file level. Unused *exports* in live CLI modules (61 knip hits whose path parses as `src/` and is not under `src/resources/extensions/`) are part of the [unused-export remainder](#7-unused-exports-and-types-remainder).

### LOW-LEAD

Live CLI / loader / help / MCP-mode files are published surfaces ([inventory §2–§3](https://github.com/open-gsd/gsd-pi/blob/research/entry-point-roots/.project/research/045-entry-point-roots.md)). Do not treat knip unused exports in those files as file-dead.

032a HIGH files under `src/` are **gone** (`roadmap-mutations.ts`, `commands-bootstrap.ts`, `triage-ui.ts`, `resolve-ts-hooks.mjs`, `web-mode-runtime-fixtures.ts`, `src/rtk-shared.js`) — deleted in `42c6eab29` / [#1580](https://github.com/open-gsd/gsd-pi/pull/1580) ([disposition §1](https://github.com/open-gsd/gsd-pi/blob/research/032a-disposition/.project/research/045-032a-disposition.md)).

---

## 2. `packages/*`

### HIGH

| Row | Evidence | Verify gate |
|---|---|---|
| `packages/mcp-server/src/readers/index.ts` | knip unused file ([raw L3](https://github.com/open-gsd/gsd-pi/blob/research/knip-leads/.project/research/045-knip-leads.raw.txt)). Barrel is **not** in the published `exports` map — only `./readers/{graph,paths,roadmap,state}` ([inventory §1b](https://github.com/open-gsd/gsd-pi/blob/research/entry-point-roots/.project/research/045-entry-point-roots.md); `packages/mcp-server/package.json` L22–42). Package `src/index.ts` re-exports the same symbols from the leaf files, not from `./readers/index.js` (`packages/mcp-server/src/index.ts` L22–49). `git grep` for `readers/index` / `from './readers'` / `@opengsd/mcp-server/readers` (no subpath) is empty. | `build:core` (includes `build:mcp-server` + root `tsc`; `package.json` L65) |
| `packages/pi-ai/bedrock-provider.js` + `bedrock-provider.d.ts` | knip unused files ([raw L4–5](https://github.com/open-gsd/gsd-pi/blob/research/knip-leads/.project/research/045-knip-leads.raw.txt)). Tracked one-line shims (`export * from "./dist/bedrock-provider.js"`). Published export is `./dist/bedrock-provider.js` ([inventory §1d](https://github.com/open-gsd/gsd-pi/blob/research/entry-point-roots/.project/research/045-entry-point-roots.md); `packages/pi-ai/package.json` L58–60). Package `files` is `bin`, `dist`, `README.md` only (`package.json` L66–70) — the root shims are not shipped. Same class as the gone `src/rtk-shared.js` stale sibling ([032a §2a](https://github.com/open-gsd/gsd-pi/blob/main/plans/032a-dead-code-audit.md#2a-high-confidence--safe-to-remove-6)). | `build:core` (includes `build:pi-ai`) |

### MEDIUM

| Row | Why a glance | Citation |
|---|---|---|
| `packages/gsd-agent-core/scripts/generate-session-decomposition.mjs` | 032a MEDIUM one-off codegen; still present; not in any `package.json` script | [disposition §5](https://github.com/open-gsd/gsd-pi/blob/research/032a-disposition/.project/research/045-032a-disposition.md); knip unused file ([raw L2](https://github.com/open-gsd/gsd-pi/blob/research/knip-leads/.project/research/045-knip-leads.raw.txt)) |
| `packages/pi-ai/scripts/generate-test-image.ts` | 032a MEDIUM manual generator; still present; only `canvas` import site | [disposition §5](https://github.com/open-gsd/gsd-pi/blob/research/032a-disposition/.project/research/045-032a-disposition.md); knip unused file ([raw L6](https://github.com/open-gsd/gsd-pi/blob/research/knip-leads/.project/research/045-knip-leads.raw.txt)) |
| `@gsd/native` in `packages/gsd-agent-core/package.json` | knip unused dependency ([raw L270](https://github.com/open-gsd/gsd-pi/blob/research/knip-leads/.project/research/045-knip-leads.raw.txt)). Declared at `package.json` L28. `git grep '@gsd/native'` under `packages/gsd-agent-core/` hits only the manifest. | New knip lead. Gate if removed: `build:core` |
| `@opengsd/contracts` in `packages/pi-coding-agent/package.json` | knip unused dependency ([raw L271](https://github.com/open-gsd/gsd-pi/blob/research/knip-leads/.project/research/045-knip-leads.raw.txt)). Declared at `package.json` L36. No `from` / `require` in that package. | New knip lead. Gate if removed: `build:core` |
| `extract-zip` in `packages/pi-coding-agent/package.json` | knip unused dependency ([raw L272](https://github.com/open-gsd/gsd-pi/blob/research/knip-leads/.project/research/045-knip-leads.raw.txt)). Declared at `package.json` L42. No source import; only a CHANGELOG mention. Root `src/rtk.ts` still uses `extract-zip` ([032a §1a](https://github.com/open-gsd/gsd-pi/blob/main/plans/032a-dead-code-audit.md#1a-used-from-root-code-24--keep)). | New knip lead. Gate if removed: `build:core` |
| `@sinclair/typebox` in `packages/pi-tui/package.json` | knip unused dependency ([raw L273](https://github.com/open-gsd/gsd-pi/blob/research/knip-leads/.project/research/045-knip-leads.raw.txt)). No import under `packages/pi-tui/`. | New knip lead. Gate if removed: `build:core` |

### LOW-LEAD

| Class | Why keep | Citation |
|---|---|---|
| `packages/pi-coding-agent/examples/**` (knip: 88 files including `packages/rpc-client/examples/basic-usage.ts`) | Shipped example/docs code | [032a §2c](https://github.com/open-gsd/gsd-pi/blob/main/plans/032a-dead-code-audit.md#2c-lowlead--do-not-remove-knip-false-positives-explained); [disposition §8](https://github.com/open-gsd/gsd-pi/blob/research/032a-disposition/.project/research/045-032a-disposition.md) (123 tracked files under `packages/pi-coding-agent/examples`); [inventory excludes examples](https://github.com/open-gsd/gsd-pi/blob/research/entry-point-roots/.project/research/045-entry-point-roots.md) |
| `packages/pi-tui/vitest.config.ts` | Vitest convention root for `packages/pi-tui` `test` script | knip unused file ([raw L94](https://github.com/open-gsd/gsd-pi/blob/research/knip-leads/.project/research/045-knip-leads.raw.txt)); 032a false-positive class “package.json-script roots” |
| Wildcard `exports` (`./*` on `@gsd/pi-coding-agent`, `@gsd/agent-core`, `@gsd/agent-modes`) | Every compiled `dist/*.js` is a published import path | [inventory §1d](https://github.com/open-gsd/gsd-pi/blob/research/entry-point-roots/.project/research/045-entry-point-roots.md) |
| Named package `exports` / bins | Published surfaces | [inventory §1b–§1d](https://github.com/open-gsd/gsd-pi/blob/research/entry-point-roots/.project/research/045-entry-point-roots.md) |
| `canvas`, `@types/diff`, `@types/ms`, `shx`, `@xterm/xterm` | 032a §1f package/web leads; still present | [disposition §9](https://github.com/open-gsd/gsd-pi/blob/research/032a-disposition/.project/research/045-032a-disposition.md); knip unused devDeps ([raw L304–308](https://github.com/open-gsd/gsd-pi/blob/research/knip-leads/.project/research/045-knip-leads.raw.txt)) |

Live duplicates (jsonl pair, rtk-shared pair, compaction / messages / claude-spawn / `fuzzyFindText` families) still exist ([disposition §2 / §10](https://github.com/open-gsd/gsd-pi/blob/research/032a-disposition/.project/research/045-032a-disposition.md)). **Excluded** from this hunt.

---

## 3. Extensions

Bundled extensions under `src/resources/extensions/` are jiti-discovered at runtime (`src/extension-discovery.ts`) and shipped via `src/resources` in the tarball ([inventory “Bundled extensions”](https://github.com/open-gsd/gsd-pi/blob/research/entry-point-roots/.project/research/045-entry-point-roots.md); [032a §2c](https://github.com/open-gsd/gsd-pi/blob/main/plans/032a-dead-code-audit.md#2c-lowlead--do-not-remove-knip-false-positives-explained)). That class is LOW-LEAD. The HIGH rows below are **not** extension entries — they are unused internals / barrels.

### HIGH

| Row | Evidence | Verify gate |
|---|---|---|
| `src/resources/extensions/gsd/safe-fs.ts` | knip unused file ([raw L154](https://github.com/open-gsd/gsd-pi/blob/research/knip-leads/.project/research/045-knip-leads.raw.txt)). Exports `safeMkdir` / `safeCopy` / `safeCopyRecursive`. `git grep` of those symbols hits only this file plus comments in `worktree-state-projection.ts` and a **filename string** in `silent-catch-diagnostics.test.ts` L77 (the test enumerates files; it does not import the module). No `from '…safe-fs'`. | `typecheck:extensions` |
| `src/resources/extensions/gsd/compat/index.ts` | knip unused file ([raw L152](https://github.com/open-gsd/gsd-pi/blob/research/knip-leads/.project/research/045-knip-leads.raw.txt)). Barrel re-exports `compat-marker.js`. Live callers import `./compat/compat-marker.js` (and siblings) directly — e.g. `projection-worker.ts`, `markdown-renderer.ts`, `db-writer.ts`. No `from '…/compat'` / `from '…/compat/index'`. | `typecheck:extensions` |
| `src/resources/extensions/gsd/migrate/index.ts` | knip unused file ([raw L153](https://github.com/open-gsd/gsd-pi/blob/research/knip-leads/.project/research/045-knip-leads.raw.txt)). Barrel for the old `.planning` migrator. Live callers import leaf modules (`./migrate/parser.js`, `./migrate/writer.js`, …). No `from '…/migrate'` / `from '…/migrate/index'`. | `typecheck:extensions` |
| `src/resources/extensions/gsd/state/derive/interrupted-work.ts` | knip unused file ([raw L155](https://github.com/open-gsd/gsd-pi/blob/research/knip-leads/.project/research/045-knip-leads.raw.txt)). File header: “Detect interrupted slice work from CONTINUE artifacts **(legacy path)**.” Exports `detectInterruptedWork` / `interruptedWorkNextAction`. `git grep` of both symbols hits only this file. | `typecheck:extensions` |

### MEDIUM

| Row | Why a glance | Citation |
|---|---|---|
| `src/resources/extensions/gsd/tests/integration/headless-command.ts` | 032a MEDIUM manual `npx tsx` harness; still 545 lines; does not match `test:integration` glob `*.test.ts` (`package.json` L95) | [disposition §5](https://github.com/open-gsd/gsd-pi/blob/research/032a-disposition/.project/research/045-032a-disposition.md); knip unused file ([raw L159](https://github.com/open-gsd/gsd-pi/blob/research/knip-leads/.project/research/045-knip-leads.raw.txt)) |

### LOW-LEAD

| Class | knip unused-file count (approx.) | Why keep | Citation |
|---|---|---|---|
| `src/resources/extensions/*/index.ts` + tool files (async-jobs, aws-auth, bg-shell, browser-tools, context7, github-sync, google-cli, mac-tools, slash-commands, universal-config, voice, …) | 41 | jiti / directory discovery; copied by `copy-resources.cjs` | [032a §2c](https://github.com/open-gsd/gsd-pi/blob/main/plans/032a-dead-code-audit.md#2c-lowlead--do-not-remove-knip-false-positives-explained); [disposition §8](https://github.com/open-gsd/gsd-pi/blob/research/032a-disposition/.project/research/045-032a-disposition.md); [inventory bundled extensions](https://github.com/open-gsd/gsd-pi/blob/research/entry-point-roots/.project/research/045-entry-point-roots.md) |
| `src/resources/skills/create-gsd-extension/templates/*.ts` | 2 | skill templates copied as text | [032a §2c](https://github.com/open-gsd/gsd-pi/blob/main/plans/032a-dead-code-audit.md#2c-lowlead--do-not-remove-knip-false-positives-explained); [disposition §8](https://github.com/open-gsd/gsd-pi/blob/research/032a-disposition/.project/research/045-032a-disposition.md) (3 files still present; knip flagged the two non-test templates) |
| `src/resources/extensions/gsd/tests/fixtures/*worker.ts` | 3 | spawned as worker processes by tests | [032a §2c](https://github.com/open-gsd/gsd-pi/blob/main/plans/032a-dead-code-audit.md#2c-lowlead--do-not-remove-knip-false-positives-explained); [disposition §8](https://github.com/open-gsd/gsd-pi/blob/research/032a-disposition/.project/research/045-032a-disposition.md) |

Slash-command / workflow-template / skill files that knip did **not** flag as unused files are live published roots ([inventory §4–§6](https://github.com/open-gsd/gsd-pi/blob/research/entry-point-roots/.project/research/045-entry-point-roots.md)).

---

## 4. Scripts

Orphaned scripts are specified for `scripts/archive/`, **not** deletion ([map](https://github.com/open-gsd/gsd-pi/issues/1741); [ticket 1745](https://github.com/open-gsd/gsd-pi/issues/1745)).

### HIGH

**None.** No new archive candidates.

032a §3 recorded **zero** orphaned `package.json` scripts ([032a §3](https://github.com/open-gsd/gsd-pi/blob/main/plans/032a-dead-code-audit.md#3-orphaned-packagejson-scripts); [disposition “Out of scope”](https://github.com/open-gsd/gsd-pi/blob/research/032a-disposition/.project/research/045-032a-disposition.md)). knip’s unused-file list under `scripts/` is the false-positive class “package.json-script roots / transitive / skill / docs”, plus files **already** in `scripts/archive/`.

### MEDIUM

None. `scripts/preview-dashboard.ts` is a manual harness (knip unused file, [raw L110](https://github.com/open-gsd/gsd-pi/blob/research/knip-leads/.project/research/045-knip-leads.raw.txt)) but `scripts/archive/README.md` L49–50 already kept it because `docs/dev/FILE-SYSTEM-MAP.md` references it. LOW-LEAD (do not re-litigate).

### LOW-LEAD

| Class | Paths | Why keep | Citation |
|---|---|---|---|
| Already archived | `scripts/archive/migrate-pi-clean-seam.cjs`, `parallel-monitor.mjs`, `rtk-benchmark.mjs`, `sync-agent-core-upstream.cjs`, `tui-open-surface-demo.mjs` (knip unused files [raw L98–102](https://github.com/open-gsd/gsd-pi/blob/research/knip-leads/.project/research/045-knip-leads.raw.txt)) | Already in `scripts/archive/`; README lists zero inbound refs | `scripts/archive/README.md` L15–39 |
| Published `files` field | `scripts/postinstall.js`, `scripts/link-workspace-packages.cjs`, `scripts/lib/logo.cjs` | Shipped in the npm tarball | root `package.json` `files` L20–38; [inventory §1a](https://github.com/open-gsd/gsd-pi/blob/research/entry-point-roots/.project/research/045-entry-point-roots.md) |
| Transitive / CI / skill / vendor roots | `watch-resources.js` (spawned by `scripts/dev.js`, which is the `dev` script), `check-skill-references.mjs` (`scripts/ci-fast-gates.sh` L37), `ci_monitor.cjs` (shipped skill `src/resources/skills/github-workflows/SKILL.md` + `src/tests/integration/ci_monitor.test.ts`), vendor chain (`vendor-pi*.cjs`, `apply-seam.cjs`, `apply-gsd-pi-package-json.cjs`, `normalize-pi-imports.cjs`, `restore-pi-tsconfig.cjs`, `generate-pi-coding-agent-index.cjs`, `trim-pi-coding-agent-index.cjs`) | Not import-graph roots; still live | `scripts/archive/README.md` L41–59; `docs/dev/pi-upstream.md`; `package.json` `dev` L109 |
| Docs-referenced manual harness | `scripts/preview-dashboard.ts` | Kept by the archive pass | `scripts/archive/README.md` L49–50 |

---

## 5. Tests

Tests are consumers, not roots ([inventory](https://github.com/open-gsd/gsd-pi/blob/research/entry-point-roots/.project/research/045-entry-point-roots.md); [map](https://github.com/open-gsd/gsd-pi/issues/1741)). Unused test files and test-only helpers are still in scope as ledger rows.

### HIGH

None.

### MEDIUM

| Row | Why a glance | Citation |
|---|---|---|
| `src/resources/extensions/gsd/tests/integration/headless-command.ts` | See [Extensions MEDIUM](#medium-1). Unused test-adjacent harness (not a `*.test.ts`). | [disposition §5](https://github.com/open-gsd/gsd-pi/blob/research/032a-disposition/.project/research/045-032a-disposition.md) |
| `tests/live-regression/benchmark.ts` | **032a changed row.** 032a §2c said “referenced by `test:live-regression` — not dead.” On HEAD, `test:live-regression` runs `tests/live-regression/run.ts` (`package.json` L150). CI (`.github/workflows/npm-publish.yml`) calls that script. `git grep tests/live-regression/benchmark` hits only the file itself + 032a. File still exists (170 lines) as a **manual** harness (`GSD_SMOKE_BINARY=… node --experimental-strip-types tests/live-regression/benchmark.ts`, `benchmark.ts` L25–27). Disposition: **not** a new HIGH deletion lead — owner chooses keep-as-manual vs `scripts/archive/`. | [disposition §8 changed row](https://github.com/open-gsd/gsd-pi/blob/research/032a-disposition/.project/research/045-032a-disposition.md); knip unused file ([raw L174](https://github.com/open-gsd/gsd-pi/blob/research/knip-leads/.project/research/045-knip-leads.raw.txt)) |

`headless-command.ts` is counted once, under extensions. This tests section adds only `benchmark.ts` to the MEDIUM total.

### LOW-LEAD

| Row | Why keep | Citation |
|---|---|---|
| `tests/live/run.ts` | `package.json` script `test:live` (`package.json` L99) | [032a §2c](https://github.com/open-gsd/gsd-pi/blob/main/plans/032a-dead-code-audit.md#2c-lowlead--do-not-remove-knip-false-positives-explained); [disposition §8](https://github.com/open-gsd/gsd-pi/blob/research/032a-disposition/.project/research/045-032a-disposition.md) |
| `tests/live/load-live-credentials.ts` | Imported by `tests/live/run.ts` L14 (`loadLiveCredentialsFromAuth`) | knip unused-file false positive ([raw L175](https://github.com/open-gsd/gsd-pi/blob/research/knip-leads/.project/research/045-knip-leads.raw.txt)) |
| `src/resources/extensions/gsd/tests/fixtures/*worker.ts` | See [Extensions LOW-LEAD](#low-lead-2) | [032a §2c](https://github.com/open-gsd/gsd-pi/blob/main/plans/032a-dead-code-audit.md#2c-lowlead--do-not-remove-knip-false-positives-explained) |
| Other tracked `tests/**` (e2e, smoke, live-workflow, acceptance-bed, `tests/live-regression/run.ts`) | Not in knip unused files; wired by `package.json` scripts (`test:e2e`, `test:smoke`, `test:live-workflow`, `test:auto-acceptance`, `test:live-regression`) | `package.json` L99–L154 |

032a HIGH unused test helpers (`resolve-ts-hooks.mjs`, `web-mode-runtime-fixtures.ts`) are **gone** ([disposition §1](https://github.com/open-gsd/gsd-pi/blob/research/032a-disposition/.project/research/045-032a-disposition.md)).

---

## 6. Deps

### HIGH

**None.** 032a never put unused deps in HIGH. The four suspect-unused deps that were closest (`chokidar`, `proxy-agent`, `file-type`, `ajv-formats`) are **gone** ([disposition §4](https://github.com/open-gsd/gsd-pi/blob/research/032a-disposition/.project/research/045-032a-disposition.md)). Remaining unused-dep leads need `validate-pack` and/or a human glance at hoisting.

### MEDIUM

| Row | Evidence | Verify gate |
|---|---|---|
| `balanced-match`, `brace-expansion`, `graceful-fs`, `retry`, `signal-exit` (root `dependencies`) | 032a §1d packaging deps. Still in root `package.json`. Zero `from` / `require` / `import()`. Added in `7faba933b` so npm flat-install smoke tests pass. | `validate-pack` ([disposition §3](https://github.com/open-gsd/gsd-pi/blob/research/032a-disposition/.project/research/045-032a-disposition.md); [032a §1d](https://github.com/open-gsd/gsd-pi/blob/main/plans/032a-dead-code-audit.md#1d-used-via-packaging--deliberate-do-not-remove-casually-5--medium)) |
| `@types/picomatch` (root `devDependencies`) | 032a MEDIUM leftover. Still `"@types/picomatch": "^4.0.2"` (`package.json` L206). picomatch is only `_require()`’d with local `PicomatchFn` types. knip 6.32.2 did **not** re-flag it (absent from unused-devDep list [raw L303–310](https://github.com/open-gsd/gsd-pi/blob/research/knip-leads/.project/research/045-knip-leads.raw.txt)). | `typecheck:extensions` (and `build:core` if dropped) — [disposition §4](https://github.com/open-gsd/gsd-pi/blob/research/032a-disposition/.project/research/045-032a-disposition.md) |
| `@gsd/native` (`@gsd/agent-core`) | See [packages MEDIUM](#medium) | `build:core` |
| `@opengsd/contracts` (`@gsd/pi-coding-agent`) | See [packages MEDIUM](#medium) | `build:core` |
| `extract-zip` (`@gsd/pi-coding-agent`) | See [packages MEDIUM](#medium) | `build:core` |
| `@sinclair/typebox` (`@gsd/pi-tui`) | See [packages MEDIUM](#medium) | `build:core` |
| `@eslint/eslintrc` (`web` devDependency) | knip unused devDep ([raw L309](https://github.com/open-gsd/gsd-pi/blob/research/knip-leads/.project/research/045-knip-leads.raw.txt)). `web/eslint.config.mjs` imports `eslint/config` + `eslint-config-next`, not `@eslint/eslintrc`. | Human glance (web lint). Named gates do not typecheck `web/`. |
| `esbuild` (`web` devDependency) | knip unused devDep ([raw L310](https://github.com/open-gsd/gsd-pi/blob/research/knip-leads/.project/research/045-knip-leads.raw.txt)). No web-source import found. | Human glance (web build). |

The five packaging deps count as **5** MEDIUM rows; the four new package unused deps count as **4**; the two web unused devDeps count as **2**; `@types/picomatch` is **1**. **12 MEDIUM dep rows.**

### LOW-LEAD

| Class | Count | Why keep | Citation |
|---|---|---|---|
| Root-duplicate deps (032a §1b) | 21 | Imported only inside `packages/*` that self-declare them (except `diff`: `packages/gsd-agent-modes/src/modes/interactive/components/diff.ts` L1 imports `diff` and that package does **not** self-declare — same at 032a landing). Removal still `validate-pack`-gated. knip 6.32.2 re-flagged 20 of 21; it did **not** flag root `diff` (`package.json` L175) because the agent-modes import is visible to a whole-repo knip run. Keep `diff` in this class anyway. | [disposition §7](https://github.com/open-gsd/gsd-pi/blob/research/032a-disposition/.project/research/045-032a-disposition.md); [032a §1b](https://github.com/open-gsd/gsd-pi/blob/main/plans/032a-dead-code-audit.md#1b-used-only-inside-packages-which-self-declare-them--root-entry-is-a-duplicate-21--low-removal-confidence) |
| `@google/genai`, `ws` (root) | 2 | 032a §1a **USED from root** (dynamic `import()`). knip unused-dep false positives ([raw L245, L269](https://github.com/open-gsd/gsd-pi/blob/research/knip-leads/.project/research/045-knip-leads.raw.txt)). | [032a §1a](https://github.com/open-gsd/gsd-pi/blob/main/plans/032a-dead-code-audit.md#1a-used-from-root-code-24--keep) |
| web radix / shadcn / form deps | 27 | Vendored shadcn library | [032a §1f](https://github.com/open-gsd/gsd-pi/blob/main/plans/032a-dead-code-audit.md#1f-knip-corroboration); [disposition §9](https://github.com/open-gsd/gsd-pi/blob/research/032a-disposition/.project/research/045-032a-disposition.md); knip unused deps [raw L274–302](https://github.com/open-gsd/gsd-pi/blob/research/knip-leads/.project/research/045-knip-leads.raw.txt) |
| `canvas`, `@types/diff`, `@types/ms`, `shx`, `@xterm/xterm` | 5 | 032a §1f package leads | [disposition §9](https://github.com/open-gsd/gsd-pi/blob/research/032a-disposition/.project/research/045-032a-disposition.md) |

**55 LOW-LEAD dep items** = 21 + 2 + 27 + 5.

---

## 7. Unused exports and types (remainder)

knip: **788 unused exports**, **537 unused exported types**, **5 duplicate exports** ([045-knip-leads.md](https://github.com/open-gsd/gsd-pi/blob/research/knip-leads/.project/research/045-knip-leads.md); [raw L881 / L1670](https://github.com/open-gsd/gsd-pi/blob/research/knip-leads/.project/research/045-knip-leads.raw.txt)).

These are **not** HIGH. An unused export on a live module is not file-unreachability. Most parse as:

| Path class | Unused-export hits (parsed) | Tier |
|---|---|---|
| `src/resources/extensions/**` | 372 | LOW-LEAD (jiti / published extension internals) |
| `src/` (CLI, not extensions) | 61 | **MEDIUM remainder** — glance; not published (`package.json` has no `exports`) |
| `web/` | 58 | LOW-LEAD (shadcn / CLI `--web` surface) |
| `scripts/` | 22 | LOW-LEAD if under `scripts/install` (published) or archive/vendor |
| `packages/*` (named + truncated) | 8 parsed + many truncated `…` paths | LOW-LEAD when the file is a published `exports` target ([inventory §1](https://github.com/open-gsd/gsd-pi/blob/research/entry-point-roots/.project/research/045-entry-point-roots.md)) |
| `vscode-extension/` | 9 | LOW-LEAD (VS Code manifest entry) |
| `tests/` | 5 | MEDIUM-adjacent; folded into the remainder glance |
| `studio/` | 3 | Excluded as an automatic root |

**MEDIUM remainder row (1):** knip unused exports / unused exported types after false-positive disposition. Do not delete from this list without a per-symbol `git grep` and a named gate. The 61 `src/` CLI unused exports are the first glance set.

HIGH unused *files* already cover their exports (`readers/index.ts` barrel, `safe-fs.ts` symbols, `compat`/`migrate` barrels, `interrupted-work.ts` symbols, bedrock shims).

---

## 8. Other surfaces (not named sections)

The ticket sections are `src/`, `packages/*`, extensions, scripts, tests, deps. These extra knip unused files are recorded so they are not re-litigated.

### MEDIUM (not automatic roots)

| Row | Why a glance | Citation |
|---|---|---|
| `studio/` (whole Electron app; knip unused files: `studio/electron.vite.config.ts`, `studio/src/main/index.ts`, `studio/src/preload/index.ts`, `studio/src/renderer/src/App.tsx`, `studio/src/renderer/src/main.tsx`) | 032a MEDIUM leftover. **Not an automatic root** ([map](https://github.com/open-gsd/gsd-pi/issues/1741); [inventory](https://github.com/open-gsd/gsd-pi/blob/research/entry-point-roots/.project/research/045-entry-point-roots.md)). Still 20 tracked files; not in `pnpm-workspace.yaml` / root scripts / CI. | [disposition §5](https://github.com/open-gsd/gsd-pi/blob/research/032a-disposition/.project/research/045-032a-disposition.md) |
| `web/components/gsd/guided-dialog.tsx` | knip unused file ([raw L196](https://github.com/open-gsd/gsd-pi/blob/research/knip-leads/.project/research/045-knip-leads.raw.txt)). Not shadcn. `git grep` of `guided-dialog` / `GuidedDialog` hits only this file. | New knip lead. Named gates do not build `web/`. |
| `web/components/gsd/onboarding/wizard-stepper.tsx` | knip unused file ([raw L197](https://github.com/open-gsd/gsd-pi/blob/research/knip-leads/.project/research/045-knip-leads.raw.txt)). `WizardStepper` has no importers. | New knip lead. |
| `web/components/gsd/terminal.tsx` | knip unused file ([raw L198](https://github.com/open-gsd/gsd-pi/blob/research/knip-leads/.project/research/045-knip-leads.raw.txt)). Live terminals are `main-session-terminal` / `shell-terminal` (`dual-terminal.tsx`, `app-shell.tsx`). | New knip lead. |
| `web/styles/globals.css` | knip unused file ([raw L241](https://github.com/open-gsd/gsd-pi/blob/research/knip-leads/.project/research/045-knip-leads.raw.txt)). Live CSS is `web/app/globals.css` (`web/app/layout.tsx` L4; `web/components.json` `"css": "app/globals.css"`). | New knip lead. Possibly leftover shadcn path — glance, not HIGH. |

### LOW-LEAD

| Class | knip unused-file count | Why keep | Citation |
|---|---|---|---|
| `web/components/ui/*.tsx` + `web/hooks/use-*.ts` | 43 (plus the leftover `web/styles/globals.css` counted MEDIUM above) | Vendored shadcn | [032a §2c](https://github.com/open-gsd/gsd-pi/blob/main/plans/032a-dead-code-audit.md#2c-lowlead--do-not-remove-knip-false-positives-explained); [disposition §8](https://github.com/open-gsd/gsd-pi/blob/research/032a-disposition/.project/research/045-032a-disposition.md) (55 UI components + hooks) |
| `vscode-extension/src/*` | 19 | VS Code manifest entry (`main`: `dist/extension.js`), not the import graph. Not a workspace package / not one of the six published-root categories. | [032a §2c](https://github.com/open-gsd/gsd-pi/blob/main/plans/032a-dead-code-audit.md#2c-lowlead--do-not-remove-knip-false-positives-explained); [inventory “Explicitly excluded”](https://github.com/open-gsd/gsd-pi/blob/research/entry-point-roots/.project/research/045-entry-point-roots.md) |

`web/` as a package export is private; it is live only via CLI `--web` / `gsd web` ([inventory §1e / §2](https://github.com/open-gsd/gsd-pi/blob/research/entry-point-roots/.project/research/045-entry-point-roots.md)).

---

## 9. 032a leftover roll-forward

From [045-032a-disposition.md](https://github.com/open-gsd/gsd-pi/blob/research/032a-disposition/.project/research/045-032a-disposition.md) (62 named rows: **11 gone / 50 still valid / 1 changed**):

| 032a leftover | This draft |
|---|---|
| 6 HIGH dead files | gone — not re-listed |
| 4 suspect-unused deps | gone — not re-listed |
| 5 packaging deps | MEDIUM deps (still) |
| `@types/picomatch` | MEDIUM deps (still; knip did not re-flag) |
| `headless-command.ts`, two generators, `studio/` | MEDIUM files (still) |
| 21 root-duplicate deps | LOW-LEAD deps (still; `diff` kept even though knip dropped it) |
| knip FP categories | LOW-LEAD (still), except `benchmark.ts` |
| `tests/live-regression/benchmark.ts` | **changed → MEDIUM** (manual harness; `test:live-regression` now runs `run.ts`) |
| §1f package/web leads | LOW-LEAD (still) |
| §4 live duplicates | **excluded** (existence-only; cloud-config pair already gone) |

---

## 10. What this draft is not

- Not an approved program. Do not execute deletions or archival from this file.
- Not a `plans/045-*.md` (that is ticket 1746).
- Not a standing CI knip gate ([map out of scope](https://github.com/open-gsd/gsd-pi/issues/1741)).
- Not a list of unused *branches* inside live functions.
- Not a consolidation plan for live duplicates.

---

## One-line gist

Draft whole-repo ledger on `cdc4fd1f2`: **HIGH 6** (unused barrels / stale pi-ai shims / unused gsd internals) / **MEDIUM 22** (032a leftovers + `benchmark.ts` + new package/web unused deps + unused web GSD components + unused-export remainder) / **LOW-LEAD 220 unused-file FPs + 55 deps**. No new `scripts/archive/` candidates. `studio/` is not a root.
