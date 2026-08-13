# 045 — Published entry-point roots for the dead-code hunt

**Ticket:** [Enumerate published entry-point roots for the dead-code hunt](https://github.com/open-gsd/gsd-pi/issues/1742)
**Map:** [Wayfinder: whole-repo dead-code cleanup program](https://github.com/open-gsd/gsd-pi/issues/1741)
**Baseline:** `origin/main` at `cdc4fd1f2` (contains [PR 1725](https://github.com/open-gsd/gsd-pi/pull/1725) `c98e19837`)
**Method:** Primary sources only — package manifests, command tables, MCP registries, `workflow-templates/registry.json`, skill folders. Tests are consumers, not roots. `studio/` is excluded.

## Scope

Live for this hunt means a **published surface**: something an install, CLI invocation, MCP client, slash-command user, workflow-template start, or skill loader can reach without going through a test file.

Not roots (explicit):

- Test files and test-only helpers
- `studio/` (map: not an automatic root)
- `packages/pi-coding-agent/examples/**` and `packages/pi-coding-agent/test/fixtures/**` (examples/fixtures, not published commands)
- Repo-root `gsd-orchestrator/SKILL.md` (OpenClaw skill; not in root `package.json` `files`)

Related live discovery that the hunt must still treat as reachable (otherwise knip false-positives every bundled extension) is recorded in [Bundled extensions](#bundled-extensions-runtime-discovery-not-one-of-the-six-named-categories).

---

## 1. Package `exports` / `bin` entry files

Workspace membership: `pnpm-workspace.yaml` packages `packages/*`, `extensions/*`, `web`. Root `@opengsd/gsd-pi` is the published CLI tarball. Independently published packages have `publishConfig`; `@gsd/*` workspace packages ship inside the root tarball via `files: packages/*/dist/**` (`package.json` lines 20–38).

### 1a. Root `@opengsd/gsd-pi`

Owner: `package.json`.

| Surface | Target | Source |
|---|---|---|
| bin `gsd` | `dist/loader.js` (compiled from `src/loader.ts`) | `package.json` `bin.gsd` L16 |
| bin `gsd-cli` | `dist/loader.js` | `package.json` `bin.gsd-cli` L17 |
| bin `gsd-pi` | `scripts/install.js` | `package.json` `bin.gsd-pi` L18 |
| no `exports` map | CLI-only package | `package.json` has `bin` + `files`, no `exports` |
| shipped resources | `dist`, `packages/*/dist/**`, `src/resources`, `integrations/hermes`, install scripts | `package.json` `files` L20–38 |
| `postinstall` | `scripts/install.js` | `package.json` `scripts.postinstall` L115 |

`src/loader.ts` L1–L30 is the compiled bin body: it handles `--version`/`-v` and `--help`/`-h` before importing `src/cli.ts`.

### 1b. Independently published workspace packages (`publishConfig`)

| Package | `exports` / `bin` | Source files |
|---|---|---|
| `@opengsd/contracts` | `exports["."]` → `./dist/index.js` (re-exports `rpc.js` + `workflow.js`) | `packages/contracts/package.json` L22–26; `packages/contracts/src/index.ts` L4–5 |
| `@opengsd/rpc-client` | `exports["."]` → `./dist/index.js` | `packages/rpc-client/package.json` L22–26 |
| `@opengsd/mcp-server` | `exports["."]` → `./dist/index.js`; subpaths `./readers/{graph,paths,roadmap,state}`; bin `gsd-mcp-server` → `./bin/gsd-mcp-server.js` → `dist/cli.js` | `packages/mcp-server/package.json` L22–46; `packages/mcp-server/bin/gsd-mcp-server.js` L7–14; `packages/mcp-server/src/index.ts` L5–49 |
| `@opengsd/daemon` | `exports["."]` → `./dist/index.js`; bin `gsd-daemon` → `./bin/gsd-daemon.js` → `dist/cli.js` | `packages/daemon/package.json` L17–25; `packages/daemon/bin/gsd-daemon.js` L7–14 |

### 1c. Native engine optionalDependencies (published platform packages)

Root `optionalDependencies` pins five `@opengsd/engine-*` packages (`package.json` L216–220). Each platform package's `main` is `gsd_engine.node`:

| Package | `main` | Source |
|---|---|---|
| `@opengsd/engine-darwin-arm64` | `gsd_engine.node` | `native/npm/darwin-arm64/package.json` L2, L11 |
| `@opengsd/engine-darwin-x64` | `gsd_engine.node` | `native/npm/darwin-x64/package.json` |
| `@opengsd/engine-linux-arm64-gnu` | `gsd_engine.node` | `native/npm/linux-arm64-gnu/package.json` |
| `@opengsd/engine-linux-x64-gnu` | `gsd_engine.node` | `native/npm/linux-x64-gnu/package.json` L2, L11 |
| `@opengsd/engine-win32-x64-msvc` | `gsd_engine.node` | `native/npm/win32-x64-msvc/package.json` |

These are **not** in `pnpm-workspace.yaml`; they are published artifacts consumed as optional native binaries.

### 1d. `@gsd/*` workspace packages (bundled in the root tarball; have `exports`)

| Package | `exports` / `bin` | Source |
|---|---|---|
| `@gsd/native` | `.`, `./grep`, `./ps`, `./glob`, `./clipboard`, `./ast`, `./html`, `./text`, `./fd`, `./image`, `./xxhash`, `./diff`, `./gsd-parser`, `./highlight`, `./json-parse`, `./stream-process`, `./truncate`, `./ttsr`, `./file-identity`, `./directory-sync` | `packages/native/package.json` L19–99 |
| `@gsd/pi-ai` | `.`, `./anthropic`, `./anthropic-vertex`, `./azure-openai-responses`, `./google`, `./google-vertex`, `./mistral`, `./openai-codex-responses`, `./openai-completions`, `./openai-responses`, `./oauth`, `./bedrock-provider`; bin `pi-ai` → `./bin/pi-ai.js` → `dist/cli.js` | `packages/pi-ai/package.json` L13–65; `packages/pi-ai/bin/pi-ai.js` L7–14; `packages/pi-ai/src/cli.ts` L1 |
| `@gsd/pi-agent-core` | `.`, `./node`, `./package.json` | `packages/pi-agent-core/package.json` L13–22 |
| `@gsd/pi-tui` | `.` (types/import/require → `./dist/index.js`) | `packages/pi-tui/package.json` L13–18 |
| `@gsd/pi-coding-agent` | `.`, `./*` (wildcard over `dist/*`), `./hooks` | `packages/pi-coding-agent/package.json` L17–29 |
| `@gsd/agent-core` | `.`, `./*` | `packages/gsd-agent-core/package.json` L13–21 |
| `@gsd/agent-modes` | `.`, `./*` | `packages/gsd-agent-modes/package.json` L13–21 |

**Wildcard note:** `./*` on `@gsd/pi-coding-agent`, `@gsd/agent-core`, and `@gsd/agent-modes` publishes every compiled `dist/*.js` file as an import path. Dead-code tools that only follow named `exports` keys will under-count; the hunt must treat those `dist/` trees as published.

### 1e. Other workspace packages (not library exports)

| Package | Why it is / is not a package-export root | Source |
|---|---|---|
| `gsd-web` | `"private": true`, no `exports`/`bin`. Reached via CLI `--web` / `gsd web`, not as an npm export. | `web/package.json` L2–11; CLI in §2 |
| `@gsd-extensions/google-search` | Workspace extension (`extensions/google-search`). `pi.extensions: ["./index.ts"]`. No `exports`. | `extensions/google-search/package.json` L1–17 |
| Bundled copy `pi-extension-google-search` | Private resource-tree twin; `pi.extensions: ["./index.ts"]`. | `src/resources/extensions/google-search/package.json` L1–8 |

`pkg/package.json` (`@glittercowboy/gsd`) is a `piConfig` stub shipped in root `files` (`pkg`); it has no `exports`/`bin`.

---

## 2. CLI flags and commands

Canonical parser: `parseCliArgs` in `src/cli-web-branch.ts`. Dispatch: `src/cli.ts`. User-facing table: `src/help-text.ts` `printHelp` / `SUBCOMMAND_HELP`.

### 2a. Top-level flags (`parseCliArgs`)

Owner: `src/cli-web-branch.ts` L79–157. Help text: `src/help-text.ts` L234–256.

| Flag | Parser | In `printHelp`? |
|---|---|---|
| `--mode <text\|json\|rpc\|mcp>` | L84–86 | yes L238 |
| `--print` / `-p` | L87–88 | yes L239 |
| `--continue` / `-c` | L89–90 | yes L240 |
| `--help` / `-h` | L91–92 (also fast-path in `src/loader.ts` L26–29) | yes L256 |
| `--version` / `-v` | L93–94 (also fast-path in `src/loader.ts` L21–24) | yes L255 |
| `--no-session` | L95–96 | yes L246 |
| `--session <path\|id>` | L97–98 | yes L241 |
| `--session-dir <dir>` | L99–100 | yes L242 |
| `--worktree` / `-w` `[name]` | L101–107 | yes L243 |
| `--web` `[path]` | L108–113 | yes L247 |
| `--host <host>` | L114–115 | yes L248 |
| `--port <port>` | L116–121 | yes L249 |
| `--allowed-origins <csv>` | L122–124 | yes L250 |
| `--no-auth` | L125–126 | yes L251 |
| `--model <id>` | L127–128 | yes L244 |
| `--thinking <level>` | L129–134; levels `off\|minimal\|low\|medium\|high\|xhigh\|max` L46 | yes L245 |
| `--extension <path>` (repeatable) | L135–136 | yes L252 |
| `--append-system-prompt <text>` | L137–138 | **no** — still parsed |
| `--tools <a,b,c>` | L139–140 | yes L253 |
| `--bare` | L141–144 | **no** in top-level help; documented under `headless` L183 |
| `--list-models [search]` | L145–146 | yes L254 |

Unknown dashed args throw (`L153–154`).

`--mode` values that are live dispatch branches in `src/cli.ts`: `rpc` L786–790, `mcp` L793–815, else print/interactive (`text`/`json`) L817–826.

### 2b. Passthrough / implemented CLI subcommands

`PASSTHROUGH_SUBCOMMANDS` (`src/cli-web-branch.ts` L48–63) plus `auto` (redirect) and `update`/`upgrade` (mismatch-gate bypass).

| Subcommand | Dispatch owner | Nested commands / flags |
|---|---|---|
| `config` | `src/cli.ts` L417–423 | re-run onboarding; help `src/help-text.ts` L8–22 |
| `install` / `remove` / `list` | `src/cli.ts` L400–415 via `runPackageCommand` | help L65–87 |
| `update` / `upgrade` | `src/cli-policy.ts` L16–18 bypasses mismatch gate; `src/cli.ts` L254–257 → `src/update-cmd.ts` | help L24–50; `update [browser] [--models]` |
| `sessions` | `src/cli.ts` L453–517 | help L52–63 |
| `web` / `--web` | `src/cli.ts` L426–448 → `runWebCliBranch` | `web stop [path\|all]`, `web [start] [path]`; flags `--host/--port/--allowed-origins/--no-auth` |
| `read` | `src/cli.ts` L519–523 → `src/read-cli.ts` L153 | `progress\|roadmap\|memory --json --project <path>` (`src/help-text.ts` L162–172). **Omitted from `printHelp` subcommand list; still dispatched.** |
| `headless` | `src/cli.ts` L525–536 → `src/headless.ts` | see §2c |
| `auto` | `src/cli.ts` L580–585 → headless when stdin/stdout are non-TTY | help L266 |
| `graph` | `src/cli.ts` L270–366 | `build\|status\|query <term>\|diff` (default `build`) |
| `hermes` | `src/cli.ts` L261–267 → `src/hermes-integration-install.ts` L36 | only `install`; flags `--hermes-home`, `--project`, `--plugin-source`, `--skip-pip`, `--skip-enable`, `--dry-run` (`src/help-text.ts` L144–160) |
| `worktree` / `wt` | `src/cli.ts` L588–611 → `src/worktree-cli.ts` | `list` (default), `merge [name]`, `clean`, `remove\|rm <name>` |

TTY-exempt set (must stay in sync with implemented subcommands): `src/cli.ts` L378–394 (`auto`, `config`, `graph`, `headless`, `hermes`, `read`, `install`, `list`, `remove`, `sessions`, `update`, `upgrade`, `web`, `worktree`, `wt`).

### 2c. `gsd headless` flags and default commands

Parser: `parseHeadlessArgs` `src/headless.ts` L172–274. Help: `src/help-text.ts` L174–228.

Flags: `--timeout`, `--json`, `--output-format <text\|json\|stream-json>`, `--model`, `--thinking`, `--context`, `--context-text`, `--auto`, `--verbose`, `--max-restarts`, `--answers`, `--events`, `--supervised`, `--response-timeout`, `--resume`, `--resume-wedge`, `--bare`. Unrecognized `--*` flags pass through to the assembled `/gsd …` command (`src/headless.ts` L261–265).

Documented headless commands (`src/help-text.ts` L192–197): `auto` (default), `next`, `status`, `new-milestone`, `query`. Help also names `recover` (L225). Any other token becomes the `/gsd <command>` subcommand (`src/headless.ts` L267–268), so the full `/gsd` catalog in §5b is reachable from headless.

`isMultiTurnHeadlessCommand`: `auto`, `next`, `discuss`, `plan` (`src/headless.ts` L120–126).

---

## 3. MCP tools

Two published MCP surfaces.

### 3a. `@opengsd/mcp-server` stdio server (`gsd-mcp-server`)

Entry: `packages/mcp-server/bin/gsd-mcp-server.js` → `packages/mcp-server/src/cli.ts` → `runMcpServerCli`. Registration: `packages/mcp-server/src/server.ts` `createMcpServer`.

**Always-on tools** (`server.tool(` calls in `packages/mcp-server/src/server.ts`):

| Tool | Line |
|---|---|
| `gsd_execute` | L1126 |
| `gsd_status` | L1159 |
| `gsd_result` | L1181 |
| `gsd_cancel` | L1209 |
| `gsd_cancel_by_project` | L1244 |
| `gsd_query` | L1269 |
| `gsd_resolve_blocker` | L1294 |
| `ask_user_questions` | L1315 |
| `secure_env_collect` | L1343 |
| `gsd_progress` | L1372 |
| `gsd_roadmap` | L1391 |
| `gsd_history` | L1411 |
| `gsd_doctor` | L1431 |
| `gsd_captures` | L1451 |
| `gsd_knowledge` | L1471 |
| `gsd_graph` | L1496 (`mode`: `build\|query\|status\|diff`) |

**Workflow tools** (when `includeWorkflowTools` / bridge config is on): registered from `WORKFLOW_TOOL_CONTRACTS` in `packages/contracts/src/workflow.ts` L18–331 via `registerWorkflowTools` (`packages/mcp-server/src/server.ts` L1573–1578).

Canonical names (`CANONICAL_WORKFLOW_TOOL_NAMES`, 37):

`gsd_decision_save`, `gsd_requirement_update`, `gsd_requirement_save`, `gsd_milestone_generate_id`, `gsd_plan_milestone`, `gsd_plan_slice`, `gsd_plan_task`, `gsd_replan_slice`, `gsd_replan_task`, `gsd_rework_brief_save`, `gsd_slice_complete`, `gsd_skip_slice`, `gsd_complete_milestone`, `gsd_validate_milestone`, `gsd_prepare_milestone_subjective_uat`, `gsd_answer_milestone_subjective_uat`, `gsd_reassess_roadmap`, `gsd_save_gate_result`, `gsd_uat_result_save`, `gsd_summary_save`, `gsd_task_complete`, `gsd_task_reopen`, `gsd_task_recovery_resume`, `gsd_slice_reopen`, `gsd_milestone_reopen`, `gsd_milestone_status`, `gsd_checkpoint_db`, `gsd_journal_query`, `gsd_uat_exec`, `gsd_exec`, `gsd_exec_search`, `gsd_resume`, `gsd_capture_thought`, `gsd_memory_query`, `gsd_memory_graph`, `gsd_requirement_list`, `gsd_requirement_get`, `gsd_decision_list`, `gsd_decision_get`.

Aliases (17; advertised only when `GSD_MCP_ADVERTISE_ALIASES=1`, comment at `packages/mcp-server/src/server.ts` L1569–1572): `gsd_save_decision`, `gsd_update_requirement`, `gsd_save_requirement`, `gsd_generate_milestone_id`, `gsd_milestone_plan`, `gsd_slice_plan`, `gsd_task_plan`, `gsd_slice_replan`, `gsd_complete_slice`, `gsd_milestone_complete`, `gsd_milestone_validate`, `gsd_roadmap_reassess`, `gsd_save_summary`, `gsd_complete_task`, `gsd_reopen_task`, `gsd_reopen_slice`, `gsd_reopen_milestone` (`packages/contracts/src/workflow.ts` `aliases` fields; `WORKFLOW_TOOL_ALIAS_NAMES` L354–356).

Handlers still exist for aliases even when they are hidden from `tools/list` (`packages/mcp-server/src/workflow-tools.ts` L2554–2563). Treat alias **executors** as live.

### 3b. GSD-mode MCP adapter subset

`GSD_MODE_MCP_WORKFLOW_ADAPTER_TOOL_NAMES` (`packages/mcp-server/src/mcp-adapter-tools.ts` L5–20):

`gsd_execute`, `gsd_status`, `gsd_result`, `gsd_cancel`, `gsd_query`, `gsd_resolve_blocker`, `gsd_progress`, `gsd_roadmap`, `gsd_history`, `gsd_doctor`, `gsd_captures`, `gsd_knowledge`, `gsd_graph`, `ask_user_questions`.

This is a **subset** of 3a (no `secure_env_collect`, no `gsd_cancel_by_project`, no workflow contracts). Used when GSD-mode wraps the MCP server; not a second registry.

`gsd_resolve_blocker` is registered in `packages/mcp-server/src/server.ts` L1294.

### 3c. `gsd --mode mcp` (agent-tool MCP bridge)

`src/cli.ts` L793–815 activates **every** registered agent tool (`session.getAllTools()`), then `src/mcp-server.ts` `startMcpServer` exposes them over stdio. This makes extension `pi.registerTool` implementations MCP-reachable. It is not a second named registry; the roots are the bundled-extension tool registrations in §Bundled extensions.

---

## 4. Slash commands

### 4a. Built-in Pi commands

Owner: `packages/pi-coding-agent/src/core/slash-commands.ts` `BUILTIN_SLASH_COMMANDS` L19–41 (21):

`settings`, `model`, `scoped-models`, `export`, `import`, `share`, `copy`, `name`, `session`, `changelog`, `hotkeys`, `fork`, `clone`, `tree`, `login`, `logout`, `new`, `compact`, `resume`, `reload`, `quit`.

Browser dispatch also consumes this table (`web/lib/browser-slash-command-dispatch.ts` L3).

### 4b. `/gsd` command table (GSD extension)

Registration: `src/resources/extensions/gsd/commands/index.ts` L5–19 (`pi.registerCommand("gsd", …)`).

**Inline catalog** (79): `TOP_LEVEL_SUBCOMMANDS` in `src/resources/extensions/gsd/commands/catalog.ts` L22–101, mirrored in `GSD_COMMAND_DESCRIPTION` L19–20:

`help`, `next`, `auto`, `stop`, `pause`, `status`, `widget`, `visualize`, `brief`, `queue`, `quick`, `discuss`, `capture`, `changelog`, `triage`, `dispatch`, `verdict`, `history`, `undo`, `undo-task`, `reset-slice`, `rate`, `skip`, `report`, `export`, `cleanup`, `closeout`, `rebuild`, `db`, `model`, `mode`, `prefs`, `config`, `keys`, `hooks`, `run-hook`, `skill-health`, `notifications`, `doctor`, `logs`, `usage`, `context`, `debug`, `forensics`, `init`, `setup`, `onboarding`, `migrate`, `remote`, `steer`, `inspect`, `knowledge`, `memory`, `new-milestone`, `new-project`, `parallel`, `cmux`, `park`, `unpark`, `update`, `upgrade`, `start`, `templates`, `extensions`, `fast`, `mcp`, `rethink`, `workflow`, `codebase`, `ship`, `do`, `session-report`, `backlog`, `pr-branch`, `add-tests`, `scan`, `language`, `worktree`, `eval-review`.

**Implemented extra workflows** (43): `GSD_CORE_IMPLEMENTED_CATALOG` `src/resources/extensions/gsd/commands-gsd-core.ts` L24–68, spread into `TOP_LEVEL_SUBCOMMANDS` (`catalog.ts` L104):

`explore`, `spike`, `sketch`, `map-codebase`, `docs-update`, `graphify`, `stats`, `progress`, `health`, `surface`, `code-review`, `review`, `audit-milestone`, `audit-uat`, `audit-fix`, `ui-review`, `secure-phase`, `validate-phase`, `verify-work`, `plan-review-convergence`, `discuss-phase`, `plan-phase`, `execute-phase`, `spec-phase`, `mvp-phase`, `ui-phase`, `ai-integration-phase`, `ultraplan-phase`, `autonomous`, `pause-work`, `resume-work`, `manager`, `phase`, `thread`, `workstreams`, `workspace`, `milestone-summary`, `review-backlog`, `inbox`, `import`, `ingest-docs`, `profile-user`, `settings`.

**Namespace aliases** (6; redirect to `/gsd help`): `GSD_CORE_ALIAS_CATALOG` `src/resources/extensions/gsd/commands/gsd-core-aliases.ts` L42–49:

`ns-context`, `ns-ideate`, `ns-manage`, `ns-project`, `ns-review`, `ns-workflow`.

**Total `/gsd` subcommands: 79 + 43 + 6 = 128.** Nested completions (not extra top-level roots) live in `NESTED_COMPLETIONS` (`catalog.ts` L108+): e.g. `parallel` → `start|status|stop|pause|resume|merge|watch` L133–141.

GSD extension also registers top-level (non-`/gsd`) commands:

| Command | Source |
|---|---|
| `/kill` | `src/resources/extensions/gsd/bootstrap/register-extension.ts` L206 |
| `/worktree`, `/wt` | `src/resources/extensions/gsd/worktree-command.ts` L254, L264 |
| `/exit` | `src/resources/extensions/gsd/exit-command.ts` L9 |

Manifest claim: `src/resources/extensions/gsd/extension-manifest.json` `provides.commands` L14: `["gsd", "kill", "worktree", "exit"]` (`wt` is a second `registerCommand` alias, not in the manifest array).

### 4c. Other bundled-extension slash commands

| Command | Owner |
|---|---|
| `/voice` | `src/resources/extensions/voice/index.ts` L192 |
| `/configs` | `src/resources/extensions/universal-config/index.ts` L104 |
| `/subagent` | `src/resources/extensions/subagent/index.ts` L870 |
| `/create-slash-command` | `src/resources/extensions/slash-commands/create-slash-command.ts` L5 |
| `/create-extension` | `src/resources/extensions/slash-commands/create-extension.ts` L5 |
| `/clear` | `src/resources/extensions/slash-commands/clear.ts` L4 |
| `/audit` | `src/resources/extensions/slash-commands/audit.ts` L5 |
| `/search-provider` | `src/resources/extensions/search-the-web/command-search-provider.ts` L49 |
| `/ollama` | `src/resources/extensions/ollama/ollama-commands.ts` L21 |
| `/github-sync` | `src/resources/extensions/github-sync/index.ts` L19 |
| `/bg` | `src/resources/extensions/bg-shell/bg-shell-command.ts` L26 |
| `/jobs` | `src/resources/extensions/async-jobs/index.ts` L108 |
| `/memory` | `packages/pi-coding-agent/src/resources/extensions/memory/index.ts` L73 / L165 (Pi bundled memory extension) |

`slash-commands` manifest: `src/resources/extensions/slash-commands/extension-manifest.json` L9.

---

## 5. Workflow templates

Owner: `src/resources/extensions/gsd/workflow-templates/registry.json` (`version: 1`, `templates` object L3–268). Loaded by `loadRegistry` imported from `../workflow-templates.js` in `commands/catalog.ts` L4.

24 templates; each `file` exists beside the registry:

| id | file | mode |
|---|---|---|
| `full-project` | `full-project.md` | auto-milestone |
| `bugfix` | `bugfix.md` | markdown-phase |
| `small-feature` | `small-feature.md` | markdown-phase |
| `refactor` | `refactor.md` | markdown-phase |
| `spike` | `spike.md` | markdown-phase |
| `hotfix` | `hotfix.md` | markdown-phase |
| `security-audit` | `security-audit.md` | markdown-phase |
| `dep-upgrade` | `dep-upgrade.md` | markdown-phase |
| `pr-review` | `pr-review.md` | oneshot |
| `changelog-gen` | `changelog-gen.md` | oneshot |
| `issue-triage` | `issue-triage.md` | oneshot |
| `pr-triage` | `pr-triage.md` | oneshot |
| `onboarding-check` | `onboarding-check.md` | oneshot |
| `dead-code` | `dead-code.md` | oneshot |
| `accessibility-audit` | `accessibility-audit.md` | oneshot |
| `test-backfill` | `test-backfill.yaml` | yaml-step |
| `docs-sync` | `docs-sync.yaml` | yaml-step |
| `rename-symbol` | `rename-symbol.yaml` | yaml-step |
| `env-audit` | `env-audit.yaml` | yaml-step |
| `release` | `release.md` | markdown-phase |
| `api-breaking-change` | `api-breaking-change.md` | markdown-phase |
| `performance-audit` | `performance-audit.md` | markdown-phase |
| `observability-setup` | `observability-setup.md` | markdown-phase |
| `ci-bootstrap` | `ci-bootstrap.md` | markdown-phase |

Directory listing matches the registry (24 template files + `registry.json`). `/gsd start` / `/gsd templates` consume this registry (`catalog.ts` L84–85).

---

## 6. Skills

### 6a. Bundled skills synced by `initResources`

Owner: directories under `src/resources/skills/*/SKILL.md`. Synced to `~/.gsd/agent/skills/` by `src/resource-loader.ts` L713–768 (`syncResourceDir(join(resourcesDir, 'skills'), skillsDir)`). Loaded by `loadSkills` from `join(agentDir, "skills")` (`packages/pi-coding-agent/src/core/skills.ts` L510).

35 skill roots (one `SKILL.md` per first-level directory):

`accessibility`, `agent-browser`, `api-design`, `best-practices`, `btw`, `code-optimizer`, `core-web-vitals`, `create-gsd-extension`, `create-mcp-server`, `create-skill`, `create-workflow`, `debug-like-expert`, `decompose-into-slices`, `dependency-upgrade`, `design-an-interface`, `forensics`, `frontend-design`, `github-workflows`, `grill-me`, `handoff`, `lint`, `make-interfaces-feel-better`, `observability`, `react-best-practices`, `review`, `security-review`, `spike-wrap-up`, `tdd`, `test`, `userinterface-wiki`, `verify-before-complete`, `web-design-guidelines`, `web-quality-audit`, `write-docs`, `write-milestone-brief`.

`github-workflows/references/gh/SKILL.md` is nested material of `github-workflows`, not a separate published skill.

### 6b. Injected `gsd-browser` skill

`src/resource-loader.ts` L714, L769 `syncGsdBrowserPackageSkill` copies `@opengsd/gsd-browser/SKILL.md` into `~/.gsd/agent/skills/gsd-browser/`. Not a folder under `src/resources/skills/`; still a published skill root.

### 6c. Extension-shipped `gsd-headless`

`src/resources/extensions/gsd/skills/gsd-headless/SKILL.md` (frontmatter `name: gsd-headless`). Shipped with the gsd extension via `src/resources` + `scripts/copy-resources.cjs` (copies non-`.ts` files). Not synced by `initResources` into `agent/skills`. Treat as a published skill artifact of the gsd extension.

### 6d. Not a published skill root

- `gsd-orchestrator/SKILL.md` — repo-root OpenClaw skill; absent from root `package.json` `files`.
- `packages/pi-coding-agent/test/fixtures/skills/**` — tests.
- `packages/pi-coding-agent/examples/extensions/dynamic-resources/SKILL.md` — example.

---

## Bundled extensions (runtime discovery; not one of the six named categories)

Plan 032a already recorded that knip false-positives `src/resources/extensions/*/index.ts` because they are jiti-loaded by directory (`plans/032a-dead-code-audit.md` §2c). Discovery: `src/extension-discovery.ts` `discoverExtensionEntryPaths` L61–81 (top-level `.ts`/`.js`, or subdirectory `package.json` `pi.extensions`, else `index.ts`/`index.js`). `cmux` opts out with `"pi": {}` (`src/resources/extensions/cmux/package.json` L5–6).

Live bundled extension entries under `src/resources/extensions/` (excluding `shared/`, `package.json`, `cmux`):

Standalone files: `ask-user-questions.ts`, `get-secrets-from-user.ts`.

Directories with `index.ts`: `async-jobs`, `aws-auth`, `bg-shell`, `browser-tools`, `claude-code-cli`, `context7`, `cursor-cli`, `github-sync`, `google-cli`, `google-search`, `gsd`, `mac-tools`, `mcp-client`, `ollama`, `remote-questions`, `search-the-web`, `slash-commands`, `subagent`, `ttsr`, `universal-config`, `visual-brief`, `voice`.

Plus Pi bundled `packages/pi-coding-agent/src/resources/extensions/memory/index.ts`.

These are live because `src/resources` is in the published tarball (`package.json` `files` L27) and `initResources` syncs them into `~/.gsd/agent/extensions/`.

Hermes plugin (also in `files`): `integrations/hermes/plugin.yaml` L1–4 (`entry_point: open_gsd_hermes:register`), installed by `gsd hermes install`.

---

## Explicitly excluded from this inventory

| Surface | Why |
|---|---|
| `studio/` | Map: not an automatic root. Self-contained Electron app, not in `pnpm-workspace.yaml`. |
| Tests | Consumers. |
| `vscode-extension/` | Separate VS Code marketplace product (`vscode-extension/package.json` `main: dist/extension.js`); not in the six named categories and not a workspace package. Do not treat as an automatic root unless a later ticket adds it. |
| `web/` as a package export | Private Next app; live only via CLI `--web` (§2). |

---

## Counts (for the hunt)

| Category | Count | Owner |
|---|---|---|
| Root bins | 3 (`gsd`, `gsd-cli`, `gsd-pi`) | `package.json` L15–18 |
| Workspace packages with `exports` | 11 (`contracts`, `rpc-client`, `mcp-server`, `daemon`, `native`, `pi-ai`, `pi-agent-core`, `pi-tui`, `pi-coding-agent`, `agent-core`, `agent-modes`) | §1 |
| Extra bins | `gsd-mcp-server`, `gsd-daemon`, `pi-ai` | §1 |
| Native engine packages | 5 | `native/npm/*/package.json` |
| Top-level CLI flags | 21 parsed | `src/cli-web-branch.ts` |
| CLI subcommands | 15 passthrough names + `auto` + `update`/`upgrade` | §2b |
| MCP always-on tools | 16 (`gsd_resolve_blocker` included) | `packages/mcp-server/src/server.ts` |
| MCP workflow canonical tools | 37 | `packages/contracts/src/workflow.ts` |
| MCP workflow aliases | 17 (hidden by default, handlers live) | same |
| Builtin slash commands | 21 | `slash-commands.ts` |
| `/gsd` subcommands | 128 | catalog + core + aliases |
| Other extension slash commands | 16 named in §4c + `/kill` `/worktree` `/wt` `/exit` | §4 |
| Workflow templates | 24 | `registry.json` |
| Bundled skills | 35 + `gsd-browser` + extension `gsd-headless` | §6 |

## One-line gist

Live roots on post-1725 `main`: root bins `gsd`/`gsd-cli`/`gsd-pi` plus 11 workspace `exports` maps and 3 extra bins; CLI flags/`parseCliArgs` subcommands; `@opengsd/mcp-server` tools (16 always-on + 37 workflow + 17 alias handlers) and `gsd --mode mcp`; 21 builtin slash commands + 128 `/gsd` subcommands + extension commands; 24 workflow templates; 35 bundled skills (+ `gsd-browser`, `gsd-headless`). `studio/` is not a root.
