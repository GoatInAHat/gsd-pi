import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport, getDefaultEnvironment } from "@modelcontextprotocol/sdk/client/stdio.js";
import { CallToolResultSchema, type Tool } from "@modelcontextprotocol/sdk/types.js";

export interface ExternalMcpToolConfig {
  id: string;
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
}

export interface ExternalMcpToolExecution {
  handled: boolean;
  result?: unknown;
}

interface ExternalMcpConnection {
  client: Client;
  transport: StdioClientTransport;
}

const DEFAULT_BROWSER_MCP_ID = "gsd-browser";

// Minimum interval between route refreshes triggered by an unknown tool name in
// executeIfAvailable(). Bounds how often remote-supplied names can drive
// listTools()/spawn work while still letting a newly advertised tool be
// discovered within the window.
const ROUTE_REFRESH_TTL_MS = 60_000;

export class ExternalMcpToolBridge {
  private readonly connections = new Map<string, ExternalMcpConnection>();
  private readonly connecting = new Map<string, Promise<ExternalMcpConnection>>();
  private readonly toolRoutes = new Map<string, string>();
  private routesRefreshedAt = 0;

  constructor(private readonly configs: ExternalMcpToolConfig[]) {}

  static fromEnvironment(env: NodeJS.ProcessEnv = process.env): ExternalMcpToolBridge {
    return new ExternalMcpToolBridge(readExternalMcpToolConfigs(env));
  }

  async advertisedTools(): Promise<Tool[]> {
    const tools: Tool[] = [];
    const seen = new Set<string>();
    this.toolRoutes.clear();
    for (const config of this.configs) {
      try {
        const connection = await this.connectionFor(config);
        const result = await connection.client.listTools(undefined, { timeout: 10_000 });
        for (const tool of result.tools) {
          if (seen.has(tool.name)) continue;
          seen.add(tool.name);
          this.toolRoutes.set(tool.name, config.id);
          tools.push(tool);
        }
      } catch {
        await this.closeConnection(config.id);
      }
    }
    // Record that a full refresh attempt completed so executeIfAvailable() can
    // rate-limit refreshes driven by unknown tool names.
    this.routesRefreshedAt = Date.now();
    return tools.sort((a, b) => a.name.localeCompare(b.name));
  }

  async executeIfAvailable(toolName: string, args: Record<string, unknown>): Promise<ExternalMcpToolExecution> {
    let configId = this.toolRoutes.get(toolName);
    if (!configId && Date.now() - this.routesRefreshedAt >= ROUTE_REFRESH_TTL_MS) {
      // Routes are only populated by advertisedTools(); a call can arrive before
      // that has run (or after the routes were cleared). Refresh at most once per
      // ROUTE_REFRESH_TTL_MS before deciding the tool is not ours, so a valid
      // forwarded tool isn't rejected while a stream of unknown names from remote
      // callers cannot force unbounded listTools()/spawn work (a DoS vector).
      await this.advertisedTools().catch(() => undefined);
      configId = this.toolRoutes.get(toolName);
    }
    if (!configId) return { handled: false };

    const config = this.configs.find((candidate) => candidate.id === configId);
    if (!config) return { handled: false };

    try {
      const connection = await this.connectionFor(config);
      const result = await connection.client.callTool(
        { name: toolName, arguments: args },
        CallToolResultSchema,
        { timeout: 10 * 60 * 1000, resetTimeoutOnProgress: true },
      );
      return { handled: true, result };
    } catch (err) {
      await this.closeConnection(config.id);
      throw err;
    }
  }

  async close(): Promise<void> {
    // Drain in-flight connect attempts first. A successful attempt moves its
    // connection into this.connections (see connectionFor), so awaiting the
    // connecting map before closing established connections ensures a child
    // process / stdio transport that finished connecting during shutdown is
    // still closed rather than leaked. Failures already cleaned up after
    // themselves in openConnection().
    await Promise.all(
      Array.from(this.connecting.values()).map((attempt) => attempt.catch(() => undefined)),
    );
    await Promise.all(Array.from(this.connections.keys()).map((id) => this.closeConnection(id)));
  }

  private async connectionFor(config: ExternalMcpToolConfig): Promise<ExternalMcpConnection> {
    const existing = this.connections.get(config.id);
    if (existing) return existing;

    // Share one connect attempt across concurrent callers for the same config so
    // two simultaneous tool calls cannot each spawn a child process (and leak the
    // loser's transport). The in-flight entry is cleared on success and failure.
    const inFlight = this.connecting.get(config.id);
    if (inFlight) return inFlight;

    const attempt = this.openConnection(config).then(
      (connection) => {
        this.connecting.delete(config.id);
        this.connections.set(config.id, connection);
        return connection;
      },
      (err) => {
        this.connecting.delete(config.id);
        throw err;
      },
    );
    this.connecting.set(config.id, attempt);
    return attempt;
  }

  private async openConnection(config: ExternalMcpToolConfig): Promise<ExternalMcpConnection> {
    const transport = new StdioClientTransport({
      command: config.command,
      args: config.args ?? [],
      ...(config.cwd ? { cwd: config.cwd } : {}),
      // Merge the config's env over the SDK's safe default environment
      // (getDefaultEnvironment: PATH, HOME, and other required vars) instead of
      // replacing it. Passing config.env alone would drop PATH and cause the
      // child MCP server to fail to spawn. This mirrors the transport's own
      // default (getDefaultEnvironment() when env is unset) while adding the
      // configured overrides, and avoids leaking the full process.env.
      ...(config.env ? { env: { ...getDefaultEnvironment(), ...config.env } } : {}),
      stderr: "pipe",
    });
    transport.stderr?.on("data", () => {
      // Drain child stderr so a noisy MCP server cannot block on a full pipe.
    });
    const client = new Client({ name: `gsd-cloud-runtime-${config.id}`, version: "1.0.0" });
    try {
      await client.connect(transport, { timeout: 10_000 });
    } catch (err) {
      await transport.close().catch(() => undefined);
      throw err;
    }
    return { client, transport };
  }

  private async closeConnection(id: string): Promise<void> {
    const connection = this.connections.get(id);
    this.connections.delete(id);
    if (!connection) return;
    try {
      await connection.client.close();
    } catch {
      // Fall through: the transport is still closed below so a failed client
      // close cannot leak the stdio child process / pipes.
    } finally {
      // Always close the transport, not just on the client-close error path.
      // Client.close() usually closes the transport too, but that is not
      // guaranteed, and this close is idempotent, so on the success path this
      // ensures the stdio child process / pipes are released.
      await connection.transport.close().catch(() => undefined);
    }
  }
}

function readExternalMcpToolConfigs(env: NodeJS.ProcessEnv): ExternalMcpToolConfig[] {
  const explicit = parseExplicitConfigs(env.GSD_CLOUD_MCP_SERVERS);
  if (explicit) return explicit;

  const browserFlag = env.GSD_CLOUD_BROWSER_MCP?.trim().toLowerCase();
  if (browserFlag === "0" || browserFlag === "false" || browserFlag === "off") return [];

  return [{
    id: DEFAULT_BROWSER_MCP_ID,
    command: env.GSD_CLOUD_BROWSER_MCP_COMMAND || env.GSD_BROWSER_MCP_COMMAND || "gsd-browser",
    args: parseArgsValue(env.GSD_CLOUD_BROWSER_MCP_ARGS || env.GSD_BROWSER_MCP_ARGS, ["mcp"]),
  }];
}

function parseExplicitConfigs(value: string | undefined): ExternalMcpToolConfig[] | undefined {
  if (!value?.trim()) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch (err) {
    throw new Error(
      `GSD_CLOUD_MCP_SERVERS must be valid JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (!Array.isArray(parsed)) throw new Error("GSD_CLOUD_MCP_SERVERS must be a JSON array");
  return parsed.map((item, index) => {
    if (!isRecord(item) || typeof item.command !== "string" || !item.command.trim()) {
      throw new Error(`GSD_CLOUD_MCP_SERVERS[${index}] must include command`);
    }
    return {
      id: typeof item.id === "string" && item.id.trim() ? item.id.trim() : `external-${index + 1}`,
      command: item.command.trim(),
      args: parseArgsValue(item.args, []),
      ...(typeof item.cwd === "string" ? { cwd: item.cwd } : {}),
      ...(isStringRecord(item.env) ? { env: item.env } : {}),
    };
  });
}

function parseArgsValue(value: unknown, fallback: string[]): string[] {
  if (value === undefined) return fallback;
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) return parsed.filter((item): item is string => typeof item === "string");
    } catch {
      // Malformed JSON array (e.g. a partially copied env value): fall back to
      // whitespace splitting below instead of throwing and crashing the daemon.
    }
  }
  return trimmed.split(/\s+/).filter(Boolean);
}

function isStringRecord(value: unknown): value is Record<string, string> {
  if (!isRecord(value)) return false;
  return Object.values(value).every((item) => typeof item === "string");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
