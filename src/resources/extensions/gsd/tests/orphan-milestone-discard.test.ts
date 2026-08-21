import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  _getAdapter,
  closeDatabase,
  deleteOrphanMilestoneRows,
  getMilestone,
  insertMilestone,
  insertSlice,
  openDatabase,
} from "../gsd-db.ts";
import {
  discardOrphanMilestoneReservations,
  OrphanMilestoneDiscardRefusalError,
} from "../orphan-milestone-discard.ts";

function fixture(): string {
  const base = mkdtempSync(join(tmpdir(), "gsd-orphan-discard-"));
  mkdirSync(join(base, ".gsd"), { recursive: true });
  assert.ok(openDatabase(join(base, ".gsd", "gsd.db")));
  return base;
}

function cleanup(base: string): void {
  closeDatabase();
  rmSync(base, { recursive: true, force: true });
}

test("discardOrphanMilestoneReservations deletes a target set transactionally", (t) => {
  const base = fixture();
  t.after(() => cleanup(base));
  insertMilestone({ id: "M001", title: "Reserved one", status: "queued" });
  insertMilestone({ id: "M002", title: "Reserved two", status: "queued" });
  writeFileSync(
    join(base, ".gsd", "QUEUE-ORDER.json"),
    JSON.stringify({ order: ["M003"], updatedAt: "before" }),
  );

  const result = discardOrphanMilestoneReservations(base, ["M001", "M002"]);

  assert.equal(result.ok, true);
  assert.deepEqual(result.requestedIds, ["M001", "M002"]);
  assert.ok(result.before.every((snapshot) => !snapshot.queueOrderReference));
  assert.deepEqual(result.after, [
    { id: "M001", canonicalMilestone: null },
    { id: "M002", canonicalMilestone: null },
  ]);
  assert.equal(getMilestone("M001"), null);
  assert.equal(getMilestone("M002"), null);
  const queue = JSON.parse(readFileSync(join(base, ".gsd", "QUEUE-ORDER.json"), "utf8"));
  assert.deepEqual(queue.order, ["M003"]);
});

test("the post-delete external guard rolls back the canonical transaction", (t) => {
  const base = fixture();
  t.after(() => cleanup(base));
  insertMilestone({ id: "M001", title: "Reserved", status: "queued" });
  let guardCalls = 0;

  assert.throws(
    () => deleteOrphanMilestoneRows(["M001"], () => {
      guardCalls += 1;
      if (guardCalls === 2) throw new Error("external state appeared");
    }),
    /external state appeared/,
  );
  assert.equal(guardCalls, 2);
  assert.ok(getMilestone("M001"), "the row must be restored when the final guard fails");
});

test("orphan-only preflight refuses the whole set when any target has workflow or disk state", (t) => {
  const base = fixture();
  t.after(() => cleanup(base));
  insertMilestone({ id: "M001", title: "Disk state", status: "queued" });
  insertMilestone({ id: "M002", title: "Workflow state", status: "queued" });
  insertMilestone({ id: "M003", title: "Worktree state", status: "queued" });
  insertSlice({ milestoneId: "M002", id: "S01", title: "Started" });
  mkdirSync(join(base, ".gsd", "milestones", "M001"), { recursive: true });
  mkdirSync(join(base, ".gsd-worktrees", "M003"), { recursive: true });

  assert.throws(
    () => discardOrphanMilestoneReservations(base, ["M001", "M002", "M003"]),
    (error) => {
      assert.ok(error instanceof OrphanMilestoneDiscardRefusalError);
      assert.match(error.failures.find((failure) => failure.id === "M001")!.reasons.join(" "), /directory exists/);
      assert.match(error.failures.find((failure) => failure.id === "M002")!.reasons.join(" "), /slices contains 1/);
      assert.match(error.failures.find((failure) => failure.id === "M003")!.reasons.join(" "), /worktree exists/);
      return true;
    },
  );
  assert.ok(getMilestone("M001"), "eligible peers must not be partially deleted");
  assert.ok(getMilestone("M002"), "ineligible target must remain");
  assert.ok(getMilestone("M003"), "worktree-backed target must remain");
});

test("orphan-only preflight refuses dependent references and unknown milestone-linked tables", (t) => {
  const base = fixture();
  t.after(() => cleanup(base));
  insertMilestone({ id: "M001", title: "Reserved", status: "queued" });
  insertMilestone({ id: "M002", title: "Dependent", status: "queued", depends_on: ["M001"] });
  const db = _getAdapter()!;
  db.exec("CREATE TABLE future_milestone_surface (milestone_id TEXT NOT NULL, value TEXT NOT NULL)");
  db.prepare("INSERT INTO future_milestone_surface (milestone_id, value) VALUES (?, ?)").run("M001", "unexpected");

  assert.throws(
    () => discardOrphanMilestoneReservations(base, ["M001"]),
    (error) => {
      assert.ok(error instanceof OrphanMilestoneDiscardRefusalError);
      const reasons = error.failures[0]!.reasons.join(" ");
      assert.match(reasons, /future_milestone_surface contains 1/);
      assert.match(reasons, /referenced by milestone dependencies: M002/);
      return true;
    },
  );
  assert.ok(getMilestone("M001"));
});

test("orphan-only preflight refuses queue-order and parallel-worker references", (t) => {
  const base = fixture();
  t.after(() => cleanup(base));
  insertMilestone({ id: "M001", title: "Queued reservation", status: "queued" });
  insertMilestone({ id: "M002", title: "Worker reservation", status: "queued" });
  writeFileSync(
    join(base, ".gsd", "QUEUE-ORDER.json"),
    JSON.stringify({ order: ["M001"], updatedAt: "before" }),
  );
  mkdirSync(join(base, ".gsd", "parallel"), { recursive: true });
  writeFileSync(join(base, ".gsd", "parallel", "M002.status.json"), "{}");

  assert.throws(
    () => discardOrphanMilestoneReservations(base, ["M001", "M002"]),
    (error) => {
      assert.ok(error instanceof OrphanMilestoneDiscardRefusalError);
      assert.match(error.failures.find((failure) => failure.id === "M001")!.reasons.join(" "), /QUEUE-ORDER\.json references milestone/);
      assert.match(error.failures.find((failure) => failure.id === "M002")!.reasons.join(" "), /parallel worker state exists/);
      return true;
    },
  );
  assert.ok(getMilestone("M001"));
  assert.ok(getMilestone("M002"));
});

test("orphan-only preflight rejects duplicate and malformed target IDs", (t) => {
  const base = fixture();
  t.after(() => cleanup(base));
  assert.throws(() => discardOrphanMilestoneReservations(base, ["M001", "M001"]), /must not be repeated/);
  assert.throws(() => discardOrphanMilestoneReservations(base, ["1; DROP TABLE milestones"]), /Invalid milestone ID/);
  assert.ok(existsSync(join(base, ".gsd", "gsd.db")));
});
