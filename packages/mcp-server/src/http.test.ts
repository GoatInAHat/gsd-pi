import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatUrlHost, isLoopbackHost, validateHttpMcpOptions } from './http.js';

test('HTTP MCP refuses unauthenticated public bind by default', () => {
  assert.throws(
    () => validateHttpMcpOptions({ host: '0.0.0.0', port: 8787 }),
    /refusing to expose unauthenticated/,
  );
});

test('HTTP MCP allows loopback development without auth', () => {
  assert.doesNotThrow(() => validateHttpMcpOptions({ host: '127.0.0.1', port: 8787 }));
  assert.doesNotThrow(() => validateHttpMcpOptions({ host: 'localhost', port: 8787 }));
  assert.equal(isLoopbackHost('::1'), true);
});

test('HTTP MCP allows public bind with bearer token', () => {
  assert.doesNotThrow(() =>
    validateHttpMcpOptions({ host: '0.0.0.0', port: 8787, authToken: 'secret' }),
  );
});

test('formatUrlHost brackets IPv6 literals for a valid URL authority', () => {
  assert.equal(formatUrlHost('::1'), '[::1]');
  assert.equal(formatUrlHost('::'), '[::]');
  assert.equal(formatUrlHost('2001:db8::1'), '[2001:db8::1]');
  // Already-bracketed input must not be double-wrapped.
  assert.equal(formatUrlHost('[::1]'), '[::1]');
  // IPv4 and hostnames pass through unchanged.
  assert.equal(formatUrlHost('127.0.0.1'), '127.0.0.1');
  assert.equal(formatUrlHost('localhost'), 'localhost');
});
