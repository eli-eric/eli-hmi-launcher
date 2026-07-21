import type { LaunchableItem, LauncherConfig, MenuNode } from "./types";

export type NormalizedConfig = {
  config: LauncherConfig;
  /** Human-readable problems found in the YAML. Valid entries remain usable. */
  problems: string[];
};

function asTrimmedString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function optionalString(
  record: Record<string, unknown>,
  key: string,
  where: string,
  problems: string[],
): { valid: boolean; value?: string } {
  const raw = record[key];

  if (raw === undefined || raw === null || raw === "") {
    return { valid: true };
  }

  const value = asTrimmedString(raw);
  if (!value) {
    problems.push(`${where}: optional field "${key}" must be a non-empty string when provided.`);
    return { valid: false };
  }

  return { valid: true, value };
}

function normalizeArgs(raw: unknown, where: string, problems: string[]): string[] | undefined | null {
  if (raw === undefined || raw === null) {
    return undefined;
  }

  if (!Array.isArray(raw)) {
    problems.push(`${where}: "args" must be a YAML list, for example ["--workspace", "L4"].`);
    return null;
  }

  const args: string[] = [];

  for (const [index, value] of raw.entries()) {
    if (!["string", "number", "boolean"].includes(typeof value)) {
      problems.push(`${where}.args[${index}]: argument must be a string, number, or boolean scalar.`);
      return null;
    }

    args.push(String(value));
  }

  return args;
}

function normalizeLaunchable(
  raw: unknown,
  where: string,
  problems: string[],
  seenIds: Set<string>,
): LaunchableItem | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    problems.push(`${where}: launchable entry is not a YAML mapping.`);
    return null;
  }

  const record = raw as Record<string, unknown>;
  const id = asTrimmedString(record["id"]);

  if (!id) {
    problems.push(`${where}: launchable is missing the required "id" field.`);
    return null;
  }

  if (seenIds.has(id)) {
    problems.push(`${where}: duplicate launchable id "${id}". Ids must be unique across the whole file.`);
    return null;
  }

  const explicitName = asTrimmedString(record["name"]);
  const legacyLabel = asTrimmedString(record["label"]);
  const name = explicitName ?? legacyLabel;

  if (!name) {
    problems.push(`${where}: launchable "${id}" is missing the required "name" field.`);
    return null;
  }

  if (!explicitName && legacyLabel) {
    problems.push(`${where}: launchable "${id}" uses legacy field "label"; rename it to "name".`);
  }

  const explicitNote = optionalString(record, "note", where, problems);
  const legacyDescription = optionalString(record, "description", where, problems);
  const technology = optionalString(record, "technology", where, problems);
  const section = optionalString(record, "section", where, problems);

  if (!explicitNote.valid || !legacyDescription.valid || !technology.valid || !section.valid) {
    return null;
  }

  const note = explicitNote.value ?? legacyDescription.value;
  if (!explicitNote.value && legacyDescription.value) {
    problems.push(`${where}: launchable "${id}" uses legacy field "description"; rename it to "note".`);
  }

  const type = asTrimmedString(record["type"]);

  if (type === "web") {
    const url = asTrimmedString(record["url"]);

    if (!url) {
      problems.push(`${where}: web launchable "${id}" is missing the required "url" field.`);
      return null;
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      problems.push(`${where}: web launchable "${id}" has an invalid URL: "${url}".`);
      return null;
    }

    if (!new Set(["http:", "https:"]).has(parsedUrl.protocol)) {
      problems.push(`${where}: web launchable "${id}" must use an http:// or https:// URL.`);
      return null;
    }

    seenIds.add(id);
    return {
      id,
      name,
      note,
      technology: technology.value,
      section: section.value,
      type: "web",
      url,
    };
  }

  if (type === "executable") {
    const command = asTrimmedString(record["command"]);

    if (!command) {
      problems.push(`${where}: executable launchable "${id}" is missing the required "command" field.`);
      return null;
    }

    const args = normalizeArgs(record["args"], where, problems);
    const cwd = optionalString(record, "cwd", where, problems);

    if (args === null || !cwd.valid) {
      return null;
    }

    seenIds.add(id);
    return {
      id,
      name,
      note,
      technology: technology.value,
      section: section.value,
      type: "executable",
      command,
      args,
      cwd: cwd.value,
    };
  }

  problems.push(`${where}: launchable "${id}" has unsupported type "${type ?? "(missing)"}". Use "web" or "executable".`);
  return null;
}

function normalizeMenuNodes(raw: unknown, where: string, problems: string[], seenIds: Set<string>): MenuNode[] {
  if (raw === undefined || raw === null) {
    return [];
  }

  if (!Array.isArray(raw)) {
    problems.push(`${where}: expected a list of groups.`);
    return [];
  }

  const nodes: MenuNode[] = [];

  for (const [index, entry] of raw.entries()) {
    const nodeWhere = `${where}[${index}]`;

    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      problems.push(`${nodeWhere}: group entry is not a YAML mapping.`);
      continue;
    }

    const record = entry as Record<string, unknown>;
    const label = asTrimmedString(record["label"]);

    if (!label) {
      problems.push(`${nodeWhere}: group is missing the required "label" field and was skipped.`);
      continue;
    }

    const launchables: LaunchableItem[] = [];
    const rawLaunchables = record["launchables"];

    if (rawLaunchables !== undefined && rawLaunchables !== null) {
      if (!Array.isArray(rawLaunchables)) {
        problems.push(`${nodeWhere}: "launchables" must be a list.`);
      } else {
        for (const [itemIndex, item] of rawLaunchables.entries()) {
          const normalized = normalizeLaunchable(item, `${nodeWhere}.launchables[${itemIndex}]`, problems, seenIds);
          if (normalized) {
            launchables.push(normalized);
          }
        }
      }
    }

    const children = normalizeMenuNodes(record["children"], `${nodeWhere}.children`, problems, seenIds);

    nodes.push({
      label,
      launchables: launchables.length > 0 ? launchables : undefined,
      children: children.length > 0 ? children : undefined,
    });
  }

  return nodes;
}

export function normalizeConfig(parsed: unknown): NormalizedConfig {
  const problems: string[] = [];

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {
      config: { appName: "ELI HMI Launcher", menu: [] },
      problems: ["Config file is empty or is not a YAML mapping."],
    };
  }

  const raw = parsed as Record<string, unknown>;
  const explicitAppName = asTrimmedString(raw["appName"]);
  const appName = explicitAppName ?? "ELI HMI Launcher";

  if (raw["appName"] !== undefined && !explicitAppName) {
    problems.push('Top-level "appName" must be a non-empty string; the default title is being used.');
  }

  if (raw["menu"] === undefined) {
    problems.push('Config is missing the top-level "menu" list.');
  }

  const seenIds = new Set<string>();
  const menu = normalizeMenuNodes(raw["menu"], "menu", problems, seenIds);

  return { config: { appName, menu }, problems };
}
