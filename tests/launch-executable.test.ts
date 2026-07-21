import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { launchExecutable } from "../src/main/launch-executable";
import type { ExecutableLaunchable } from "../src/shared/types";

function nodeItem(args: string[]): ExecutableLaunchable {
  return { id: "node-test", name: "Node test process", type: "executable", command: process.execPath, args };
}

test("resolves after a process survives the immediate-exit window", async () => {
  await launchExecutable(nodeItem(["-e", "setTimeout(() => process.exit(0), 250)"]), { immediateExitWindowMs: 80 });
});

test("returns an immediate non-zero exit through the launch request", async () => {
  await assert.rejects(launchExecutable(nodeItem(["-e", "process.exit(7)"]), { immediateExitWindowMs: 2000 }), /exited immediately with code 7/);
});

test("rejects a missing working directory before spawning", async () => {
  await assert.rejects(launchExecutable({ ...nodeItem(["-e", "process.exit(0)"]), cwd: path.join(process.cwd(), "missing-cwd-test") }), /Working directory does not exist/);
});
