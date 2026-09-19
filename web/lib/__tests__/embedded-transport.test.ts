import test from "node:test"
import assert from "node:assert/strict"
import {
  createEmbeddedOperationClient,
  isEmbeddedMode,
  readChannelNonce,
  EMBEDDED_RESPONSE_MESSAGE,
} from "../embedded-transport.ts"

const NONCE = "abcdefgh12345678_abcdefgh12345678"

function fakeWindow(origin: string) {
  const listeners: Array<(event: { data: unknown; source?: unknown; origin?: string }) => void> = []
  const posted: Array<{ message: unknown; targetOrigin: string }> = []
  const parent = {
    postMessage: (message: unknown, targetOrigin: string) => {
      posted.push({ message, targetOrigin })
    },
  }
  const win = {
    origin,
    location: { search: "?__gsd_channel=" + NONCE },
    addEventListener: (_type: string, listener: (event: { data: unknown; source?: unknown; origin?: string }) => void) => listeners.push(listener),
    removeEventListener: (_type: string, listener: (event: { data: unknown; source?: unknown; origin?: string }) => void) => {
      const i = listeners.indexOf(listener)
      if (i >= 0) listeners.splice(i, 1)
    },
    parent,
    postMessage: () => {},
  }
  return {
    win,
    parent,
    posted,
    dispatch: (data: unknown, opts?: { source?: unknown; eventOrigin?: string }) => {
      const source = opts && "source" in opts ? opts.source : parent
      const eventOrigin = opts?.eventOrigin ?? "https://parent.test"
      for (const l of [...listeners]) l({ data, source, origin: eventOrigin })
    },
    listenerCount: () => listeners.length,
  }
}

function makeClient(h: ReturnType<typeof fakeWindow>, extra?: Parameters<typeof createEmbeddedOperationClient>[0]) {
  return createEmbeddedOperationClient({ window: h.win, allowedOperations: ["preferences.get", "projects.list"], nonce: NONCE, ...extra })
}

test("embedded mode is detected only for opaque origins", () => {
  assert.equal(isEmbeddedMode(fakeWindow("null").win), true)
  assert.equal(isEmbeddedMode(fakeWindow("https://x.test").win), false)
})

test("channel nonce is read and validated from location", () => {
  assert.equal(readChannelNonce(fakeWindow("null").win), NONCE)
  const short = fakeWindow("null")
  short.win.location = { search: "?__gsd_channel=short" }
  assert.equal(readChannelNonce(short.win), undefined)
})

test("non-allowlisted operations fail closed without posting", async () => {
  const h = fakeWindow("null")
  const client = makeClient(h)
  await assert.rejects(() => client.request("evil.op"), /not allowed/)
  assert.equal(h.posted.length, 0)
  client.dispose()
})

test("allowlisted request posts nonce-bound message and resolves on parent response", async () => {
  const h = fakeWindow("null")
  const client = makeClient(h)
  const promise = client.request("preferences.get", { detail: true })
  assert.equal(h.posted.length, 1)
  assert.equal(h.posted[0].targetOrigin, "*")
  const message = h.posted[0].message as { type: string; id: number; nonce: string; name: string; args?: unknown }
  assert.equal(message.nonce, NONCE)
  assert.equal(message.name, "preferences.get")
  assert.deepEqual(message.args, { detail: true })
  h.dispatch({ type: EMBEDDED_RESPONSE_MESSAGE, id: message.id, nonce: NONCE, ok: true, result: { launchCwd: null } })
  const result = (await promise) as { launchCwd: string | null }
  assert.equal(result.launchCwd, null)
  client.dispose()
})

test("responses with wrong nonce or unknown ids are ignored", async () => {
  const h = fakeWindow("null")
  const client = makeClient(h)
  const promise = client.request("preferences.get")
  const message = h.posted[0].message as { id: number }
  h.dispatch({ type: EMBEDDED_RESPONSE_MESSAGE, id: message.id, nonce: "wrongwrongwrong12_wrongwrongwrong12", ok: true, result: 1 })
  h.dispatch({ type: EMBEDDED_RESPONSE_MESSAGE, id: 9999, nonce: NONCE, ok: true, result: 2 })
  h.dispatch({ type: EMBEDDED_RESPONSE_MESSAGE, id: message.id, nonce: NONCE, ok: true, result: 3 })
  const result = await promise
  assert.equal(result, 3)
  client.dispose()
})

test("responses from a non-parent source are ignored", async () => {
  const h = fakeWindow("null")
  const client = makeClient(h)
  const promise = client.request("preferences.get")
  const message = h.posted[0].message as { id: number }
  const stranger = { postMessage: () => {} }
  h.dispatch({ type: EMBEDDED_RESPONSE_MESSAGE, id: message.id, nonce: NONCE, ok: true, result: "spoofed" }, { source: stranger })
  h.dispatch({ type: EMBEDDED_RESPONSE_MESSAGE, id: message.id, nonce: NONCE, ok: true, result: "spoofed" }, { source: null })
  h.dispatch({ type: EMBEDDED_RESPONSE_MESSAGE, id: message.id, nonce: NONCE, ok: true, result: "real" })
  const result = await promise
  assert.equal(result, "real")
  client.dispose()
})

test("responses with an unexpected parent origin are ignored when one is configured", async () => {
  const h = fakeWindow("null")
  const client = makeClient(h, { expectedParentOrigin: "https://expected.test" })
  const promise = client.request("preferences.get")
  const message = h.posted[0].message as { id: number }
  h.dispatch({ type: EMBEDDED_RESPONSE_MESSAGE, id: message.id, nonce: NONCE, ok: true, result: "spoofed" }, { eventOrigin: "https://other.test" })
  h.dispatch({ type: EMBEDDED_RESPONSE_MESSAGE, id: message.id, nonce: NONCE, ok: true, result: "real" }, { eventOrigin: "https://expected.test" })
  const result = await promise
  assert.equal(result, "real")
  client.dispose()
})

test("parent silence times out and late responses are ignored", async () => {
  const h = fakeWindow("null")
  const client = makeClient(h, { timeoutMs: 25 })
  const promise = client.request("preferences.get")
  const message = h.posted[0].message as { id: number }
  await assert.rejects(() => promise, /timed out/)
  h.dispatch({ type: EMBEDDED_RESPONSE_MESSAGE, id: message.id, nonce: NONCE, ok: true, result: "late" })
  client.dispose()
})

test("pending cap rejects excess requests while the parent is silent", async () => {
  const h = fakeWindow("null")
  const client = makeClient(h, { timeoutMs: 60_000, maxPending: 1 })
  const first = client.request("preferences.get")
  await assert.rejects(() => client.request("projects.list"), /pending cap/)
  client.dispose()
  await assert.rejects(() => first, /disposed/)
})

test("postMessage throw rejects the request and drains the pending entry", async () => {
  const h = fakeWindow("null")
  const client = makeClient(h, { maxPending: 1 })
  const originalPostMessage = h.parent.postMessage
  h.parent.postMessage = () => {
    const error = new Error("could not be cloned")
    error.name = "DataCloneError"
    throw error
  }
  await assert.rejects(() => client.request("preferences.get", { uncloneable: Symbol("x") }), /could not be cloned/)
  h.parent.postMessage = originalPostMessage
  const promise = client.request("preferences.get")
  h.dispatch({ type: EMBEDDED_RESPONSE_MESSAGE, id: (h.posted[0].message as { id: number }).id, nonce: NONCE, ok: true, result: "ok" })
  assert.equal(await promise, "ok")
  client.dispose()
})

test("dispose rejects pending requests and removes the listener", async () => {
  const h = fakeWindow("null")
  const client = makeClient(h, { timeoutMs: 60_000 })
  const promise = client.request("preferences.get")
  assert.equal(h.listenerCount(), 1)
  client.dispose()
  await assert.rejects(() => promise, /disposed/)
  assert.equal(h.listenerCount(), 0)
  await assert.rejects(() => client.request("preferences.get"), /disposed/)
})


test("top-level opaque document without a distinct parent is not embedded mode", () => {
  const topLevel: { origin: string; location: { search: string }; addEventListener: () => void; removeEventListener: () => void; parent: unknown; postMessage: () => void } = {
    origin: "null",
    location: { search: "?__gsd_channel=" + NONCE },
    addEventListener: () => {},
    removeEventListener: () => {},
    parent: null,
    postMessage: () => {},
  }
  topLevel.parent = topLevel
  assert.equal(isEmbeddedMode(topLevel as never), false)
  const embedded = fakeWindow("null")
  assert.equal(isEmbeddedMode(embedded.win), true)
})


test("constructor rejects an invalid channel nonce", () => {
  const h = fakeWindow("null")
  assert.throws(() => createEmbeddedOperationClient({ window: h.win, allowedOperations: ["preferences.get"], nonce: "short" }), /invalid embedded channel nonce/)
})

