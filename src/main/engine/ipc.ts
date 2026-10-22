import { BrowserWindow, dialog, ipcMain, shell, type IpcMainInvokeEvent } from 'electron'
import { IPC, type SettingsUpdate } from '@shared/types'
import type { Engine } from './engine'

/**
 * Registers a handler for every IPC channel in the shared contract. Handlers wait for the
 * engine to finish starting, so the renderer can call them as soon as it loads.
 */
export function registerIpc(ready: Promise<Engine>): void {
  const handle = <A extends unknown[], R>(channel: string, fn: (engine: Engine, ...args: A) => R | Promise<R>): void => {
    ipcMain.handle(channel, async (_event, ...args) => fn(await ready, ...(args as A)))
  }

  handle(IPC.getSnapshot, (engine) => engine.getSnapshot())
  handle(IPC.addUrl, (engine, url: string) => engine.addUrl(asString(url, 'url')))
  handle(IPC.addFiles, (engine, paths: string[]) => engine.addFiles(asStringList(paths)))
  handle(IPC.addNote, (engine, text: string) => engine.addNote(asString(text, 'note')))
  handle(IPC.retrySource, (engine, id: string) => engine.retrySource(asString(id, 'source id')))
  handle(IPC.ask, (engine, question: string) => engine.ask(asString(question, 'question')))
  handle(IPC.runJanitor, (engine) => engine.runJanitor())
  handle(IPC.listPages, (engine) => engine.listPages())
  handle(IPC.readPage, (engine, slug: string) => engine.readPage(asString(slug, 'page')))
  handle(IPC.getSettings, (engine) => engine.getSettings())
  handle(IPC.saveSettings, (engine, update: SettingsUpdate) => engine.saveSettings(asSettingsUpdate(update)))
  handle(IPC.openPath, async (engine, path: string) => {
    const target = asString(path, 'path')
    if (!engine.isInsideKnowledge(target)) throw new Error('Only files in the knowledge folder can be opened')
    const failure = await shell.openPath(target)
    if (failure) throw new Error(failure)
  })

  ipcMain.handle(IPC.chooseKnowledgeDir, async (event) => {
    const win = windowOf(event)
    const options: Electron.OpenDialogOptions = {
      title: 'Choose a knowledge folder',
      buttonLabel: 'Use this folder',
      properties: ['openDirectory', 'createDirectory']
    }
    const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
    return result.canceled ? null : (result.filePaths[0] ?? null)
  })

  ipcMain.on(IPC.winMinimize, (event) => windowOf(event)?.minimize())
  ipcMain.on(IPC.winToggleMaximize, (event) => {
    const win = windowOf(event)
    if (!win) return
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  })
  ipcMain.on(IPC.winClose, (event) => windowOf(event)?.close())
}

function windowOf(event: IpcMainInvokeEvent | Electron.IpcMainEvent): BrowserWindow | null {
  return BrowserWindow.fromWebContents(event.sender)
}

function asString(value: unknown, what: string): string {
  if (typeof value !== 'string') throw new Error(`Expected a ${what}`)
  return value
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) throw new Error('Expected a list of file paths')
  return value
}

function asSettingsUpdate(value: unknown): SettingsUpdate {
  if (typeof value !== 'object' || value === null) throw new Error('Expected settings')
  const update: SettingsUpdate = {}
  for (const key of ['knowledgeDir', 'apiKey', 'model', 'userName'] as const) {
    const field = (value as Record<string, unknown>)[key]
    if (field !== undefined) update[key] = asString(field, key)
  }
  return update
}
