/**
 * Tests for batch-JSON cost aggregation and sessionId capture — verifies the
 * HeadlessJsonResult emitted by --output-format json carries real cost totals
 * from contract-shaped cost_update frames and the sessionId from init.
 */

import test from 'node:test'
import assert from 'node:assert/strict'

import type { RpcCostUpdateEvent, RpcInitResult } from '@opengsd/contracts'
import {
  readCostUpdateEvent,
  createHeadlessCostTotals,
  trackHeadlessCostEvent,
  buildHeadlessJsonResult,
} from '../headless-events.js'

// Canonical frame per RpcCostUpdateEvent (packages/contracts/src/rpc.ts):
// cumulativeCost is a plain number, NOT an object with costUsd.
function makeCostFrame(overrides: Partial<RpcCostUpdateEvent> = {}): RpcCostUpdateEvent {
  return {
    type: 'cost_update',
    runId: 'run-1',
    turnCost: 0.01,
    cumulativeCost: 0.0423,
    tokens: { input: 1200, output: 340, cacheRead: 5000, cacheWrite: 800 },
    ...overrides,
  }
}

test('readCostUpdateEvent reads the contract cost_update shape', () => {
  const reading = readCostUpdateEvent(makeCostFrame())
  assert.ok(reading)
  assert.equal(reading.costUsd, 0.0423)
  assert.equal(reading.inputTokens, 1200)
  assert.equal(reading.outputTokens, 340)
  assert.equal(reading.cacheReadTokens, 5000)
  assert.equal(reading.cacheWriteTokens, 800)
})

test('readCostUpdateEvent ignores non-cost events', () => {
  assert.equal(readCostUpdateEvent({ type: 'agent_end' }), null)
  assert.equal(readCostUpdateEvent({}), null)
  assert.equal(readCostUpdateEvent(undefined), null)
})

test('readCostUpdateEvent does not NaN-poison on malformed fields', () => {
  // The legacy (buggy) reader expected { cumulativeCost: { costUsd } }; if such
  // a frame ever appears, every field must degrade to 0, not NaN.
  const reading = readCostUpdateEvent({
    type: 'cost_update',
    cumulativeCost: { costUsd: 0.5 },
    tokens: { input: 10, output: 'lots', cacheRead: 0, cacheWrite: 0 },
  })
  assert.ok(reading)
  assert.equal(reading.costUsd, 0)
  assert.equal(reading.inputTokens, 10)
  assert.equal(reading.outputTokens, 0)
})

test('emitted HeadlessJsonResult carries nonzero cost and sessionId from init', () => {
  // sessionId comes from the awaited client.init() RPC response, not an event
  const initResult: RpcInitResult = {
    protocolVersion: 2,
    sessionId: 'session-abc-123',
    capabilities: { events: ['*'], commands: [] },
  }

  const totals = createHeadlessCostTotals()
  const frames: RpcCostUpdateEvent[] = [
    makeCostFrame({ cumulativeCost: 0.01, tokens: { input: 100, output: 20, cacheRead: 0, cacheWrite: 0 } }),
    makeCostFrame({ cumulativeCost: 0.0423 }),
  ]
  for (const frame of frames) {
    trackHeadlessCostEvent(totals, frame)
  }
  // interleaved non-cost events are ignored
  trackHeadlessCostEvent(totals, { type: 'tool_execution_start', toolName: 'read' })

  const result = buildHeadlessJsonResult({
    blocked: false,
    exitCode: 0,
    totalEvents: 3,
    recentEvents: [],
    sessionId: initResult.sessionId,
    duration: 1234,
    cost: totals,
    toolCalls: 1,
  })

  assert.equal(result.status, 'success')
  assert.equal(result.sessionId, 'session-abc-123')
  assert.equal(result.cost.total, 0.0423)
  assert.equal(result.cost.input_tokens, 1200)
  assert.equal(result.cost.output_tokens, 340)
  assert.equal(result.cost.cache_read_tokens, 5000)
  assert.equal(result.cost.cache_write_tokens, 800)
})

test('cost totals are cumulative-max, never regress on late lower frames', () => {
  const totals = createHeadlessCostTotals()
  trackHeadlessCostEvent(totals, makeCostFrame({ cumulativeCost: 0.05 }))
  trackHeadlessCostEvent(totals, makeCostFrame({ cumulativeCost: 0.02, tokens: { input: 10, output: 5, cacheRead: 0, cacheWrite: 0 } }))
  assert.equal(totals.total, 0.05)
  assert.equal(totals.input_tokens, 1200)
})
