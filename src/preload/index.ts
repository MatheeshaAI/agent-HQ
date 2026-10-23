import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from 'electron'
import { IPC, type AgentHqApi, type AppSnapshot } from '@shared/types'

/**
 * ipcRenderer.invoke, minus the "Error invoking remote method '<channel>': Error: " prefix Electron
 * adds to errors thrown in the main process, so the UI can show the engine's message as written.
 */
async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  try {
    return await ipcRenderer.invoke(channel, ...args)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(message.replace(/^Error invoking remote method '[^']*': (?:\w*Error: )?/, ''))
  }
}

const api: AgentHqApi = {
  getSnapshot: () => invoke(IPC.getSnapshot),
  onSnapshot(cb) {
    const listener = (_event: IpcRendererEvent, snapshot: AppSnapshot): void => cb(snapshot)
    ipcRenderer.on(IPC.snapshot, listener)
    return () => {
      ipcRenderer.removeListener(IPC.snapshot, listener)
    }
  },

  addUrl: (url) => invoke(IPC.addUrl, url),
  addFiles: (paths) => invoke(IPC.addFiles, paths),
  addNote: (text) => invoke(IPC.addNote, text),
  pathForFile: (file) => webUtils.getPathForFile(file),
  retrySource: (id) => invoke(IPC.retrySource, id),

  ask: (question) => invoke(IPC.ask, question),
  runJanitor: () => invoke(IPC.runJanitor),

  listPages: () => invoke(IPC.listPages),
  readPage: (slug) => invoke(IPC.readPage, slug),

  getSettings: () => invoke(IPC.getSettings),
  saveSettings: (update) => invoke(IPC.saveSettings, update),
  listRooms: () => invoke(IPC.listRooms),
  switchRoom: (id) => invoke(IPC.switchRoom, id),
  addRoom: (name) => invoke(IPC.addRoom, name),
  renameRoom: (id, name) => invoke(IPC.renameRoom, id, name),
  listModels: () => invoke(IPC.listModels),
  openClaudeLogin: () => invoke(IPC.openClaudeLogin),
  chooseKnowledgeDir: () => invoke(IPC.chooseKnowledgeDir),
  openPath: (path) => invoke(IPC.openPath, path),

  window: {
    platform: process.platform,
    minimize: () => ipcRenderer.send(IPC.winMinimize),
    toggleMaximize: () => ipcRenderer.send(IPC.winToggleMaximize),
    close: () => ipcRenderer.send(IPC.winClose)
  }
}

contextBridge.exposeInMainWorld('api', api)
