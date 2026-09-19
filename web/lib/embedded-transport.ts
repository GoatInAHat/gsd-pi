/**
 * Child-side embedded operation transport for the Control UI plugin tab.
 *
 * The GSD web app runs in an opaque sandboxed iframe when embedded. In that
 * mode it cannot make credentialed cross-origin requests, so operations run
 * through a tokenless, frame-lifetime-bound postMessage channel to a trusted
 * parent adapter that performs authenticated, allowlisted server calls.
 *
 * Inert by design: only allowlisted operation names may be requested, every
 * message carries the per-mount channel nonce, and the transport never
 * handles tokens, cookies, or URLs.
 */

export const EMBEDDED_REQUEST_MESSAGE = "openclaw-gsd-embedded-request"
export const EMBEDDED_RESPONSE_MESSAGE = "openclaw-gsd-embedded-response"
export const CHANNEL_NONCE_QUERY = "__gsd_channel"

export interface EmbeddedTransportWindow {
  addEventListener(type: string, listener: (event: MessageEvent) => void): void
  removeEventListener(type: string, listener: (event: MessageEvent) => void): void
  parent: unknown
  postMessage(message: unknown, targetOrigin: string): void
}

export function isEmbeddedMode(win?: EmbeddedTransportWindow): boolean {
  const w = win ?? (typeof window !== "undefined" ? (window as unknown as EmbeddedTransportWindow) : undefined)
  if (!w) return false
  try {
    const origin = (w as { origin?: string }).origin
    return origin === "null"
  } catch {
    return false
  }
}

export function readChannelNonce(win?: EmbeddedTransportWindow & { location?: { search?: string } }): string | undefined {
  const w = win ?? (typeof window !== "undefined" ? (window as unknown as EmbeddedTransportWindow & { location?: { search?: string } }) : undefined)
  if (!w?.location?.search) return undefined
  try {
    const nonce = new URLSearchParams(w.location.search).get(CHANNEL_NONCE_QUERY)
    return nonce && /^[a-zA-Z0-9_-]{16,128}$/.test(nonce) ? nonce : undefined
  } catch {
    return undefined
  }
}

export interface EmbeddedOperationResponse {
  type: string
  id: number
  nonce: string
  ok: boolean
  result?: unknown
  error?: string
}

export interface EmbeddedOperationClient {
  request(name: string, args?: unknown): Promise<unknown>
  dispose(): void
}

export function createEmbeddedOperationClient(options: {
  window?: EmbeddedTransportWindow
  allowedOperations: Iterable<string>
  nonce: string
  targetOrigin?: string
}): EmbeddedOperationClient {
  const allowed = new Set(options.allowedOperations)
  // Opaque-origin frames cannot know the parent origin, so "*" is the only
  // usable target; the per-mount nonce is the channel secret that makes the
  // message inert for any other listener, and the parent adapter validates
  // event.source identity before acting.
  const targetOrigin = options.targetOrigin ?? "*"
  const w = options.window ?? (window as unknown as EmbeddedTransportWindow)
  const postToParent = (message: unknown) => {
    ;(w.parent as { postMessage(message: unknown, origin: string): void }).postMessage(message, targetOrigin)
  }
  const pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>()
  let nextId = 1
  let disposed = false
  const listener = (event: MessageEvent) => {
    const data = event.data as EmbeddedOperationResponse | undefined
    if (!data || data.nonce !== options.nonce || data.type !== EMBEDDED_RESPONSE_MESSAGE) return
    const entry = pending.get(data.id)
    if (!entry) return
    pending.delete(data.id)
    if (data.ok) entry.resolve(data.result)
    else entry.reject(new Error(data.error ?? "embedded operation failed"))
  }
  w.addEventListener("message", listener)
  return {
    request(name: string, args?: unknown): Promise<unknown> {
      if (disposed) return Promise.reject(new Error("embedded transport disposed"))
      if (!allowed.has(name)) return Promise.reject(new Error("embedded operation not allowed: " + name))
      const id = nextId++
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject })
        postToParent({ type: EMBEDDED_REQUEST_MESSAGE, id, nonce: options.nonce, name, args })
      })
    },
    dispose() {
      if (disposed) return
      disposed = true
      w.removeEventListener("message", listener)
      for (const entry of pending.values()) entry.reject(new Error("embedded transport disposed"))
      pending.clear()
    },
  }
}
