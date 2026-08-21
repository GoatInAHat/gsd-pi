import { test } from 'node:test'
import assert from 'node:assert/strict'

import { runHeadlessDiscardMilestone } from '../headless-discard-milestone.ts'

test('headless discard requires --orphan-only before opening the database', async () => {
  let opened = false
  let output = ''
  const result = await runHeadlessDiscardMilestone('/project', ['M015'], {
    openExistingWorkflowDatabase() {
      opened = true
      return { ok: true }
    },
    closeWorkflowDatabase() {},
    discardOrphanMilestonesAtomic() {
      throw new Error('must not run')
    },
  }, (text) => { output += text })

  assert.equal(result.exitCode, 1)
  assert.equal(opened, false)
  assert.match(output, /--orphan-only is required/)
})

test('headless discard emits the operation before/after JSON and closes the database', async () => {
  let closed = false
  let output = ''
  const result = await runHeadlessDiscardMilestone('/project', ['M015', 'M016', '--orphan-only'], {
    openExistingWorkflowDatabase() {
      return { ok: true }
    },
    closeWorkflowDatabase() {
      closed = true
    },
    discardOrphanMilestonesAtomic(_basePath, ids) {
      return {
        operation: 'discard-milestone',
        orphanOnly: true,
        ok: true,
        requestedIds: [...ids],
        before: ids.map((id) => ({ id, exists: true })),
        after: ids.map((id) => ({ id, exists: false })),
        errors: [],
      }
    },
  }, (text) => { output += text })

  assert.equal(result.exitCode, 0)
  assert.equal(closed, true)
  assert.deepEqual(JSON.parse(output).after, [
    { id: 'M015', exists: false },
    { id: 'M016', exists: false },
  ])
})
