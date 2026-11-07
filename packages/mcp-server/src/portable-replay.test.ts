import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMcpServer } from './server.js';
import { SessionManager } from './session-manager.js';

// Real MCP schema validation + real workflow DB. No Claude metadata or model calls.
test('generic MCP client initializes, plans, saves, reads and safely replays', async () => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'mcp-portable-')));
  const manager = new SessionManager();
  const { server } = await createMcpServer(manager, { includeWorkflowTools: true });
  const client = new Client({ name: 'generic-client', version: '1' });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(st);
    await client.connect(ct);
    const call = (name: string, args: Record<string, unknown>, meta?: Record<string, unknown>) =>
      client.callTool({ name, arguments: { projectDir: dir, ...args }, ...(meta ? { _meta: meta } : {}) });
    const ok = (r: Awaited<ReturnType<typeof call>>) => {
      assert.notEqual(r.isError, true, JSON.stringify(r));
      return r;
    };
    const json = (r: Awaited<ReturnType<typeof call>>) => {
      ok(r);
      const content = r.content as Array<{ type: string; text: string }>;
      return JSON.parse(content.find((c) => c.type === 'text')!.text);
    };
    const listed = await client.listTools();
    assert.ok(listed.tools.find((t) => t.name === 'gsd_plan_milestone')!.inputSchema.properties!.idempotencyKey);
    assert.equal((await call('gsd_query', { query: 'rework' })).isError, true);
    ok(await call('gsd_project_init', {}));
    assert.equal(json(await call('gsd_project_init', {})).created, false);
    const plan = { milestoneId: 'M001', title: 'Portable MCP', vision: 'Replay-safe planning', slices: [{
      sliceId: 'S01', title: 'Replay proof', risk: 'low', depends: [], demo: 'One durable effect',
      goal: 'Prove client-owned retry identity', successCriteria: 'Replay does not duplicate',
      proofLevel: 'integration', integrationClosure: 'Real MCP to workflow DB', observabilityImpact: 'Readback and ledger',
    }] };
    assert.equal((await call('gsd_plan_milestone', plan)).isError, true);
    assert.equal((await call('gsd_plan_milestone', { ...plan, idempotencyKey: ' ' })).isError, true);
    const planned = ok(await call('gsd_plan_milestone', { ...plan, idempotencyKey: 'plan-1' }));
    assert.deepEqual(ok(await call('gsd_plan_milestone', { ...plan, idempotencyKey: 'plan-1' })), planned);
    assert.equal((await call('gsd_plan_milestone', { ...plan, title: 'Different', idempotencyKey: 'plan-1' })).isError, true);
    assert.equal(json(await call('gsd_query', { query: 'milestones' })).milestones.length, 1);
    const brief = {
      idempotencyKey: 'brief-1', briefId: 'RB-001', milestoneId: 'M001', sliceId: 'S01', taskId: 'T01',
      findings: [{ findingId: 'F01', severity: 'advisory', description: 'A concrete mismatch', requiredFix: 'Repair it', verificationCommands: ['node --test'], status: 'resolved', evidence: 'fixture proof' }],
    };
    ok(await call('gsd_rework_brief_save', brief));
    const first = json(await call('gsd_query', { query: 'rework' }));
    assert.equal(first.readMetadata.source, 'database');
    assert.equal(first.rework.length, 1);
    assert.equal(first.rework[0].id, 'RB-001');
    assert.equal(first.rework[0].findings[0].status, 'resolved');
    assert.deepEqual(first.rework[0].findings[0].verification_commands, ['node --test']);
    ok(await call('gsd_rework_brief_save', brief));
    assert.deepEqual(json(await call('gsd_query', { query: 'rework' })), first);
    // Legacy private metadata is still accepted; mixed identities are rejected.
    const { idempotencyKey: _key, ...legacy } = brief;
    ok(await call('gsd_rework_brief_save', legacy, { 'io.opengsd/idempotency-key': 'brief-1' }));
    assert.equal((await call('gsd_rework_brief_save', brief, { 'io.opengsd/idempotency-key': 'other' })).isError, true);
    assert.equal((await call('gsd_rework_brief_save', { ...brief, idempotencyKey: 'transport:claude-code:forged' })).isError, true);
    assert.deepEqual(json(await call('gsd_query', { query: 'rework' })), first);
  } finally {
    await client.close();
    await server.close();
    await manager.cleanup();
    rmSync(dir, { recursive: true, force: true });
  }
});
