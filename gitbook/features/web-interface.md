# Web Interface

GSD includes a browser-based interface for project management and real-time progress monitoring.

## Quick Start

```bash
gsd --web
```

This starts a local web server and opens the dashboard in your default browser.

## CLI Flags

```bash
gsd --web --host 0.0.0.0 --port 8080 --allowed-origins "https://example.com"
```

| Flag | Default | Description |
|------|---------|-------------|
| `--host` | `127.0.0.1` | Bind address |
| `--port` | `3000` | Port |
| `--allowed-origins` | (none) | Comma-separated CORS origins |
| `--no-auth` | disabled | Disable the built-in bearer token gate |

`--no-auth` explicitly allows unauthenticated web mode on any bind address, including a non-loopback host such as `--host 0.0.0.0`:

```bash
gsd --web --host 0.0.0.0 --no-auth
```

For environment-only launches, `GSD_WEB_NO_AUTH=1` is limited to loopback hosts by default. Set `GSD_WEB_ALLOW_UNAUTHENTICATED_LAN=1` as well to use a non-loopback host. The syntax depends on your shell:

macOS/Linux:

```bash
GSD_WEB_NO_AUTH=1 GSD_WEB_ALLOW_UNAUTHENTICATED_LAN=1 gsd --web --host 0.0.0.0
```

PowerShell:

```powershell
$env:GSD_WEB_NO_AUTH='1'; $env:GSD_WEB_ALLOW_UNAUTHENTICATED_LAN='1'; gsd --web --host 0.0.0.0
```

Command Prompt:

```batch
set "GSD_WEB_NO_AUTH=1" && set "GSD_WEB_ALLOW_UNAUTHENTICATED_LAN=1" && gsd --web --host 0.0.0.0
```

Unauthenticated LAN mode exposes terminal and file APIs to any client that can reach the server unless trusted external access control is already in place. Use it only behind authentication you control, such as a reverse proxy, VPN, or private network boundary.

## Features

- **Project management** — view milestones, slices, and tasks in a visual dashboard
- **Real-time progress** — live updates as auto mode executes
- **Multi-project support** — manage multiple projects from one browser tab via `?project=` URL parameter
- **Change project root** — switch directories from the web UI without restarting
- **Onboarding flow** — API key setup and provider configuration in the browser
- **Model selection** — switch models and providers from the web UI

## Local And Cloud Modes

`gsd --web` starts local mode. Local mode treats `?project=` as a local
filesystem path, falls back to `GSD_WEB_PROJECT_CWD` when omitted, and creates a
per-project stdio bridge to a local `gsd --mode rpc` child process.

Cloud mode is for the hosted `gsd-cloud` app. Build the cloud image from the
repository root:

```bash
docker build -f web/Dockerfile.cloud -t gsd-web:cloud .
```

Run it with the required server-side gateway settings:

```bash
docker run --rm -p 3000:3000 \
  -e GATEWAY_INTERNAL_URL="http://gateway.internal:9100" \
  -e GATEWAY_INTERNAL_TOKEN="replace-with-internal-token" \
  -e APP_BRIDGE_SECRET="replace-with-app-bridge-secret" \
  gsd-web:cloud
```

`web/Dockerfile.cloud` sets `GSD_CLOUD_MODE=1` and `PORT=3000`. Cloud startup
fails closed unless `GATEWAY_INTERNAL_URL`, `GATEWAY_INTERNAL_TOKEN`, and
`APP_BRIDGE_SECRET` are present.

In cloud mode, `?project=` is a session-granted project alias, not a local path.
The bridge uses `CloudTransport`: the web server mints an internal RPC token via
`POST {GATEWAY_INTERNAL_URL}/internal/rpc/token`, opens a WebSocket to
`/rpc/connect?token=...`, and forwards bridge NDJSON frames through the gateway.
File browsing proxies project-relative `readdir`, `read`, `stat`, and non-viewer
`write` operations to `/internal/fs`. Local host operations such as browsing
directories, switching roots, creating projects, local PTY terminals, shutdown,
and update are disabled.

### Cloud Authentication

Cloud entry starts at `/api/cloud/bootstrap?token=...`. The token is a
short-lived HMAC-signed app bridge token minted by the `gsd-cloud` SaaS with
`APP_BRIDGE_SECRET`. On success, the app sets an httpOnly, SameSite=Lax
`gsd_cloud_session` cookie for 8 hours and redirects to `/`.

Every other `/api/*` request in cloud mode requires that cookie. A `?project=`
alias must be included in the cookie's `projects` grant. The local
`GSD_WEB_AUTH_TOKEN` bearer-token gate is ignored in cloud mode, so keep
`GATEWAY_INTERNAL_TOKEN` and `APP_BRIDGE_SECRET` server-side and run the public
app behind the cloud SaaS or an equivalent authenticated TLS proxy.

## Platform Notes

- **macOS/Linux** — Full support
- **Windows** — Web build is skipped due to Next.js compatibility issues; CLI remains fully functional
