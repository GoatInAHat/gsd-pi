/**
 * gsd.ui.* Gateway RPC methods for the embedded Control UI frame.
 *
 * Vendor contracts: handlers take one options object and return void, with
 * results through respond(ok, payload, error?) using ErrorShape frames; event
 * delivery uses broadcastToConnIds(event, payload, ReadonlySet<connId>, opts?).
 * Admin admission is required by default (adminOnly: false opts out
 * explicitly). Subscriptions require an admitted approved project, use
 * non-starting daemon routes (require_existing), are byte-bounded while
 * reading, capped per connection, and fully released on unsubscribe, lease
 * expiry, connection retirement, or disposeAll - with liveness rechecked
 * before every emission and late replies dropped.
 */

import { realpathSync } from "node:fs"
import { isAbsolute, join, resolve, sep } from "node:path"

export interface ApprovedProject {
  projectId: string
  canonicalRoot: string
}

export interface EmbeddedProjectsConfig {
  adminOnly?: boolean
  projects?: ApprovedProject[]
}

export interface UiErrorShape {
  message: string
  code?: string
}

export interface UiClient {
  connId?: string
  connectionSignal?: AbortSignal
  invalidated?: boolean
  authenticatedUserProfile?: { profileId: string }
  internal?: { controlUiAdmin?: true }
}

export interface UiHandlerContext {
  broadcastToConnIds?: (
    event: string,
    payload: unknown,
    connIds: ReadonlySet<string>,
    opts?: unknown,
  ) => void
}

export interface UiHandlerOptions {
  params: Record<string, unknown>
  client: UiClient | null
  respond: (ok: boolean, payload?: unknown, error?: UiErrorShape, meta?: Record<string, unknown>) => void
  context: UiHandlerContext
  signal?: AbortSignal
}

export interface UiMethodApi {
  registerGatewayMethod: (
    method: string,
    handler: (opts: UiHandlerOptions) => Promise<void> | void,
    opts?: { scope?: string; profileAccess?: string },
  ) => void
}

const GSD_UI_BASE_PATH = "/plugins/open-gsd-openclaw/web"
const DAEMON_TIMEOUT_MS = 10_000
const DAEMON_MAX_BYTES = 1_048_576
const STREAM_LEASE_MS = 600_000
const MAX_SUBSCRIPTIONS_PER_CONNECTION = 16
const GSD_UI_EVENT = "gsd.ui.event"

function approvedProjects(config: EmbeddedProjectsConfig | undefined): ApprovedProject[] {
  return (config?.projects ?? []).filter(
    (p): p is ApprovedProject =>
      typeof p?.projectId === "string" && p.projectId.length > 0 && typeof p?.canonicalRoot === "string" && isAbsolute(p.canonicalRoot),
  )
}

export function canonicalRootIsCurrent(root: string): boolean {
  try {
    return realpathSync(root) === root
  } catch {
    return false
  }
}

export function containsCanonically(root: string, target: string): boolean {
  try {
    const realRoot = realpathSync(root)
    const realTarget = realpathSync(resolve(root, target))
    return realTarget === realRoot || realTarget.startsWith(realRoot + sep)
  } catch {
    return false
  }
}

function findApproved(config: EmbeddedProjectsConfig | undefined, key: { projectId?: string; root?: string }): ApprovedProject | undefined {
  return approvedProjects(config).find((p) =>
    key.projectId ? p.projectId === key.projectId : key.root ? p.canonicalRoot === key.root : false,
  )
}

export function registerGsdUiMethods(
  api: UiMethodApi,
  getWebHostPort: () => number | undefined,
  config?: EmbeddedProjectsConfig,
): { subscriptions: Map<string, { connId: string }>; disposeAll(): void } {
  const daemonBase = (): string | null => {
    const port = getWebHostPort()
    return typeof port === "number" ? `http://127.0.0.1:${port}${GSD_UI_BASE_PATH}` : null
  }

  const daemonFetch = async (route: string, init?: { method?: string; body?: string }): Promise<unknown> => {
    const base = daemonBase()
    if (!base) throw new Error("GSD web host unavailable")
    const res = await fetch(base + route, {
      method: init?.method ?? "GET",
      body: init?.body,
      headers: init?.body ? { "Content-Type": "application/json" } : undefined,
      redirect: "manual",
      signal: AbortSignal.timeout(DAEMON_TIMEOUT_MS),
    })
    if (!res.ok) throw new Error(`GSD route ${route} returned ${res.status}`)
    const text = await res.text()
    if (text.length > DAEMON_MAX_BYTES) throw new Error("GSD response exceeds size bound")
    const parsed = JSON.parse(text) as unknown
    if (typeof parsed !== "object" || parsed === null) throw new Error("GSD response is not a JSON object")
    return parsed
  }

  const paramString = (params: Record<string, unknown>, key: string): string | undefined => {
    const value = params[key]
    return typeof value === "string" && value.length > 0 ? value : undefined
  }

  // Admin admission is required by DEFAULT; only an explicit adminOnly:false
  // opts out. Identity is always the server-owned client, never params.
  const adminRequired = config?.adminOnly !== false
  const admissionDenied = (client: UiClient | null): string | null => {
    if (client?.invalidated) return "client invalidated"
    if (!adminRequired) return null
    if (client?.internal?.controlUiAdmin !== true) return "administrator admission required"
    return null
  }

  const requireApprovedProject = (
    params: Record<string, unknown>,
    client: UiClient | null,
  ): { project: ApprovedProject; denied: UiErrorShape | null } => {
    const denied = admissionDenied(client)
    if (denied) return { project: undefined as never, denied: { message: denied } }
    const projectId = paramString(params, "projectId")
    const root = paramString(params, "root") ?? paramString(params, "project")
    const project = findApproved(config, { projectId, root })
    if (!project) return { project: undefined as never, denied: { message: "no approved project matches" } }
    if (!canonicalRootIsCurrent(project.canonicalRoot)) {
      return { project: undefined as never, denied: { message: "approved root canonical identity changed" } }
    }
    return { project, denied: null }
  }

  const guard = (opts: UiHandlerOptions, run: () => unknown): Promise<void> =>
    (async () => {
      try {
        opts.respond(true, await run())
      } catch (error) {
        const thrown = error as { message?: unknown } | null
        const message = error instanceof Error
          ? error.message
          : typeof thrown?.message === "string"
            ? thrown.message
            : String(error)
        opts.respond(false, undefined, { message })
      }
    })() as Promise<void>

  api.registerGatewayMethod(
    "gsd.ui.preferences.read",
    (opts) => guard(opts, () => daemonFetch("/api/preferences")),
    { scope: "operator.read", profileAccess: "required" },
  )

  api.registerGatewayMethod(
    "gsd.ui.projects.list",
    (opts) =>
      guard(opts, async () => {
        const { project, denied } = requireApprovedProject(opts.params, opts.client)
        if (denied) throw denied
        const detail = opts.params.detail === true
        return daemonFetch(`/api/projects?root=${encodeURIComponent(project.canonicalRoot)}&detail=${detail ? "true" : "false"}`)
      }),
    { scope: "operator.read", profileAccess: "required" },
  )

  api.registerGatewayMethod(
    "gsd.ui.directories.list",
    (opts) =>
      guard(opts, async () => {
        const { project, denied } = requireApprovedProject(opts.params, opts.client)
        if (denied) throw denied
        const rawPath = paramString(opts.params, "path")
        // Daemon paths are absolute; normalize either form before containment.
        const target = rawPath ? (isAbsolute(rawPath) ? rawPath : join(project.canonicalRoot, rawPath)) : project.canonicalRoot
        if (!containsCanonically(project.canonicalRoot, target)) throw { message: "path escapes the approved root" }
        return daemonFetch(`/api/browse-directories?path=${encodeURIComponent(target)}`)
      }),
    { scope: "operator.read", profileAccess: "required" },
  )

  api.registerGatewayMethod(
    "gsd.ui.preferences.selectRoot",
    (opts) =>
      guard(opts, async () => {
        const devRoot = paramString(opts.params, "devRoot")
        if (!devRoot) throw { message: "missing devRoot" }
        const { project, denied } = requireApprovedProject({ root: devRoot }, opts.client)
        if (denied) throw denied
        return daemonFetch("/api/switch-root", { method: "POST", body: JSON.stringify({ devRoot: project.canonicalRoot }) })
      }),
    { scope: "operator.write", profileAccess: "required" },
  )

  api.registerGatewayMethod(
    "gsd.ui.files.delete",
    (opts) =>
      guard(opts, async () => {
        const { project, denied } = requireApprovedProject(opts.params, opts.client)
        if (denied) throw denied
        const path = paramString(opts.params, "path")
        if (!path) throw { message: "missing path" }
        if (!containsCanonically(project.canonicalRoot, path)) throw { message: "path escapes the approved root" }
        const relative = resolve(project.canonicalRoot, path).slice(project.canonicalRoot.length).replace(/^\//, "")
        return daemonFetch(
          `/api/files?root=project&path=${encodeURIComponent(relative)}&project=${encodeURIComponent(project.canonicalRoot)}`,
          { method: "DELETE" },
        )
      }),
    { scope: "operator.write", profileAccess: "required" },
  )

  interface SubscriptionRecord {
    connId: string
    controller: AbortController
    lease: ReturnType<typeof setTimeout>
    subscriptionId: string
    seq: number
    removeConnectionListener: () => void
  }
  const subscriptions = new Map<string, SubscriptionRecord>()

  const release = (subscriptionId: string, reason: string) => {
    const record = subscriptions.get(subscriptionId)
    if (!record) return
    subscriptions.delete(subscriptionId)
    clearTimeout(record.lease)
    record.removeConnectionListener()
    record.controller.abort()
  }

  const startSubscription = (opts: UiHandlerOptions, streamRoute: (project: ApprovedProject) => string): void => {
    const fail = (message: string) => {
      opts.respond(false, undefined, { message })
    }
    const connId = opts.client?.connId
    const connectionSignal = opts.client?.connectionSignal
    const broadcast = opts.context.broadcastToConnIds
    if (!connId || !connectionSignal || !broadcast) {
      fail("connection-targeted delivery unavailable")
      return
    }
    if (connectionSignal.aborted || opts.client?.invalidated) {
      fail("client connection already retired")
      return
    }
    const { project, denied } = requireApprovedProject(opts.params, opts.client)
    if (denied) {
      fail(denied.message)
      return
    }
    let perConnection = 0
    for (const record of subscriptions.values()) if (record.connId === connId) perConnection += 1
    if (perConnection >= MAX_SUBSCRIPTIONS_PER_CONNECTION) {
      fail("subscription cap reached for this connection")
      return
    }
    const route = streamRoute(project) + (streamRoute(project).includes("?") ? "&" : "?") + "require_existing=1"
    const subscriptionId = `sub-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`
    const onConnectionAbort = () => release(subscriptionId, "connection retired")
    const record: SubscriptionRecord = {
      connId,
      controller: new AbortController(),
      lease: setTimeout(() => release(subscriptionId, "lease expired"), STREAM_LEASE_MS),
      subscriptionId,
      seq: 0,
      removeConnectionListener: () => connectionSignal.removeEventListener("abort", onConnectionAbort),
    }
    subscriptions.set(subscriptionId, record)
    connectionSignal.addEventListener("abort", onConnectionAbort, { once: true })
    const emit = (payload: unknown): boolean => {
      // Liveness recheck before every emission.
      if (subscriptions.get(subscriptionId) !== record) return false
      if (connectionSignal.aborted) {
        release(subscriptionId, "connection retired")
        return false
      }
      broadcast(GSD_UI_EVENT, payload, new Set([connId]))
      return true
    }
    void (async () => {
      const base = daemonBase()
      if (!base) {
        release(subscriptionId, "daemon unavailable")
        fail("GSD web host unavailable")
        return
      }
      try {
        const res = await fetch(base + route, {
          redirect: "manual",
          signal: AbortSignal.any([record.controller.signal, AbortSignal.timeout(DAEMON_TIMEOUT_MS)]),
        })
        if (!res.ok || !res.body) {
          release(subscriptionId, `stream route returned ${res.status}`)
          if (res.status === 409) fail("workspace or terminal not started; start it first")
          else fail(`stream route returned ${res.status}`)
          return
        }
        if (subscriptions.get(subscriptionId) !== record) return // closed before reply
        opts.respond(true, { subscriptionId })
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ""
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          if (buffer.length > DAEMON_MAX_BYTES) {
            release(subscriptionId, "stream buffer exceeded size bound")
            return
          }
          let index: number
          while ((index = buffer.indexOf("\n\n")) >= 0) {
            const chunk = buffer.slice(0, index)
            buffer = buffer.slice(index + 2)
            const dataLine = chunk.split("\n").find((l) => l.startsWith("data:"))
            if (!dataLine) continue
            const payload = dataLine.slice(5).trim()
            if (!payload || payload.length > DAEMON_MAX_BYTES) continue
            let event: unknown
            try {
              event = JSON.parse(payload)
            } catch {
              event = payload
            }
            record.seq += 1
            if (!emit({ type: GSD_UI_EVENT, subscriptionId, seq: record.seq, event })) return
          }
        }
        release(subscriptionId, "stream ended")
      } catch {
        if (subscriptions.get(subscriptionId) === record) {
          release(subscriptionId, "stream failed")
        }
      }
    })()
  }

  api.registerGatewayMethod(
    "gsd.ui.workspace.events.subscribe",
    (opts) =>
      startSubscription(opts, (project) => `/api/session/events?project=${encodeURIComponent(project.canonicalRoot)}`),
    { scope: "operator.read", profileAccess: "required" },
  )

  api.registerGatewayMethod(
    "gsd.ui.terminal.output.subscribe",
    (opts) =>
      startSubscription(opts, (project) => {
        const terminalId = paramString(opts.params, "terminalId")
        if (!terminalId) throw { message: "missing terminalId" }
        return `/api/terminal/stream?id=${encodeURIComponent(terminalId)}`
      }),
    { scope: "operator.read", profileAccess: "required" },
  )

  for (const [method, scope] of [
    ["gsd.ui.workspace.events.unsubscribe", "operator.write"],
    ["gsd.ui.terminal.output.unsubscribe", "operator.write"],
  ] as const) {
    api.registerGatewayMethod(
      method,
      (opts) =>
        guard(opts, () => {
          const subscriptionId = paramString(opts.params, "subscriptionId")
          if (!subscriptionId) throw { message: "missing subscriptionId" }
          const record = subscriptions.get(subscriptionId)
          if (!record || record.connId !== opts.client?.connId) throw { message: "unknown subscription for this connection" }
          release(subscriptionId, "unsubscribed")
          return { released: subscriptionId }
        }),
      { scope, profileAccess: "required" },
    )
  }

  return {
    subscriptions,
    disposeAll() {
      for (const id of [...subscriptions.keys()]) release(id, "plugin disposal")
    },
  }
}
