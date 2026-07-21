import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import YAML from "yaml";
import { normalizeConfig } from "../src/shared/config";

for (const relativePath of ["config/launcher.yaml", "config/l4.template.yaml"]) {
  test(`${relativePath} parses and validates without problems`, async () => {
    const content = await readFile(path.join(process.cwd(), relativePath), "utf8");
    const result = normalizeConfig(YAML.parse(content));
    assert.deepEqual(result.problems, []);
    assert.ok(result.config.menu.length > 0);
  });
}
