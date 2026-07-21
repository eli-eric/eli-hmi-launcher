import type { GetConfigResponse, LaunchResult } from "../shared/types";

declare global {
  interface Window {
    launcherApi: {
      getConfig(): Promise<GetConfigResponse>;
      reloadConfig(): Promise<GetConfigResponse>;
      launchItem(itemId: string): Promise<LaunchResult>;
    };
  }
}
