import assert from "node:assert/strict";
import test from "node:test";
import { normalizeConfig } from "../src/shared/config";

function oneLaunchable(overrides: Record<string, unknown> = {}): unknown {
  return {
    appName: "Test launcher",
    menu: [{ label: "L4", launchables: [{ id: "gui-1", name: "Vacuum Overview", note: "Main operator panel", technology: "Web", section: "Vacuum", type: "web", url: "https://example.test/vacuum", ...overrides }] }],
  };
}

test("normalizes a valid launchable", () => {
  const result = normalizeConfig(oneLaunchable());
  assert.equal(result.problems.length, 0);
  assert.equal(result.config.menu[0]?.launchables?.[0]?.name, "Vacuum Overview");
});

test("requires a user-facing name", () => {
  const result = normalizeConfig(oneLaunchable({ name: undefined }));
  assert.equal(result.config.menu[0]?.launchables, undefined);
  assert.match(result.problems.join("\n"), /missing the required "name" field/);
});

test("accepts legacy label with a migration warning", () => {
  const result = normalizeConfig(oneLaunchable({ name: undefined, label: "Legacy name" }));
  assert.equal(result.config.menu[0]?.launchables?.[0]?.name, "Legacy name");
  assert.match(result.problems.join("\n"), /uses legacy field "label"/);
});

test("rejects args that are not a YAML list", () => {
  const result = normalizeConfig(oneLaunchable({ type: "executable", url: undefined, command: "program", args: "--workspace L4" }));
  assert.equal(result.config.menu[0]?.launchables, undefined);
  assert.match(result.problems.join("\n"), /"args" must be a YAML list/);
});

test("rejects structured values inside args", () => {
  const result = normalizeConfig(oneLaunchable({ type: "executable", url: undefined, command: "program", args: [{ bad: true }] }));
  assert.equal(result.config.menu[0]?.launchables, undefined);
  assert.match(result.problems.join("\n"), /argument must be a string, number, or boolean scalar/);
});

test("rejects invalid and non-http web URLs", () => {
  assert.match(normalizeConfig(oneLaunchable({ url: "not a URL" })).problems.join("\n"), /invalid URL/);
  assert.match(normalizeConfig(oneLaunchable({ url: "file:\/\/\/tmp\/panel.html" })).problems.join("\n"), /must use an http:\/\/ or https:\/\/ URL/);
});

test("rejects duplicate ids across groups", () => {
  const result = normalizeConfig({ menu: [
    { label: "A", launchables: [{ id: "same", name: "A", type: "web", url: "https://a.test" }] },
    { label: "B", launchables: [{ id: "same", name: "B", type: "web", url: "https://b.test" }] },
  ] });
  assert.equal(result.config.menu[0]?.launchables?.length, 1);
  assert.equal(result.config.menu[1]?.launchables, undefined);
  assert.match(result.problems.join("\n"), /duplicate launchable id "same"/);
});
