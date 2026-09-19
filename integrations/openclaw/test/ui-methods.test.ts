import test from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync, rmSync, realpathSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { registerGsdUiMethods, type UiMethodApi, type UiHandlerOptions, type EmbeddedProjectsConfig, type UiClient } from "../src/ui-methods.ts"

const NL2 = String.fromCharCode(10)

function recordingApi() {
  const registered = new Map<string, { handler: (opts: UiHandlerOptions) => Promise<void> | void; opts?: { scope?: string; profileAccess?: string } }>()
  const api: UiMethodApi = {
    registerGatewayMethod: (method, handler, opts) => {
      registered.set(method, { handler, opts })
    },
  }
  return { api, registered }
}

async function call(handler: (opts: UiHandlerOptions) => Promise<void> | void, overrides: Partial<UiHandlerOptions> = {}) {
  const responses: Array<{ ok: boolean; payload: unknown }> = []
  const opts: UiHandlerOptions = {
    params: {},
    client: null,
    respond: (ok, payload) => {
      responses.push({ ok, payload })
    },
    context: {},
    ...overrides,
  }
  await handler(opts)
  return responses
}

function adminClient(overrides: Partial<UiClient> = {}): UiClient {
  return {
    connId: "conn-1",
    connectionSignal: new AbortController().signal,
    internal: { controlUiAdmin: true },
    ...overrides,
  }
}

function stubDaemonFetch(body: unknown = { stubbed: true }) {
  const calls: Array<{ url: string; init?: { method?: string; body?: string } }> = []
  const original = globalThis.fetch
  globalThis.fetch = (async (input: unknown, init?: { method?: string; body?: string }) => {
    calls.push({ url: String(input), init })
    return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } })
  }) as typeof fetch
  return { calls, restore: () => { globalThis.fetch = original } }
}

test("nine gsd.ui methods registered individually, profile required, respond contract", async () => {
  const { api, registered } = recordingApi()
  registerGsdUiMethods(api, () => 33277)
  assert.equal(registered.size, 9)
  for (const [method, entry] of registered) {
    assert.ok(method.startsWith("gsd.ui."), method)
    assert.equal(entry.opts?.profileAccess, "required", method)
  }
  const daemon = stubDaemonFetch()
  try {
    const responses = await call(registered.get("gsd.ui.preferences.read")!.handler)
    assert.deepEqual(responses, [{ ok: true, payload: { stubbed: true } }])
    assert.equal(daemon.calls[0].url, "http://127.0.0.1:33277/plugins/open-gsd-openclaw/web/api/preferences")
  } finally {
    daemon.restore()
  }
})

test("adminOnly enforced from server-owned client identity, never params", async () => {
  const { api, registered } = recordingApi()
  const config: EmbeddedProjectsConfig = { adminOnly: true, projects: [] }
  registerGsdUiMethods(api, () => 33277, config)
  const nonAdmin = await call(registered.get("gsd.ui.projects.list")!.handler, { params: { root: "/x" }, client: { internal: {} } })
  assert.equal(nonAdmin[0].ok, false)
  assert.match((nonAdmin[0].payload as { error?: string }).error ?? "", /administrator/)
  const fakeAdmin = await call(registered.get("gsd.ui.projects.list")!.handler, {
    params: { root: "/x", admin: true },
    client: { connId: "c" },
  })
  assert.equal(fakeAdmin[0].ok, false)
})

test("approved-root operations with canonical identity, containment, and daemon translation", async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "gsd-v2-")))
  mkdirSync(join(root, "src"))
  writeFileSync(join(root, "src", "f.txt"), "x")
  const config: EmbeddedProjectsConfig = { adminOnly: true, projects: [{ projectId: "p1", canonicalRoot: root }] }
  const { api, registered } = recordingApi()
  registerGsdUiMethods(api, () => 33277, config)
  const client = adminClient()
  const daemon = stubDaemonFetch()
  try {
    const listed = await call(registered.get("gsd.ui.projects.list")!.handler, { params: { projectId: "p1", detail: true }, client })
    assert.equal(listed[0].ok, true)
    assert.ok(daemon.calls[0].url.includes("/api/projects?root=" + encodeURIComponent(root)))
    const dirsDefault = await call(registered.get("gsd.ui.directories.list")!.handler, { params: { projectId: "p1" }, client })
    assert.equal(dirsDefault[0].ok, true)
    assert.ok(daemon.calls[1].url.includes("path=" + encodeURIComponent(root)))
    const dirsEscape = await call(registered.get("gsd.ui.directories.list")!.handler, { params: { projectId: "p1", path: "../../etc" }, client })
    assert.equal(dirsEscape[0].ok, false)
    assert.match((dirsEscape[0].payload as { error?: string }).error ?? "", /escapes/)
    const del = await call(registered.get("gsd.ui.files.delete")!.handler, { params: { projectId: "p1", path: join(root, "src", "f.txt") }, client })
    assert.equal(del[0].ok, true, (del[0].payload as { error?: string }).error ?? "")
    const delUrl = daemon.calls[2].url
    assert.ok(delUrl.includes("root=project"), delUrl)
    assert.ok(delUrl.includes("project=" + encodeURIComponent(root)), delUrl)
    assert.ok(delUrl.includes("path=src%2Ff.txt"), delUrl)
  } finally {
    daemon.restore()
    rmSync(root, { recursive: true, force: true })
  }
})

test("approved root replaced by a symlink loses canonical identity and denies", async () => {
  const outside = realpathSync(mkdtempSync(join(tmpdir(), "gsd-out-")))
  const linkParent = realpathSync(mkdtempSync(join(tmpdir(), "gsd-link-")))
  const linkPath = join(linkParent, "approved")
  try {
    symlinkSync(outside, linkPath)
    const config: EmbeddedProjectsConfig = { adminOnly: true, projects: [{ projectId: "p1", canonicalRoot: linkPath }] }
    const { api, registered } = recordingApi()
    registerGsdUiMethods(api, () => 33277, config)
    const denied = await call(registered.get("gsd.ui.projects.list")!.handler, { params: { projectId: "p1" }, client: adminClient() })
    assert.equal(denied[0].ok, false)
    assert.match((denied[0].payload as { error?: string }).error ?? "", /canonical identity/)
  } finally {
    rmSync(linkParent, { recursive: true, force: true })
    rmSync(outside, { recursive: true, force: true })
  }
})

test("subscriptions deliver to the exact connection and honor unsubscribe", async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "gsd-sub-")))
  const config: EmbeddedProjectsConfig = { adminOnly: true, projects: [{ projectId: "p1", canonicalRoot: root }] }
  const { api, registered } = recordingApi()
  registerGsdUiMethods(api, () => 33277, config)
  const broadcasts: Array<{ connIds: string[]; event: unknown }> = []
  const context = { broadcastToConnIds: (connIds: string[], event: unknown) => { broadcasts.push({ connIds, event }) } }
  const controller = new AbortController()
  const client = adminClient({ connectionSignal: controller.signal })
  const original = globalThis.fetch
  const sseBody = "data: " + JSON.stringify({ kind: "a" }) + NL2 + NL2 + "data: " + JSON.stringify({ kind: "b" }) + NL2 + NL2
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(sseBody))
      // Deliberately left open: a real SSE feed stays open, so unsubscribe
      // has a live subscription to release instead of a completed stream.
    },
  })
  globalThis.fetch = (async () =>
    new Response(stream, { status: 200, headers: { "Content-Type": "text/event-stream" } })) as typeof fetch
  try {
    const subResponses: Array<{ ok: boolean; payload: unknown }> = []
    await registered.get("gsd.ui.workspace.events.subscribe")!.handler({
      params: { project: root },
      client,
      respond: (ok, payload) => {
        subResponses.push({ ok, payload })
      },
      context,
    })
    await new Promise((r) => setTimeout(r, 40))
    assert.equal(subResponses.length, 1)
    assert.equal(subResponses[0].ok, true)
    const subscriptionId = (subResponses[0].payload as { subscriptionId: string }).subscriptionId
    const events = broadcasts.filter((b) => (b.event as { type?: string; subscriptionId?: string }).type === "gsd.ui.event" && (b.event as { subscriptionId?: string }).subscriptionId === subscriptionId && (b.event as { event?: unknown }).event !== undefined)
    assert.equal(events.length, 2, JSON.stringify(broadcasts))
    assert.deepEqual(events[0].connIds, ["conn-1"])
    assert.equal((events[0].event as { seq: number }).seq, 1)
    assert.equal((events[1].event as { seq: number }).seq, 2)
    const unsub = await call(registered.get("gsd.ui.workspace.events.unsubscribe")!.handler, {
      params: { subscriptionId },
      client,
      context,
    })
    assert.equal(unsub[0].ok, true)
  } finally {
    globalThis.fetch = original
    controller.abort()
    rmSync(root, { recursive: true, force: true })
  }
})

test("daemon unavailability responds with an error, never throws", async () => {
  const { api, registered } = recordingApi()
  registerGsdUiMethods(api, () => undefined)
  const responses = await call(registered.get("gsd.ui.preferences.read")!.handler)
  assert.equal(responses[0].ok, false)
  assert.match((responses[0].payload as { error?: string }).error ?? "", /unavailable/)
})
