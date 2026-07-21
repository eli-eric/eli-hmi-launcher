import { accessSync, constants, statSync } from "node:fs";
import path from "node:path";

export type ResolveEnvironment = {
  platform: NodeJS.Platform;
  envPath: string;
  pathExt: string;
  baseDir: string;
};

export function defaultResolveEnvironment(cwd?: string): ResolveEnvironment {
  return {
    platform: process.platform,
    envPath: process.env["PATH"] ?? "",
    pathExt: process.env["PATHEXT"] ?? ".COM;.EXE;.BAT;.CMD",
    baseDir: cwd ?? process.cwd(),
  };
}

function isFile(candidate: string): boolean {
  try {
    return statSync(candidate).isFile();
  } catch {
    return false;
  }
}

function isExecutableFile(candidate: string, platform: NodeJS.Platform): boolean {
  if (!isFile(candidate)) {
    return false;
  }

  if (platform === "win32") {
    return true;
  }

  try {
    accessSync(candidate, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function candidateNames(command: string, env: ResolveEnvironment): string[] {
  if (env.platform !== "win32") {
    return [command];
  }

  const extensions = env.pathExt
    .split(";")
    .map((extension) => extension.trim())
    .filter((extension) => extension.length > 0);

  const hasKnownExtension = extensions.some((extension) => command.toLowerCase().endsWith(extension.toLowerCase()));
  return hasKnownExtension ? [command] : [command, ...extensions.map((extension) => command + extension)];
}

/**
 * Resolves an "executable" launchable command to an absolute file path before spawning,
 * so that a wrong path or a missing program produces an immediate, specific error
 * instead of a silent failure.
 *
 * Throws Error with an operator-actionable message when the command cannot be resolved.
 */
export function resolveExecutable(command: string, env: ResolveEnvironment = defaultResolveEnvironment()): string {
  const looksLikePath = command.includes("/") || command.includes("\\") || path.isAbsolute(command);

  if (looksLikePath) {
    const base = path.isAbsolute(command) ? command : path.resolve(env.baseDir, command);

    for (const candidate of candidateNames(base, env)) {
      if (isExecutableFile(candidate, env.platform)) {
        return candidate;
      }
    }

    if (isFile(base)) {
      throw new Error(`"${base}" exists but is not executable. Check the file permissions.`);
    }

    throw new Error(`Executable path does not exist: "${base}". Check the "command" value in the launcher YAML.`);
  }

  const separator = env.platform === "win32" ? ";" : ":";
  const directories = env.envPath.split(separator).filter((directory) => directory.length > 0);

  for (const directory of directories) {
    for (const candidate of candidateNames(path.join(directory, command), env)) {
      if (isExecutableFile(candidate, env.platform)) {
        return candidate;
      }
    }
  }

  throw new Error(
    `Executable "${command}" was not found on PATH. ` +
      `Use the program's full path in the "command" field, or make sure it is installed on this machine.`,
  );
}
