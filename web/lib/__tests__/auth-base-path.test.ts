import test from "node:test"
import assert from "node:assert/strict"
import { withBasePath } from "../auth.ts"

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
