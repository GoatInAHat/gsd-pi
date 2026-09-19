import test from "node:test"
import assert from "node:assert/strict"
import {
  createGsdEmbedPlugin,
  GSD_EMBED_PLUGIN_ID,
  GSD_EMBED_PROTOCOL,
  GSD_EMBED_READY_TYPE,
  GSD_EMBED_BIND_TYPE,
  GSD_EMBED_REQUEST_TYPE,
  GSD_EMBED_RESPONSE_TYPE,
  GSD_EMBED_EVENT_TYPE,
  GSD_UI_HOST_EVENT_NAME,
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
  const loadListeners: Array<() => void> = []
  const iframe = {
    contentWindow,
    src: "",
    sandbox: "",
    style: {} as Record<string, string>,
    removed: 0,
    remove() {
      this.removed += 1
    },
    addEventListener: (type: string, listener: () => void) => {
      if (type === "load") loadListeners.push(listener)
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
    return { answered: method }
  }
  const hostEvents: Array<{ name: string; handler: (event: unknown) => void }> = []
  const onEvent = (name: string, handler: (event: unknown) => void) => {
    hostEvents.push({ name, handler })
    return () => {
      const i = hostEvents.findIndex((h) => h.handler === handler)
      if (i >= 0) hostEvents.splice(i, 1)
    }
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
    onEvent,
  })
  let registeredPage: { id: string; label: string; mount: (container: unknown, context: { signal: AbortSignal }) => { dispose?: () => void } | void } | undefined
  let registeredNav: { id: string; label: string; page: { id: string } } | undefined
  capturedPlugin!.activate({
    ui: {
      registerPage: (page: typeof registeredPage) => {
        registeredPage = page
      },
      registerNavigation: (item: typeof registeredNav) => {
        registeredNav = item
      },
    },
  })
  const controller = new AbortController()
  const mountResult = registeredPage!.mount(container, { signal: controller.signal })
  const dispatchToWrapper = (data: unknown, ports: unknown[] = []) => {
    for (const l of [...windowListeners]) l({ data, source: contentWindow, ports })
  }
  const fireLoad = () => {
    for (const l of [...loadListeners]) l()
  }
  const emitHostEvent = (event: unknown) => {
    for (const h of [...hostEvents]) h.handler(event)
  }
  const restore = () => {
    g.addEventListener = originalAdd
    g.removeEventListener = originalRemove
  }
  return { windowListeners, postMessagesToFrame, iframe, container, requests, dispatchToWrapper, fireLoad, emitHostEvent, controller, mountResult, registeredPage, registeredNav, hostEvents, restore, pluginId: capturedPlugin!.id }
}

function framePortAt(h: ReturnType<typeof setup>, index: number) {
  return h.postMessagesToFrame[index].transfer![0] as { postMessage(m: unknown): void; onmessage: ((ev: { data: unknown }) => void) | null }
}

function waitForPortMessage(port: { onmessage: ((ev: { data: unknown }) => void) | null }): Promise<any> {
  return new Promise((resolve) => {
    port.onmessage = (ev) => {
      port.onmessage = null
      resolve(ev.data)
    }
  })
}

test("loader contract: plugin id, label, navigation, and dispose-shaped mount result", () => {
  const h = setup()
  try {
    assert.equal(h.pluginId, GSD_EMBED_PLUGIN_ID)
    assert.equal(h.pluginId, "open-gsd-openclaw")
    assert.equal(h.registeredPage!.label, "GSD")
    assert.equal(h.registeredPage!.id, "gsd")
    assert.equal(h.registeredNav!.label, "GSD")
    assert.equal(typeof (h.mountResult as { dispose?: () => void }).dispose, "function")
    ;(h.mountResult as { dispose: () => void }).dispose()
    assert.equal(h.iframe.removed, 1)
    assert.equal(h.windowListeners.length, 0)
  } finally {
    h.restore()
  }
})

test("bind, request roundtrip, refusal, and host-event forwarding over one channel", async () => {
  const h = setup()
  try {
    h.fireLoad()
    h.dispatchToWrapper({ protocol: GSD_EMBED_PROTOCOL, type: GSD_EMBED_READY_TYPE })
    assert.equal(h.postMessagesToFrame.length, 1)
    const port = framePortAt(h, 0)
    const reply = waitForPortMessage(port)
    port.postMessage({ protocol: GSD_EMBED_PROTOCOL, type: GSD_EMBED_REQUEST_TYPE, generation: 1, requestId: "r1", operation: "preferences.read", args: {} })
    const response = await reply
    assert.equal(response.type, GSD_EMBED_RESPONSE_TYPE)
    assert.equal(response.ok, true)
    assert.deepEqual(response.result, { answered: "gsd.ui.preferences.read" })
    const refusal = waitForPortMessage(port)
    port.postMessage({ protocol: GSD_EMBED_PROTOCOL, type: GSD_EMBED_REQUEST_TYPE, generation: 1, requestId: "r2", operation: "evil.op", args: {} })
    const refused = await refusal
    assert.equal(refused.ok, false)
    assert.match(refused.error, /not allowed/)
    assert.equal(h.requests.length, 1)
    const eventReceived = waitForPortMessage(port)
    h.emitHostEvent({ type: GSD_UI_HOST_EVENT_NAME, subscriptionId: "s1", seq: 1, event: { kind: "tick" } })
    const forwarded = await eventReceived
    assert.equal(forwarded.type, GSD_EMBED_EVENT_TYPE)
    assert.equal(forwarded.subscriptionId, "s1")
    assert.equal(forwarded.seq, 1)
    assert.deepEqual(forwarded.event, { kind: "tick" })
    h.emitHostEvent({ type: "unrelated.event", subscriptionId: "s1", seq: 2, event: { kind: "nope" } })
    await new Promise((r) => setTimeout(r, 10))
  } finally {
    ;(h.mountResult as { dispose: () => void }).dispose()
    h.restore()
  }
})

test("reload lifecycle: second load retires, new ready rebinds, exactly one channel; first load never closes", async () => {
  const h = setup()
  try {
    // First load happens BEFORE any bind: must not disturb anything.
    h.fireLoad()
    h.dispatchToWrapper({ protocol: GSD_EMBED_PROTOCOL, type: GSD_EMBED_READY_TYPE })
    const port1 = framePortAt(h, 0)
    let port1Heard = false
    port1Heard = false
    port1.onmessage = () => {
      port1Heard = true
    }
    // Reload: load after bind retires the channel.
    h.fireLoad()
    port1.postMessage({ protocol: GSD_EMBED_PROTOCOL, type: GSD_EMBED_REQUEST_TYPE, generation: 1, requestId: "stale", operation: "preferences.read" })
    await new Promise((r) => setTimeout(r, 10))
    assert.equal(port1Heard, false, "retired channel must not respond")
    assert.equal(h.requests.length, 0)
    // New document: fresh ready ping rebinds with generation 2.
    h.dispatchToWrapper({ protocol: GSD_EMBED_PROTOCOL, type: GSD_EMBED_READY_TYPE })
    assert.equal(h.postMessagesToFrame.length, 2)
    const port2 = framePortAt(h, 1)
    assert.equal((h.postMessagesToFrame[1].data as { generation: number }).generation, 2)
    const reply = waitForPortMessage(port2)
    port2.postMessage({ protocol: GSD_EMBED_PROTOCOL, type: GSD_EMBED_REQUEST_TYPE, generation: 2, requestId: "r3", operation: "preferences.read" })
    const response = await reply
    assert.equal(response.ok, true)
    assert.equal(h.requests.length, 1)
    // Stale generation requests on the new port are ignored.
    port2.postMessage({ protocol: GSD_EMBED_PROTOCOL, type: GSD_EMBED_REQUEST_TYPE, generation: 1, requestId: "stale2", operation: "preferences.read" })
    await new Promise((r) => setTimeout(r, 10))
    assert.equal(h.requests.length, 1)
  } finally {
    ;(h.mountResult as { dispose: () => void }).dispose()
    h.restore()
  }
})

test("dispose unsubscribes host events and closes the channel", async () => {
  const h = setup()
  try {
    h.dispatchToWrapper({ protocol: GSD_EMBED_PROTOCOL, type: GSD_EMBED_READY_TYPE })
    assert.equal(h.hostEvents.length, 1)
    ;(h.mountResult as { dispose: () => void }).dispose()
    assert.equal(h.hostEvents.length, 0)
    assert.equal(h.iframe.removed, 1)
    assert.equal(h.windowListeners.length, 0)
  } finally {
    h.restore()
  }
})
