/**
 * Regression tests for the optional sharp dependency in capture.ts.
 *
 * Behaviour:
 *   - constrainScreenshot must fall back to returning the raw buffer
 *     unchanged when sharp is unavailable, rather than throwing.
 *   - When sharp IS available, oversized screenshots get resized.
 *
 * No source-grep. The test drives the real constrainScreenshot function
 * after seeding the module-private `_sharp` cache via the test-only
 * `__setSharpForTesting` export.
 */

const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const jiti = require("jiti")(__filename, { interopDefault: true, debug: false });

const { constrainScreenshot, __setSharpForTesting } = jiti("../capture.ts");
// getScreenshotBufferDimensions is not re-exported through capture.ts; pull it
// straight from the module under change. jiti caches modules, and capture.ts
// imports screenshot-constraints.ts, so both share the same `_sharp` cache and
// the same __setSharpForTesting seam.
const { getScreenshotBufferDimensions } = jiti("../screenshot-constraints.ts");

describe("constrainScreenshot — sharp unavailable (null)", () => {
	afterEach(() => {
		// Clear the test override so later tests don't inherit a null sharp.
		__setSharpForTesting(undefined);
	});

	it("returns the raw buffer unchanged when sharp is null", async () => {
		__setSharpForTesting(null);

		const rawBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); // PNG magic bytes
		const result = await constrainScreenshot(null, rawBuffer, "image/png", 80);

		assert.strictEqual(
			result,
			rawBuffer,
			"constrainScreenshot must return the exact same buffer instance when sharp is null",
		);
	});

	it("returns the raw buffer unchanged for JPEG input when sharp is null", async () => {
		__setSharpForTesting(null);

		const rawBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]); // JPEG magic bytes
		const result = await constrainScreenshot(null, rawBuffer, "image/jpeg", 80);

		assert.strictEqual(result, rawBuffer);
	});
});

describe("constrainScreenshot — sharp available", () => {
	afterEach(() => {
		__setSharpForTesting(undefined);
	});

	it("passes through a small image unchanged (below cap)", async () => {
		const sharp = require("sharp");
		const small = await sharp({
			create: {
				width: 400,
				height: 300,
				channels: 3,
				background: { r: 128, g: 128, b: 128 },
			},
		})
			.jpeg({ quality: 80 })
			.toBuffer();

		const result = await constrainScreenshot(null, small, "image/jpeg", 80);
		const meta = await sharp(result).metadata();
		assert.equal(meta.width, 400, "small images must not be resized");
		assert.equal(meta.height, 300);
	});

	it("resizes an oversized image to within 1568px", async () => {
		const sharp = require("sharp");
		const big = await sharp({
			create: {
				width: 3000,
				height: 2000,
				channels: 3,
				background: { r: 128, g: 128, b: 128 },
			},
		})
			.jpeg({ quality: 80 })
			.toBuffer();

		const result = await constrainScreenshot(null, big, "image/jpeg", 80);
		const meta = await sharp(result).metadata();
		assert.ok(meta.width <= 1568, `width ${meta.width} must be <= 1568`);
		assert.ok(meta.height <= 1568, `height ${meta.height} must be <= 1568`);
	});
});

describe("constrainScreenshot — cached sharp value is a callable factory", () => {
	afterEach(() => {
		__setSharpForTesting(undefined);
	});

	// Regression guard for the sharp typing contract: getSharp() caches the
	// callable constructor (via resolveSharpFactory) — not the module namespace.
	// SharpFactory must resolve to that callable regardless of which type surface
	// module resolution picks: sharp ships both dist/index.d.mts
	// (`export default sharp`, so the module has a `default` property) and the
	// legacy lib/index.d.ts (`export = sharp`, so the module *is* the factory).
	// The conditional `SharpFactory` type indexes into `default` only when it
	// exists; if it regressed to the module namespace, `sharp(buffer)` would not
	// be callable. resolveSharpFactory's own unit coverage lives in
	// tests/screenshot-constraints.test.mjs; these tests instead inject a plain
	// function factory and assert the runtime consumers invoke it as a function,
	// without needing the native sharp binary.
	it("invokes the injected sharp factory as a function on the resize path", async () => {
		const calls = [];
		const makeInstance = () => ({
			metadata: async () => ({ width: 3000, height: 2000 }),
			resize: () => makeInstance(),
			png: () => makeInstance(),
			jpeg: () => makeInstance(),
			toBuffer: async () => Buffer.from([0x01, 0x02, 0x03]),
		});
		const sharpFactory = (buffer) => {
			calls.push(buffer);
			return makeInstance();
		};
		__setSharpForTesting(sharpFactory);

		const raw = Buffer.from([0xff, 0xd8, 0xff, 0xe0]); // JPEG magic bytes
		const result = await constrainScreenshot(null, raw, "image/jpeg", 80);

		assert.ok(
			calls.length >= 1,
			"the cached sharp value must be invoked as a callable factory",
		);
		assert.ok(Buffer.isBuffer(result), "resize path must return a Buffer");
	});

	it("invokes the injected sharp factory as a function on the metadata path", async () => {
		const calls = [];
		const sharpFactory = (buffer) => {
			calls.push(buffer);
			return {
				metadata: async () => ({ width: 1024, height: 768 }),
			};
		};
		__setSharpForTesting(sharpFactory);

		const raw = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // PNG magic bytes
		const dims = await getScreenshotBufferDimensions(raw);

		assert.equal(calls.length, 1, "the cached sharp value must be called as a factory");
		assert.strictEqual(calls[0], raw, "the raw buffer must be handed to the factory");
		assert.deepEqual(
			dims,
			{ width: 1024, height: 768 },
			"getScreenshotBufferDimensions must read width/height from sharp().metadata()",
		);
	});
});
