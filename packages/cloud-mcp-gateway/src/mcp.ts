import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  CallToolResultSchema,
  ListToolsRequestSchema,
  type CallToolResult,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import type { RuntimeRegistry } from "./runtime-registry.js";
import type { RuntimeToolDefinition, RuntimeToolInputSchema } from "./protocol.js";
import type { UserRecord } from "./auth-store.js";
import { formatQuotaExceeded, type UsageLimiter } from "./usage-limits.js";
import type { InMemoryUsageStore } from "./usage-store.js";
import { WORKFLOW_TOOL_NAMES } from "@opengsd/mcp-server";

const SERVER_NAME = "gsd-cloud-gateway";
const SERVER_VERSION = "1.0.2";

const SESSION_TOOL_NAMES = [
  "gsd_execute",
  "gsd_status",
  "gsd_result",
  "gsd_cancel",
  "gsd_query",
  "gsd_resolve_blocker",
  "gsd_progress",
  "gsd_roadmap",
  "gsd_history",
  "gsd_doctor",
  "gsd_captures",
  "gsd_knowledge",
  "gsd_graph",
] as const;

const CLOUD_PROJECTS_TOOL = "gsd_cloud_projects";

export const CLOUD_GATEWAY_TOOL_NAMES = [
  CLOUD_PROJECTS_TOOL,
  ...SESSION_TOOL_NAMES,
  ...WORKFLOW_TOOL_NAMES,
] as const;

const BUILTIN_TOOL_NAMES = new Set<string>(CLOUD_GATEWAY_TOOL_NAMES);

const EMPTY_INPUT_SCHEMA: RuntimeToolInputSchema = {
  type: "object",
  properties: {},
};

const ROUTING_PROPERTIES = {
  runtimeId: {
    type: "string",
    description: "Connected Local GSD Runtime ID. Optional when only one runtime is connected.",
  },
  projectAlias: {
    type: "string",
    description: "Gateway project alias advertised by the Local GSD Runtime.",
  },
} satisfies Record<string, object>;

const PASSTHROUGH_INPUT_SCHEMA: RuntimeToolInputSchema = {
  type: "object",
  properties: ROUTING_PROPERTIES,
  additionalProperties: true,
};

export function createGatewayMcpServer(params: {
  userId: string;
  registry: RuntimeRegistry;
  usage?: InMemoryUsageStore;
  usageLimiter?: UsageLimiter;
  getUser?: (userId: string) => UserRecord | undefined;
}): Server {
  const server = new Server(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: { listChanged: true } } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: buildGatewayToolList(params.registry.listTools(params.userId)),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request, extra): Promise<CallToolResult> => {
    const toolName = request.params.name;
    const args = request.params.arguments ?? {};
    const startedAt = Date.now();

    // A tool is "known" when it is a gateway built-in or a runtime-advertised
    // tool. Built-ins short-circuit before the runtime tool-name lookup
    // (listTools + per-call scan) to keep the hot path cheap.
    const knownTool = BUILTIN_TOOL_NAMES.has(toolName)
      || params.registry.listTools(params.userId).some((tool) => tool.name === toolName);

    // Enforce quota before dispatching so all tools/call traffic (including
    // spammed, arbitrary tool names) is minute-throttled. Only known tools
    // consume and reserve billable day/month quota; an unknown tool is
    // rate-limited but must not deny legitimate calls near the day/month
    // boundary. A billable pass reserves quota that must be released once the
    // call settles.
    const quota = enforceQuota(params, toolName, args, startedAt, knownTool);
    if (quota.rejected) return quota.rejected;

    try {
      if (toolName === CLOUD_PROJECTS_TOOL) {
        const result = jsonToolResult({ projects: params.registry.listProjects(params.userId) });
        recordUsage(params.usage, params.userId, toolName, args, startedAt, true);
        return result;
      }

      if (!knownTool) {
        recordUsage(params.usage, params.userId, toolName, args, startedAt, false, {
          error: "unknown tool",
          billable: false,
        });
        return errorToolResult(`Unknown Cloud MCP Gateway tool: ${toolName}`);
      }

      try {
        const result = await params.registry.callTool({
          userId: params.userId,
          toolName,
          args,
          // extra can be undefined in MCP request handlers, so read the abort
          // signal optionally to avoid throwing (which would turn the call into a 500).
          signal: extra?.signal,
        });
        const coerced = coerceToolResult(result);
        recordUsage(params.usage, params.userId, toolName, args, startedAt, coerced.isError !== true);
        return coerced;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        recordUsage(params.usage, params.userId, toolName, args, startedAt, false, { error: message });
        return errorToolResult(message);
      }
    } finally {
      if (quota.reserved) params.usageLimiter?.releaseBillable(params.userId, startedAt);
    }
  });

  return server;
}

export function buildGatewayToolList(runtimeTools: RuntimeToolDefinition[]): Tool[] {
  const tools: Tool[] = [
    {
      name: CLOUD_PROJECTS_TOOL,
      description: "List projects currently advertised by connected Local GSD Runtimes.",
      inputSchema: EMPTY_INPUT_SCHEMA,
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
  ];
  const seen = new Set<string>([CLOUD_PROJECTS_TOOL]);

  for (const toolName of [...SESSION_TOOL_NAMES, ...WORKFLOW_TOOL_NAMES]) {
    if (seen.has(toolName)) continue;
    seen.add(toolName);
    tools.push({
      name: toolName,
      description: `Forward ${toolName} to a connected Local GSD Runtime through the Cloud MCP Gateway.`,
      inputSchema: PASSTHROUGH_INPUT_SCHEMA,
    });
  }

  for (const tool of runtimeTools) {
    if (seen.has(tool.name)) continue;
    seen.add(tool.name);
    tools.push({
      ...tool,
      description: tool.description
        ?? `Forward ${tool.name} to a runtime-advertised MCP server through the Cloud MCP Gateway.`,
      inputSchema: addRoutingFields(tool.inputSchema),
      _meta: {
        ...(tool._meta ?? {}),
        "opengsd.forwarded": true,
      },
    });
  }

  return tools;
}

function addRoutingFields(schema: RuntimeToolInputSchema): RuntimeToolInputSchema {
  const existingProperties = isRecord(schema.properties) ? schema.properties : {};
  const required = Array.isArray(schema.required)
    ? schema.required.filter((item): item is string => typeof item === "string")
    : undefined;

  return {
    ...schema,
    type: "object",
    properties: {
      ...existingProperties,
      ...Object.fromEntries(
        Object.entries(ROUTING_PROPERTIES).filter(([name]) => !Object.hasOwn(existingProperties, name)),
      ),
    },
    ...(required ? { required } : {}),
  };
}

function coerceToolResult(value: unknown): CallToolResult {
  const parsed = CallToolResultSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  const serialized = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return {
    content: [{
      type: "text",
      text: typeof serialized === "string" ? serialized : String(value),
    }],
  };
}

function jsonToolResult(value: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}

function errorToolResult(message: string): CallToolResult {
  return { isError: true, content: [{ type: "text", text: message }] };
}

function recordUsage(
  usage: InMemoryUsageStore | undefined,
  userId: string,
  toolName: string,
  args: Record<string, unknown>,
  startedAt: number,
  ok: boolean,
  options: {
    error?: string;
    billable?: boolean;
    throttled?: boolean;
  } = {},
): void {
  if (!usage) return;
  usage.recordToolCall({
    userId,
    toolName,
    startedAt,
    durationMs: Date.now() - startedAt,
    ok,
    billable: options.billable,
    throttled: options.throttled,
    ...(typeof args.runtimeId === "string" ? { runtimeId: args.runtimeId } : {}),
    // Only record an explicit alias. Falling back to args.projectDir would
    // persist and display absolute local filesystem paths in the usage store.
    ...(typeof args.projectAlias === "string" ? { projectAlias: args.projectAlias } : {}),
    ...(options.error ? { error: options.error } : {}),
  });
}

interface QuotaGate {
  // Set when the request must be rejected (quota exceeded or unknown user).
  rejected?: CallToolResult;
  // True when check() accepted the call and reserved billable quota, so the
  // caller must call usageLimiter.releaseBillable() once the call settles.
  reserved: boolean;
}

function enforceQuota(
  params: {
    userId: string;
    usage?: InMemoryUsageStore;
    usageLimiter?: UsageLimiter;
    getUser?: (userId: string) => UserRecord | undefined;
  },
  toolName: string,
  args: Record<string, unknown>,
  startedAt: number,
  // Whether this call is billable (a known tool). Non-billable calls are still
  // minute-throttled by check() but skip the day/month billable gate/reservation.
  billable: boolean,
): QuotaGate {
  if (!params.usage || !params.usageLimiter || !params.getUser) return { reserved: false };
  const user = params.getUser(params.userId);
  if (!user) return { rejected: errorToolResult(`Unknown user: ${params.userId}`), reserved: false };
  const status = params.usageLimiter.check(user, params.usage, startedAt, billable);
  if (status.allowed) return { reserved: billable };
  const message = formatQuotaExceeded(status);
  recordUsage(params.usage, params.userId, toolName, args, startedAt, false, {
    error: message,
    billable: false,
    throttled: true,
  });
  return { rejected: errorToolResult(message), reserved: false };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
