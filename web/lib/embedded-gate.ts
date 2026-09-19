/**
 * Embedded-mode integration gate for the Control UI plugin tab.
 *
 * In embedded mode the app never uses legacy boot/fetch/EventSource/beacon
 * paths directly: application requests map through an exact route-to-
 * operation table onto the gsd-ui/1 named-operation transport. Unknown
 * routes, methods, and negotiation failures all fail closed - there is NO
 * fallback to direct credentialed HTTP. Standalone behavior is untouched.
 */

import {
  detectEmbeddedChannel,
  negotiateEmbeddedTransport,
  EMBEDDED_MARKER_QUERY,
  type EmbeddedOperationClient,
  type FrameEventMessage,
} from "./embedded-transport.ts"

export type EmbeddedStartupState = "standalone" | "embedded-ready" | "embedded-unavailable"

let cachedTransport: EmbeddedOperationClient | null = null
let startupPromise: Promise<EmbeddedStartupState> | null = null

export function embeddedModeActive(): boolean {
  if (typeof window === "undefined") return false
  return detectEmbeddedChannel(window as never).embedded
}

/** Bounded startup: standalone resolves immediately; embedded negotiates once
 * and never falls back to direct HTTP. */
export function embeddedStartup(options?: {
  allowedOperations?: Iterable<string>
  negotiate?: (opts: { allowedOperations: Iterable<string> }) => Promise<EmbeddedOperationClient>
}): Promise<EmbeddedStartupState> {
  if (!embeddedModeActive()) return Promise.resolve("standalone")
  if (startupPromise) return startupPromise
  const allowed = options?.allowedOperations ?? []
  const negotiate = options?.negotiate ?? ((opts) => negotiateEmbeddedTransport({ ...opts, window: window as never }))
  startupPromise = negotiate({ allowedOperations: allowed })
    .then((client) => {
      cachedTransport = client
      return "embedded-ready" as const
    })
    .catch(() => "embedded-unavailable" as const)
  return startupPromise
}

export function getEmbeddedTransport(): EmbeddedOperationClient | null {
  return cachedTransport
}

/** Testing seam: reset the singleton. */
export function resetEmbeddedGate(): void {
  cachedTransport?.dispose()
  cachedTransport = null
  startupPromise = null
}

interface RouteMapping {
  method: string
  pattern: RegExp
  operation: string
  buildArgs: (url: URL, bodyText: string | null) => unknown
}

const ROUTE_MAP: RouteMapping[] = [
  {
    method: "GET",
    pattern: /^\/api\/preferences$/,
    operation: "preferences.read",
    buildArgs: () => ({}),
  },
  {
    method: "GET",
    pattern: /^\/api\/projects$/,
    operation: "projects.list",
    buildArgs: (url) => ({ root: url.searchParams.get("root"), detail: url.searchParams.get("detail") === "true" }),
  },
  {
    method: "GET",
    pattern: /^\/api\/browse-directories$/,
    operation: "directories.list",
    buildArgs: (url) => ({ root: url.searchParams.get("root"), path: url.searchParams.get("path") }),
  },
  {
    method: "POST",
    pattern: /^\/api\/switch-root$/,
    operation: "preferences.selectRoot",
    buildArgs: (_url, bodyText) => {
      try {
        return bodyText ? JSON.parse(bodyText) : {}
      } catch {
        return {}
      }
    },
  },
  {
    method: "DELETE",
    pattern: /^\/api\/files$/,
    operation: "files.delete",
    buildArgs: (url) => ({ root: url.searchParams.get("root"), path: url.searchParams.get("path") }),
  },
]

export function mapRouteToOperation(method: string, path: string, bodyText: string | null): { operation: string; args: unknown } | undefined {
  const url = new URL("http://embedded.invalid" + path)
  for (const mapping of ROUTE_MAP) {
    if (mapping.method !== method) continue
    if (!mapping.pattern.test(url.pathname)) continue
    return { operation: mapping.operation, args: mapping.buildArgs(url, bodyText) }
  }
  return undefined
}

function unavailableResponse(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), { status, headers: { "Content-Type": "application/json" } })
}

/** authFetch-compatible wrapper for embedded mode. Fails closed for unknown
 * routes/methods and for transport failures; never performs network IO. */
export async function embeddedApiFetch(path: string, init?: RequestInit): Promise<Response> {
  const transport = getEmbeddedTransport()
  if (!transport) return unavailableResponse("embedded transport unavailable", 503)
  const method = (init?.method ?? "GET").toUpperCase()
  const bodyText = typeof init?.body === "string" ? init.body : null
  const mapped = mapRouteToOperation(method, path, bodyText)
  if (!mapped) return unavailableResponse("embedded mode refuses unmapped route: " + method + " " + path, 501)
  try {
    const result = await transport.request(mapped.operation, mapped.args)
    return new Response(JSON.stringify(result ?? null), { status: 200, headers: { "Content-Type": "application/json" } })
  } catch (error) {
    return unavailableResponse(error instanceof Error ? error.message : "embedded operation failed", 502)
  }
}

/** Embedded pagehide must never send the shutdown beacon; the adapter closes
 * instead. */
export function shouldSuppressShutdownBeacon(): boolean {
  return embeddedModeActive()
}

export function embeddedShutdown(): void {
  resetEmbeddedGate()
}

/** EventSource-compatible adapter over subscription operations. */
export class EmbeddedEventSourceAdapter {
  onopen: (() => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  onerror: (() => void) | null = null
  private closed = false
  private subscriptionId: string | null = null
  private unsubscribeEvents: () => void

  constructor(transport: EmbeddedOperationClient, operation: string, args: unknown) {
    this.unsubscribeEvents = transport.onEvent((message: FrameEventMessage) => {
      if (this.closed) return
      if (this.subscriptionId !== null && message.subscriptionId !== this.subscriptionId) return
      if (message.event === undefined) return
      this.onmessage?.({ data: typeof message.event === "string" ? message.event : JSON.stringify(message.event) })
    })
    transport.request(operation, args).then(
      (result) => {
        if (this.closed) return
        this.subscriptionId = (result as { subscriptionId?: string } | null)?.subscriptionId ?? null
        this.onopen?.()
      },
      () => {
        if (!this.closed) this.onerror?.()
      },
    )
  }

  close(): void {
    if (this.closed) return
    this.closed = true
    this.unsubscribeEvents()
  }
}

const STREAM_MAP: Array<{ pattern: RegExp; operation: string; buildArgs: (url: URL) => unknown }> = [
  {
    pattern: /^\/api\/session\/events/,
    operation: "workspace.events.subscribe",
    buildArgs: (url) => ({ project: url.searchParams.get("project") }),
  },
  {
    pattern: /^\/api\/terminal\/stream/,
    operation: "terminal.output.subscribe",
    buildArgs: (url) => ({ terminalId: url.searchParams.get("id"), command: url.searchParams.get("command") }),
  },
]

export function embeddedEventSourceForUrl(url: string): EmbeddedEventSourceAdapter | undefined {
  const transport = getEmbeddedTransport()
  if (!transport) return undefined
  const path = url.split("?")[0]
  for (const mapping of STREAM_MAP) {
    if (!mapping.pattern.test(path)) continue
    return new EmbeddedEventSourceAdapter(transport, mapping.operation, mapping.buildArgs(new URL("http://embedded.invalid" + url)))
  }
  return undefined
}

export { EMBEDDED_MARKER_QUERY }
