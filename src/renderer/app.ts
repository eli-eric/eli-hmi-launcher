import "@picocss/pico/css/pico.min.css";
import "./styles.css";
import { collectFacets, collectMatches, EMPTY_FILTER, isFilterActive, pruneMenu, type LaunchableFilter } from "../shared/search";
import type { GetConfigResponse, LaunchableItem, MenuNode } from "../shared/types";

type AppState = {
  appName: string;
  menu: MenuNode[];
  problems: string[];
  configPath: string;
  path: number[];
  mode: "tiles" | "tree";
  filter: LaunchableFilter;
};

const state: AppState = {
  appName: "ELI HMI Launcher",
  menu: [],
  problems: [],
  configPath: "",
  path: [],
  mode: "tiles",
  filter: { ...EMPTY_FILTER },
};

const appTitle = document.getElementById("app-title") as HTMLHeadingElement;
const mainElement = document.querySelector("main") as HTMLElement;
const tilesView = document.getElementById("tiles-view") as HTMLElement;
const treeView = document.getElementById("tree-view") as HTMLElement;
const tilesButton = document.getElementById("tiles-button") as HTMLButtonElement;
const treeButton = document.getElementById("tree-button") as HTMLButtonElement;
const reloadButton = document.getElementById("reload-button") as HTMLButtonElement;
const searchInput = document.getElementById("search-input") as HTMLInputElement;
const technologyFilter = document.getElementById("technology-filter") as HTMLSelectElement;
const sectionFilter = document.getElementById("section-filter") as HTMLSelectElement;
const clearFiltersButton = document.getElementById("clear-filters") as HTMLButtonElement;
const matchCount = document.getElementById("match-count") as HTMLSpanElement;

function setBanner(id: string, className: string, message: string): void {
  const existing = document.getElementById(id);

  if (!message) {
    existing?.remove();
    return;
  }

  const banner = existing ?? document.createElement("section");
  banner.id = id;
  banner.className = className;
  banner.setAttribute("role", className === "error-banner" ? "alert" : "status");
  banner.textContent = message;

  const dismiss = document.createElement("button");
  dismiss.className = "banner-dismiss";
  dismiss.type = "button";
  dismiss.setAttribute("aria-label", "Dismiss message");
  dismiss.textContent = "×";
  dismiss.addEventListener("click", () => banner.remove());
  banner.appendChild(dismiss);

  if (!existing) {
    mainElement.prepend(banner);
  }
}

function setError(message: string): void {
  setBanner("error-banner", "error-banner", message);
}

function setWarning(message: string): void {
  setBanner("warning-banner", "warning-banner", message);
}

/**
 * Errors thrown by main-process IPC handlers arrive wrapped by Electron as
 * "Error invoking remote method 'channel': Error: <message>". Only the actual
 * message is useful to the user, so strip the transport prefix.
 */
function errorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return raw.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, "");
}

function createButton(label: string, onClick: () => void, className?: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  if (className) {
    button.className = className;
  }
  button.addEventListener("click", onClick);
  return button;
}

function createBadge(text: string, className: string): HTMLSpanElement {
  const badge = document.createElement("span");
  badge.className = `badge ${className}`;
  badge.textContent = text;
  return badge;
}

function appendItemMeta(container: HTMLElement, item: LaunchableItem): void {
  if (!item.technology && !item.section) {
    return;
  }

  const meta = document.createElement("div");
  meta.className = "tile-badges";

  if (item.technology) {
    meta.appendChild(createBadge(item.technology, "badge-technology"));
  }
  if (item.section) {
    meta.appendChild(createBadge(item.section, "badge-section"));
  }

  container.appendChild(meta);
}

function getNodeByPath(): { currentNode: MenuNode | null; currentNodes: MenuNode[] } {
  let currentNodes = state.menu;
  let currentNode: MenuNode | null = null;

  for (const index of state.path) {
    currentNode = currentNodes[index] ?? null;

    if (!currentNode) {
      break;
    }

    currentNodes = Array.isArray(currentNode.children) ? currentNode.children : [];
  }

  return { currentNode, currentNodes };
}

async function launchItem(item: LaunchableItem): Promise<void> {
  try {
    if (!window.launcherApi?.launchItem) {
      throw new Error("Launcher API is unavailable. Check that the preload script loaded correctly.");
    }

    // Launching is intentionally silent while it works: the target either opens or
    // the same request returns an actionable error. No progress indication.
    setError("");
    await window.launcherApi.launchItem(item.id);
  } catch (error) {
    setError(`Launch failed: ${errorMessage(error)}`);
  }
}

function createLaunchableTile(item: LaunchableItem, groupPath?: string[]): HTMLElement {
  const tile = document.createElement("article");
  tile.className = "tile";

  const body = document.createElement("div");
  body.className = "tile-body";

  const title = document.createElement("h3");
  title.textContent = item.name;
  body.appendChild(title);

  if (groupPath && groupPath.length > 0) {
    const location = document.createElement("p");
    location.className = "tile-location";
    location.textContent = groupPath.join(" > ");
    body.appendChild(location);
  }

  const note = document.createElement("p");
  note.textContent = item.note ?? "";
  body.appendChild(note);

  appendItemMeta(body, item);

  tile.append(body, createButton("Launch", () => launchItem(item)));
  return tile;
}

function renderBreadcrumbs(container: HTMLElement): void {
  const breadcrumbs = document.createElement("div");
  breadcrumbs.className = "breadcrumbs";

  function appendBreadcrumb(label: string, onClick: () => void, isCurrent = false): void {
    if (breadcrumbs.childElementCount > 0) {
      const separator = document.createElement("span");
      separator.className = "breadcrumb-separator";
      separator.textContent = ">";
      breadcrumbs.appendChild(separator);
    }

    if (isCurrent) {
      const current = document.createElement("span");
      current.className = "breadcrumb-current";
      current.textContent = label;
      breadcrumbs.appendChild(current);
      return;
    }

    const link = document.createElement("a");
    link.className = "breadcrumb-link";
    link.href = "#";
    link.textContent = label;
    link.addEventListener("click", (event) => {
      event.preventDefault();
      onClick();
    });
    breadcrumbs.appendChild(link);
  }

  appendBreadcrumb(
    "Root",
    () => {
      state.path = [];
      render();
    },
    state.path.length === 0,
  );

  let nodes = state.menu;
  const pathSoFar: number[] = [];

  for (const [pathIndex, index] of state.path.entries()) {
    const node = nodes[index];

    if (!node) {
      break;
    }

    pathSoFar.push(index);
    const breadcrumbPath = [...pathSoFar];
    appendBreadcrumb(
      node.label ?? "Group",
      () => {
        state.path = breadcrumbPath;
        render();
      },
      pathIndex === state.path.length - 1,
    );
    nodes = Array.isArray(node.children) ? node.children : [];
  }

  container.appendChild(breadcrumbs);
}

function renderFilteredTiles(): void {
  const matches = collectMatches(state.menu, state.filter);
  matchCount.textContent = matches.length === 1 ? "1 match" : `${matches.length} matches`;

  if (matches.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No GUIs match the current search and filters. Clear them to see everything.";
    tilesView.appendChild(empty);
    return;
  }

  const grid = document.createElement("div");
  grid.className = "tiles-grid";

  for (const match of matches) {
    grid.appendChild(createLaunchableTile(match.item, match.groupPath));
  }

  tilesView.appendChild(grid);
}

function renderTiles(): void {
  tilesView.innerHTML = "";

  if (isFilterActive(state.filter)) {
    renderFilteredTiles();
    return;
  }

  matchCount.textContent = "";
  renderBreadcrumbs(tilesView);

  const { currentNode, currentNodes } = getNodeByPath();
  const visibleGroups = state.path.length === 0 ? state.menu : currentNodes;
  const launchables = Array.isArray(currentNode?.launchables) ? currentNode.launchables : [];
  const grid = document.createElement("div");
  grid.className = "tiles-grid";

  for (const [index, group] of visibleGroups.entries()) {
    const tile = document.createElement("article");
    tile.className = "tile";
    const body = document.createElement("div");
    body.className = "tile-body";
    const title = document.createElement("h3");
    title.textContent = group.label ?? "Group";
    const description = document.createElement("p");
    description.textContent = "Open group";
    body.append(title, description);
    tile.append(
      body,
      createButton("Open", () => {
        state.path = [...state.path, index];
        render();
      }),
    );
    grid.appendChild(tile);
  }

  for (const item of launchables) {
    grid.appendChild(createLaunchableTile(item));
  }

  tilesView.appendChild(grid);
}

function renderTreeNodes(nodes: MenuNode[], forceOpen: boolean): HTMLUListElement {
  const list = document.createElement("ul");
  list.className = "tree-list";

  for (const node of nodes) {
    const branch = document.createElement("li");
    branch.className = "tree-branch";
    const launchables = Array.isArray(node.launchables) ? node.launchables : [];
    const children = Array.isArray(node.children) ? node.children : [];

    if (launchables.length > 0 || children.length > 0) {
      const details = document.createElement("details");
      details.className = "tree-node";
      details.open = forceOpen;

      const summary = document.createElement("summary");
      summary.className = "branch-label";
      summary.textContent = node.label ?? "Group";
      details.appendChild(summary);

      const content = document.createElement("div");
      content.className = "tree-node-content";

      for (const item of launchables) {
        const row = document.createElement("div");
        row.className = "launch-item";
        const launchButton = createButton(item.name, () => launchItem(item));
        if (item.note) {
          launchButton.title = item.note;
        }
        row.appendChild(launchButton);
        appendItemMeta(row, item);
        content.appendChild(row);
      }

      if (children.length > 0) {
        content.appendChild(renderTreeNodes(children, forceOpen));
      }

      details.appendChild(content);
      branch.appendChild(details);
      list.appendChild(branch);
      continue;
    }

    const label = document.createElement("p");
    label.className = "branch-label";
    label.textContent = node.label ?? "Group";
    branch.appendChild(label);

    list.appendChild(branch);
  }

  return list;
}

function renderTree(): void {
  treeView.innerHTML = "";
  const filtering = isFilterActive(state.filter);
  const visibleMenu = pruneMenu(state.menu, state.filter);

  if (filtering && visibleMenu.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No GUIs match the current search and filters. Clear them to see everything.";
    treeView.appendChild(empty);
    return;
  }

  treeView.appendChild(renderTreeNodes(visibleMenu, filtering));
}

function renderFacetOptions(): void {
  const facets = collectFacets(state.menu);

  function fill(select: HTMLSelectElement, values: string[], allLabel: string, selected: string): void {
    select.innerHTML = "";
    const allOption = document.createElement("option");
    allOption.value = "";
    allOption.textContent = allLabel;
    select.appendChild(allOption);

    for (const value of values) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    }

    select.value = values.some((value) => value.toLowerCase() === selected.toLowerCase()) ? selected : "";
  }

  fill(technologyFilter, facets.technologies, "All technologies", state.filter.technology);
  fill(sectionFilter, facets.sections, "All sections", state.filter.section);
  state.filter.technology = technologyFilter.value;
  state.filter.section = sectionFilter.value;
}

function render(): void {
  tilesButton.classList.toggle("active", state.mode === "tiles");
  treeButton.classList.toggle("active", state.mode === "tree");
  tilesButton.classList.toggle("outline", state.mode !== "tiles");
  treeButton.classList.toggle("outline", state.mode !== "tree");
  tilesButton.setAttribute("aria-pressed", String(state.mode === "tiles"));
  treeButton.setAttribute("aria-pressed", String(state.mode === "tree"));
  tilesView.classList.toggle("active", state.mode === "tiles");
  treeView.classList.toggle("active", state.mode === "tree");
  renderTiles();
  renderTree();
}

function applyConfig(config: GetConfigResponse): void {
  state.appName = config.appName ?? state.appName;
  state.menu = Array.isArray(config.menu) ? config.menu : [];
  state.problems = Array.isArray(config.problems) ? config.problems : [];
  state.configPath = config.configPath ?? "";
  state.path = [];
  appTitle.textContent = state.appName;
  setError("");

  if (state.problems.length > 0) {
    const shown = state.problems.slice(0, 5).join(" — ");
    const remaining = state.problems.length - 5;
    const suffix = remaining > 0 ? ` (and ${remaining} more)` : "";
    setWarning(`Config problems in ${state.configPath}: ${shown}${suffix}`);
  } else {
    setWarning("");
  }

  renderFacetOptions();
  render();
}

tilesButton.addEventListener("click", () => {
  state.mode = "tiles";
  render();
});

treeButton.addEventListener("click", () => {
  state.mode = "tree";
  render();
});

searchInput.addEventListener("input", () => {
  state.filter.query = searchInput.value;
  render();
});

technologyFilter.addEventListener("change", () => {
  state.filter.technology = technologyFilter.value;
  render();
});

sectionFilter.addEventListener("change", () => {
  state.filter.section = sectionFilter.value;
  render();
});

clearFiltersButton.addEventListener("click", () => {
  state.filter = { ...EMPTY_FILTER };
  searchInput.value = "";
  technologyFilter.value = "";
  sectionFilter.value = "";
  render();
});

reloadButton.addEventListener("click", async () => {
  try {
    if (!window.launcherApi?.reloadConfig) {
      throw new Error("Launcher API is unavailable. Check that the preload script loaded correctly.");
    }

    applyConfig(await window.launcherApi.reloadConfig());
  } catch (error) {
    setError(`Config reload failed: ${errorMessage(error)}`);
  }
});

async function initialize(): Promise<void> {
  try {
    if (!window.launcherApi?.getConfig) {
      throw new Error("Launcher API is unavailable. Check that the preload script loaded correctly.");
    }

    applyConfig(await window.launcherApi.getConfig());
  } catch (error) {
    setError(`Config load failed: ${errorMessage(error)}`);
  }
}

initialize();
