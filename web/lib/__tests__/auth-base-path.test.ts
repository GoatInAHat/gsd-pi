import test from "node:test"
import assert from "node:assert/strict"
import { withBasePath, authFetch } from "../auth.ts"

const B = "/plugins/open-gsd-openclaw/web"

test("withBasePath prefixes root-relative API paths", () => {
  assert.equal(withBasePath("/api/projects", B), `${B}/api/projects`)
  assert.equal(withBasePath("/api/preferences", B), `${B}/api/preferences`)
})

test("withBasePath prefixes public assets", () => {
  assert.equal(withBasePath("/logo-black.svg", B), `${B}/logo-black.svg`)
  assert.equal(withBasePath("/logo-icon-white.svg", B), `${B}/logo-icon-white.svg`)
})

test("withBasePath does not double-prefix", () => {
  assert.equal(withBasePath(`${B}/api/boot`, B), `${B}/api/boot`)
  assert.equal(withBasePath(B, B), B)
})

test("withBasePath passes through non-root-relative inputs", () => {
  assert.equal(withBasePath("http://127.0.0.1:38429/api/x", B), "http://127.0.0.1:38429/api/x")
  assert.equal(withBasePath("//cdn.example.com/x", B), "//cdn.example.com/x")
  assert.equal(withBasePath("relative/path", B), "relative/path")
})

test("withBasePath is identity without a base path", () => {
  assert.equal(withBasePath("/api/x", ""), "/api/x")
})

function stubFetch() {
  const calls: Array<{ input: unknown; init?: RequestInit }> = []
  const original = globalThis.fetch
  globalThis.fetch = ((input: unknown, init?: RequestInit) => {
    calls.push({ input, init })
    return Promise.resolve(new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } }))
  }) as typeof fetch
  return { calls, restore: () => { globalThis.fetch = original } }
}

test("authFetch sends credentials include for first-party root-relative paths", async () => {
  const stub = stubFetch()
  try {
    await authFetch("/api/projects")
    assert.equal(stub.calls.length, 1)
    assert.equal(stub.calls[0].input, "/api/projects")
    assert.equal(stub.calls[0].init?.credentials, "include")
  } finally { stub.restore() }
})

test("authFetch preserves explicit credentials overrides", async () => {
  const stub = stubFetch()
  try {
    await authFetch("/api/projects", { credentials: "omit" })
    assert.equal(stub.calls[0].init?.credentials, "omit")
  } finally { stub.restore() }
})

test("authFetch does not enable credentials for absolute external URLs", async () => {
  const stub = stubFetch()
  try {
    await authFetch("https://external.example/api")
    assert.equal(stub.calls[0].init?.credentials, undefined)
  } finally { stub.restore() }
})

test("authFetch does not enable credentials for protocol-relative or relative inputs", async () => {
  const stub = stubFetch()
  try {
    await authFetch("//cdn.example.com/x")
    await authFetch("relative/path")
    assert.equal(stub.calls[0].init?.credentials, undefined)
    assert.equal(stub.calls[1].init?.credentials, undefined)
  } finally { stub.restore() }
})
