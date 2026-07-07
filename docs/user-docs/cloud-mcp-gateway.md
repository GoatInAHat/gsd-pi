# Cloud MCP Gateway

The Cloud MCP Gateway lets a hosted MCP client call GSD workflow tools through a local runtime. Use it when the MCP client cannot reach your workstation directly, but your workstation can open an outbound WebSocket connection to a gateway.

The reader for this guide is an operator setting up a gateway, accounts, usage limits, and one or more local runtimes. After reading it, they should be able to start the gateway, issue MCP tokens, pair a runtime, connect it, and confirm that remote MCP tool calls can reach local projects and runtime-advertised MCP tools.

## Architecture

The gateway exposes these HTTP surfaces:

- `/mcp`: authenticated Streamable HTTP MCP endpoint for remote MCP clients.
- `/runtime/connect`: outbound WebSocket target for paired local runtimes.
- `/pairing-codes` and `/pairing/exchange`: pairing-code issuance and exchange for local runtime device tokens.
- `/admin`: operator UI for user management, pairing codes, connected runtimes, and usage.
- `/account`: optional Clerk-backed self-service account UI for end users.
- `/register`: optional public self-registration endpoint when explicitly enabled.

The gateway is a routing layer. It does not host workspaces, clone source code, store `.gsd` artifacts, or run GSD workflows itself. The local runtime runs under `gsd-daemon cloud` or the `gsd-mcp-runtime` alias. After pairing, it stores the gateway URL, runtime ID, and encrypted device token in the daemon config. When it connects, it advertises local projects and optional local MCP tools, then forwards tool calls to the local GSD runtime.

## Gateway Requirements

Run the gateway with Node 22 or newer. The gateway listens on port `8787` by default.

`GSD_CLOUD_USER_TOKEN` is required at startup. It seeds the initial gateway user as an `admin` user with the `unlimited` plan. Use a long random value and treat it as a secret.

For production, also configure persistent auth and usage stores. Without these paths, users, tokens, pairing codes, and usage counters are in memory only.

```bash
export GSD_CLOUD_USER_TOKEN="$(openssl rand -hex 32)"
export GSD_CLOUD_ADMIN_TOKEN="$(openssl rand -hex 32)"

gsd-cloud-mcp-gateway \
  --port 8787 \
  --auth-store /secure/path/gsd-cloud-auth.json \
  --usage-store /secure/path/gsd-cloud-usage.json
```

The process prints the listen URL and admin UI URL on startup. In local development, the default URL is `http://localhost:8787`. In production, put TLS and any public routing in front of the gateway, then give clients the public HTTPS URL.

Equivalent environment variables are available for persistent stores:

```bash
export GSD_CLOUD_AUTH_STORE_PATH=/secure/path/gsd-cloud-auth.json
export GSD_CLOUD_USAGE_STORE_PATH=/secure/path/gsd-cloud-usage.json
```

The auth store persists users, user tokens, device tokens, and pairing codes as salted scrypt-derived hashes. Raw bearer tokens and device tokens are not written to disk.

## Admin Access

Open `/admin` on the gateway and enter a bearer token.

When `GSD_CLOUD_ADMIN_TOKEN` is set, `/admin/api/*` accepts only that dedicated operator token. When it is not set, `/admin/api/*` accepts bearer tokens for gateway users with the `admin` role. The startup seed user created from `GSD_CLOUD_USER_TOKEN` is an admin.

The admin UI lets an operator:

- create `member` and `admin` users
- assign `free`, `paid`, or `unlimited` plans
- set per-user quota overrides
- issue user bearer tokens and pairing codes
- revoke user tokens
- disable or re-enable users
- view connected runtimes and their advertised projects/tools
- inspect aggregate MCP usage and recent tool calls

Use admin-issued user bearer tokens for `/mcp` clients and pairing-code creation. Do not expose `GSD_CLOUD_ADMIN_TOKEN` to MCP clients.

## Register Users

Public self-registration is disabled by default. To allow anonymous `POST /register` calls that create `member` users on the `free` plan and return a bearer token that is shown once, start the gateway with:

```bash
gsd-cloud-mcp-gateway --allow-registration
# or
GSD_CLOUD_ALLOW_REGISTRATION=1 gsd-cloud-mcp-gateway
```

Registration requires an email in the request body:

```bash
curl -sS -X POST "https://gateway.example.com/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","name":"Example User"}'
```

Use the returned `userToken` as the bearer token for `/mcp` and `/pairing-codes`.

## Clerk Account UI

For public sign-up and sign-in, enable Clerk and send users to `/account`. Clerk authenticates the human user. The gateway still creates local gateway users and manages MCP bearer tokens, pairing codes, plans, quota overrides, and usage locally.

```bash
export CLERK_SECRET_KEY=sk_live_...
export CLERK_PUBLISHABLE_KEY=pk_live_...
# Optional: networkless JWT verification.
export CLERK_JWT_KEY='-----BEGIN PUBLIC KEY-----...'

gsd-cloud-mcp-gateway \
  --auth-store /secure/path/gsd-cloud-auth.json \
  --usage-store /secure/path/gsd-cloud-usage.json
```

If `CLERK_FRONTEND_API_URL` is not set, the gateway derives the ClerkJS script origin from `CLERK_PUBLISHABLE_KEY`.

The `/account` page loads ClerkJS. Signed-in users can:

- create MCP bearer tokens
- revoke their own MCP bearer tokens
- create local runtime pairing codes
- view their plan, billable usage, throttled attempts, and quota status

On first authenticated Clerk access, the gateway creates a local `free` user linked by `clerkUserId`. MCP token verification remains local, so normal tool calls do not require a Clerk round trip.

## Pair a Local Runtime

Create a pairing code with a gateway user token. This can be the seeded `GSD_CLOUD_USER_TOKEN`, an admin-created user token, a self-registration token, or a token created from `/account`.

```bash
curl -sS -X POST "https://gateway.example.com/pairing-codes" \
  -H "Authorization: Bearer $GSD_CLOUD_USER_TOKEN"
```

The response contains a short code and an expiration timestamp. Pair the local runtime before the code expires:

```bash
gsd-daemon cloud pair \
  --gateway "https://gateway.example.com" \
  --code "PAIRING_CODE" \
  --runtime-name "Laptop"
```

You can use the standalone alias for the same runtime flow:

```bash
gsd-mcp-runtime pair \
  --gateway "https://gateway.example.com" \
  --code "PAIRING_CODE" \
  --runtime-name "Laptop"
```

Pairing saves the cloud runtime fields in the daemon config and enables cloud runtime mode. The stored device token is secret and is written encrypted in current configs. Use the status command when you need to inspect the config safely:

```bash
gsd-daemon cloud status
```

To remove the local cloud runtime credentials:

```bash
gsd-daemon cloud disconnect
```

## Connect the Runtime

Start the local runtime connection:

```bash
gsd-daemon cloud connect --verbose
```

The runtime connects to `/runtime/connect` on the gateway with the saved device token. HTTPS gateway URLs become secure WebSocket URLs automatically. If the connection drops, the runtime retries periodically.

The runtime advertises projects discovered by the daemon. Remote MCP callers can list the advertised projects with `gsd_cloud_projects`, then pass `projectAlias` or `runtimeId` when calling a forwarded GSD tool. When more than one runtime is connected for the same user, callers must provide `runtimeId` or an unambiguous `projectAlias`.

## Runtime-Advertised MCP Tools

The gateway always lists `gsd_cloud_projects`, GSD session tools, and GSD workflow tools on `/mcp`. It also includes MCP tools advertised by connected local runtimes.

By default, the local runtime tries to advertise `gsd-browser mcp` when `gsd-browser` is available on `PATH`:

```bash
npm install -g @opengsd/gsd-browser
gsd-daemon cloud connect --verbose
```

Configure the browser MCP command explicitly:

```bash
export GSD_CLOUD_BROWSER_MCP_COMMAND=gsd-browser
export GSD_CLOUD_BROWSER_MCP_ARGS=mcp
gsd-daemon cloud connect --verbose
```

Disable browser MCP advertisement:

```bash
export GSD_CLOUD_BROWSER_MCP=0
gsd-daemon cloud connect
```

Advertise additional stdio MCP servers from the same runtime with `GSD_CLOUD_MCP_SERVERS`:

```bash
export GSD_CLOUD_MCP_SERVERS='[
  { "id": "gsd-browser", "command": "gsd-browser", "args": ["mcp"] }
]'
gsd-daemon cloud connect --verbose
```

Runtime-advertised tools are merged into the `/mcp` `tools/list` response. The gateway adds routing fields where needed and forwards calls to the connected runtime that advertised the project or matches the requested `runtimeId`.

## Configure a Remote MCP Client

Point the client at the gateway MCP endpoint and pass a gateway user token as a bearer token:

```text
URL: https://gateway.example.com/mcp
Authorization: Bearer <GATEWAY_USER_TOKEN>
```

The gateway forwards GSD session tools, GSD workflow tools, and runtime-advertised MCP tools to an online local runtime owned by the authenticated user.

## Usage Store and Quotas

The gateway records every `/mcp` `tools/call`, including forwarded GSD tools and runtime-advertised MCP tools. Usage records include user ID, tool name, optional runtime/project routing fields, status, duration, billable status, throttle status, and timestamp.

Accepted MCP tool calls are billable and count toward user quotas. Throttled attempts are recorded as non-billable so a retry loop cannot keep increasing a user's quota counter after enforcement starts.

Default plan limits are:

- `free`: 12 calls/minute, 100 billable calls/day, 1,000 billable calls/month
- `paid`: 60 calls/minute, 2,000 billable calls/day, 50,000 billable calls/month
- `unlimited`: no quota checks

Override plan defaults with environment variables. Set a value to `0` to make that dimension unlimited.

```bash
export GSD_CLOUD_FREE_CALLS_PER_MINUTE=12
export GSD_CLOUD_FREE_CALLS_PER_DAY=100
export GSD_CLOUD_FREE_CALLS_PER_MONTH=1000

export GSD_CLOUD_PAID_CALLS_PER_MINUTE=60
export GSD_CLOUD_PAID_CALLS_PER_DAY=2000
export GSD_CLOUD_PAID_CALLS_PER_MONTH=50000
```

When a user exceeds quota, `/mcp` returns a tool error such as `Usage limit exceeded`, the runtime tool call is not forwarded, and the denied attempt appears in the admin usage view as `Throttled`.

## Failure Expectations

- `401 Unauthorized`: the user token, admin token, or device token is missing, invalid, revoked, or disabled.
- `403 Registration is disabled`: anonymous `POST /register` was attempted without registration enabled.
- `503 Clerk authentication is not configured`: `/account/api/*` was called without Clerk environment variables.
- `400 Pairing code is invalid or expired`: the code was mistyped, already used, superseded, or expired.
- `No Local GSD Runtime is connected`: the gateway is running, but no paired runtime is online for the authenticated user.
- `runtimeId or projectAlias is required`: more than one runtime is online and the call did not identify a target.
- `Usage limit exceeded`: the user's minute, daily, or monthly quota denied the tool call before forwarding.
- Tool call timeout: the runtime accepted the call but did not answer before the gateway timeout.

Treat user tokens, admin tokens, and device tokens like passwords. Do not commit them to project files or paste them into issue trackers.
