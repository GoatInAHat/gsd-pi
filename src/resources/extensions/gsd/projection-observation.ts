// Project/App: gsd-pi
// File Purpose: Observe and preserve externally changed projection bytes before canonical rendering.

import { existsSync, mkdirSync, renameSync } from "node:fs";
import { dirname, isAbsolute, join, relative, sep } from "node:path";

import { gsdProjectionRoot } from "./paths.js";
import { readCompatMarker, writeCompatMarker } from "./compat/compat-marker.js";
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

function preserveOne(basePath: string, absPath: string, stamp: string): PreservedProjectionEvidence | null {
  if (!existsSync(absPath)) return null;
  const target = quarantinePath(basePath, absPath, stamp);
  mkdirSync(dirname(target), { recursive: true });
  renameSync(absPath, target);
  return { sourcePath: absPath, quarantinePath: target };
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

  const paths = new Set([
    ...additionalPaths,
    ...detectProjectionDrift(basePath).map((entry) => entry.path),
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
    const result = preserveOne(basePath, absPath, stamp);
    if (!result) continue;
    preserved.push({ ...result, observation: observedByPath.get(absPath) });
  }
  return {
    preserved,
    refreshedPassthrough: passthrough.map((record) => record.projectionPath),
  };
}
