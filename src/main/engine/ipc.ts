import { BrowserWindow, dialog, ipcMain, shell, type IpcMainInvokeEvent } from 'electron'
import { spawn } from 'node:child_process'
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
  handle(IPC.listRooms, (engine) => engine.listRooms())
  handle(IPC.switchRoom, (engine, id: string) => engine.switchRoom(asString(id, 'room id')))
  handle(IPC.addRoom, (engine, name: string) => engine.addRoom(asString(name, 'room name')))
  handle(IPC.renameRoom, (engine, id: string, name: string) => engine.renameRoom(asString(id, 'room id'), asString(name, 'room name')))
  handle(IPC.listModels, (engine) => engine.listModels())
  ipcMain.handle(IPC.openClaudeLogin, async () => {
    if (process.platform !== 'win32') throw new Error('Open a terminal and run claude to sign in on this platform')
    await new Promise<void>((resolve, reject) => {
      const terminal = spawn('powershell.exe', ['-NoExit', '-Command', 'claude'], { detached: true, stdio: 'ignore', windowsHide: false })
      terminal.once('spawn', () => { terminal.unref(); resolve() })
      terminal.once('error', reject)
    })
  })
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
  for (const key of ['knowledgeDir', 'apiKey', 'model', 'userName', 'baseUrl', 'command', 'args'] as const) {
    const field = (value as Record<string, unknown>)[key]
    if (field !== undefined) update[key] = asString(field, key)
  }
  const provider = (value as Record<string, unknown>).providerId
  if (provider !== undefined) {
    const providers = ['anthropic', 'claude-code', 'openai', 'openrouter', 'codex', 'opencode', 'antigravity', 'kilocode', 'acp']
    if (typeof provider !== 'string' || !providers.includes(provider)) throw new Error('Unknown model provider')
    update.providerId = provider as SettingsUpdate['providerId']
  }
  return update
}
