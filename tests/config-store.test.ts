import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { LauncherConfigStore } from "../src/main/config-store";

const validYaml = `appName: Stable config\nmenu:\n  - label: L4\n    launchables:\n      - id: stable-item\n        name: Stable item\n        type: web\n        url: https://example.test\n`;

test("failed reload preserves the last successful config and launch map", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "eli-launcher-store-"));
  const configPath = path.join(directory, "launcher.yaml");
  await writeFile(configPath, validYaml);
  const store = new LauncherConfigStore();
  await store.initialize(configPath);
  assert.equal(store.getResponse().appName, "Stable config");
  await writeFile(configPath, "menu: [broken");
  await assert.rejects(store.reload(configPath), /YAML syntax error/);
  assert.equal(store.getResponse().appName, "Stable config");
  assert.equal(store.getLaunchable("stable-item")?.name, "Stable item");
});

test("successful reload recovers from an initial read error", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "eli-launcher-store-"));
  const configPath = path.join(directory, "missing.yaml");
  const store = new LauncherConfigStore();
  await store.initialize(configPath);
  assert.throws(() => store.getResponse(), /Cannot read config file/);
  await writeFile(configPath, validYaml);
  assert.equal((await store.reload(configPath)).appName, "Stable config");
});
