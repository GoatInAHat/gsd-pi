/**
 * Child-side embedded operation transport for the Control UI plugin tab.
 *
 * The GSD web app runs in an opaque sandboxed iframe when embedded. In that
 * mode it cannot make credentialed cross-origin requests, so operations run
 * through a tokenless, frame-lifetime-bound postMessage channel to a trusted
 * parent adapter that performs authenticated, allowlisted server calls.
 *
 * Binding: responses are accepted ONLY from the exact parent window
 * (event.source identity), plus the configured parent origin when known.
 * The per-mount nonce is request-response correlation and replay resistance
 * within that binding - it is NOT itself a security boundary. Requests are
 * bounded by a timeout and a pending cap so an absent or lost parent cannot
 * strand promises or grow the pending map. The transport never handles
 * tokens, cookies, or URLs.
 */

export const EMBEDDED_REQUEST_MESSAGE = "openclaw-gsd-embedded-request"
export const EMBEDDED_RESPONSE_MESSAGE = "openclaw-gsd-embedded-response"
export const CHANNEL_NONCE_QUERY = "__gsd_channel"

export const DEFAULT_REQUEST_TIMEOUT_MS = 20_000
export const DEFAULT_MAX_PENDING = 64

export interface EmbeddedTransportWindow {
  addEventListener(type: string, listener: (event: MessageEvent) => void): void
  removeEventListener(type: string, listener: (event: MessageEvent) => void): void
  parent: unknown
  postMessage(message: unknown, targetOrigin: string): void
}

export interface EmbeddedChannelInit {
  embedded: boolean
  nonce?: string
}

/** Strict embedded detection: an opaque origin alone is not enough - a
 * top-level opaque document (file or about pages) also reports origin null.
 * Embedded mode requires a distinct parent window AND a valid channel
 * nonce from the mount-time init. */
export function detectEmbeddedChannel(win?: EmbeddedTransportWindow & { location?: { search?: string } }): EmbeddedChannelInit {
  const w = win ?? (typeof window !== "undefined" ? (window as unknown as EmbeddedTransportWindow & { location?: { search?: string } }) : undefined)
  if (!w) return { embedded: false }
  try {
    if ((w as { origin?: string }).origin !== "null") return { embedded: false }
    if (w.parent === (w as unknown)) return { embedded: false }
    const nonce = readChannelNonce(w)
    return nonce ? { embedded: true, nonce } : { embedded: false }
  } catch {
    return { embedded: false }
  }
}

export function isEmbeddedMode(win?: EmbeddedTransportWindow): boolean {
  return detectEmbeddedChannel(win).embedded
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

interface PendingEntry {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

export function createEmbeddedOperationClient(options: {
  window?: EmbeddedTransportWindow
  allowedOperations: Iterable<string>
  nonce: string
  targetOrigin?: string
  expectedParentOrigin?: string
  timeoutMs?: number
  maxPending?: number
}): EmbeddedOperationClient {
  if (!/^[a-zA-Z0-9_-]{16,128}$/.test(options.nonce)) {
    throw new Error("invalid embedded channel nonce")
  }
  const allowed = new Set(options.allowedOperations)
  const timeoutMs = options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS
  const maxPending = options.maxPending ?? DEFAULT_MAX_PENDING
  // Opaque-origin frames cannot know the parent origin, so "*" is the only
  // usable request target; response acceptance is bound to the exact parent
  // window source below, never to the nonce alone.
  const targetOrigin = options.targetOrigin ?? "*"
  const w = options.window ?? (window as unknown as EmbeddedTransportWindow)
  const postToParent = (message: unknown) => {
    ;(w.parent as { postMessage(message: unknown, origin: string): void }).postMessage(message, targetOrigin)
  }
  const pending = new Map<number, PendingEntry>()
  let nextId = 1
  let disposed = false
  const settle = (id: number, entry: PendingEntry, run: (entry: PendingEntry) => void) => {
    clearTimeout(entry.timer)
    if (pending.get(id) !== entry) return
    pending.delete(id)
    run(entry)
  }
  const listener = (event: MessageEvent) => {
    if (event.source !== w.parent) return
    if (options.expectedParentOrigin && event.origin !== options.expectedParentOrigin) return
    const data = event.data as EmbeddedOperationResponse | undefined
    if (!data || data.nonce !== options.nonce || data.type !== EMBEDDED_RESPONSE_MESSAGE) return
    const entry = pending.get(data.id)
    if (!entry) return
    if (data.ok) settle(data.id, entry, (e) => e.resolve(data.result))
    else settle(data.id, entry, (e) => e.reject(new Error(data.error ?? "embedded operation failed")))
  }
  w.addEventListener("message", listener)
  return {
    request(name: string, args?: unknown): Promise<unknown> {
      if (disposed) return Promise.reject(new Error("embedded transport disposed"))
      if (!allowed.has(name)) return Promise.reject(new Error("embedded operation not allowed: " + name))
      if (pending.size >= maxPending) return Promise.reject(new Error("embedded transport pending cap reached"))
      const id = nextId++
      return new Promise((resolve, reject) => {
        const entry: PendingEntry = {
          resolve,
          reject,
          timer: setTimeout(() => {
            settle(id, entry, (e) => e.reject(new Error("embedded operation timed out")))
          }, timeoutMs),
        }
        pending.set(id, entry)
        try {
          postToParent({ type: EMBEDDED_REQUEST_MESSAGE, id, nonce: options.nonce, name, args })
        } catch (error) {
          settle(id, entry, (e) => e.reject(error instanceof Error ? error : new Error(String(error))))
        }
      })
    },
    dispose() {
      if (disposed) return
      disposed = true
      w.removeEventListener("message", listener)
      for (const [id, entry] of pending) {
        settle(id, entry, (e) => e.reject(new Error("embedded transport disposed")))
      }
      pending.clear()
    },
  }
}
