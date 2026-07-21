export type LaunchableBase = {
  id: string;
  /** Operator-facing name shown on tiles and in the tree. Searchable. */
  name: string;
  /** Free-text note shown under the name. Searchable. */
  note?: string;
  /** Implementation technology (for example "CS Studio", "WinCC OA", "Web"). Filterable, not searchable. */
  technology?: string;
  /** Machine/facility section (for example "Vacuum", "Motion"). Filterable, not searchable. */
  section?: string;
};

export type WebLaunchable = LaunchableBase & {
  type: "web";
  url: string;
};

export type ExecutableLaunchable = LaunchableBase & {
  type: "executable";
  command: string;
  args?: string[];
  cwd?: string;
};

export type LaunchableItem = WebLaunchable | ExecutableLaunchable;

export type MenuNode = {
  label?: string;
  launchables?: LaunchableItem[];
  children?: MenuNode[];
};

export type LauncherConfig = {
  appName: string;
  menu: MenuNode[];
};

export type GetConfigResponse = LauncherConfig & {
  /** Human-readable validation problems found while loading the YAML file. */
  problems: string[];
  /** Absolute path of the YAML file that was loaded, for error messages. */
  configPath: string;
};

export type LaunchResult = {
  ok: true;
};
