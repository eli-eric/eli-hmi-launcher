import { app, BrowserWindow, ipcMain, shell } from "electron";
import path from "node:path";
import type { WebLaunchable } from "../shared/types";
import { LauncherConfigStore } from "./config-store";
import { launchExecutable } from "./launch-executable";

const configStore = new LauncherConfigStore();

function getConfigPath(): string {
  if (process.env["ELI_LAUNCHER_CONFIG"]) {
    return path.resolve(process.env["ELI_LAUNCHER_CONFIG"]);
  }

  return path.join(app.getAppPath(), "config", "launcher.yaml");
}

function createMainWindow(): void {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (process.env["ELECTRON_RENDERER_URL"]) {
    void window.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    void window.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}

async function launchWebTarget(item: WebLaunchable): Promise<void> {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(item.url);
  } catch {
    throw new Error(`"${item.name}" has an invalid URL: "${item.url}". Fix the "url" value in the launcher YAML.`);
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error(`"${item.name}" uses ${parsedUrl.protocol}// but only http:// and https:// URLs are allowed.`);
  }

  await shell.openExternal(item.url);
}

function registerIpcHandlers(): void {
  ipcMain.handle("launcher:get-config", async () => configStore.getResponse());

  ipcMain.handle("launcher:reload-config", async () => configStore.reload(getConfigPath()));

  ipcMain.handle("launcher:launch-item", async (_event, itemId: string) => {
    const item = configStore.getLaunchable(itemId);

    if (!item) {
      throw new Error(`Unknown launcher item id: ${itemId}`);
    }

    if (item.type === "web") {
      await launchWebTarget(item);
    } else {
      await launchExecutable(item);
    }

    return { ok: true } as const;
  });
}

app
  .whenReady()
  .then(async () => {
    await configStore.initialize(getConfigPath());
    registerIpcHandlers();
    createMainWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
      }
    });
  })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    app.quit();
  });

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
