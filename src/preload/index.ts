import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from 'electron'
import { IPC, type AgentHqApi, type AppSnapshot } from '@shared/types'

const api: AgentHqApi = {
  getSnapshot: () => ipcRenderer.invoke(IPC.getSnapshot),
  onSnapshot(cb) {
    const listener = (_event: IpcRendererEvent, snapshot: AppSnapshot): void => cb(snapshot)
    ipcRenderer.on(IPC.snapshot, listener)
    return () => {
      ipcRenderer.removeListener(IPC.snapshot, listener)
    }
  },

  addUrl: (url) => ipcRenderer.invoke(IPC.addUrl, url),
  addFiles: (paths) => ipcRenderer.invoke(IPC.addFiles, paths),
  addNote: (text) => ipcRenderer.invoke(IPC.addNote, text),
  pathForFile: (file) => webUtils.getPathForFile(file),
  retrySource: (id) => ipcRenderer.invoke(IPC.retrySource, id),

  ask: (question) => ipcRenderer.invoke(IPC.ask, question),
  runJanitor: () => ipcRenderer.invoke(IPC.runJanitor),

  listPages: () => ipcRenderer.invoke(IPC.listPages),
  readPage: (slug) => ipcRenderer.invoke(IPC.readPage, slug),

  getSettings: () => ipcRenderer.invoke(IPC.getSettings),
  saveSettings: (update) => ipcRenderer.invoke(IPC.saveSettings, update),
  chooseKnowledgeDir: () => ipcRenderer.invoke(IPC.chooseKnowledgeDir),
  openPath: (path) => ipcRenderer.invoke(IPC.openPath, path),

  window: {
    platform: process.platform,
    minimize: () => ipcRenderer.send(IPC.winMinimize),
    toggleMaximize: () => ipcRenderer.send(IPC.winToggleMaximize),
    close: () => ipcRenderer.send(IPC.winClose)
  }
}

contextBridge.exposeInMainWorld('api', api)
