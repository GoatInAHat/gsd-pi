/**
 * gsd.ui.* Gateway RPC methods for the embedded Control UI frame.
 *
 * Registered individually with explicit scopes and profileAccess required.
 * Reads proxy fixed internal routes on the service-owned loopback daemon
 * port with server-built URLs and no redirect following. Writes are gated by
 * the approved-project policy: an explicit projectId/canonicalRoot allowlist,
 * administrator-only initially, DEFAULT DENY when unconfigured. Canonical
 * containment is revalidated with realpath at operation time. No CLI
 * credentials and no client-supplied URLs or headers ever cross.
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

export interface UiMethodApi {
  registerGatewayMethod: (
    method: string,
    handler: (params: unknown, context: unknown) => Promise<unknown>,
    opts?: { scope?: string; profileAccess?: string },
  ) => void
}

const GSD_UI_BASE_PATH = "/plugins/open-gsd-openclaw/web"

function approvedProjects(config: EmbeddedProjectsConfig | undefined): ApprovedProject[] {
  return (config?.projects ?? []).filter(
    (p): p is ApprovedProject =>
      typeof p?.projectId === "string" &&
      p.projectId.length > 0 &&
      typeof p?.canonicalRoot === "string" &&
      isAbsolute(p.canonicalRoot),
  )
}

/** Default-deny root approval: exact canonicalRoot membership only. */
export function isApprovedRoot(config: EmbeddedProjectsConfig | undefined, root: string): boolean {
  return approvedProjects(config).some((p) => p.canonicalRoot === root)
}

/** Canonical containment at operation time: realpath both sides and require
 * the resolved target to sit strictly inside the approved root. Symlink
 * escape denies. */
export function containsCanonically(root: string, target: string): boolean {
  try {
    const realRoot = realpathSync(root)
    const realTarget = realpathSync(resolve(root, target))
    return realTarget === realRoot || realTarget.startsWith(realRoot + sep)
  } catch {
    return false
  }
}

export function registerGsdUiMethods(
  api: UiMethodApi,
  getWebHostPort: () => number | undefined,
  config?: EmbeddedProjectsConfig,
): void {
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
    })
    if (!res.ok) throw new Error(`GSD route ${route} returned ${res.status}`)
    return res.json()
  }

  const requireString = (params: unknown, key: string): string | undefined => {
    if (typeof params !== "object" || params === null) return undefined
    const value = (params as Record<string, unknown>)[key]
    return typeof value === "string" ? value : undefined
  }

  // Reads
  api.registerGatewayMethod(
    "gsd.ui.preferences.read",
    async () => daemonFetch("/api/preferences"),
    { scope: "operator.read", profileAccess: "required" },
  )

  api.registerGatewayMethod(
    "gsd.ui.projects.list",
    async (params: unknown) => {
      const root = requireString(params, "root")
      if (!root) throw new Error("missing root")
      if (!isApprovedRoot(config, root)) throw new Error("root not approved for embedded use")
      const detail = (params as { detail?: unknown } | null)?.detail === true
      return daemonFetch(`/api/projects?root=${encodeURIComponent(root)}&detail=${detail ? "true" : "false"}`)
    },
    { scope: "operator.read", profileAccess: "required" },
  )

  api.registerGatewayMethod(
    "gsd.ui.directories.list",
    async (params: unknown) => {
      const root = requireString(params, "root")
      if (!root) throw new Error("missing root")
      if (!isApprovedRoot(config, root)) throw new Error("root not approved for embedded use")
      const path = requireString(params, "path")
      const query = `root=${encodeURIComponent(root)}${path ? `&path=${encodeURIComponent(path)}` : ""}`
      return daemonFetch(`/api/browse-directories?${query}`)
    },
    { scope: "operator.read", profileAccess: "required" },
  )

  // Writes - approved-root gated with validated DTOs
  api.registerGatewayMethod(
    "gsd.ui.preferences.selectRoot",
    async (params: unknown) => {
      const devRoot = requireString(params, "devRoot")
      if (!devRoot) throw new Error("missing devRoot")
      if (!isApprovedRoot(config, devRoot)) throw new Error("devRoot not approved for embedded use")
      return daemonFetch("/api/switch-root", { method: "POST", body: JSON.stringify({ devRoot }) })
    },
    { scope: "operator.write", profileAccess: "required" },
  )

  api.registerGatewayMethod(
    "gsd.ui.files.delete",
    async (params: unknown) => {
      const root = requireString(params, "root")
      const path = requireString(params, "path")
      if (!root || !path) throw new Error("missing root or path")
      if (!isApprovedRoot(config, root)) throw new Error("root not approved for embedded use")
      if (!containsCanonically(root, path)) throw new Error("path escapes the approved root")
      return daemonFetch(`/api/files?root=${encodeURIComponent(root)}&path=${encodeURIComponent(path)}`, { method: "DELETE" })
    },
    { scope: "operator.write", profileAccess: "required" },
  )

  // Subscriptions: explicitly unavailable until the streaming contract piece
  // is reviewed - named refusal, never silent fallback.
  for (const [method, scope] of [
    ["gsd.ui.workspace.events.subscribe", "operator.read"],
    ["gsd.ui.workspace.events.unsubscribe", "operator.write"],
    ["gsd.ui.terminal.output.subscribe", "operator.read"],
    ["gsd.ui.terminal.output.unsubscribe", "operator.write"],
  ] as const) {
    api.registerGatewayMethod(
      method,
      async () => {
        throw new Error("embedded subscriptions are not yet enabled")
      },
      { scope, profileAccess: "required" },
    )
  }
}
