/**
 * Bounded headless milestone reservation deletion.
 *
 * `gsd headless discard-milestone <ids...> --orphan-only` bypasses the RPC
 * session and invokes the extension's fail-closed canonical operation directly.
 */

import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { resolveBundledGsdExtensionModule } from './bundled-resource-path.js'

function resolveAgentExtensionModule(agentDir: string, segments: string[]): string {
  const requested = join(agentDir, ...segments)
  if (existsSync(requested)) return requested
  if (segments.length === 1 && segments[0].endsWith('.ts')) {
    const jsPath = join(agentDir, segments[0].replace(/\.ts$/, '.js'))
    if (existsSync(jsPath)) return jsPath
  }
  return requested
}

export interface HeadlessDiscardResult {
  exitCode: number
  data: Record<string, unknown>
}

interface HeadlessDiscardModules {
  openExistingWorkflowDatabase(basePath: string): {
    ok: boolean
    reason?: string
    error?: Error
  }
  closeWorkflowDatabase(): void
  discardOrphanMilestonesAtomic(basePath: string, milestoneIds: readonly string[]): Record<string, unknown> & { ok: boolean }
}

async function loadExtensionModules(): Promise<HeadlessDiscardModules> {
  const [{ createJiti }, queryModule] = await Promise.all([
    import('@mariozechner/jiti'),
    import('./headless-query.js'),
  ])
  const jiti = createJiti(fileURLToPath(import.meta.url), { interopDefault: true, debug: false })
  const agentExtensionsDir = queryModule.resolveGsdAgentExtensionsDir()
  const { useAgentDir } = queryModule.shouldUseAgentExtensionsDir({ env: process.env })
  const gsdExtensionPath = (...segments: string[]) => useAgentDir
    ? resolveAgentExtensionModule(agentExtensionsDir, segments)
    : resolveBundledGsdExtensionModule(import.meta.url, segments.join('/'))
  const workspaceModule = await jiti.import(gsdExtensionPath('db-workspace.ts'), {}) as any
  const discardModule = await jiti.import(gsdExtensionPath('orphan-milestone-discard.ts'), {}) as any
  if (typeof workspaceModule.openExistingWorkflowDatabase !== 'function'
    || typeof workspaceModule.closeWorkflowDatabase !== 'function'
    || typeof discardModule.discardOrphanMilestonesAtomic !== 'function') {
    throw new Error('selected GSD extensions do not support orphan milestone discard; synchronize the extension bundle')
  }
  return {
    openExistingWorkflowDatabase: workspaceModule.openExistingWorkflowDatabase,
    closeWorkflowDatabase: workspaceModule.closeWorkflowDatabase,
    discardOrphanMilestonesAtomic: discardModule.discardOrphanMilestonesAtomic,
  }
}

function failure(requestedIds: string[], message: string): Record<string, unknown> {
  return {
    operation: 'discard-milestone',
    orphanOnly: true,
    ok: false,
    requestedIds,
    before: [],
    after: [],
    errors: [{ id: '*', reasons: [message] }],
  }
}

function emitResult(
  data: Record<string, unknown>,
  writeOutput: (text: string) => void,
): HeadlessDiscardResult {
  writeOutput(`${JSON.stringify(data)}\n`)
  return { exitCode: data.ok === true ? 0 : 1, data }
}

export async function runHeadlessDiscardMilestone(
  basePath: string,
  args: readonly string[],
  modules: HeadlessDiscardModules,
  writeOutput: (text: string) => void = (text) => process.stdout.write(text),
): Promise<HeadlessDiscardResult> {
  const requestedIds = args.filter((arg) => !arg.startsWith('--'))
  const unknownFlags = args.filter((arg) => arg.startsWith('--') && arg !== '--orphan-only')
  let data: Record<string, unknown>

  if (!args.includes('--orphan-only')) {
    data = failure(requestedIds, '--orphan-only is required')
    return emitResult(data, writeOutput)
  }
  if (unknownFlags.length > 0) {
    data = failure(requestedIds, `unknown flag: ${unknownFlags[0]}`)
    return emitResult(data, writeOutput)
  }
  if (requestedIds.length === 0) {
    data = failure(requestedIds, 'at least one milestone ID is required')
    return emitResult(data, writeOutput)
  }

  const opened = modules.openExistingWorkflowDatabase(basePath)
  if (!opened.ok) {
    data = failure(requestedIds, opened.error?.message ?? `database unavailable: ${opened.reason ?? 'open failed'}`)
    return emitResult(data, writeOutput)
  }

  try {
    data = modules.discardOrphanMilestonesAtomic(basePath, requestedIds)
  } catch (error) {
    data = failure(requestedIds, error instanceof Error ? error.message : String(error))
  } finally {
    modules.closeWorkflowDatabase()
  }

  return emitResult(data, writeOutput)
}

export async function handleDiscardMilestone(basePath: string, args: readonly string[]): Promise<HeadlessDiscardResult> {
  let modules: HeadlessDiscardModules
  try {
    modules = await loadExtensionModules()
  } catch (error) {
    const data = failure(args.filter((arg) => !arg.startsWith('--')), error instanceof Error ? error.message : String(error))
    return emitResult(data, (text) => process.stdout.write(text))
  }
  return runHeadlessDiscardMilestone(basePath, args, modules)
}
