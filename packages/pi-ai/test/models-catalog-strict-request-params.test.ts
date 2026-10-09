import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MODELS } from "../src/models.generated.ts";

/**
 * #2500 / #2645 — the strict-surface compat flags are authored in the
 * generator and must land in BOTH generated artifacts. The JSON is consumed
 * by tooling, the TS module by `getModel()` at runtime; a mismatch silently
 * drops the request guards for real traffic (seen when a naive patch marked
 * the wrong entries).
 */

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

interface CatalogCompat {
	strictRequestParams?: boolean;
	thinkingOffMode?: string;
	rejectsTemperature?: boolean;
	rejectsForcedToolChoice?: boolean;
}

function jsonCompatMap(): Map<string, CatalogCompat> {
	// Generated data file (JSON), not source — read as data for parity checking.
	const raw = JSON.parse(
		readFileSync(join(packageRoot, "src", "models.generated.json"), "utf8"),
	) as Record<string, Record<string, { id?: string; compat?: CatalogCompat }>>;
	const marked = new Map<string, CatalogCompat>();
	for (const [provider, models] of Object.entries(raw)) {
		for (const entry of Object.values(models)) {
			const compat = entry.compat ?? {};
			const isMarked =
				compat.strictRequestParams === true ||
				compat.thinkingOffMode !== undefined ||
				compat.rejectsTemperature === true ||
				compat.rejectsForcedToolChoice === true;
			if (isMarked) {
				// Key by provider:id — the same id can be marked differently per
				// provider (e.g. claude-fable-5.1 on cloudflare vs Copilot).
				marked.set(`${provider}:${entry.id ?? "unknown"}`, compat);
			}
		}
	}
	return marked;
}

function tsCompatMap(): Map<string, CatalogCompat> {
	const marked = new Map<string, CatalogCompat>();
	for (const [provider, models] of Object.entries(MODELS)) {
		for (const [key, entry] of Object.entries(models)) {
			const compat = (entry as { compat?: CatalogCompat }).compat ?? {};
			const isMarked =
				compat.strictRequestParams === true ||
				compat.thinkingOffMode !== undefined ||
				compat.rejectsTemperature === true ||
				compat.rejectsForcedToolChoice === true;
			if (isMarked) {
				marked.set(`${provider}:${(entry as { id?: string }).id ?? key}`, compat);
			}
		}
	}
	return marked;
}

describe("strict-surface catalog parity (#2500/#2645)", () => {
	it("marks the same compat in models.generated.json and models.generated.ts", () => {
		const fromJson = jsonCompatMap();
		const fromTs = tsCompatMap();

		expect(fromTs.size, "TS catalog must mark entries").toBeGreaterThan(0);
		expect([...fromJson.keys()].sort()).toEqual([...fromTs.keys()].sort());
		for (const [id, compat] of fromJson) {
			expect(fromTs.get(id)).toEqual(compat);
		}
	});
});

describe("strictRequestParams umbrella (#2500/#2645)", () => {
	it("only marks anthropic-messages / anthropic-vertex API models", () => {
		for (const models of Object.values(MODELS)) {
			for (const entry of Object.values(models) as Array<{ api: string; compat?: CatalogCompat }>) {
				if (entry.compat?.strictRequestParams === true) {
					expect(["anthropic-messages", "anthropic-vertex"]).toContain(entry.api);
				}
			}
		}
	});

	it("marks claude-sonnet-5-5 on the anthropic provider", () => {
		const entry = MODELS.anthropic?.["claude-sonnet-5-5"] as
			| { compat?: CatalogCompat }
			| undefined;
		expect(entry?.compat?.strictRequestParams).toBe(true);
	});

	it("marks Opus 5.5 and Fable 5.1 on the anthropic provider (#2645)", () => {
		for (const id of ["claude-opus-5-5", "claude-fable-5-1"]) {
			const entry = MODELS.anthropic?.[id] as { compat?: CatalogCompat } | undefined;
			expect(entry?.compat?.strictRequestParams, id).toBe(true);
		}
	});

	it("does NOT umbrella-mark Fable 5, which still accepts forced tool_choice (#2645)", () => {
		const entry = MODELS.anthropic?.["claude-fable-5"] as { compat?: CatalogCompat } | undefined;
		expect(entry?.compat?.strictRequestParams).toBeUndefined();
		expect(entry?.compat?.thinkingOffMode).toBe("between_tools");
		expect(entry?.compat?.rejectsTemperature).toBe(true);
	});

	it("marks the 5.5/5.1 relay entries on Copilot with both omitters (#2645)", () => {
		for (const id of ["claude-sonnet-5.5", "claude-opus-5.5", "claude-fable-5.1"]) {
			const entry = MODELS["github-copilot"]?.[id] as { compat?: CatalogCompat } | undefined;
			expect(entry?.compat?.rejectsTemperature, id).toBe(true);
			expect(entry?.compat?.rejectsForcedToolChoice, id).toBe(true);
		}
	});

	it("marks the Fable 5 relay entry with rejectsTemperature only (#2645)", () => {
		const entry = MODELS["github-copilot"]?.["claude-fable-5"] as { compat?: CatalogCompat } | undefined;
		expect(entry?.compat?.rejectsTemperature).toBe(true);
		expect(entry?.compat?.rejectsForcedToolChoice).toBeUndefined();
	});

	it("marks OpenRouter Claude 5.x relay entries (#2645)", () => {
		const entry = MODELS.openrouter?.["anthropic/claude-opus-5.5"] as { compat?: CatalogCompat } | undefined;
		expect(entry?.compat?.rejectsTemperature).toBe(true);
		expect(entry?.compat?.rejectsForcedToolChoice).toBe(true);
	});
});
