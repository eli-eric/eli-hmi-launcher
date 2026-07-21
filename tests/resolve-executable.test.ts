import assert from "node:assert/strict";
import { chmod, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { resolveExecutable, type ResolveEnvironment } from "../src/main/resolve-executable";

test("resolves absolute paths and PATH entries", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "eli-launcher-exec-"));
  const executable = path.join(directory, "panel");
  await writeFile(executable, "#!/bin/sh\nexit 0\n");
  await chmod(executable, 0o755);
  const env: ResolveEnvironment = { platform: "linux", envPath: directory, pathExt: "", baseDir: directory };
  assert.equal(resolveExecutable(executable, env), executable);
  assert.equal(resolveExecutable("panel", env), executable);
});

test("reports missing and non-executable files", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "eli-launcher-exec-"));
  const nonExecutable = path.join(directory, "panel");
  await writeFile(nonExecutable, "not executable\n");
  await chmod(nonExecutable, 0o644);
  const env: ResolveEnvironment = { platform: "linux", envPath: directory, pathExt: "", baseDir: directory };
  assert.throws(() => resolveExecutable(nonExecutable, env), /exists but is not executable/);
  assert.throws(() => resolveExecutable("missing", env), /was not found on PATH/);
});
