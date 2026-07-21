import { contextBridge, ipcRenderer } from "electron";
import type { GetConfigResponse, LaunchResult } from "../shared/types";

contextBridge.exposeInMainWorld("launcherApi", {
  getConfig: (): Promise<GetConfigResponse> => ipcRenderer.invoke("launcher:get-config"),
  reloadConfig: (): Promise<GetConfigResponse> => ipcRenderer.invoke("launcher:reload-config"),
  launchItem: (itemId: string): Promise<LaunchResult> => ipcRenderer.invoke("launcher:launch-item", itemId),
});
