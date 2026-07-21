import type { LaunchableItem, MenuNode } from "./types";

export type LaunchableFilter = {
  /** Free-text query. Matched case-insensitively against "name" and "note" only. */
  query: string;
  /** Exact technology to keep, or "" for all. Compared case-insensitively. */
  technology: string;
  /** Exact section to keep, or "" for all. Compared case-insensitively. */
  section: string;
};

export type FlatMatch = {
  item: LaunchableItem;
  /** Group labels from the root down to the group that owns the item. */
  groupPath: string[];
};

export const EMPTY_FILTER: LaunchableFilter = { query: "", technology: "", section: "" };

export function isFilterActive(filter: LaunchableFilter): boolean {
  return filter.query.trim().length > 0 || filter.technology !== "" || filter.section !== "";
}

/**
 * Free-text search. Intentionally restricted to the "name" and "note" fields;
 * id, technology, section, url and command are NOT searched.
 */
export function matchesQuery(item: LaunchableItem, query: string): boolean {
  const needle = query.trim().toLowerCase();

  if (needle.length === 0) {
    return true;
  }

  const name = item.name.toLowerCase();
  const note = (item.note ?? "").toLowerCase();
  return name.includes(needle) || note.includes(needle);
}

/**
 * Faceted filtering. Intentionally restricted to the "technology" and "section" fields.
 */
export function matchesFacets(item: LaunchableItem, technology: string, section: string): boolean {
  if (technology !== "" && (item.technology ?? "").toLowerCase() !== technology.toLowerCase()) {
    return false;
  }

  if (section !== "" && (item.section ?? "").toLowerCase() !== section.toLowerCase()) {
    return false;
  }

  return true;
}

export function matchesFilter(item: LaunchableItem, filter: LaunchableFilter): boolean {
  return matchesQuery(item, filter.query) && matchesFacets(item, filter.technology, filter.section);
}

/** Distinct technology and section values used across the whole menu, sorted for the filter dropdowns. */
export function collectFacets(menu: MenuNode[]): { technologies: string[]; sections: string[] } {
  const technologies = new Map<string, string>();
  const sections = new Map<string, string>();

  function walk(nodes: MenuNode[]): void {
    for (const node of nodes) {
      for (const item of node.launchables ?? []) {
        if (item.technology) {
          const key = item.technology.toLowerCase();
          if (!technologies.has(key)) {
            technologies.set(key, item.technology);
          }
        }
        if (item.section) {
          const key = item.section.toLowerCase();
          if (!sections.has(key)) {
            sections.set(key, item.section);
          }
        }
      }
      walk(node.children ?? []);
    }
  }

  walk(menu);

  const byName = (a: string, b: string): number => a.localeCompare(b, undefined, { sensitivity: "base" });
  return {
    technologies: [...technologies.values()].sort(byName),
    sections: [...sections.values()].sort(byName),
  };
}

/** Flat list of every launchable matching the filter, with its group path, in document order. */
export function collectMatches(menu: MenuNode[], filter: LaunchableFilter): FlatMatch[] {
  const matches: FlatMatch[] = [];

  function walk(nodes: MenuNode[], path: string[]): void {
    for (const node of nodes) {
      const nextPath = [...path, node.label ?? "Group"];

      for (const item of node.launchables ?? []) {
        if (matchesFilter(item, filter)) {
          matches.push({ item, groupPath: nextPath });
        }
      }

      walk(node.children ?? [], nextPath);
    }
  }

  walk(menu, []);
  return matches;
}

/** Copy of the menu tree that keeps only launchables matching the filter and only branches that still contain something. */
export function pruneMenu(menu: MenuNode[], filter: LaunchableFilter): MenuNode[] {
  if (!isFilterActive(filter)) {
    return menu;
  }

  function prune(nodes: MenuNode[]): MenuNode[] {
    const kept: MenuNode[] = [];

    for (const node of nodes) {
      const launchables = (node.launchables ?? []).filter((item) => matchesFilter(item, filter));
      const children = prune(node.children ?? []);

      if (launchables.length > 0 || children.length > 0) {
        kept.push({
          label: node.label,
          launchables: launchables.length > 0 ? launchables : undefined,
          children: children.length > 0 ? children : undefined,
        });
      }
    }

    return kept;
  }

  return prune(menu);
}
