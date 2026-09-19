import test from "node:test"
import assert from "node:assert/strict"
import {
  mapRouteToOperation,
  embeddedApiFetch,
  embeddedStartup,
  resetEmbeddedGate,
  getEmbeddedTransport,
  EmbeddedEventSourceAdapter,
  embeddedEventSourceForUrl,
  shouldSuppressShutdownBeacon,
} from "../embedded-gate.ts"
import { EMBEDDED_PROTOCOL, EVENT_TYPE } from "../embedded-transport.ts"

function stubWindow(embedded: boolean): () => void {
  const g = globalThis as unknown as { window?: unknown }
  g.window = embedded
    ? { origin: "null", location: { search: "?__gsd_embedded=1" }, parent: { postMessage: () => {} }, addEventListener: () => {}, removeEventListener: () => {}, postMessage: () => {} }
    : { origin: "https://standalone.test", location: { search: "" }, parent: {}, addEventListener: () => {}, removeEventListener: () => {}, postMessage: () => {} }
  return () => {
    delete g.window
  }
}

function fakeTransport(result?: unknown, error?: Error) {
  const requests: Array<{ operation: string; args?: unknown }> = []
  const handlers = new Set<(message: unknown) => void>()
  return {
    requests,
    emit: (message: unknown) => {
      for (const h of [...handlers]) h(message)
    },
    client: {
      request: async (operation: string, args?: unknown) => {
        requests.push({ operation, args })
        if (error) throw error
        return result
      },
      onEvent: (handler: (message: unknown) => void) => {
        handlers.add(handler)
        return () => handlers.delete(handler)
      },
      dispose: () => {},
    },
  }
}

test("known routes map to named operations with parsed args", () => {
  assert.deepEqual(mapRouteToOperation("GET", "/api/preferences", null), { operation: "preferences.read", args: {} })
  assert.deepEqual(
    mapRouteToOperation("GET", "/api/projects?root=%2Fhome%2Fx&detail=true", null),
    { operation: "projects.list", args: { root: "/home/x", detail: true } },
  )
  assert.deepEqual(
    mapRouteToOperation("POST", "/api/switch-root", JSON.stringify({ root: "/home/y" })),
    { operation: "preferences.selectRoot", args: { root: "/home/y" } },
  )
  assert.deepEqual(
    mapRouteToOperation("DELETE", "/api/files?root=%2Fhome%2Fx&path=src", null),
    { operation: "files.delete", args: { root: "/home/x", path: "src" } },
  )
})

test("unknown routes and mismatched methods fail closed", () => {
  assert.equal(mapRouteToOperation("GET", "/api/unknown", null), undefined)
  assert.equal(mapRouteToOperation("PATCH", "/api/preferences", null), undefined)
  assert.equal(mapRouteToOperation("POST", "/api/preferences", null), undefined)
})

test("embeddedApiFetch without a transport returns 503 and never throws", async () => {
  const restore = stubWindow(true)
  try {
    resetEmbeddedGate()
    const res = await embeddedApiFetch("/api/preferences")
    assert.equal(res.ok, false)
    assert.equal(res.status, 503)
  } finally {
    restore()
    resetEmbeddedGate()
  }
})

test("embeddedApiFetch maps, calls the transport, and wraps typed results", async () => {
  const restore = stubWindow(true)
  try {
    const fake = fakeTransport({ launchCwd: null })
    await embeddedStartup({ allowedOperations: ["preferences.read"], negotiate: async () => fake.client })
    const res = await embeddedApiFetch("/api/preferences")
    assert.equal(res.status, 200)
    assert.equal(res.ok, true)
    assert.deepEqual(await res.json(), { launchCwd: null })
    assert.deepEqual(fake.requests, [{ operation: "preferences.read", args: {} }])
  } finally {
    restore()
    resetEmbeddedGate()
  }
})

test("embeddedApiFetch rejects unmapped routes with 501 and transport failures with 502", async () => {
  const restore = stubWindow(true)
  try {
    const fake = fakeTransport(undefined, new Error("operation denied"))
    await embeddedStartup({ allowedOperations: ["preferences.read"], negotiate: async () => fake.client })
    const unmapped = await embeddedApiFetch("/api/session/command", { method: "POST", body: "{}" })
    assert.equal(unmapped.status, 501)
    const denied = await embeddedApiFetch("/api/preferences")
    assert.equal(denied.status, 502)
    assert.equal(denied.ok, false)
  } finally {
    restore()
    resetEmbeddedGate()
  }
})

test("startup resolves standalone, embedded-ready, and embedded-unavailable states", async () => {
  const restoreStandalone = stubWindow(false)
  resetEmbeddedGate()
  assert.equal(await embeddedStartup(), "standalone")
  restoreStandalone()
  const restoreEmbedded = stubWindow(true)
  try {
    const fake = fakeTransport()
    assert.equal(await embeddedStartup({ allowedOperations: [], negotiate: async () => fake.client }), "embedded-ready")
    assert.equal(getEmbeddedTransport(), fake.client)
    resetEmbeddedGate()
    assert.equal(
      await embeddedStartup({ allowedOperations: [], negotiate: async () => Promise.reject(new Error("no bridge")) }),
      "embedded-unavailable",
    )
    assert.equal(getEmbeddedTransport(), null)
  } finally {
    restoreEmbedded()
    resetEmbeddedGate()
  }
})

test("SSE adapter opens on subscribe, delivers only its subscription events, and closes", async () => {
  const fake = fakeTransport({ subscriptionId: "sub-1" })
  const received: string[] = []
  let opened = false
  let errored = false
  const adapter = new EmbeddedEventSourceAdapter(fake.client, "workspace.events.subscribe", { project: "/p" })
  adapter.onopen = () => {
    opened = true
  }
  adapter.onmessage = (ev) => {
    received.push(ev.data)
  }
  adapter.onerror = () => {
    errored = true
  }
  await new Promise((r) => setTimeout(r, 5))
  assert.equal(opened, true)
  assert.equal(errored, false)
  assert.deepEqual(fake.requests, [{ operation: "workspace.events.subscribe", args: { project: "/p" } }])
  fake.emit({ protocol: EMBEDDED_PROTOCOL, type: EVENT_TYPE, generation: 1, subscriptionId: "sub-1", seq: 1, event: { kind: "tick" } })
  fake.emit({ protocol: EMBEDDED_PROTOCOL, type: EVENT_TYPE, generation: 1, subscriptionId: "sub-other", seq: 1, event: { kind: "not-mine" } })
  await new Promise((r) => setTimeout(r, 5))
  assert.deepEqual(received, [JSON.stringify({ kind: "tick" })])
  adapter.close()
  fake.emit({ protocol: EMBEDDED_PROTOCOL, type: EVENT_TYPE, generation: 1, subscriptionId: "sub-1", seq: 2, event: { kind: "after-close" } })
  await new Promise((r) => setTimeout(r, 5))
  assert.deepEqual(received, [JSON.stringify({ kind: "tick" })])
})

test("stream URL mapping returns undefined without a transport; beacon suppression tracks embedded mode", () => {
  const restore = stubWindow(true)
  try {
    resetEmbeddedGate()
    assert.equal(embeddedEventSourceForUrl("/api/session/events?project=%2Fp"), undefined)
    assert.equal(shouldSuppressShutdownBeacon(), true)
  } finally {
    restore()
    resetEmbeddedGate()
  }
  const restoreStandalone = stubWindow(false)
  try {
    assert.equal(shouldSuppressShutdownBeacon(), false)
  } finally {
    restoreStandalone()
  }
})
