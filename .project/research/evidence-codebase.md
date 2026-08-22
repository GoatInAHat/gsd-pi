# Evidence — codebase

<!-- Written by the codebase mapper during /gsd-path-inspect. Read by define
     (brownfield mode), researchers (fifth standard dimension), the planner
     (conventions are binding), and reviewers. -->

Repo root: /Users/jeremymcspadden/orca/workspaces/gsd-pi/path-fixes
Scanned: 2026-08-22 (verify sidecar worktree pinned at e210e12a41df85b2f02e1de65a2afc37b348ba12, branch gsd-path-verify/inspect-codebase)
Checks run (all inside the verify sidecar; pnpm 10.12.1, node v26.0.0):
- `pnpm install --frozen-lockfile --ignore-scripts` → clean in 8.5s; lockfile consistent with manifests
- `pnpm run test:compile` → 3049 files compiled to `dist-test/` in ~3.5s
- `pnpm run test:unit:compiled` on a fresh checkout (no build) → 3648 passed, 1029 failed, 9 skipped; failures are mass `ERR_MODULE_NOT_FOUND` under `dist-test/packages/*/dist/**` (environmental, see finding)
- `pnpm run build:core` → exit 0 in ~38s (Rust/native artifacts resolved from prebuilt platform packages)
- `pnpm run test:compile && pnpm run test:unit:compiled` after build → **14438 passed, 25 failed, 28 skipped** (exit 1); breakdown in the dedicated finding below (23 environmental, 1 genuine gate failure, 1 isolation-sensitive)
- `node --import ./scripts/dist-test-resolve.mjs --experimental-test-isolation=process --test dist-test/src/tests/prompt-golden-fixtures.test.js dist-test/src/tests/read-cli-args.test.js` → prompt-golden gate assertion reproduced; read-cli-args passed in isolation
- `node --import ./scripts/dist-test-resolve.mjs --test-reporter=spec --test dist-test/src/tests/worktree-cli-root.test.js` → isolated repro confirming the pre-build failure mode
- `git rev-parse --is-shallow-repository` → true; only 57 commits visible locally
- Not run: `test:integration`, `test:e2e`, `test:live*`, `test:packages`, coverage targets (need credentials, Playwright browsers, Docker, or live services)

## Map

- **Stack**: TypeScript 5.9 (strict, NodeNext ESM, `"type": "module"`) on Node >= 22.18 (`package.json:47-49`); pnpm 10.12.1 monorepo (`pnpm-workspace.yaml` globs `packages/*`, `extensions/*`, `web`). Rust 2021 N-API workspace in `native/` (crates `gsd-engine`, `gsd-ast`, `gsd-grep`; tree-sitter + ast-grep). Web UI is Next.js 16.2.11 (`web/package.json:61`, package `gsd-web`, Radix UI). Python plugin in `integrations/hermes` (pyproject.toml). VS Code extension (`vscode-extension/`, v0.3.0) on a separate npm toolchain (own `package-lock.json`, not in the pnpm workspace). Tests: Node built-in `node --test` with `--experimental-strip-types` plus esbuild-compiled `dist-test/`; one vitest outlier (`test:pi-claude-schemas`); c8 coverage gates at 40% statements/lines, 20% branches/functions (`package.json:94`).
- **Entry points**: npm bins `gsd`/`gsd-cli` → `dist/loader.js` (`package.json:15-19`); `src/loader.ts` is a fast-path startup loader (`--version`/`--help` short-circuit, then Node/git runtime checks). The real CLI is `src/cli.ts`, lazy-importing `@gsd/pi-coding-agent`, `@gsd/agent-core`, and `@gsd/agent-modes` (interactive, print, RPC modes). Other bins: `gsd-daemon` (packages/daemon), `gsd-mcp-server` (packages/mcp-server), `pi-ai` (packages/pi-ai). Web mode stages and runs a Next standalone server (`scripts/stage-web-standalone.cjs`, `src/web-mode.ts`). Dev entries: `node scripts/dev.js`, `scripts/dev-cli.js`.
- **Architecture**: A local-first coding-agent CLI ("GSD Pi", `@opengsd/gsd-pi` v1.16.1). Root `src/` is a thin host shell (CLI routing, onboarding, worktree commands, headless mode, web mode) compiled by `tsc` to `dist/`. Agent execution lives in published workspace packages under `packages/` (`pi-coding-agent`, `pi-ai` provider layer, `pi-tui`, `pi-agent-core`, `agent-core`, `agent-modes`, `contracts`, `rpc-client`, `mcp-server`, `daemon`, `native`). The domain/workflow engine (milestones → slices → tasks, SQLite-backed state via sql.js, auto-mode orchestration, dispatch) is NOT in `packages/` — it is a bundled pi extension shipped as TypeScript source under `src/resources/extensions/gsd/` (~1925 `.ts` files incl. ~1155 test files), excluded from the root tsconfig, loaded at runtime via jiti / `--experimental-strip-types` with a custom module hook (`src/resources/extensions/gsd/tests/resolve-ts.mjs`). The Rust `native/` engine (built by `native/scripts/build.js`, shipped as `@opengsd/engine-<platform>` optionalDependencies) accelerates grep/AST/directory-sync and is consumed from the gsd extension's db engine. Hermes (Python), the VS Code extension, the daemon (Discord), and the MCP server are satellite surfaces over the shared `@opengsd/contracts`.
- **Conventions**: kebab-case filenames with heavy prefix grouping (`auto-worktree-merge-*.ts`, `headless-*.ts`, `worktree-cli-*.ts`). Commit style is conventional-commit-ish, dominated by `fix(issue): ... (#PR)` — all 57 visible commits match. Tests colocated as `*.test.ts` beside source (`src/tests/`, `src/resources/extensions/*/tests/`, `packages/*/src`), run with `node --test`. Domain-layer error handling uses typed errors (`GSDError` with codes such as `GSD_REVISION_CONFLICT`, `GSD_IDEMPOTENCY_CONFLICT`) and revision-checked "domain operation" write boundaries (`src/resources/extensions/gsd/db/domain-operation.ts`). Source files carry `// Project/App:` + `// File Purpose:` headers. ADRs live in `docs/dev/ADR-0NN-*.md` (48 ADRs, up to ADR-048).
- **Maturity**: Shipping software at v1.16.1 with a real release pipeline (20 GitHub workflows; CI on blacksmith runners with merge queue; trusted manual npm-publish with provenance). Large test surface: 191 test files in `src/tests`, ~1220 under `src/resources/extensions`, 30 script tests, plus e2e/live/smoke/acceptance beds under `tests/` (most gated behind env flags). Unit suite passes 14438/14491 with 25 remaining failures at this revision — 23 environmental (fault-injection native build not run), 1 genuine token-budget gate miss, 1 isolation-sensitive (see findings). Coverage gates are modest (40/40/20/20). Scaffolding/half-built: `packages/db` (no manifest, unreferenced), lost plans 033/034 (`plans/README.md`), empty `docs/adr/` (real ADRs in `docs/dev/`), three parallel doc trees.
- **Recent activity**: Only 57 commits visible (shallow clone), all within ~30 days, 55/57 by one author. The tail is v1.16.1 release plus a dense cluster of `fix(issue):` patches — Windows path/locking bugs (`os error 32`, forward-slash `pnpm.cmd`, projection bootstrap CWD locking), auto-mode deadlock/liveness fixes, `gsd quick` headless entry points, and validation-shape fixes (`knownIssues` wrapper, `answers[id].answers`). File-touch counts over the visible window: `src/resources` 3121, `packages/pi-coding-agent` 460, `docs/dev` 219, `src/tests` 209, `packages/pi-ai` 177.

## Finding: the domain engine is shipped as uncompiled TypeScript "resources", not built code

- **Claim**: The product's core workflow engine — SQLite state, milestone/slice/task lifecycle, auto-mode orchestration (~1925 `.ts` files under `src/resources/extensions/gsd/`, including a 52-entry `auto/` cluster and a `db/` kernel with engine, domain-operation, lifecycle-shadow modules) — is excluded from the root `tsc` build and shipped as source in the npm tarball, loaded at runtime via jiti / `--experimental-strip-types`.
- **Source**: `tsconfig.json` exclude block (`"src/resources/extensions"`); `package.json:20-38` (`files` includes `src/resources`); `src/resources/extensions/gsd/tests/resolve-ts.mjs:1-7`; `find src/resources/extensions/gsd -name '*.ts' | wc -l` → 1925.
- **Confidence**: high
- **Why it matters here**: A planner reading `packages/` would look in the wrong place for the business logic. Engine changes follow resource-extension conventions (jiti resolution, `.ts` import specifiers, custom test hook, separate `tsconfig.extensions.json` typecheck), not package conventions — and they ship uncompiled, so runtime strip-types behavior is part of the compatibility surface.

## Finding: unit suite is green only in the exact order build → test:compile → test:unit

- **Claim**: `test:unit:compiled` resolves workspace imports into `dist-test/packages/*/dist/**` via `scripts/dist-test-resolve.mjs`, but that mirror is populated by `test:compile` copying from the packages' real `dist/` (`scripts/compile-tests.mjs:412-428`). On a fresh checkout (`test:compile` before `build:core`) the suite reports 1029 failures, all `ERR_MODULE_NOT_FOUND` — environmental, not real. In the correct order (encoded in `verify:pr`, `package.json:139`) the same tree yields 14438 passed / 25 failed.
- **Source**: `scripts/dist-test-resolve.mjs:30-41`; `scripts/compile-tests.mjs:418-428`; sidecar runs recorded in "Checks run".
- **Confidence**: high
- **Why it matters here**: Anyone running `pnpm test` on a clean clone sees a four-digit failure count and may misread the codebase as broken. Verification agents must replicate the `verify:pr` order exactly.

## Finding: post-build unit suite has 25 failures — 23 environmental, 1 genuine gate failure, 1 isolation-sensitive

- **Claim**: After `build:core` + `test:compile`, the compiled unit suite ends `14438 passed, 25 failed, 28 skipped` (exit 1). Breakdown of the 25: (a) 23 failures are all in `src/resources/extensions/gsd/tests/migrate-safety-audit.test.ts` (tree publication/deletion/retirement invariants) and require the fault-injection native build — they call `setMutationBoundaryFaultForTest`, which only exists when the native addon is built with `--test-fault-injection`; CI runs `pnpm run build:native:test` before the unit suites (`.github/workflows/ci.yml:184,342`) but `build:core` does not. (b) 1 genuine failure: `prompt golden fixtures meet Phase 2 reduction gate` (`src/tests/prompt-golden-fixtures.test.ts`) — `AssertionError: execute-task should be at least 40% smaller than Phase 2 start baseline (8614/14320)`, i.e. the prompt is ~39.9% smaller, marginally missing a token-reduction gate. (c) 1 isolation-sensitive: `runReadCli handles global flags before read` (`src/tests/read-cli-args.test.ts`) fails in the full run but passes when run standalone.
- **Source**: sidecar runs recorded in "Checks run"; `migrate-safety-audit.test.ts:165-168` (fault hook); `.github/workflows/ci.yml:184,342`; `package.json:108` (`build:native:test` = `native/scripts/build.js --dev --test-fault-injection`); isolated rerun of the two non-native failures.
- **Confidence**: high on (a) and (b); medium on (c) being a flake rather than environment-specific (node v26 vs the repo's `>=22.18` floor)
- **Why it matters here**: A fully green local unit run requires `build:native:test`, not just `build:core` — undocumented in package scripts' default path. The prompt-size gate failure means HEAD of the v1.16.1 release tag is marginally red on a token-budget gate; define should confirm whether that gate is actively enforced in CI or already known-failing.

## Finding: packages/db is a half-built, non-workspace package

- **Claim**: `packages/db/` contains `src/client.ts`, `src/schema/{index,gsd-state}.ts`, and `tests/schema.test.ts` (4 files) but no `package.json`, so pnpm's `packages/*` glob ignores it; nothing builds, tests, or imports it. The live database layer is `src/resources/extensions/gsd/db/`.
- **Source**: `ls packages/db` (src, tests only); `find packages/db -type f | wc -l` → 4; `docs/db-map.md:1-25` maps the real layer under the gsd extension.
- **Confidence**: high that it is unreferenced; medium on intent (looks like a stalled extraction)
- **Why it matters here**: Define should confirm whether this is a live migration target or abandoned scaffolding before anyone builds on or deletes it.

## Finding: a database-authoritative lifecycle cutover (ADR-046→048) is mid-flight behind a shadow gate

- **Claim**: `CONTEXT.md` states ADR-046 vocabulary "do[es] not describe current runtime authority until the relevant cutover has completed". The repo carries a dedicated CI gate (`gate:lifecycle-shadow-no-cutover` → `scripts/lifecycle-shadow-no-cutover-gate.mjs`), shadow-comparison code (`src/resources/extensions/gsd/db/lifecycle-shadow-comparison.ts`, `domain-operation.ts`, `writers/`), and `legacy:cleanup:{gate,evidence,proof}` scripts.
- **Source**: `CONTEXT.md:5-9`; `package.json:77,80-82`; `docs/dev/ADR-046-database-authoritative-workflow-lifecycle.md`, `ADR-047`, `ADR-048`.
- **Confidence**: high that the cutover is incomplete (the gate's name asserts "no cutover")
- **Why it matters here**: Two lifecycle models coexist (legacy projections vs DB-authoritative domain operations). Planning that touches milestones/slices/tasks must know which authority a code path uses; assuming either full cutover or no cutover will be wrong in places.

## Finding: Windows platform bugs dominate the visible commit tail

- **Claim**: At least 7 of the last ~25 commits fix Windows-specific failures: forward-slash `pnpm.cmd` breaking `cmd.exe`, a 30s default exec timeout killing builds, projection rendering failing with `os error 32`, worktree projection bootstrap DELETE-locking its own CWD, and tmux-check false positives.
- **Source**: `git log --oneline -25` (d4c3e00f8, b3dbda15d, d9add4c99, 794a3c600, f6e809adc, d2a1f2dc0, 114c35f33).
- **Confidence**: high
- **Why it matters here**: Windows support is real but apparently exercised mostly by users, not pre-merge (a `windows-e2e-changed` gate exists in `ci.yml`). Path handling is a live pain point — the primary workspace branch is literally named `path-fixes`.

## Finding: two copies of the google-search extension exist with different identities

- **Claim**: `extensions/google-search` is a publishable workspace package `@gsd-extensions/google-search@1.16.1`, while `src/resources/extensions/google-search` is a private bundled copy `pi-extension-google-search@1.0.0` with its own `extension-manifest.json`. Both are live.
- **Source**: `extensions/google-search/package.json`; `src/resources/extensions/google-search/package.json`; `pnpm-workspace.yaml:3`.
- **Confidence**: high on duplication; low on whether the two are intentionally synced
- **Why it matters here**: A fix applied to one copy may not reach the other; define should clarify the bundled-vs-published extraction story.

## Finding: three parallel documentation trees and an empty docs/adr directory

- **Claim**: The repo carries `docs/` (283 markdown files incl. `docs/dev/` with 48 ADRs), `gitbook/` (34 files), and `mintlify-docs/` (21 mdx files) simultaneously; `docs/adr/` exists but contains only `.gitkeep` — actual ADRs live in `docs/dev/`.
- **Source**: `find docs -name '*.md' | wc -l` → 283; `ls docs/adr` → `.gitkeep` only; `ls docs/dev | grep ADR | wc -l` → 51.
- **Confidence**: high
- **Why it matters here**: Documentation authority is ambiguous; no single tree (and certainly not `docs/adr/`) should be treated as canonical without asking.

## Finding: visible git history is shallow and effectively single-author

- **Claim**: The checkout shows 57 commits, all within ~30 days, 55 by one author; `git rev-parse --is-shallow-repository` → true. Issue/PR numbers up to #1931 prove a much longer real history exists remotely but is not available locally.
- **Source**: `git log --oneline | wc -l` → 57; `git log -60 --format='%an' | sort | uniq -c`.
- **Confidence**: high for this checkout
- **Why it matters here**: The "recent activity" picture covers only the visible window; churn and archaeology beyond ~30 days are unverifiable from this clone.

## Finding: heavyweight self-governance tooling and an agent-generated plan backlog

- **Claim**: The repo embeds unusual amounts of self-governance: 109 top-level scripts including test-confidence/gap/matrix auditors (`audit-test-confidence.mjs`, `audit-test-gaps.mjs`, `audit-test-matrix.mjs`), baseline gates (`baseline:refactor:gate`, `legacy:cleanup:*`), a secret scanner, boundary verifiers (`verify:pi-boundary`, `verify:workspace-coverage`), and 34 numbered improvement plans in `plans/` generated by an "improve skill" — two of which (033, 034) were lost to a working-tree clean and remain unrecoverable/TODO.
- **Source**: `ls scripts | wc -l` → 109; `package.json:73-93,127-131`; `plans/README.md:14-18`.
- **Confidence**: high
- **Why it matters here**: The project is already heavily agent-operated (CI-healing and PatchDeck commits in the log). New work should reuse these gates rather than invent parallel checks, and define should know `plans/` is an active backlog.

## Finding: version-stamped multi-surface release pipeline

- **Claim**: One version (1.16.1) is stamped across the root package, all 12 workspace packages, the Rust workspace, native platform optionalDependencies (`@opengsd/engine-*`), and `pkg/` (a `@glittercowboy/gsd` alias manifest), enforced by `verify:version-sync` and `verify:native-platform-packages` inside `prepublishOnly`.
- **Source**: `package.json:149,120-121,208-217`; per-package `package.json` versions; `native/Cargo.toml:6`; `pkg/package.json`.
- **Confidence**: high
- **Why it matters here**: Version bumps and releases are scripted and gated — planners must not hand-edit versions, and `verify:pr` (build + typecheck + unit + lifecycle gate) is the expected local bar for changes.

## Apparent intent

- Becoming a multi-surface agent platform rather than just a CLI: the same contracts feed a Next.js web UI, a VS Code extension, a Discord daemon, an MCP server, and a Python (Hermes) plugin — based on the workspace layout and `@opengsd/contracts` as the shared dependency (e.g. `vscode-extension/package.json` deps, `web/package.json` deps).
- Migrating the workflow engine from file/projection-based state to a database-authoritative lifecycle (ADR-046→048), with the cutover deliberately gated and evidence collected before legacy deletion — based on `CONTEXT.md`, the shadow/no-cutover gate, and `legacy:cleanup:*` scripts.
- Extracting bundled resource extensions into publishable workspace packages over time — based on the `extensions/google-search` vs bundled twin and the `pi-package`/`gsd-extension` manifest keywords; `packages/db` may be a stalled instance of the same motion for the DB layer.
- Treating Windows and headless/autonomous operation as first-class — based on the commit tail, the `gsd quick` non-interactive work, and `gsd-orchestrator/SKILL.md` driving `gsd headless` as a subprocess.

## Open questions for define

- Is `packages/db` an active extraction target or dead scaffolding? Should new DB work go there or stay in `src/resources/extensions/gsd/db/`?
- What is the current cutover state of the ADR-046 database-authoritative lifecycle, and which authority (legacy projections vs domain operations) should new features target?
- Is the prompt-golden-fixtures "Phase 2 reduction gate" failure (execute-task prompt ~39.9% smaller than baseline vs required ≥40%) known/accepted at release HEAD, or is it enforced and currently red in CI? And is the read-cli-args failure a known flake?
- Are bundled (`src/resources/extensions/*`) and published (`extensions/*`) extension copies meant to converge, and who syncs them?
- Which documentation tree is canonical (docs/ vs gitbook/ vs mintlify-docs/), and should `docs/adr/` be populated or removed?
- Is Windows covered in CI beyond the `windows-e2e-changed` gate, given the bug tail? (Workspace branch `path-fixes` suggests active pain.)
- Are plans 033/034 (lost, still TODO) still wanted, and is `plans/` an active backlog or an archive?

## Blocked areas

- Full git history — the sidecar's object store is shallow (57 commits); churn, authorship, and evolution beyond ~30 days could not be inspected.
- `test:integration`, `test:e2e`, `test:live*`, `test:packages`, and coverage targets were not run — they require API credentials, live services, Playwright browser downloads, or Docker; recorded as unverifiable in this pass.
- `integrations/hermes` (Python) and `vscode-extension` (separate npm toolchain) were inspected statically only; their test suites were not executed.
