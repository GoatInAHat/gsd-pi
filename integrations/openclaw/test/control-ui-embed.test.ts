import test from "node:test"
import assert from "node:assert/strict"
import {
  createGsdEmbedPlugin,
  GSD_EMBED_PROTOCOL,
  GSD_EMBED_READY_TYPE,
  GSD_EMBED_BIND_TYPE,
  GSD_EMBED_REQUEST_TYPE,
  GSD_EMBED_RESPONSE_TYPE,
} from "../src/control-ui-embed.ts"

function setup() {
  const windowListeners: Array<(event: unknown) => void> = []
  const g = globalThis as unknown as Record<string, unknown>
  const originalAdd = g.addEventListener
  const originalRemove = g.removeEventListener
  g.addEventListener = (t: string, l: (event: unknown) => void) => {
    if (t === "message") windowListeners.push(l)
  }
  g.removeEventListener = (t: string, l: (event: unknown) => void) => {
    const i = windowListeners.indexOf(l)
    if (i >= 0) windowListeners.splice(i, 1)
  }
  const postMessagesToFrame: Array<{ data: unknown; transfer?: unknown[] }> = []
  const contentWindow = {
    postMessage: (data: unknown, _origin: string, transfer?: unknown[]) => {
      postMessagesToFrame.push({ data, transfer })
    },
  }
  const iframe = {
    contentWindow,
    src: "",
    sandbox: "",
    style: {} as Record<string, string>,
    removed: 0,
    remove() {
      this.removed += 1
    },
  }
  const container = {
    ownerDocument: { createElement: () => iframe },
    appended: [] as unknown[],
    appendChild(child: unknown) {
      this.appended.push(child)
    },
  }
  const requests: Array<{ method: string; params: unknown }> = []
  const request = async (method: string, params: unknown) => {
    requests.push({ method, params })
    if (method.endsWith("denied.op")) throw new Error("server denied")
    return { answered: method }
  }
  let capturedPlugin: { id: string; activate: (host: unknown) => void } | undefined
  const definePlugin = (plugin: { id: string; activate: (host: unknown) => void }) => {
    capturedPlugin = plugin
    return { plugin: true }
  }
  createGsdEmbedPlugin({
    frameSrc: "/plugins/open-gsd-openclaw/web/?__gsd_embedded=1",
    request,
    allowedOperations: ["preferences.read"],
    definePlugin,
  })
  let registeredPage: { id: string; title?: string; mount: (container: unknown, view: { signal: AbortSignal }) => (() => void) | void } | undefined
  capturedPlugin!.activate({ ui: { registerPage: (page: typeof registeredPage) => { registeredPage = page } } })
  const controller = new AbortController()
  const teardown = registeredPage!.mount(container, { signal: controller.signal })
  const dispatchToWrapper = (data: unknown, ports: unknown[] = []) => {
    for (const l of [...windowListeners]) l({ data, source: contentWindow, ports })
  }
  const restore = () => {
    g.addEventListener = originalAdd
    g.removeEventListener = originalRemove
  }
  return { windowListeners, postMessagesToFrame, iframe, container, requests, dispatchToWrapper, controller, teardown, restore }
}

function waitForPortMessage(port: { onmessage: ((ev: { data: unknown }) => void) | null }): Promise<any> {
  return new Promise((resolve) => {
    port.onmessage = (ev) => {
      port.onmessage = null
      resolve(ev.data)
    }
  })
}

test("wrapper registers the page, owns the iframe, and binds on the ready ping", async () => {
  const h = setup()
  try {
    assert.equal(h.iframe.sandbox, "allow-scripts")
    assert.ok(h.iframe.src.includes("__gsd_embedded=1"))
    assert.equal(h.container.appended.length, 1)
    assert.equal(h.windowListeners.length, 1)
    h.dispatchToWrapper({ protocol: GSD_EMBED_PROTOCOL, type: GSD_EMBED_READY_TYPE })
    assert.equal(h.postMessagesToFrame.length, 1)
    const bind = h.postMessagesToFrame[0].data as { protocol: string; type: string; generation: number }
    assert.equal(bind.protocol, GSD_EMBED_PROTOCOL)
    assert.equal(bind.type, GSD_EMBED_BIND_TYPE)
    assert.equal(bind.generation, 1)
    assert.equal(h.postMessagesToFrame[0].transfer?.length, 1)
    const framePort = h.postMessagesToFrame[0].transfer![0] as { postMessage(m: unknown): void; onmessage: ((ev: { data: unknown }) => void) | null }
    const replyPromise = waitForPortMessage(framePort)
    framePort.postMessage({ protocol: GSD_EMBED_PROTOCOL, type: GSD_EMBED_REQUEST_TYPE, generation: 1, requestId: "r1", operation: "preferences.read", args: {} })
    const reply = await replyPromise
    assert.equal(reply.type, GSD_EMBED_RESPONSE_TYPE)
    assert.equal(reply.ok, true)
    assert.deepEqual(reply.result, { answered: "gsd.ui.preferences.read" })
    assert.deepEqual(h.requests, [{ method: "gsd.ui.preferences.read", params: {} }])
    const refusalPromise = waitForPortMessage(framePort)
    framePort.postMessage({ protocol: GSD_EMBED_PROTOCOL, type: GSD_EMBED_REQUEST_TYPE, generation: 1, requestId: "r2", operation: "evil.op", args: {} })
    const refusal = await refusalPromise
    assert.equal(refusal.ok, false)
    assert.match(refusal.error, /not allowed/)
    assert.equal(h.requests.length, 1)
    h.dispatchToWrapper({ protocol: GSD_EMBED_PROTOCOL, type: GSD_EMBED_READY_TYPE })
    assert.equal(h.postMessagesToFrame.length, 1)
    h.dispatchToWrapper({ protocol: GSD_EMBED_PROTOCOL, type: GSD_EMBED_BIND_TYPE, generation: 9 }, [new MessageChannel().port1])
    assert.equal(h.postMessagesToFrame.length, 1)
  } finally {
    h.restore()
  }
})

test("abort teardown closes the port, removes the iframe, and drops the listener", async () => {
  const h = setup()
  try {
    h.dispatchToWrapper({ protocol: GSD_EMBED_PROTOCOL, type: GSD_EMBED_READY_TYPE })
    const framePort = h.postMessagesToFrame[0].transfer![0] as { postMessage(m: unknown): void; onmessage: ((ev: { data: unknown }) => void) | null }
    h.controller.abort()
    assert.equal(h.iframe.removed, 1)
    assert.equal(h.windowListeners.length, 0)
    let heard = false
    framePort.onmessage = () => {
      heard = true
    }
    framePort.postMessage({ protocol: GSD_EMBED_PROTOCOL, type: GSD_EMBED_REQUEST_TYPE, generation: 1, requestId: "r3", operation: "preferences.read" })
    await new Promise((r) => setTimeout(r, 20))
    assert.equal(heard, false)
    assert.equal(h.requests.length, 0)
  } finally {
    h.restore()
  }
})
