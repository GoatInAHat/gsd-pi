/**
 * Trusted native Control UI wrapper for the embedded GSD frame.
 *
 * Default export carries the exact plugin id the native loader matches for
 * open-gsd-openclaw. The page uses the required label and returns {dispose}
 * from mount. Document-generation lifecycle: each iframe load after the
 * first retires the active channel; a fresh ready ping binds a new
 * generation - the first-load race never closes a channel because nothing
 * is bound before the first ready ping. Host events are forwarded to the
 * bound port ONLY (exact-recipient, no broadcast), as gsd-ui-event messages.
 * host.request stays private: allowlisted operations dispatch to
 * individually registered gsd.ui.* methods.
 */

export const GSD_EMBED_PLUGIN_ID = "open-gsd-openclaw"
export const GSD_EMBED_PROTOCOL = "gsd-ui/1"
export const GSD_EMBED_BIND_TYPE = "gsd-ui-bind"
export const GSD_EMBED_READY_TYPE = "gsd-ui-ready"
export const GSD_EMBED_REQUEST_TYPE = "gsd-ui-request"
export const GSD_EMBED_RESPONSE_TYPE = "gsd-ui-response"
export const GSD_EMBED_EVENT_TYPE = "gsd-ui-event"
export const GSD_UI_HOST_EVENT_NAME = "gsd.ui.event"

export interface EmbedFrameRequest {
  protocol: string
  type: string
  generation: number
  requestId: string
  operation: string
  args?: unknown
}

export interface EmbedContainerLike {
  ownerDocument?: unknown
  appendChild(child: unknown): void
}

export interface EmbedControlUiViewContext {
  signal: AbortSignal
}

export interface EmbedHostRequest {
  (method: string, params: unknown): Promise<unknown>
}

export interface EmbedHostOnEvent {
  (eventName: string, handler: (event: unknown) => void): () => void
}

export interface EmbedHostUi {
  registerPage(page: {
    id: string
    label: string
    mount: (
      container: EmbedContainerLike,
      context: EmbedControlUiViewContext,
    ) => { dispose?: () => void } | void
  }): void
  registerNavigation?: (item: { id: string; label: string; page: { id: string } }) => void
}

export interface EmbedHost {
  ui: EmbedHostUi
  request?: EmbedHostRequest
  onEvent?: EmbedHostOnEvent
}

export interface EmbedDefinePlugin {
  (plugin: { id: string; activate: (host: EmbedHost) => void }): unknown
}

export interface GsdEmbedOptions {
  frameSrc: string
  request: EmbedHostRequest
  allowedOperations: readonly string[]
  definePlugin: EmbedDefinePlugin
  onEvent?: EmbedHostOnEvent
}

interface PortLike {
  onmessage: ((ev: { data: unknown }) => void) | null
  postMessage(message: unknown): void
  close(): void
}

interface ContentWindowLike {
  postMessage(message: unknown, origin: string, transfer?: unknown[]): void
}

interface IframeLike {
  contentWindow: ContentWindowLike | null
  src: string
  sandbox: string
  style: Record<string, string>
  remove(): void
  addEventListener?(type: string, listener: () => void): void
}

interface DocumentLike {
  createElement(tag: string): IframeLike
}

export const EMBED_ALLOWED_OPERATIONS: readonly string[] = [
  "preferences.read",
  "projects.list",
  "directories.list",
  "preferences.selectRoot",
  "files.delete",
  "workspace.events.subscribe",
  "workspace.events.unsubscribe",
  "terminal.output.subscribe",
  "terminal.output.unsubscribe",
]

export function createGsdEmbedPlugin(options: GsdEmbedOptions): unknown {
  const allowed = new Set(options.allowedOperations)
  return options.definePlugin({
    id: GSD_EMBED_PLUGIN_ID,
    activate(host: EmbedHost) {
      const page = {
        id: "gsd",
        label: "GSD",
        mount: (container: EmbedContainerLike, context: EmbedControlUiViewContext) => {
          const doc = (container.ownerDocument ?? (globalThis as { document?: DocumentLike }).document) as DocumentLike
          const iframe = doc.createElement("iframe")
          iframe.sandbox = "allow-scripts"
          iframe.src = options.frameSrc
          iframe.style.width = "100%"
          iframe.style.height = "100%"
          iframe.style.border = "none"
          ;(container as { appendChild(child: unknown): void }).appendChild(iframe)

          let bound = false
          let generation = 0
          let port: PortLike | null = null
          let loadCount = 0
          let disposed = false

          const respond = (requestId: string, ok: boolean, payload: unknown, error?: string) => {
            port?.postMessage({
              protocol: GSD_EMBED_PROTOCOL,
              type: GSD_EMBED_RESPONSE_TYPE,
              generation,
              requestId,
              ok,
              ...(ok ? { result: payload } : { error }),
            })
          }

          const forwardHostEvent = (event: unknown) => {
            if (!port || !bound) return
            const data = event as { type?: string; subscriptionId?: unknown; seq?: unknown; event?: unknown; closed?: unknown; reason?: unknown } | undefined
            if (!data || data.type !== GSD_UI_HOST_EVENT_NAME) return
            if (typeof data.subscriptionId !== "string") return
            port.postMessage({
              protocol: GSD_EMBED_PROTOCOL,
              type: GSD_EMBED_EVENT_TYPE,
              generation,
              subscriptionId: data.subscriptionId,
              ...(typeof data.seq === "number" ? { seq: data.seq } : { seq: 0 }),
              ...(data.event !== undefined ? { event: data.event } : {}),
              ...(data.closed === true ? { closed: true, reason: typeof data.reason === "string" ? data.reason : "closed" } : {}),
            })
          }

          const retireChannel = () => {
            try {
              port?.close()
            } catch {
              // already closed
            }
            port = null
            bound = false
          }

          const bindChannel = () => {
            retireChannel()
            generation += 1
            const channel = new MessageChannel() as unknown as { port1: PortLike; port2: unknown }
            const localGeneration = generation
            channel.port1.onmessage = (ev) => {
              const message = ev.data as EmbedFrameRequest | undefined
              if (!message || message.protocol !== GSD_EMBED_PROTOCOL || message.type !== GSD_EMBED_REQUEST_TYPE) return
              if (typeof message.requestId !== "string" || typeof message.operation !== "string" || message.generation !== localGeneration) return
              if (!allowed.has(message.operation)) {
                respond(message.requestId, false, undefined, "operation not allowed: " + message.operation)
                return
              }
              void options
                .request("gsd.ui." + message.operation, message.args ?? {})
                .then(
                  (result) => {
                    if (generation === localGeneration) respond(message.requestId, true, result)
                  },
                  (error: unknown) => {
                    if (generation === localGeneration) respond(message.requestId, false, undefined, error instanceof Error ? error.message : String(error))
                  },
                )
            }
            port = channel.port1
            bound = true
            ;(iframe.contentWindow as ContentWindowLike | null)?.postMessage(
              { protocol: GSD_EMBED_PROTOCOL, type: GSD_EMBED_BIND_TYPE, generation },
              "*",
              [channel.port2],
            )
          }

          const windowListener = (event: MessageEvent) => {
            if (event.source !== (iframe.contentWindow as unknown)) return
            const data = event.data as { protocol?: string; type?: string } | undefined
            if (!data || data.protocol !== GSD_EMBED_PROTOCOL) return
            if (data.type === GSD_EMBED_READY_TYPE) {
              // A ready ping always (re)binds: initial bind, or rebind after a
              // document reload retired the previous channel.
              bindChannel()
              return
            }
            if (data.type === GSD_EMBED_BIND_TYPE) {
              // Frame-initiated bind attempts are rejected: close transferred ports.
              const ports = (event as unknown as { ports?: unknown[] }).ports
              if (Array.isArray(ports)) {
                for (const candidate of ports) {
                  try {
                    ;(candidate as { close(): void }).close()
                  } catch {
                    // already closed
                  }
                }
              }
            }
          }

          ;(globalThis as unknown as { addEventListener(t: string, l: unknown): void }).addEventListener("message", windowListener)

          // Document-generation lifecycle: a load event after the first one
          // means the document was replaced (reload/navigation) - retire the
          // channel and wait for the new document's ready ping. The FIRST load
          // fires before any bind exists, so it never closes a channel.
          iframe.addEventListener?.("load", () => {
            loadCount += 1
            if (loadCount > 1 && !disposed) retireChannel()
          })

          const unsubscribeHostEvents = options.onEvent
            ? options.onEvent(GSD_UI_HOST_EVENT_NAME, forwardHostEvent)
            : undefined

          const teardown = () => {
            if (disposed) return
            disposed = true
            retireChannel()
            unsubscribeHostEvents?.()
            ;(globalThis as unknown as { removeEventListener(t: string, l: unknown): void }).removeEventListener("message", windowListener)
            try {
              iframe.remove()
            } catch {
              // already removed
            }
          }
          context.signal.addEventListener("abort", teardown, { once: true })
          return { dispose: teardown }
        },
      }
      host.ui.registerPage(page)
      host.ui.registerNavigation?.({ id: "gsd", label: "GSD", page: { id: "gsd" } })
    },
  })
}
