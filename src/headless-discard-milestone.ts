// Project/App: gsd-pi
// File Purpose: Direct non-interactive route for orphan-only milestone reservation deletion.

import { createJiti } from "@mariozechner/jiti";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

import { resolveBundledGsdExtensionModule } from "./bundled-resource-path.js";
import { resolveGsdAgentExtensionsDir, shouldUseAgentExtensionsDir } from "./headless-query.js";
import type {
  OrphanMilestoneDiscardResult,
  OrphanMilestoneSnapshot,
} from "./resources/extensions/gsd/orphan-milestone-discard.js";

interface OrphanMilestoneDiscardRefusal extends Error {
  code: string;
  before: OrphanMilestoneSnapshot[];
  after?: OrphanMilestoneSnapshot[];
}

interface HeadlessDiscardModules {
  openExistingWorkflowDatabase: (basePath: string) => {
    ok: boolean;
    reason: string;
    error?: Error;
  };
  closeWorkflowDatabase: () => void;
  discardOrphanedMilestoneReservations: (
    basePath: string,
    ids: readonly string[],
  ) => OrphanMilestoneDiscardResult;
  isRefusal: (error: unknown) => error is OrphanMilestoneDiscardRefusal;
}

const jiti = createJiti(fileURLToPath(import.meta.url), { interopDefault: true, debug: false });

function resolveAgentExtensionModule(agentDir: string, file: string): string {
  const requested = join(agentDir, file);
  if (existsSync(requested)) return requested;
  const jsPath = requested.replace(/\.ts$/, ".js");
  return existsSync(jsPath) ? jsPath : requested;
}

async function loadExtensionModules(): Promise<HeadlessDiscardModules> {
  const agentDir = resolveGsdAgentExtensionsDir();
  const { useAgentDir } = shouldUseAgentExtensionsDir({ env: process.env });
  const extensionPath = (file: string) => useAgentDir
    ? resolveAgentExtensionModule(agentDir, file)
    : resolveBundledGsdExtensionModule(import.meta.url, file);
  const workspaceModule = await jiti.import(extensionPath("db-workspace.ts"), {}) as any;
  const discardModule = await jiti.import(extensionPath("orphan-milestone-discard.ts"), {}) as any;
  if (typeof workspaceModule.openExistingWorkflowDatabase !== "function"
    || typeof workspaceModule.closeWorkflowDatabase !== "function"
    || typeof discardModule.discardOrphanedMilestoneReservations !== "function"
    || typeof discardModule.OrphanMilestoneDiscardRefusedError !== "function"
    || typeof discardModule.OrphanMilestoneDiscardPostflightError !== "function") {
    throw new Error("selected GSD extensions do not support orphan milestone reservation discard; synchronize the extension bundle");
  }
  const Refusal = discardModule.OrphanMilestoneDiscardRefusedError;
  const PostflightError = discardModule.OrphanMilestoneDiscardPostflightError;
  return {
    openExistingWorkflowDatabase: workspaceModule.openExistingWorkflowDatabase,
    closeWorkflowDatabase: workspaceModule.closeWorkflowDatabase,
    discardOrphanedMilestoneReservations: discardModule.discardOrphanedMilestoneReservations,
    isRefusal: (error: unknown): error is OrphanMilestoneDiscardRefusal =>
      error instanceof Refusal || error instanceof PostflightError,
  };
}

interface HeadlessDiscardFailure {
  command: "discard-milestone";
  ok: false;
  orphanOnly: boolean;
  requested: string[];
  deleted: [];
  before: OrphanMilestoneSnapshot[];
  after: OrphanMilestoneSnapshot[];
  error: {
    code: string;
    message: string;
  };
}

type HeadlessDiscardPayload = OrphanMilestoneDiscardResult | HeadlessDiscardFailure;

export interface HeadlessDiscardMilestoneResult {
  exitCode: number;
  payload: HeadlessDiscardPayload;
}

function failure(
  code: string,
  message: string,
  requested: string[],
  orphanOnly: boolean,
  before: OrphanMilestoneSnapshot[] = [],
  after: OrphanMilestoneSnapshot[] = before,
): HeadlessDiscardFailure {
  return {
    command: "discard-milestone",
    ok: false,
    orphanOnly,
    requested,
    deleted: [],
    before,
    after,
    error: { code, message },
  };
}

function emit(
  payload: HeadlessDiscardPayload,
  write: (text: string) => void,
): HeadlessDiscardMilestoneResult {
  write(`${JSON.stringify(payload, null, 2)}\n`);
  return { exitCode: payload.ok ? 0 : 1, payload };
}

/** Execute `gsd headless discard-milestone <ids...> --orphan-only`. */
export async function handleDiscardMilestone(
  basePath: string,
  args: readonly string[],
  write: (text: string) => void = (text) => process.stdout.write(text),
): Promise<HeadlessDiscardMilestoneResult> {
  const orphanOnlyCount = args.filter((arg) => arg === "--orphan-only").length;
  const ids = args.filter((arg) => arg !== "--orphan-only");
  const unsupportedFlags = ids.filter((arg) => arg.startsWith("--"));

  if (orphanOnlyCount !== 1) {
    return emit(failure(
      "orphan_only_required",
      "discard-milestone requires exactly one --orphan-only flag",
      ids,
      false,
    ), write);
  }
  if (unsupportedFlags.length > 0) {
    return emit(failure(
      "unsupported_flag",
      `unsupported discard-milestone flag${unsupportedFlags.length === 1 ? "" : "s"}: ${unsupportedFlags.join(", ")}`,
      ids.filter((arg) => !arg.startsWith("--")),
      true,
    ), write);
  }

  let modules: HeadlessDiscardModules;
  try {
    modules = await loadExtensionModules();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return emit(failure("extension_unavailable", message, ids, true), write);
  }

  const opened = modules.openExistingWorkflowDatabase(basePath);
  if (!opened.ok) {
    const detail = opened.error?.message ?? opened.reason;
    return emit(failure(
      "database_unavailable",
      `failed to open the existing canonical database: ${detail}`,
      ids,
      true,
    ), write);
  }

  try {
    return emit(modules.discardOrphanedMilestoneReservations(basePath, ids), write);
  } catch (error) {
    if (modules.isRefusal(error)) {
      return emit(failure(error.code, error.message, ids, true, error.before, error.after), write);
    }
    const message = error instanceof Error ? error.message : String(error);
    return emit(failure("discard_failed", message, ids, true), write);
  } finally {
    modules.closeWorkflowDatabase();
  }
}
