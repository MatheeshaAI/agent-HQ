import { BrowserWindow, dialog, ipcMain, shell, type IpcMainInvokeEvent } from 'electron'
import { spawn } from 'node:child_process'
import { IPC, type RoomKind, type SettingsUpdate, type SourceOrigin } from '@shared/types'
import type { Engine } from './engine'
import { parseAgentDefList } from './settings'

/**
 * Registers a handler for every IPC channel in the shared contract. Handlers wait for the
 * engine to finish starting, so the renderer can call them as soon as it loads.
 */
export function registerIpc(ready: Promise<Engine>): void {
  const handle = <A extends unknown[], R>(channel: string, fn: (engine: Engine, ...args: A) => R | Promise<R>): void => {
    ipcMain.handle(channel, async (_event, ...args) => fn(await ready, ...(args as A)))
  }

  handle(IPC.getSnapshot, (engine) => engine.getSnapshot())
  handle(IPC.addUrl, (engine, url: string, origin?: unknown) => engine.addUrl(asString(url, 'url'), asOrigin(origin)))
  handle(IPC.addFiles, (engine, paths: string[], origin?: unknown) => engine.addFiles(asStringList(paths), asOrigin(origin)))
  handle(IPC.addNote, (engine, text: string, origin?: unknown) => engine.addNote(asString(text, 'note'), asOrigin(origin)))
  handle(IPC.agentRun, (engine, agentId: string, instruction?: unknown) =>
    engine.runAgent(asAgentId(engine, agentId), instruction === undefined || instruction === null ? undefined : asString(instruction, 'instruction')))
  handle(IPC.getAgentMemory, (engine, agentId: string) => engine.getAgentMemory(asAgentId(engine, agentId)))
  handle(IPC.setAgentMemory, (engine, agentId: string, memory: string) => engine.setAgentMemory(asAgentId(engine, agentId), asString(memory, 'memory')))
  handle(IPC.agentRuns, (engine) => engine.agentRuns())
  handle(IPC.retrySource, (engine, id: string) => engine.retrySource(asString(id, 'source id')))
  handle(IPC.ask, (engine, question: string) => engine.ask(asString(question, 'question')))
  handle(IPC.chatSend, (engine, agentId: string, text: string) => engine.chat.send(asAgentId(engine, agentId), asString(text, 'message')))
  handle(IPC.chatHistory, (engine, agentId: string) => engine.chat.history(asAgentId(engine, agentId)))
  handle(IPC.broadcastSend, (engine, text: string) => engine.chat.broadcast(asString(text, 'message')))
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

/** An id of an agent that exists in the current settings. */
function asAgentId(engine: Engine, value: unknown): string {
  if (typeof value !== 'string' || !engine.getSettings().agentDefs.some((a) => a.id === value)) throw new Error('Unknown agent')
  return value
}

const ROOMS: RoomKind[] = ['brain', 'office', 'personal']
const ORIGIN_KINDS: SourceOrigin['kind'][] = ['manual', 'agent']

/** An optional origin from the renderer: the room must be one of the three rooms. Anything else is rejected. */
function asOrigin(value: unknown): SourceOrigin | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'object') throw new Error('Expected a source origin')
  const { room, agentId, kind } = value as Record<string, unknown>
  if (typeof room !== 'string' || !ROOMS.includes(room as RoomKind)) throw new Error('Unknown room')
  const origin: SourceOrigin = { room: room as RoomKind, kind: ORIGIN_KINDS.includes(kind as SourceOrigin['kind']) ? (kind as SourceOrigin['kind']) : 'manual' }
  if (agentId !== undefined) origin.agentId = asString(agentId, 'agent id')
  return origin
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
  const agents = (value as Record<string, unknown>).agentDefs
  if (agents !== undefined) update.agentDefs = parseAgentDefList(agents)
  const provider = (value as Record<string, unknown>).providerId
  if (provider !== undefined) {
    const providers = ['anthropic', 'claude-code', 'openai', 'openrouter', 'codex', 'opencode', 'antigravity', 'kilocode', 'acp']
    if (typeof provider !== 'string' || !providers.includes(provider)) throw new Error('Unknown model provider')
    update.providerId = provider as SettingsUpdate['providerId']
  }
  return update
}
