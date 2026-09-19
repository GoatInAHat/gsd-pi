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
  const listeners: Array<(event: { data: unknown }) => void> = []
  const posted: Array<{ message: unknown; targetOrigin: string }> = []
  const parent = {
    postMessage: (message: unknown, targetOrigin: string) => {
      posted.push({ message, targetOrigin })
    },
  }
  const win = {
    origin,
    location: { search: "?__gsd_channel=" + NONCE },
    addEventListener: (_type: string, listener: (event: { data: unknown }) => void) => listeners.push(listener),
    removeEventListener: (_type: string, listener: (event: { data: unknown }) => void) => {
      const i = listeners.indexOf(listener)
      if (i >= 0) listeners.splice(i, 1)
    },
    parent,
    postMessage: () => {},
  }
  return {
    win,
    posted,
    dispatch: (data: unknown) => {
      for (const l of [...listeners]) l({ data })
    },
    listenerCount: () => listeners.length,
  }
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
  const client = createEmbeddedOperationClient({ window: h.win, allowedOperations: ["preferences.get"], nonce: NONCE })
  await assert.rejects(() => client.request("evil.op"), /not allowed/)
  assert.equal(h.posted.length, 0)
  client.dispose()
})

test("allowlisted request posts nonce-bound message and resolves on response", async () => {
  const h = fakeWindow("null")
  const client = createEmbeddedOperationClient({ window: h.win, allowedOperations: ["preferences.get"], nonce: NONCE })
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
  const client = createEmbeddedOperationClient({ window: h.win, allowedOperations: ["preferences.get"], nonce: NONCE })
  const promise = client.request("preferences.get")
  const message = h.posted[0].message as { id: number }
  h.dispatch({ type: EMBEDDED_RESPONSE_MESSAGE, id: message.id, nonce: "wrongwrongwrong12_wrongwrongwrong12", ok: true, result: 1 })
  h.dispatch({ type: EMBEDDED_RESPONSE_MESSAGE, id: 9999, nonce: NONCE, ok: true, result: 2 })
  h.dispatch({ type: EMBEDDED_RESPONSE_MESSAGE, id: message.id, nonce: NONCE, ok: true, result: 3 })
  const result = await promise
  assert.equal(result, 3)
  client.dispose()
})

test("dispose rejects pending requests and removes the listener", async () => {
  const h = fakeWindow("null")
  const client = createEmbeddedOperationClient({ window: h.win, allowedOperations: ["preferences.get"], nonce: NONCE })
  const promise = client.request("preferences.get")
  assert.equal(h.listenerCount(), 1)
  client.dispose()
  await assert.rejects(() => promise, /disposed/)
  assert.equal(h.listenerCount(), 0)
  await assert.rejects(() => client.request("preferences.get"), /disposed/)
})
