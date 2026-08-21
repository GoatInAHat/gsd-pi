import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { handleDiscardMilestone } from '../headless-discard-milestone.ts'
import { closeDatabase, insertMilestone, openDatabase } from '../resources/extensions/gsd/gsd-db.ts'

test('headless discard-milestone requires the explicit orphan-only guard', async () => {
  const result = await handleDiscardMilestone('/unused', ['M001'])
  assert.equal(result.exitCode, 1)
  assert.match(String(result.payload.error), /--orphan-only/)
})

test('headless discard-milestone returns structured before/after JSON data', async (t) => {
  const base = mkdtempSync(join(tmpdir(), 'gsd-headless-orphan-discard-'))
  t.after(() => {
    closeDatabase()
    rmSync(base, { recursive: true, force: true })
  })
  mkdirSync(join(base, '.gsd'), { recursive: true })
  assert.ok(openDatabase(join(base, '.gsd', 'gsd.db')))
  insertMilestone({ id: 'M001', title: 'Reserved', status: 'queued' })

  const result = await handleDiscardMilestone(base, ['M001', '--orphan-only'])

  assert.equal(result.exitCode, 0)
  assert.equal(result.payload.ok, true)
  assert.deepEqual(result.payload.requestedIds, ['M001'])
  assert.deepEqual(result.payload.after, [{ id: 'M001', canonicalMilestone: null }])
})
