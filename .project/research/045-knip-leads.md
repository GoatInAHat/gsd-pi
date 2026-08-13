# Knip leads on main after wave 4

Capture for [Capture knip leads on main after wave 4](https://github.com/open-gsd/gsd-pi/issues/1743).
Raw tool output: [045-knip-leads.raw.txt](./045-knip-leads.raw.txt).

Do not treat these counts as a deletion list. Classification belongs to [Draft the sectioned HIGH/MEDIUM/LOW-LEAD dead-code ledger](https://github.com/open-gsd/gsd-pi/issues/1745).

## Run

| Field | Value |
|---|---|
| knip | 6.32.2 (`npx knip@latest`) |
| commit | `cdc4fd1f23c24db22a0ccacde6495e8e8ec05840` (`origin/main` after [PR 1725](https://github.com/open-gsd/gsd-pi/pull/1725)) |
| flags | `--no-progress` only; no `knip.json` / `knip.ts`; no workspace/package flags |
| tree prep | `pnpm install --frozen-lockfile` so package vitest configs resolve (`vitest/config`) |
| exit | 1 (knip non-zero when it prints leads) |

## Category counts

| Category | Count |
|---|---|
| Unused files | 240 |
| Unused dependencies | 60 |
| Unused devDependencies | 7 |
| Unlisted dependencies | 462 |
| Unlisted binaries | 17 |
| Unresolved imports | 88 |
| Unused exports | 788 |
| Unused exported types | 537 |
| Duplicate exports | 5 |
