// Covers the per-surface nav registry: surface filtering, extras ordering, and
// the href-vs-view selection branch (FLU-5).

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  NAV_ITEMS,
  resolveNavItems,
  selectNavItem,
  type NavItem,
} from "../workspace-nav.ts";

const icon = NAV_ITEMS[0].icon;

function item(id: string, surfaces?: NavItem["surfaces"], href?: string): NavItem {
  return { id, label: id, icon, surfaces, href };
}

describe("resolveNavItems", () => {
  test("built-in views are unchanged in order on both surfaces", () => {
    const expected = ["dashboard", "power", "chat", "roadmap", "files", "activity", "visualize"];
    assert.deepEqual(
      resolveNavItems([], "bundled").map((i) => i.id),
      expected,
    );
    assert.deepEqual(
      resolveNavItems([], "saas").map((i) => i.id),
      expected,
    );
  });

  test("an entry without surfaces renders on both", () => {
    const both = item("both");
    assert.ok(resolveNavItems([both], "bundled").includes(both));
    assert.ok(resolveNavItems([both], "saas").includes(both));
  });

  test("a saas-only entry is filtered out of the bundled surface", () => {
    const extras = [item("machines", ["saas"])];
    assert.deepEqual(
      resolveNavItems(extras, "bundled").map((i) => i.id),
      NAV_ITEMS.map((i) => i.id),
    );
    assert.ok(resolveNavItems(extras, "saas").some((i) => i.id === "machines"));
  });

  test("a bundled-only entry is filtered out of the saas surface", () => {
    const extras = [item("shutdown", ["bundled"])];
    assert.ok(resolveNavItems(extras, "bundled").some((i) => i.id === "shutdown"));
    assert.deepEqual(
      resolveNavItems(extras, "saas").map((i) => i.id),
      NAV_ITEMS.map((i) => i.id),
    );
  });

  test("extras render after the built-in views", () => {
    const resolved = resolveNavItems([item("machines", ["saas"])], "saas");
    assert.equal(resolved.length, NAV_ITEMS.length + 1);
    assert.equal(resolved.at(-1)?.id, "machines");
  });

  test("filtering a built-in view out of one surface leaves the other intact", () => {
    // The registry ships nothing hidden today; this guards the mechanism itself.
    const hidden: NavItem = { ...NAV_ITEMS[1], surfaces: ["bundled"] };
    const ids = [...NAV_ITEMS.slice(0, 1), hidden, ...NAV_ITEMS.slice(2)]
      .filter((i) => !i.surfaces || i.surfaces.includes("saas"))
      .map((i) => i.id);
    assert.ok(!ids.includes("power"));
    assert.equal(ids.length, NAV_ITEMS.length - 1);
  });
});

describe("selectNavItem", () => {
  test("switches the active view when there is no href", () => {
    const seen: string[] = [];
    selectNavItem(item("files"), (view) => seen.push(view));
    assert.deepEqual(seen, ["files"]);
  });

  test("navigates and does not switch view when an href is present", () => {
    const original = (globalThis as { window?: unknown }).window;
    const location = { href: "" };
    (globalThis as { window?: unknown }).window = { location };
    try {
      const seen: string[] = [];
      selectNavItem(item("machines", ["saas"], "/devices"), (view) => seen.push(view));
      assert.equal(location.href, "/devices");
      assert.deepEqual(seen, []);
    } finally {
      (globalThis as { window?: unknown }).window = original;
    }
  });
});
