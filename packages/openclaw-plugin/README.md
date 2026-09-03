# @opengsd/openclaw-plugin

[OpenClaw](https://docs.openclaw.ai) plugin for [GSD Pi](https://github.com/open-gsd/gsd-pi). Plugin id: `open-gsd-openclaw`.

Read a bound project's progress and drive supervised `gsd headless` runs from any OpenClaw chat channel (Telegram, Discord, Slack, WhatsApp, WebChat, and the others OpenClaw supports). The `/gsd` command is handled by the OpenClaw Gateway before any model or agent runtime is selected, so it behaves identically on every first-party runtime and provider. The agent gets a read-only `gsd_status` tool and a `gsd` skill.

## Install

```bash
openclaw plugins install npm:@opengsd/openclaw-plugin --pin
openclaw config set plugins.entries.open-gsd-openclaw.config.defaultProject /absolute/path/to/project
openclaw plugins enable open-gsd-openclaw
openclaw gateway restart
```

From a gsd-pi source checkout, build the package and link it instead of installing it from npm:

```bash
pnpm --filter @opengsd/openclaw-plugin run build
openclaw plugins install --link /path/to/gsd-pi/packages/openclaw-plugin --force
```

Verify the running registration:

```bash
openclaw plugins inspect open-gsd-openclaw --runtime --json
```

The `gsd` CLI must be on the Gateway process PATH, or set `plugins.entries.open-gsd-openclaw.config.cliPath` to its absolute path.

## Commands

| Command | Behaviour |
| --- | --- |
| `/gsd status [path]` | Project snapshot: phase, active milestone/slice/task, counts, blockers, next action, plus the run line (active run, pending question, or last result) |
| `/gsd auto [path] [--model <id>]` | Start a supervised `gsd headless auto` run in the project |
| `/gsd new-milestone <brief...>` or `--file <absolute path>` `[--auto]` | Create a milestone from a brief (`--auto` chains execution) |
| `/gsd quick <task...>` | Run a quick task; the text is passed to gsd as one argument |
| `/gsd reply <number or text>` | Answer the run's pending question; `cancel` skips it |
| `/gsd cancel [path]` | SIGTERM the active run (also a run orphaned by a Gateway restart, via its lockfile) |
| `/gsd bind <absolute path>` | Bind this conversation to a GSD project |
| `/gsd unbind` | Remove the binding |
| `/gsd help` | Command list |

Project resolution order: explicit path argument, then the conversation binding, then `defaultProject`. Nothing is inferred from a working directory; with no match the command fails closed and says so.

### Supervised runs

One run per project at a time; a second `/gsd auto` is refused until the first finishes or is cancelled. The child is `gsd headless <command> --supervised --output-format stream-json --max-restarts 0 --timeout 0 --response-timeout 86400000` with the project as working directory. Once `.gsd/` exists the lockfile `.gsd/runtime/openclaw-run.json` records its pid (a lock older than the current boot is ignored); a legacy `.planning/`-only project has no cross-restart guard until gsd bootstraps `.gsd/`.

When gsd asks a question (select, confirm, input, editor) the run is parked as *blocked* and the question is posted to the chat; `/gsd reply` writes the answer to the child's stdin. A multi-select can only receive one option from chat. Secure prompts (secret values) are never posted: the plugin cancels them locally and reports that the step needs an interactive gsd session.

Because the headless parser recognises its own `--flags` anywhere in argv, chat text is always passed as a single argument and any other `-`-prefixed token is rejected with a usage error. `--model` must match `[\w.:/-]+`; `--file` must be an absolute path to an existing regular file.

Bindings are keyed by conversation route (channel, account, conversation, thread), so a native slash command and a typed `/gsd` in the same chat share one binding. They are stored under the plugin's state directory as `open-gsd-openclaw/bindings.json`.

## Authorization

`/gsd` declares `requiredScopes: ["operator.write"]`. OpenClaw enforces it: Gateway clients (the Control UI, the CLI) need that scope, and chat senders must be command owners. The plugin keeps no allowlist of its own.

Who counts as an owner follows OpenClaw's rules: `commands.ownerAllowFrom` when set, otherwise the channel's explicit `allowFrom` entries. A channel whose allowlist is empty or a wildcard has no owners, so set `commands.ownerAllowFrom` to use `/gsd` from such a channel:

```json5
{ commands: { ownerAllowFrom: ["telegram:123456789"] } }
```

## Notifications

Progress notices, questions and the final summary go to the chat that started the run. Channels with an outbound adapter (Telegram, Discord, Slack, ...) get a direct message on the same route (account, conversation, thread). WebChat and the CLI have no outbound adapter, and a provider may decline a send: in both cases the text is queued as a system event on the originating session and the session's heartbeat is woken so the agent relays it. With no session key either, the text is only logged.

## Agent tool and skill

The plugin registers one agent tool, `gsd_status` (declared in `contracts.tools`), returning the same snapshot as `/gsd status` plus the run line, with structured `details` (`projectDir`, `phase`, `activeMilestone`, `activeSlice`, `activeTask`, `blockers`, `nextAction`, `run`). It resolves the project from an optional `project` argument, then the binding of the tool's delivery route, then `defaultProject`; it is read-only and starts nothing. The bundled `skills/gsd/SKILL.md` tells the model when to call it and how the `/gsd` commands work.

## Configuration

```json5
{
  plugins: {
    entries: {
      "open-gsd-openclaw": {
        enabled: true,
        config: {
          cliPath: "/usr/local/bin/gsd", // optional; defaults to `gsd` on PATH
          defaultProject: "/home/me/code/myapp",
        },
      },
    },
  },
}
```

## Scheduling runs

OpenClaw automations run command payloads inside the Gateway with no model call, so a nightly `gsd headless auto` needs no plugin code:

```bash
openclaw automations create "0 2 * * *" \
  --name "Nightly GSD auto" \
  --command-argv '["gsd","headless","auto","--json"]' \
  --command-cwd /absolute/path/to/project \
  --timeout-seconds 7200 \
  --announce --channel telegram --to "<chat id>"
```

Raise `--timeout-seconds` to cover a milestone-length run; the default command timeout is ten minutes.

## Development

```bash
pnpm --filter @opengsd/openclaw-plugin run build
pnpm --filter @opengsd/openclaw-plugin test
```

Offline compatibility check against the OpenClaw plugin contract:

```bash
npm install --no-save --no-audit --no-fund @openclaw/plugin-inspector
./node_modules/.bin/plugin-inspector ci --plugin-root packages/openclaw-plugin --no-openclaw --runtime --mock-sdk --allow-execute
```

## License

MIT
