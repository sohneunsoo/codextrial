import { contextBridge, ipcRenderer } from "electron";
import type { AppState, FocusSession, SessionConfig, SessionSummary } from "../shared";

const api = {
  getState: (): Promise<AppState> => ipcRenderer.invoke("app:get-state"),
  startSession: (config: SessionConfig): Promise<FocusSession> => ipcRenderer.invoke("session:start", config),
  pauseSession: (): Promise<void> => ipcRenderer.invoke("session:pause"),
  resumeSession: (): Promise<void> => ipcRenderer.invoke("session:resume"),
  snooze: (minutes: number): Promise<void> => ipcRenderer.invoke("session:snooze", minutes),
  endSession: (): Promise<SessionSummary | undefined> => ipcRenderer.invoke("session:end"),
  updatePrivacyPaused: (paused: boolean): Promise<void> => ipcRenderer.invoke("privacy:set-paused", paused),
  onState: (callback: (state: AppState) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: AppState): void => callback(state);
    ipcRenderer.on("app:state", listener);
    return () => {
      ipcRenderer.removeListener("app:state", listener);
    };
  }
};

contextBridge.exposeInMainWorld("focusAligned", api);

export type FocusAlignedApi = typeof api;
