#!/usr/bin/env node
/**
 * @opengsd/mcp-server CLI entry point.
 *
 * Defaults to the stdio transport for local MCP clients (Claude Code, Cursor,
 * etc.) that spawn the server process. Passing `--http` instead starts the
 * authenticated Streamable HTTP transport documented in the package README.
 */

import { installGlobalErrorHandlers } from './cli-errors.js';
import { runMcpServerCli } from './cli-runner.js';

installGlobalErrorHandlers();

runMcpServerCli().catch((err) => {
  process.stderr.write(
    `[gsd-mcp-server] Fatal: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  process.exit(1);
});
