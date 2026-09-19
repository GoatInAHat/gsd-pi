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

interface Captured { ok: boolean; payload?: unknown; error?: { message: string } }

async function call(handler: (opts: UiHandlerOptions) => Promise<void> | void, overrides: Partial<UiHandlerOptions> = {}) {
  const responses: Captured[] = []
  const opts: UiHandlerOptions = {
    params: {},
    client: null,
    respond: (ok, payload, error) => {
      responses.push({ ok, payload, error })
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

test("nine methods registered; respond contract with ErrorShape third argument", async () => {
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
    assert.deepEqual(responses, [{ ok: true, payload: { stubbed: true }, error: undefined }])
    assert.equal(daemon.calls[0].url, "http://127.0.0.1:33277/plugins/open-gsd-openclaw/web/api/preferences")
  } finally {
    daemon.restore()
  }
})

test("admin admission required by DEFAULT, even when adminOnly is omitted", async () => {
  const { api, registered } = recordingApi()
  registerGsdUiMethods(api, () => 33277, { projects: [] })
  const denied = await call(registered.get("gsd.ui.projects.list")!.handler, { params: { root: "/x" }, client: { internal: {} } })
  assert.equal(denied[0].ok, false)
  assert.match(denied[0].error?.message ?? "", /administrator/)
  const wireForged = await call(registered.get("gsd.ui.projects.list")!.handler, {
    params: { root: "/x", admin: true },
    client: { connId: "c" },
  })
  assert.equal(wireForged[0].ok, false)
  const optedOut = recordingApi()
  registerGsdUiMethods(optedOut.api, () => 33277, { adminOnly: false, projects: [{ projectId: "p", canonicalRoot: "/definitely/not" }] })
  const nonAdmin = await call(optedOut.registered.get("gsd.ui.projects.list")!.handler, { params: { projectId: "p" }, client: { connId: "c" } })
  assert.doesNotMatch(nonAdmin[0].error?.message ?? "", /administrator/)
})

test("approved-root operations with canonical identity, containment, absolute-path normalization, daemon translation", async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "gsd-v3-")))
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
    const dirsAbsolute = await call(registered.get("gsd.ui.directories.list")!.handler, { params: { projectId: "p1", path: join(root, "src") }, client })
    assert.equal(dirsAbsolute[0].ok, true, dirsAbsolute[0].error?.message)
    assert.ok(daemon.calls[2].url.includes("path=" + encodeURIComponent(join(root, "src"))))
    const dirsEscape = await call(registered.get("gsd.ui.directories.list")!.handler, { params: { projectId: "p1", path: "../../etc" }, client })
    assert.equal(dirsEscape[0].ok, false)
    assert.match(dirsEscape[0].error?.message ?? "", /escapes/)
    const del = await call(registered.get("gsd.ui.files.delete")!.handler, { params: { projectId: "p1", path: join(root, "src", "f.txt") }, client })
    assert.equal(del[0].ok, true, del[0].error?.message)
    const delUrl = daemon.calls[3].url
    assert.ok(delUrl.includes("root=project"), delUrl)
    assert.ok(delUrl.includes("project=" + encodeURIComponent(root)), delUrl)
    assert.ok(delUrl.includes("path=src%2Ff.txt"), delUrl)
  } finally {
    daemon.restore()
    rmSync(root, { recursive: true, force: true })
  }
})

test("symlinked approved root loses canonical identity and denies", async () => {
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
    assert.match(denied[0].error?.message ?? "", /canonical identity/)
  } finally {
    rmSync(linkParent, { recursive: true, force: true })
    rmSync(outside, { recursive: true, force: true })
  }
})

test("subscriptions: policy-gated, non-starting route, exact-recipient broadcast, unsubscribe release", async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "gsd-sub-")))
  const config: EmbeddedProjectsConfig = { adminOnly: true, projects: [{ projectId: "p1", canonicalRoot: root }] }
  const { api, registered } = recordingApi()
  registerGsdUiMethods(api, () => 33277, config)
  const broadcasts: Array<{ event: string; payload: unknown; connIds: ReadonlySet<string> }> = []
  const context = {
    broadcastToConnIds: (event: string, payload: unknown, connIds: ReadonlySet<string>) => {
      broadcasts.push({ event, payload, connIds })
    },
  }
  const controller = new AbortController()
  const client = adminClient({ connectionSignal: controller.signal })
  const original = globalThis.fetch
  const sseBody = "data: " + JSON.stringify({ kind: "a" }) + NL2 + NL2 + "data: " + JSON.stringify({ kind: "b" }) + NL2 + NL2
  const stream = new ReadableStream({
    start(c) {
      c.enqueue(new TextEncoder().encode(sseBody))
    },
  })
  globalThis.fetch = (async (input: unknown) => {
    assert.ok(String(input).includes("require_existing=1"), "subscription must use non-starting route: " + String(input))
    return new Response(stream, { status: 200, headers: { "Content-Type": "text/event-stream" } })
  }) as typeof fetch
  try {
    const deniedNoProject = await call(registered.get("gsd.ui.workspace.events.subscribe")!.handler, {
      params: {},
      client,
      context,
    })
    assert.equal(deniedNoProject[0].ok, false)
    assert.match(deniedNoProject[0].error?.message ?? "", /no approved project/)
    const subResponses: Captured[] = []
    await registered.get("gsd.ui.workspace.events.subscribe")!.handler({
      params: { project: root },
      client,
      respond: (ok, payload, error) => {
        subResponses.push({ ok, payload, error })
      },
      context,
    })
    await new Promise((r) => setTimeout(r, 40))
    assert.equal(subResponses.length, 1)
    assert.equal(subResponses[0].ok, true)
    const subscriptionId = (subResponses[0].payload as { subscriptionId: string }).subscriptionId
    const events = broadcasts.filter(
      (b) => b.event === "gsd.ui.event" && (b.payload as { subscriptionId?: string }).subscriptionId === subscriptionId && (b.payload as { event?: unknown }).event !== undefined,
    )
    assert.equal(events.length, 2, JSON.stringify(broadcasts))
    assert.deepEqual([...events[0].connIds], ["conn-1"])
    assert.equal((events[0].payload as { seq: number }).seq, 1)
    assert.equal((events[1].payload as { seq: number }).seq, 2)
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

test("subscription admission failures answer the RPC with an explicit error", async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "gsd-deny-")))
  const config: EmbeddedProjectsConfig = { adminOnly: true, projects: [{ projectId: "p1", canonicalRoot: root }] }
  const { api, registered } = recordingApi()
  registerGsdUiMethods(api, () => undefined, config)
  try {
    const responses = await call(registered.get("gsd.ui.workspace.events.subscribe")!.handler, {
      params: { project: root },
      client: adminClient(),
      context: { broadcastToConnIds: () => {} },
    })
    assert.equal(responses.length, 1)
    assert.equal(responses[0].ok, false)
    assert.match(responses[0].error?.message ?? "", /unavailable/)
    const aborted = new AbortController()
    aborted.abort()
    const abortedResponses = await call(registered.get("gsd.ui.workspace.events.subscribe")!.handler, {
      params: { project: root },
      client: adminClient({ connectionSignal: aborted.signal }),
      context: { broadcastToConnIds: () => {} },
    })
    assert.equal(abortedResponses[0].ok, false)
    assert.match(abortedResponses[0].error?.message ?? "", /retired/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("daemon unavailability responds with an error frame", async () => {
  const { api, registered } = recordingApi()
  registerGsdUiMethods(api, () => undefined)
  const responses = await call(registered.get("gsd.ui.preferences.read")!.handler)
  assert.equal(responses[0].ok, false)
  assert.match(responses[0].error?.message ?? "", /unavailable/)
})
