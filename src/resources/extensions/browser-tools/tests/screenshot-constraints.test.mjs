// Project/App: gsd-pi
// File Purpose: Regression tests for sharp module-shape normalization in screenshot-constraints.
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { inspect } from "node:util";

const { resolveSharpFactory } = await import("../screenshot-constraints.ts");

// sharp has two type/runtime surfaces (see the header comment in
// screenshot-constraints.ts): an ESM namespace whose `default` is the callable
// factory, and a CJS `export = sharp` interop result that *is* the factory.
// getSharp() used to read `.default` unconditionally, which cached `undefined`
// for the second shape — defeating the `_sharp !== undefined` cache check.
describe("resolveSharpFactory", () => {
  it("unwraps the ESM namespace shape (factory on .default)", () => {
    const factory = () => {};
    assert.strictEqual(resolveSharpFactory({ default: factory }), factory);
  });

  it("returns the module itself when it is the callable factory (export = sharp)", () => {
    const factory = () => {};
    assert.strictEqual(resolveSharpFactory(factory), factory);
  });

  it("prefers the callable module over any non-callable .default", () => {
    const factory = () => {};
    factory.default = { notCallable: true };
    assert.strictEqual(resolveSharpFactory(factory), factory);
  });

  it("returns null — never undefined — when no factory is present", () => {
    for (const mod of [{}, { default: undefined }, { default: {} }, null, undefined, 42]) {
      assert.strictEqual(
        resolveSharpFactory(mod),
        null,
        `expected null for ${inspect(mod)}`,
      );
    }
  });
});
