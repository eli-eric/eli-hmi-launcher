import assert from "node:assert/strict";
import test from "node:test";
import { collectFacets, collectMatches, matchesFacets, matchesQuery, pruneMenu } from "../src/shared/search";
import type { LaunchableItem, MenuNode } from "../src/shared/types";

const item: LaunchableItem = { id: "hidden-id-token", name: "Vacuum Overview", note: "Main operator panel", technology: "CS Studio", section: "Vacuum", type: "executable", command: "/opt/secret-command-token" };

test("search matches only name and note", () => {
  assert.equal(matchesQuery(item, "vacuum"), true);
  assert.equal(matchesQuery(item, "operator"), true);
  assert.equal(matchesQuery(item, "hidden-id-token"), false);
  assert.equal(matchesQuery(item, "CS Studio"), false);
  assert.equal(matchesQuery(item, "secret-command-token"), false);
});

test("facets filter only technology and section", () => {
  assert.equal(matchesFacets(item, "cs studio", "vacuum"), true);
  assert.equal(matchesFacets(item, "Web", ""), false);
  assert.equal(matchesFacets(item, "", "Motion"), false);
});

test("facet values are de-duplicated case-insensitively", () => {
  const menu: MenuNode[] = [{ label: "A", launchables: [item] }, { label: "B", launchables: [{ ...item, id: "2", technology: "cs studio", section: "Motion" }] }];
  assert.deepEqual(collectFacets(menu), { technologies: ["CS Studio"], sections: ["Motion", "Vacuum"] });
});

test("collectMatches and pruneMenu retain only matching branches", () => {
  const menu: MenuNode[] = [{ label: "Keep", launchables: [item] }, { label: "Drop", launchables: [{ ...item, id: "2", name: "Timing", note: "Clock", section: "Timing" }] }];
  const filter = { query: "operator", technology: "CS Studio", section: "Vacuum" };
  assert.equal(collectMatches(menu, filter).length, 1);
  assert.deepEqual(pruneMenu(menu, filter).map((node) => node.label), ["Keep"]);
});
