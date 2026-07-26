/**
 * Tests for `gsd update --models` — runtime model-catalog refresh.
 *
 * Covers: successful fetch writes a well-formed overlay atomically, fetch
 * failure exits 1 and preserves an existing overlay, invalid payloads are
 * rejected, before/after counts are printed, and a value after --models is
 * rejected without hitting the network.
 */
import { test, type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { MODELS_CATALOG_URL, runUpdate } from '../update-cmd.ts'
import { resolveModelsCatalogPath, resolveModelsJsonPath } from '../models-resolver.ts'

const VALID_CATALOG = {
  anthropic: {
    'claude-opus-4-6': { id: 'claude-opus-4-6', name: 'Claude Opus 4.6' },
    'claude-sonnet-4-6': { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6' },
  },
  openai: {
    'gpt-5.2': { id: 'gpt-5.2', name: 'GPT-5.2' },
  },
}

interface Harness {
  agentDir: string
  catalogPath: string
  stdout: string[]
  stderr: string[]
  exitCode: number | null
  fetchUrls: string[]
}

function installHarness(t: TestContext, fetchImpl: (input: unknown) => Promise<Response>): Harness {
  const tmp = mkdtempSync(join(tmpdir(), 'gsd-update-models-'))
  const agentDir = join(tmp, 'agent')
  const state: Harness = {
    agentDir,
    catalogPath: join(agentDir, 'models-catalog.json'),
    stdout: [],
    stderr: [],
    exitCode: null,
    fetchUrls: [],
  }

  const originalFetch = globalThis.fetch
  const originalStdoutWrite = process.stdout.write
  const originalStderrWrite = process.stderr.write
  const originalExit = process.exit

  globalThis.fetch = async (input: unknown) => {
    state.fetchUrls.push(String(input))
    return fetchImpl(input)
  }
  ;(process.stdout as any).write = (chunk: unknown) => {
    state.stdout.push(String(chunk))
    return true
  }
  ;(process.stderr as any).write = (chunk: unknown) => {
    state.stderr.push(String(chunk))
    return true
  }
  ;(process as any).exit = (code?: number) => {
    state.exitCode = code ?? 0
    throw new Error(`process.exit(${state.exitCode})`)
  }

  t.after(() => {
    globalThis.fetch = originalFetch
    ;(process.stdout as any).write = originalStdoutWrite
    ;(process.stderr as any).write = originalStderrWrite
    ;(process as any).exit = originalExit
    rmSync(tmp, { recursive: true, force: true })
  })

  return state
}

test('resolveModelsCatalogPath is the sibling of models.json', () => {
  assert.equal(
    resolveModelsCatalogPath(),
    join(dirname(resolveModelsJsonPath()), 'models-catalog.json'),
  )
})

test('update --models writes a well-formed overlay atomically', async (t) => {
  const h = installHarness(t, async () => Response.json(VALID_CATALOG))

  await runUpdate({ target: '--models', agentDir: h.agentDir })

  assert.equal(h.exitCode, null, 'must not exit on success')
  assert.deepEqual(h.fetchUrls, [MODELS_CATALOG_URL])

  const overlay = JSON.parse(readFileSync(h.catalogPath, 'utf-8'))
  assert.equal(overlay.version, 1)
  assert.equal(overlay.source, MODELS_CATALOG_URL)
  assert.ok(typeof overlay.fetchedAt === 'string' && !Number.isNaN(Date.parse(overlay.fetchedAt)))
  assert.deepEqual(overlay.models, VALID_CATALOG)

  // Atomic write: no temp-file leftovers next to the overlay
  const leftovers = readdirSync(h.agentDir).filter((name) => name.includes('.tmp-'))
  assert.deepEqual(leftovers, [], 'atomic write must leave no temp files')

  const output = h.stdout.join('')
  assert.match(output, /Updated model catalog:.*2 providers, 3 models/)
  assert.match(output, new RegExp(h.catalogPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
})

test('update --models shows before/after counts when an overlay already exists', async (t) => {
  const h = installHarness(t, async () => Response.json(VALID_CATALOG))
  mkdirSync(h.agentDir, { recursive: true })
  writeFileSync(
    h.catalogPath,
    JSON.stringify({
      version: 1,
      fetchedAt: '2026-01-01T00:00:00.000Z',
      source: MODELS_CATALOG_URL,
      models: { anthropic: { 'claude-opus-4-6': { id: 'claude-opus-4-6' } } },
    }),
  )

  await runUpdate({ target: '--models', agentDir: h.agentDir })

  const output = h.stdout.join('')
  assert.match(output, /Previous catalog:.*1 providers, 1 models/)
  assert.match(output, /Updated model catalog:.*2 providers, 3 models/)
})

test('update --models on network failure exits 1 and preserves an existing overlay', async (t) => {
  const h = installHarness(t, async () => {
    throw new Error('ECONNREFUSED')
  })
  mkdirSync(h.agentDir, { recursive: true })
  const existing = JSON.stringify({ version: 1, fetchedAt: 'x', source: 'x', models: { a: { b: {} } } })
  writeFileSync(h.catalogPath, existing)

  await assert.rejects(
    runUpdate({ target: '--models', agentDir: h.agentDir }),
    /process\.exit\(1\)/,
  )

  assert.equal(h.exitCode, 1)
  assert.match(h.stderr.join(''), /Failed to fetch model catalog/)
  assert.equal(readFileSync(h.catalogPath, 'utf-8'), existing, 'existing overlay must not be clobbered')
})

test('update --models on HTTP error exits 1 and preserves an existing overlay', async (t) => {
  const h = installHarness(t, async () => new Response('not found', { status: 404 }))
  mkdirSync(h.agentDir, { recursive: true })
  const existing = JSON.stringify({ version: 1, fetchedAt: 'x', source: 'x', models: { a: { b: {} } } })
  writeFileSync(h.catalogPath, existing)

  await assert.rejects(
    runUpdate({ target: '--models', agentDir: h.agentDir }),
    /process\.exit\(1\)/,
  )

  assert.equal(h.exitCode, 1)
  assert.equal(readFileSync(h.catalogPath, 'utf-8'), existing, 'existing overlay must not be clobbered')
})

test('update --models rejects an invalid JSON payload and writes nothing', async (t) => {
  for (const payload of [
    Response.json(['not', 'an', 'object']),
    Response.json({ anthropic: 'not-a-map' }),
    Response.json(null),
    new Response('this is not json', { status: 200, headers: { 'Content-Type': 'text/plain' } }),
  ]) {
    const h = installHarness(t, async () => payload)

    await assert.rejects(
      runUpdate({ target: '--models', agentDir: h.agentDir }),
      /process\.exit\(1\)/,
    )

    assert.equal(h.exitCode, 1)
    assert.match(h.stderr.join(''), /invalid/i)
    assert.throws(() => readFileSync(h.catalogPath), /ENOENT/, 'no overlay may be written for invalid payloads')
  }
})

test('update --models rejects a trailing value without hitting the network', async (t) => {
  const h = installHarness(t, async () => Response.json(VALID_CATALOG))

  await assert.rejects(
    runUpdate({ target: '--models', extraArgs: ['claude-*'], agentDir: h.agentDir }),
    /process\.exit\(1\)/,
  )

  assert.equal(h.exitCode, 1)
  assert.deepEqual(h.fetchUrls, [], 'must not fetch when a value follows --models')
  assert.match(h.stderr.join(''), /does not take a value/)
})

test('update with unknown target usage mentions --models', async (t) => {
  const h = installHarness(t, async () => Response.json(VALID_CATALOG))

  await assert.rejects(
    runUpdate({ target: 'bogus', agentDir: h.agentDir }),
    /process\.exit\(1\)/,
  )

  assert.equal(h.exitCode, 1)
  assert.match(h.stderr.join(''), /Usage: gsd update \[browser\] \[--models\]/)
})
