/**
 * gsd.ui.* Gateway RPC methods for the embedded Control UI frame.
 *
 * Real vendor contract: each handler receives ONE options object
 * ({params, client, respond, context, signal, ...}) and returns void - all
 * results flow through respond(ok, payload). Identity is server-owned:
 * adminOnly requires client.internal.controlUiAdmin, never wire params.
 * Approved-project policy: default empty deny; canonicalRoot must still BE
 * canonical (realpath equal to itself) at operation time, defeating symlink
 * root replacement. Daemon calls carry timeout, size, and schema bounds.
 * Subscriptions stream daemon SSE to the exact calling connection via
 * context.broadcastToConnIds with connection-bound lifetime and lease.
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

export interface UiClient {
  connId?: string
  connectionSignal?: AbortSignal
  invalidated?: boolean
  authenticatedUserProfile?: { profileId: string }
  internal?: { controlUiAdmin?: true }
}

export interface UiHandlerContext {
  broadcastToConnIds?: (connIds: string[], event: unknown) => void
}

export interface UiHandlerOptions {
  params: Record<string, unknown>
  client: UiClient | null
  respond: (ok: boolean, payload: unknown) => void
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

function approvedProjects(config: EmbeddedProjectsConfig | undefined): ApprovedProject[] {
  return (config?.projects ?? []).filter(
    (p): p is ApprovedProject =>
      typeof p?.projectId === "string" && p.projectId.length > 0 && typeof p?.canonicalRoot === "string" && isAbsolute(p.canonicalRoot),
  )
}

/** An approved root only stays authoritative while it IS the canonical path:
 * realpath must equal the configured value, so replacing the root with a
 * symlink to elsewhere shifts identity and denies. */
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

interface DaemonCaller {
  (route: string, init?: { method?: string; body?: string }): Promise<unknown>
}

function makeDaemonFetcher(getWebHostPort: () => number | undefined): { daemonFetch: DaemonCaller; daemonBase: () => string | null } {
  const daemonBase = (): string | null => {
    const port = getWebHostPort()
    return typeof port === "number" ? `http://127.0.0.1:${port}${GSD_UI_BASE_PATH}` : null
  }
  const daemonFetch: DaemonCaller = async (route, init) => {
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
  return { daemonFetch, daemonBase }
}

function paramString(params: Record<string, unknown>, key: string): string | undefined {
  const value = params[key]
  return typeof value === "string" && value.length > 0 ? value : undefined
}

interface SubscriptionRecord {
  connId: string
  controller: AbortController
  lease: ReturnType<typeof setTimeout>
  subscriptionId: string
  seq: number
}

export interface GsdUiMethodHandles {
  subscriptions: Map<string, SubscriptionRecord>
  disposeAll(): void
}

export function registerGsdUiMethods(
  api: UiMethodApi,
  getWebHostPort: () => number | undefined,
  config?: EmbeddedProjectsConfig,
): GsdUiMethodHandles {
  const { daemonFetch, daemonBase } = makeDaemonFetcher(getWebHostPort)
  const subscriptions = new Map<string, SubscriptionRecord>()

  const requireAdmin = (client: UiClient | null): string | null => {
    if (!config?.adminOnly) return null
    if (client?.invalidated) return "client invalidated"
    if (client?.internal?.controlUiAdmin !== true) return "administrator admission required"
    return null
  }

  const requireApprovedProject = (params: Record<string, unknown>, client: UiClient | null): { project: ApprovedProject; denied: string | null } => {
    const adminDenial = requireAdmin(client)
    if (adminDenial) return { project: undefined as never, denied: adminDenial }
    const projectId = paramString(params, "projectId")
    const root = paramString(params, "root")
    const project = findApproved(config, { projectId, root })
    if (!project) return { project: undefined as never, denied: "no approved project matches" }
    if (!canonicalRootIsCurrent(project.canonicalRoot)) return { project: undefined as never, denied: "approved root canonical identity changed" }
    return { project, denied: null }
  }

  const guard = async (
    opts: UiHandlerOptions,
    run: () => unknown,
  ): Promise<void> => {
    try {
      opts.respond(true, await run())
    } catch (error) {
      opts.respond(false, { error: error instanceof Error ? error.message : String(error) })
    }
  }

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
        if (denied) throw new Error(denied)
        const detail = opts.params.detail === true
        return daemonFetch(`/api/projects?root=${encodeURIComponent(project.canonicalRoot)}&detail=${detail ? "true" : "false"}`)
      }),
    { scope: "operator.read", profileAccess: "required" },
  )

  // The daemon browse endpoint reads ONLY path (root is ignored there), so
  // containment is pinned here: no path defaults to the approved root itself;
  // any path resolves within it and must stay canonically contained.
  api.registerGatewayMethod(
    "gsd.ui.directories.list",
    (opts) =>
      guard(opts, async () => {
        const { project, denied } = requireApprovedProject(opts.params, opts.client)
        if (denied) throw new Error(denied)
        const rawPath = paramString(opts.params, "path")
        const target = rawPath ? join(project.canonicalRoot, rawPath) : project.canonicalRoot
        if (!containsCanonically(project.canonicalRoot, target)) throw new Error("path escapes the approved root")
        return daemonFetch(`/api/browse-directories?path=${encodeURIComponent(target)}`)
      }),
    { scope: "operator.read", profileAccess: "required" },
  )

  api.registerGatewayMethod(
    "gsd.ui.preferences.selectRoot",
    (opts) =>
      guard(opts, async () => {
        const devRoot = paramString(opts.params, "devRoot")
        if (!devRoot) throw new Error("missing devRoot")
        const { project, denied } = requireApprovedProject({ root: devRoot }, opts.client)
        if (denied) throw new Error(denied)
        return daemonFetch("/api/switch-root", { method: "POST", body: JSON.stringify({ devRoot: project.canonicalRoot }) })
      }),
    { scope: "operator.write", profileAccess: "required" },
  )

  // The daemon DELETE takes root=gsd|project plus ?project= selection - never
  // an absolute root. Translate from the authorized project handle.
  api.registerGatewayMethod(
    "gsd.ui.files.delete",
    (opts) =>
      guard(opts, async () => {
        const { project, denied } = requireApprovedProject(opts.params, opts.client)
        if (denied) throw new Error(denied)
        const path = paramString(opts.params, "path")
        if (!path) throw new Error("missing path")
        if (!containsCanonically(project.canonicalRoot, path)) throw new Error("path escapes the approved root")
        const relative = resolve(project.canonicalRoot, path).slice(project.canonicalRoot.length).replace(/^\//, "")
        return daemonFetch(
          `/api/files?root=project&path=${encodeURIComponent(relative)}&project=${encodeURIComponent(project.canonicalRoot)}`,
          { method: "DELETE" },
        )
      }),
    { scope: "operator.write", profileAccess: "required" },
  )

  const startSubscription = (
    opts: UiHandlerOptions,
    streamRoute: (params: Record<string, unknown>) => string,
  ): void => {
    const connId = opts.client?.connId
    const connectionSignal = opts.client?.connectionSignal
    if (!connId || !connectionSignal || !opts.context.broadcastToConnIds) {
      opts.respond(false, { error: "connection-targeted delivery unavailable" })
      return
    }
    const adminDenial = requireAdmin(opts.client)
    if (adminDenial) {
      opts.respond(false, { error: adminDenial })
      return
    }
    const route = streamRoute(opts.params)
    const subscriptionId = `sub-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`
    const record: SubscriptionRecord = {
      connId,
      controller: new AbortController(),
      lease: setTimeout(() => release(subscriptionId, "lease expired"), STREAM_LEASE_MS),
      subscriptionId,
      seq: 0,
    }
    subscriptions.set(subscriptionId, record)
    const onConnectionAbort = () => release(subscriptionId, "connection retired")
    connectionSignal.addEventListener("abort", onConnectionAbort, { once: true })
    const release = (id: string, reason: string) => {
      const rec = subscriptions.get(id)
      if (!rec) return
      subscriptions.delete(id)
      clearTimeout(rec.lease)
      connectionSignal.removeEventListener("abort", onConnectionAbort)
      rec.controller.abort()
      try {
        opts.context.broadcastToConnIds?.([rec.connId], { type: "gsd.ui.event", subscriptionId: id, closed: true, reason })
      } catch {
        // connection already gone
      }
    }
    void (async () => {
      const base = daemonBase()
      if (!base) {
        release(subscriptionId, "daemon unavailable")
        return
      }
      try {
        const composed = AbortSignal.any?.([record.controller.signal]) ?? record.controller.signal
        const res = await fetch(base + route, { redirect: "manual", signal: composed })
        if (!res.ok || !res.body) throw new Error(`stream route returned ${res.status}`)
        opts.respond(true, { subscriptionId })
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ""
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
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
            try {
              opts.context.broadcastToConnIds?.([record.connId], {
                type: "gsd.ui.event",
                subscriptionId,
                seq: record.seq,
                event,
              })
            } catch {
              release(subscriptionId, "delivery failed")
              return
            }
          }
        }
        release(subscriptionId, "stream ended")
      } catch {
        release(subscriptionId, "stream failed")
      }
    })()
  }

  api.registerGatewayMethod(
    "gsd.ui.workspace.events.subscribe",
    (opts) =>
      startSubscription(opts, (params) => {
        const project = paramString(params, "project")
        return `/api/session/events${project ? `?project=${encodeURIComponent(project)}` : ""}`
      }),
    { scope: "operator.read", profileAccess: "required" },
  )

  api.registerGatewayMethod(
    "gsd.ui.terminal.output.subscribe",
    (opts) =>
      startSubscription(opts, (params) => {
        const terminalId = paramString(params, "terminalId")
        if (!terminalId) throw new Error("missing terminalId")
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
          if (!subscriptionId) throw new Error("missing subscriptionId")
          const rec = subscriptions.get(subscriptionId)
          if (!rec || rec.connId !== opts.client?.connId) throw new Error("unknown subscription for this connection")
          rec.controller.abort()
          return { released: subscriptionId }
        }),
      { scope, profileAccess: "required" },
  )
  }

  return {
    subscriptions,
    disposeAll() {
      for (const id of [...subscriptions.keys()]) {
        const rec = subscriptions.get(id)
        if (!rec) continue
        subscriptions.delete(id)
        clearTimeout(rec.lease)
        rec.controller.abort()
      }
    },
  }
}
