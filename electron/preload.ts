import { contextBridge, ipcRenderer } from "electron";
import type { StudioBridge, OutputStatus } from "../src/shared/types";
const bridge: StudioBridge = {
  info: () => ipcRenderer.invoke("studio:info"),
  sources: () => ipcRenderer.invoke("studio:sources"),
  chooseScreen: (id) => ipcRenderer.invoke("studio:choose-screen", id),
  recordingStart: () => ipcRenderer.invoke("studio:recording-start"),
  recordingAppend: (id, seq, bytes) =>
    ipcRenderer.invoke("studio:recording-append", id, seq, bytes),
  recordingStop: (id) => ipcRenderer.invoke("studio:recording-stop", id),
  broadcastStart: (options) =>
    ipcRenderer.invoke("studio:broadcast-start", options),
  broadcastAppend: (id, seq, bytes) =>
    ipcRenderer.invoke("studio:broadcast-append", id, seq, bytes),
  broadcastStop: (id) => ipcRenderer.invoke("studio:broadcast-stop", id),
  youtubeConfigure: () => ipcRenderer.invoke("studio:youtube-configure"),
  youtubeConnect: () => ipcRenderer.invoke("studio:youtube-connect"),
  youtubeDisconnect: () => ipcRenderer.invoke("studio:youtube-disconnect"),
  youtubeStatus: () => ipcRenderer.invoke("studio:youtube-status"),
  tiktokStatus: () => ipcRenderer.invoke("studio:tiktok-status"),
  tiktokSave: (server, key) =>
    ipcRenderer.invoke("studio:tiktok-save", server, key),
  tiktokClear: () => ipcRenderer.invoke("studio:tiktok-clear"),
  thumbnailChoose: () => ipcRenderer.invoke("studio:thumbnail-choose"),
  thumbnailClear: () => ipcRenderer.invoke("studio:thumbnail-clear"),
  openExternal: (target) => ipcRenderer.invoke("studio:open-external", target),
  onStatus: (callback) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      status: OutputStatus,
    ) => callback(status);
    ipcRenderer.on("studio:status", listener);
    return () => ipcRenderer.removeListener("studio:status", listener);
  },
  onClosing: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("studio:closing", listener);
    return () => ipcRenderer.removeListener("studio:closing", listener);
  },
  finishClose: () => ipcRenderer.invoke("studio:finish-close"),
  diag: (text) => ipcRenderer.invoke("studio:diag", text),
  openLogs: () => ipcRenderer.invoke("studio:open-logs"),
};
contextBridge.exposeInMainWorld("studio", bridge);
