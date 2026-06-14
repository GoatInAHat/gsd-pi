import type { ExtensionContext } from "@gsd/pi-coding-agent";

import {
  type EnsureProjectWorkflowMcpConfigResult,
  ensureProjectWorkflowMcpConfig,
} from "./mcp-project-config.js";

interface WorkflowMcpAutoPrepContext {
  model?: { provider?: string; baseUrl?: string };
  modelRegistry?: {
    getProviderAuthMode?: (provider: string) => string;
    isProviderRequestReady?: (provider: string) => boolean;
  };
  ui?: Pick<ExtensionContext["ui"], "notify">;
}

interface WorkflowMcpAutoPrepModel {
  provider?: string;
  baseUrl?: string;
}

// ponytail: always true — .mcp.json is useful for direct `claude` CLI
// usage regardless of the current session's provider.
export function shouldAutoPrepareWorkflowMcp(_ctx: WorkflowMcpAutoPrepContext): boolean {
  return true;
}

export function prepareWorkflowMcpForProject(
  ctx: WorkflowMcpAutoPrepContext,
  projectRoot: string,
  _modelOverride?: WorkflowMcpAutoPrepModel | null,
): EnsureProjectWorkflowMcpConfigResult | null {
  if (!shouldAutoPrepareWorkflowMcp(ctx)) return null;

  try {
    const result = ensureProjectWorkflowMcpConfig(projectRoot);
    if (result.status !== "unchanged") {
      ctx.ui?.notify?.(`GSD MCP Server Prepared at ${result.configPath}`, "info");
    }
    return result;
  } catch (err) {
    ctx.ui?.notify?.(
      `Claude Code MCP prep failed: ${err instanceof Error ? err.message : String(err)}. Please run /gsd mcp init . from your project root.`,
      "warning",
    );
    return null;
  }
}
