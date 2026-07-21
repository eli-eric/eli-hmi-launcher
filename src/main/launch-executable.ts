import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";
import path from "node:path";
import type { ExecutableLaunchable } from "../shared/types";
import { resolveExecutable } from "./resolve-executable";

export type LaunchExecutableOptions = {
  immediateExitWindowMs?: number;
  platform?: NodeJS.Platform;
};

function quoteForCmd(value: string): string {
  return /[\s"^&|<>()%!]/.test(value) ? `"${value.replaceAll('"', '\\"')}"` : value;
}

export async function launchExecutable(
  item: ExecutableLaunchable,
  options: LaunchExecutableOptions = {},
): Promise<void> {
  const platform = options.platform ?? process.platform;
  const immediateExitWindowMs = options.immediateExitWindowMs ?? 2000;
  const cwd = item.cwd ? path.resolve(item.cwd) : undefined;

  if (cwd) {
    let cwdStats;
    try {
      cwdStats = await stat(cwd);
    } catch {
      throw new Error(`Working directory does not exist: "${cwd}". Fix the "cwd" value for "${item.name}".`);
    }

    if (!cwdStats.isDirectory()) {
      throw new Error(`Working directory is not a directory: "${cwd}". Fix the "cwd" value for "${item.name}".`);
    }
  }

  const resolved = resolveExecutable(item.command);
  const args = item.args ?? [];
  const needsCmdShell = platform === "win32" && /\.(bat|cmd)$/i.test(resolved);
  const spawnCommand = needsCmdShell ? "cmd.exe" : resolved;
  const spawnArgs = needsCmdShell
    ? ["/d", "/s", "/c", `"${[resolved, ...args].map(quoteForCmd).join(" ")}"`]
    : args;

  const child = spawn(spawnCommand, spawnArgs, {
    detached: true,
    stdio: "ignore",
    shell: false,
    cwd,
    windowsVerbatimArguments: needsCmdShell,
  });

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    let successTimer: NodeJS.Timeout | undefined;

    const cleanup = (): void => {
      if (successTimer) {
        clearTimeout(successTimer);
      }
      child.removeListener("spawn", onSpawn);
      child.removeListener("error", onError);
      child.removeListener("exit", onExit);
    };

    const settleSuccess = (): void => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      child.unref();
      resolve();
    };

    const settleFailure = (error: Error): void => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(error);
    };

    function onSpawn(): void {
      successTimer = setTimeout(settleSuccess, immediateExitWindowMs);
    }

    function onError(error: Error): void {
      settleFailure(new Error(`Failed to start "${resolved}": ${error.message}`));
    }

    function onExit(code: number | null, signal: NodeJS.Signals | null): void {
      const failed = (code !== null && code !== 0) || signal !== null;

      if (!failed) {
        settleSuccess();
        return;
      }

      const reason = signal ? `was terminated by signal ${signal}` : `exited immediately with code ${code}`;
      settleFailure(new Error(`"${item.name}" started but ${reason}. Check the "command" and "args" values.`));
    }

    child.once("spawn", onSpawn);
    child.once("error", onError);
    child.once("exit", onExit);
  });
}
