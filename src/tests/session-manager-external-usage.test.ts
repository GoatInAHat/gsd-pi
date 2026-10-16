// gsd-pi + SessionManager external-usage accounting (#2821): cumulative
// child-process subagent usage reconciles into the session totals with
// positive deltas — repeated, late, or replayed updates never double count,
// and nothing (completion, worker-row expiry) ever reduces the total.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { SessionManager } from "../../packages/pi-coding-agent/src/core/session-manager.ts";

function freshSession(): InstanceType<typeof SessionManager> {
	return SessionManager.inMemory("/tmp/gsd-pi-external-usage");
}

function combinedTotals(session: InstanceType<typeof SessionManager>) {
	return session.getUsageTotals({ includeExternalUsage: true });
}

describe("SessionManager.addExternalUsage", () => {
	it("includes external usage in getUsageTotals on top of session entries", () => {
		const session = freshSession();
		assert.deepEqual(combinedTotals(session), { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0 });

		session.addExternalUsage("child-a", { input: 100, output: 50, cacheRead: 10, cacheWrite: 5, cost: 0.01 });

		assert.deepEqual(combinedTotals(session), {
			input: 100,
			output: 50,
			cacheRead: 10,
			cacheWrite: 5,
			cost: 0.01,
		});
	});

	it("default getUsageTotals stays parent-only so child tokens never distort derived percentages", () => {
		const session = freshSession();
		session.addExternalUsage("child-a", { input: 900, output: 50, cacheRead: 900, cacheWrite: 5, cost: 0.5 });

		assert.deepEqual(session.getUsageTotals(), { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0 });
		assert.equal(combinedTotals(session).cost, 0.5);
	});

	it("starting a new session drops external usage (session-scoped accounting)", () => {
		const session = freshSession();
		session.addExternalUsage("child-a", { input: 100, output: 50, cacheRead: 0, cacheWrite: 0, cost: 2 });
		session.newSession();

		assert.deepEqual(session.getUsageTotals(), { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0 });
		assert.deepEqual(
			combinedTotals(session),
			{ input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0 },
			"child spend from the previous session must not leak into the new one",
		);
	});

	it("a background child's post-switch snapshots do not bill the new session", () => {
		const session = freshSession();
		session.addExternalUsage("child-a", { input: 100, output: 50, cacheRead: 0, cacheWrite: 0, cost: 0.01 });
		session.newSession();
		// The old session's child keeps streaming; its next cumulative snapshot
		// must be dropped instead of billing the new session for old work.
		session.addExternalUsage("child-a", { input: 300, output: 120, cacheRead: 0, cacheWrite: 0, cost: 0.04 });

		assert.deepEqual(
			combinedTotals(session),
			{ input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0 },
		);
	});

	it("branching into a new session drops external usage", () => {
		const session = freshSession();
		session.appendMessage({
			role: "user",
			content: [{ type: "text", text: "hello" }],
		} as any);
		const leafId = session.appendMessage({
			role: "assistant",
			content: [{ type: "text", text: "hi" }],
			usage: { input: 10, output: 5, cacheRead: 0, cacheWrite: 0, cost: { total: 0.001 } },
		} as any);
		session.addExternalUsage("child-a", { input: 100, output: 50, cacheRead: 0, cacheWrite: 0, cost: 2 });

		session.createBranchedSession(leafId);

		// Parent entries on the branched path are kept; the discarded session's
		// child spend is not inherited.
		assert.deepEqual(
			combinedTotals(session),
			{ input: 10, output: 5, cacheRead: 0, cacheWrite: 0, cost: 0.001 },
		);
	});

	it("a child registered at launch does not bill the session it first reports after a switch", () => {
		const session = freshSession();
		// Launch path binds the key with a zero snapshot before any await.
		session.addExternalUsage("child-a", { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0 });
		session.newSession();
		// First real usage arrives after the switch: dropped, not billed.
		session.addExternalUsage("child-a", { input: 300, output: 120, cacheRead: 0, cacheWrite: 0, cost: 0.04 });

		assert.deepEqual(
			combinedTotals(session),
			{ input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0 },
		);
	});

	it("switching session files drops external usage", () => {
		const session = freshSession();
		session.addExternalUsage("child-a", { input: 100, output: 50, cacheRead: 0, cacheWrite: 0, cost: 2 });
		session.setSessionFile("/tmp/gsd-pi-external-usage-switch-does-not-exist.jsonl");

		assert.deepEqual(
			combinedTotals(session),
			{ input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0 },
		);
	});

	it("banks only the positive delta of a growing cumulative snapshot", () => {
		const session = freshSession();
		session.addExternalUsage("child-a", { input: 100, output: 50, cacheRead: 0, cacheWrite: 0, cost: 0.01 });
		session.addExternalUsage("child-a", { input: 300, output: 120, cacheRead: 0, cacheWrite: 0, cost: 0.04 });

		const totals = combinedTotals(session);
		assert.equal(totals.input, 300);
		assert.equal(totals.output, 120);
		assert.equal(totals.cost, 0.04);
	});

	it("is idempotent for repeated identical snapshots", () => {
		const session = freshSession();
		const snapshot = { input: 100, output: 50, cacheRead: 10, cacheWrite: 5, cost: 0.01 };
		session.addExternalUsage("child-a", snapshot);
		session.addExternalUsage("child-a", snapshot);
		session.addExternalUsage("child-a", snapshot);

		assert.equal(combinedTotals(session).cost, 0.01);
		assert.equal(combinedTotals(session).input, 100);
	});

	it("ignores a late lower snapshot instead of going negative or double counting", () => {
		const session = freshSession();
		session.addExternalUsage("child-a", { input: 300, output: 120, cacheRead: 0, cacheWrite: 0, cost: 0.04 });
		// A replayed earlier partial update arrives after the high-water mark.
		session.addExternalUsage("child-a", { input: 100, output: 50, cacheRead: 0, cacheWrite: 0, cost: 0.01 });

		const totals = combinedTotals(session);
		assert.equal(totals.cost, 0.04);
		assert.equal(totals.input, 300);
		assert.equal(totals.output, 120);
	});

	it("counts concurrent children once each, completed or not", () => {
		const session = freshSession();
		session.addExternalUsage("child-a", { input: 100, output: 50, cacheRead: 0, cacheWrite: 0, cost: 0.01 });
		session.addExternalUsage("child-b", { input: 200, output: 60, cacheRead: 0, cacheWrite: 0, cost: 0.02 });
		session.addExternalUsage("child-c", { input: 300, output: 70, cacheRead: 0, cacheWrite: 0, cost: 0.03 });
		// Out-of-order completion replays: children report again after siblings
		// already finished — their own totals must not move.
		session.addExternalUsage("child-a", { input: 100, output: 50, cacheRead: 0, cacheWrite: 0, cost: 0.01 });
		session.addExternalUsage("child-c", { input: 300, output: 70, cacheRead: 0, cacheWrite: 0, cost: 0.03 });

		const totals = combinedTotals(session);
		assert.equal(totals.input, 600);
		assert.equal(totals.output, 180);
		assert.equal(totals.cost, 0.06);
	});

	it("keeps a completed child's usage after its reporting stops (row expiry)", () => {
		const session = freshSession();
		session.addExternalUsage("child-a", { input: 100, output: 50, cacheRead: 0, cacheWrite: 0, cost: 0.01 });
		session.addExternalUsage("child-b", { input: 200, output: 60, cacheRead: 0, cacheWrite: 0, cost: 0.02 });
		// child-a completes; only child-b keeps reporting.
		session.addExternalUsage("child-b", { input: 400, output: 90, cacheRead: 0, cacheWrite: 0, cost: 0.05 });

		const totals = combinedTotals(session);
		assert.equal(totals.cost, 0.06);
		assert.equal(totals.input, 100 + 400);
	});

	it("treats non-finite reported values as zero instead of poisoning totals", () => {
		const session = freshSession();
		session.addExternalUsage("child-a", {
			input: Number.NaN,
			output: 50,
			cacheRead: 0,
			cacheWrite: 0,
			cost: Number.NaN,
		});
		session.addExternalUsage("child-a", { input: 100, output: 50, cacheRead: 0, cacheWrite: 0, cost: 0.01 });

		const totals = combinedTotals(session);
		assert.equal(totals.input, 100);
		assert.equal(totals.cost, 0.01);
	});

	it("ignores an empty key", () => {
		const session = freshSession();
		session.addExternalUsage("", { input: 100, output: 50, cacheRead: 0, cacheWrite: 0, cost: 0.01 });
		assert.deepEqual(combinedTotals(session), { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0 });
	});
});
