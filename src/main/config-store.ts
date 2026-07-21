import { readFile } from "node:fs/promises";
import YAML from "yaml";
import { normalizeConfig } from "../shared/config";
import type { GetConfigResponse, LaunchableItem, LauncherConfig } from "../shared/types";

export type LoadedConfig = LauncherConfig & {
  launchablesById: Map<string, LaunchableItem>;
  problems: string[];
  configPath: string;
};

function emptyConfig(configPath: string): LoadedConfig {
  return {
    appName: "ELI HMI Launcher",
    menu: [],
    launchablesById: new Map(),
    problems: [],
    configPath,
  };
}

function collectLaunchables(config: LauncherConfig): Map<string, LaunchableItem> {
  const launchablesById = new Map<string, LaunchableItem>();

  function walk(nodes: LauncherConfig["menu"]): void {
    for (const node of nodes) {
      for (const launchable of node.launchables ?? []) {
        launchablesById.set(launchable.id, launchable);
      }
      walk(node.children ?? []);
    }
  }

  walk(config.menu);
  return launchablesById;
}

export async function readLauncherConfig(configPath: string): Promise<LoadedConfig> {
  let fileContent: string;

  try {
    fileContent = await readFile(configPath, "utf8");
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Cannot read config file "${configPath}": ${reason}`);
  }

  let parsed: unknown;

  try {
    parsed = YAML.parse(fileContent);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`YAML syntax error in "${configPath}": ${reason}`);
  }

  const { config, problems } = normalizeConfig(parsed);

  return {
    ...config,
    launchablesById: collectLaunchables(config),
    problems,
    configPath,
  };
}

export class LauncherConfigStore {
  private current: LoadedConfig = emptyConfig("");
  private initialLoadError: string | null = null;

  async initialize(configPath: string): Promise<void> {
    try {
      this.current = await readLauncherConfig(configPath);
      this.initialLoadError = null;
    } catch (error) {
      this.current = emptyConfig(configPath);
      this.initialLoadError = error instanceof Error ? error.message : String(error);
    }
  }

  /**
   * Load and validate a replacement before changing the active configuration.
   * A failed reload therefore leaves every visible/launchable item from the
   * last successful configuration intact.
   */
  async reload(configPath: string): Promise<GetConfigResponse> {
    const replacement = await readLauncherConfig(configPath);
    this.current = replacement;
    this.initialLoadError = null;
    return this.getResponse();
  }

  getResponse(): GetConfigResponse {
    if (this.initialLoadError) {
      throw new Error(this.initialLoadError);
    }

    return {
      appName: this.current.appName,
      menu: this.current.menu,
      problems: this.current.problems,
      configPath: this.current.configPath,
    };
  }

  getLaunchable(itemId: string): LaunchableItem | undefined {
    return this.current.launchablesById.get(itemId);
  }
}
