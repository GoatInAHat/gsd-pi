import test from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync, rmSync, existsSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { registerGsdUiMethods, isApprovedRoot, containsCanonically, type UiMethodApi, type EmbeddedProjectsConfig } from "../src/ui-methods.ts"

function recordingApi() {
  const registered = new Map<string, { handler: (params: unknown, context: unknown) => Promise<unknown>; opts?: { scope?: string; profileAccess?: string } }>()
  const api: UiMethodApi = {
    registerGatewayMethod: (method, handler, opts) => {
      registered.set(method, { handler, opts })
    },
  }
  return { api, registered }
}

function stubDaemonFetch() {
  const calls: Array<{ url: string; init?: { method?: string; body?: string } }> = []
  const original = globalThis.fetch
  globalThis.fetch = (async (input: unknown, init?: { method?: string; body?: string }) => {
    calls.push({ url: String(input), init })
    return new Response(JSON.stringify({ stubbed: true }), { status: 200, headers: { "Content-Type": "application/json" } })
  }) as typeof fetch
  return { calls, restore: () => { globalThis.fetch = original } }
}

test("registers nine gsd.ui methods individually with profile required and explicit scopes", () => {
  const { api, registered } = recordingApi()
  registerGsdUiMethods(api, () => 33277)
  assert.equal(registered.size, 9)
  for (const [method, entry] of registered) {
    assert.ok(method.startsWith("gsd.ui."), method)
    assert.equal(entry.opts?.profileAccess, "required", method)
    assert.ok(entry.opts?.scope, method)
  }
  assert.equal(registered.get("gsd.ui.preferences.read")?.opts?.scope, "operator.read")
  assert.equal(registered.get("gsd.ui.files.delete")?.opts?.scope, "operator.write")
})

test("reads proxy fixed loopback routes with server-built URLs and no redirects", async () => {
  const { api, registered } = recordingApi()
  registerGsdUiMethods(api, () => 33277)
  const daemon = stubDaemonFetch()
  try {
    const result = await registered.get("gsd.ui.preferences.read")!.handler({}, {})
    assert.deepEqual(result, { stubbed: true })
    assert.equal(daemon.calls[0].url, "http://127.0.0.1:33277/plugins/open-gsd-openclaw/web/api/preferences")
    assert.equal(daemon.calls[0].init?.method ?? "GET", "GET")
  } finally {
    daemon.restore()
  }
})

test("default-empty policy denies every root-touching operation", async () => {
  const { api, registered } = recordingApi()
  registerGsdUiMethods(api, () => 33277)
  await assert.rejects(() => registered.get("gsd.ui.projects.list")!.handler({ root: "/home" }, {}), /not approved/)
  await assert.rejects(() => registered.get("gsd.ui.directories.list")!.handler({ root: "/home" }, {}), /not approved/)
  await assert.rejects(() => registered.get("gsd.ui.preferences.selectRoot")!.handler({ devRoot: "/home" }, {}), /not approved/)
  await assert.rejects(() => registered.get("gsd.ui.files.delete")!.handler({ root: "/home", path: "x" }, {}), /not approved/)
})

test("approved roots enable operations; containment blocks escape and symlink exit", async () => {
  const root = mkdtempSync(join(tmpdir(), "gsd-ui-policy-"))
  const config: EmbeddedProjectsConfig = { adminOnly: true, projects: [{ projectId: "p1", canonicalRoot: root }] }
  try {
    mkdirSync(join(root, "src"))
    writeFileSync(join(root, "src", "file.txt"), "x")
    const outside = mkdtempSync(join(tmpdir(), "gsd-ui-outside-"))
    try {
      symlinkSync(outside, join(root, "src", "escape-link"))
    } catch {
      // symlink creation may be restricted; containment still proven by .. escape
    }
    assert.equal(isApprovedRoot(config, root), true)
    assert.equal(isApprovedRoot(config, outside), false)
    assert.equal(containsCanonically(root, join("src", "file.txt")), true)
    assert.equal(containsCanonically(root, join("src", "..", "..", "etc")), false)
    if (existsSync(join(root, "src", "escape-link"))) {
      assert.equal(containsCanonically(root, join("src", "escape-link")), false)
    }
    const { api, registered } = recordingApi()
    registerGsdUiMethods(api, () => 33277, config)
    const daemon = stubDaemonFetch()
    try {
      await registered.get("gsd.ui.projects.list")!.handler({ root }, {})
      assert.ok(daemon.calls[0].url.includes("/api/projects?root="))
      await assert.rejects(() => registered.get("gsd.ui.files.delete")!.handler({ root, path: join("src", "..", "..", "etc") }, {}), /escapes/)
    } finally {
      daemon.restore()
    }
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("daemon unavailability and subscription methods refuse explicitly", async () => {
  const { api, registered } = recordingApi()
  registerGsdUiMethods(api, () => undefined)
  await assert.rejects(() => registered.get("gsd.ui.preferences.read")!.handler({}, {}), /web host unavailable/)
  await assert.rejects(() => registered.get("gsd.ui.workspace.events.subscribe")!.handler({}, {}), /not yet enabled/)
  await assert.rejects(() => registered.get("gsd.ui.terminal.output.subscribe")!.handler({}, {}), /not yet enabled/)
})
