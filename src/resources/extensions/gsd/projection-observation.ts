// Project/App: gsd-pi
// File Purpose: Observe and preserve externally changed projection bytes before canonical rendering.

import { existsSync, mkdirSync, readFileSync, renameSync } from "node:fs";
import { dirname, isAbsolute, join, relative, sep } from "node:path";

import { atomicWriteBufferSync } from "./atomic-write.js";
import { gsdProjectionRoot } from "./paths.js";
import {
  computeProjectionSha,
  readCompatMarker,
  writeCompatMarker,
  type CompatMarker,
} from "./compat/compat-marker.js";
import { withProjectionMutationSync } from "./database-maintenance-fence.js";
import { readDecisionsProjectionIntent } from "./db-writer.js";
import { detectProjectionDrift } from "./markdown-renderer.js";
import { observeExternalMarkdownEdits } from "./state-reconciliation/drift/external-markdown-edit.js";
import { observeExternalPlanningEdits } from "./state-reconciliation/drift/external-planning-edit.js";
import type { DriftRecord } from "./state-reconciliation/types.js";

type ExternalProjectionEdit = Extract<
  DriftRecord,
  { kind: "external-markdown-edit" | "external-planning-edit" }
>;

export interface PreservedProjectionEvidence {
  sourcePath: string;
  quarantinePath: string;
  observation?: ExternalProjectionEdit;
}

export interface ProjectionObservationResult {
  preserved: PreservedProjectionEvidence[];
  refreshedPassthrough: string[];
}

function uniquePath(path: string): string {
  if (!existsSync(path)) return path;
  let suffix = 2;
  while (existsSync(`${path}.${suffix}`)) suffix += 1;
  return `${path}.${suffix}`;
}

function quarantineRelativePath(basePath: string, absPath: string): string {
  for (const rootName of [".gsd", ".planning"] as const) {
    const root = join(basePath, rootName);
    const rel = relative(root, absPath);
    if (rel && rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel)) {
      return join(rootName.slice(1), rel);
    }
  }
  return join("external", absPath.replace(/^[/\\]+/, ""));
}

function quarantinePath(basePath: string, absPath: string, stamp: string): string {
  return uniquePath(join(
    gsdProjectionRoot(basePath),
    "quarantine",
    "projections",
    stamp,
    quarantineRelativePath(basePath, absPath),
  ));
}

function hasTrustedBaseline(basePath: string, absPath: string, marker: CompatMarker): boolean {
  const rel = relative(gsdProjectionRoot(basePath), absPath);
  if (!rel || rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) return false;
  return marker.projections[rel.replace(/\\/g, "/")] !== undefined;
}

function readProjectionBytes(path: string): Buffer | null {
  try {
    return readFileSync(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

function preserveOne(
  basePath: string,
  absPath: string,
  stamp: string,
  observedBytes: Buffer,
): PreservedProjectionEvidence {
  const claimPath = join(gsdProjectionRoot(basePath), "gsd.db");
  return withProjectionMutationSync(claimPath, () => {
    const target = quarantinePath(basePath, absPath, stamp);
    mkdirSync(dirname(target), { recursive: true });
    const currentBytes = readProjectionBytes(absPath);
    if (currentBytes?.equals(observedBytes)) {
      renameSync(absPath, target);
    } else {
      atomicWriteBufferSync(target, observedBytes);
    }
    return { sourcePath: absPath, quarantinePath: target };
  });
}

/**
 * Preserve every modeled projection whose current bytes differ from its
 * writer-owned baseline, plus any caller-supplied legacy drift paths.
 * Passthrough planning files are observed but never moved because GSD does not
 * render them from database authority.
 */
export async function preserveProjectionEvidence(
  basePath: string,
  additionalPaths: readonly string[] = [],
  dryRun = false,
): Promise<ProjectionObservationResult> {
  const planningObservations = await observeExternalPlanningEdits(basePath, dryRun);
  const passthrough = planningObservations.filter((record) => record.passthrough);
  if (!dryRun && passthrough.length > 0) {
    const marker = readCompatMarker(basePath);
    for (const record of passthrough) {
      marker.planning!.passthrough[record.projectionPath] = {
        sha: record.actualSha,
        entities: record.entities,
      };
    }
    marker.lastProjectedAt = new Date().toISOString();
    writeCompatMarker(basePath, marker);
  }
  const observations = [
    ...observeExternalMarkdownEdits(basePath, dryRun),
    ...planningObservations.filter((record) => !record.passthrough),
  ];
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const observedByPath = new Map<string, ExternalProjectionEdit>();
  for (const observation of observations) {
    const root = observation.kind === "external-markdown-edit" ? ".gsd" : ".planning";
    observedByPath.set(join(basePath, root, observation.projectionPath), observation);
  }

  const marker = readCompatMarker(basePath, {
    healInvalidKeys: !dryRun,
    quarantineInvalid: !dryRun,
  });
  const unbaselinedDriftPaths = detectProjectionDrift(basePath)
    .map((entry) => entry.path)
    .filter((path) => !hasTrustedBaseline(basePath, path, marker));
  const decisionsIntent = await readDecisionsProjectionIntent(basePath);
  if (
    decisionsIntent
    && !hasTrustedBaseline(basePath, decisionsIntent.path, marker)
  ) {
    const decisionsBytes = readProjectionBytes(decisionsIntent.path);
    if (
      decisionsBytes
      && computeProjectionSha(decisionsBytes.toString("utf-8"))
        !== computeProjectionSha(decisionsIntent.content)
    ) {
      unbaselinedDriftPaths.push(decisionsIntent.path);
    }
  }
  const paths = new Set([
    ...additionalPaths,
    ...unbaselinedDriftPaths,
    ...observedByPath.keys(),
  ]);
  const preserved: PreservedProjectionEvidence[] = [];
  for (const absPath of paths) {
    if (dryRun) {
      if (!existsSync(absPath)) continue;
      preserved.push({
        sourcePath: absPath,
        quarantinePath: quarantinePath(basePath, absPath, stamp),
        observation: observedByPath.get(absPath),
      });
      continue;
    }
    const observedBytes = readProjectionBytes(absPath);
    if (!observedBytes) continue;
    const result = preserveOne(basePath, absPath, stamp, observedBytes);
    preserved.push({ ...result, observation: observedByPath.get(absPath) });
  }
  return {
    preserved,
    refreshedPassthrough: passthrough.map((record) => record.projectionPath),
  };
}
