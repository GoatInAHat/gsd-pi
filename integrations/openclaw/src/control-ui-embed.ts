/**
 * Trusted native Control UI wrapper for the embedded GSD frame.
 *
 * Owns one opaque sandbox=allow-scripts iframe whose src the frame never
 * supplies. When the frame announces readiness (data-free gsd-ui-ready ping
 * from the exact iframe contentWindow), the wrapper binds exactly one
 * MessageChannel and transfers one port to that window. Requests dispatch
 * ONLY allowlisted operations to individually registered gsd.ui.* Gateway
 * methods through the injected authenticated request function - host.request
 * stays private. Teardown on view abort closes the port, removes the listener
 * and the iframe; nothing outlives the mount.
 */

export const GSD_EMBED_PROTOCOL = "gsd-ui/1"
export const GSD_EMBED_BIND_TYPE = "gsd-ui-bind"
export const GSD_EMBED_READY_TYPE = "gsd-ui-ready"
export const GSD_EMBED_REQUEST_TYPE = "gsd-ui-request"
export const GSD_EMBED_RESPONSE_TYPE = "gsd-ui-response"

export interface EmbedFrameRequest {
  protocol: string
  type: string
  generation: number
  requestId: string
  operation: string
  args?: unknown
}

/** Minimal structural container type: the plugin compiles for a Node
 * target without DOM lib, while the wrapper executes in the browser. */
export interface EmbedContainerLike {
  ownerDocument?: unknown
  appendChild(child: unknown): void
}

export interface EmbedHostUi {
  registerPage(page: {
    id: string
    title?: string
    mount: (container: EmbedContainerLike, view: { signal: AbortSignal }) => void | (() => void)
  }): void
}

export interface EmbedHost {
  ui: EmbedHostUi
}

export interface EmbedDefinePlugin {
  (plugin: { id: string; activate: (host: EmbedHost) => void }): unknown
}

export interface GsdEmbedOptions {
  frameSrc: string
  request: (method: string, params: unknown) => Promise<unknown>
  allowedOperations: readonly string[]
  definePlugin: EmbedDefinePlugin
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
}

interface DocumentLike {
  createElement(tag: string): IframeLike
}

export function createGsdEmbedPlugin(options: GsdEmbedOptions): unknown {
  const allowed = new Set(options.allowedOperations)
  return options.definePlugin({
    id: "open-gsd-openclaw-embed",
    activate(host: EmbedHost) {
      host.ui.registerPage({
        id: "gsd",
        title: "GSD",
        mount(container: EmbedContainerLike, view: { signal: AbortSignal }) {
          const doc = (container.ownerDocument ?? (globalThis as { document?: DocumentLike }).document) as DocumentLike
          const iframe = doc.createElement("iframe")
          iframe.sandbox = "allow-scripts"
          iframe.src = options.frameSrc
          iframe.style.width = "100%"
          iframe.style.height = "100%"
          iframe.style.border = "none"
          ;(container as { appendChild(child: unknown): void }).appendChild(iframe)

          let bound = false
          let generation: number | null = null
          let port: PortLike | null = null

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

          const installRequestDispatch = (port1: PortLike) => {
            port1.onmessage = (ev) => {
              const message = ev.data as EmbedFrameRequest | undefined
              if (!message || message.protocol !== GSD_EMBED_PROTOCOL || message.type !== GSD_EMBED_REQUEST_TYPE) return
              if (typeof message.requestId !== "string" || typeof message.operation !== "string" || message.generation !== generation) return
              if (!allowed.has(message.operation)) {
                respond(message.requestId, false, undefined, "operation not allowed: " + message.operation)
                return
              }
              void options
                .request("gsd.ui." + message.operation, message.args ?? {})
                .then(
                  (result) => respond(message.requestId, true, result),
                  (error: unknown) => respond(message.requestId, false, undefined, error instanceof Error ? error.message : String(error)),
                )
            }
          }

          const windowListener = (event: MessageEvent) => {
            if (event.source !== (iframe.contentWindow as unknown)) return
            const data = event.data as { protocol?: string; type?: string } | undefined
            if (!data || data.protocol !== GSD_EMBED_PROTOCOL) return
            if (data.type === GSD_EMBED_READY_TYPE && !bound) {
              bound = true
              generation = 1
              const channel = new MessageChannel() as unknown as { port1: PortLike; port2: unknown }
              installRequestDispatch(channel.port1)
              port = channel.port1
              ;(iframe.contentWindow as ContentWindowLike).postMessage(
                { protocol: GSD_EMBED_PROTOCOL, type: GSD_EMBED_BIND_TYPE, generation: 1 },
                "*",
                [channel.port2],
              )
              return
            }
            // Any other frame-initiated bind attempt is rejected outright.
            if (data.type === GSD_EMBED_BIND_TYPE) {
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

          const teardown = () => {
            try {
              port?.close()
            } catch {
              // already closed
            }
            port = null
            bound = false
            generation = null
            ;(globalThis as unknown as { removeEventListener(t: string, l: unknown): void }).removeEventListener("message", windowListener)
            try {
              iframe.remove()
            } catch {
              // already removed
            }
          }
          view.signal.addEventListener("abort", teardown, { once: true })
          return teardown
        },
      })
    },
  })
}
