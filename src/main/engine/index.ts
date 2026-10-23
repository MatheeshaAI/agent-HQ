import { app, safeStorage, type BrowserWindow } from 'electron'
import { join } from 'node:path'
import { IPC, type AppSnapshot } from '@shared/types'
import { Engine } from './engine'
import { registerIpc } from './ipc'
import type { SecretCodec } from './settings'

const windows = new Set<BrowserWindow>()
let ready: Promise<Engine> | null = null

/**
 * Starts the wiki engine once and attaches a window to its snapshot pushes. Later windows
 * (macOS re-activation) attach to the same engine.
 */
export function startEngine(win: BrowserWindow): void {
  windows.add(win)
  win.on('closed', () => windows.delete(win))
  if (ready) return

  const dataDir = process.env.AGENT_HQ_DATA_DIR || app.getPath('userData')
  ready = Engine.start({
    dataDir,
    defaults: {
      knowledgeDir: process.env.AGENT_HQ_DATA_DIR ? join(dataDir, 'knowledge') : join(app.getPath('documents'), 'Agent HQ Knowledge'),
      documentsDir: app.getPath('documents'),
      envApiKey: process.env.ANTHROPIC_API_KEY
    },
    codec: safeStorageCodec,
    push: (snapshot) => windows.forEach((target) => send(target, snapshot))
  })
  registerIpc(ready)
  app.on('before-quit', () => void ready?.then((engine) => engine.close()))
}

function send(win: BrowserWindow, snapshot: AppSnapshot): void {
  if (!win.isDestroyed() && !win.webContents.isDestroyed()) win.webContents.send(IPC.snapshot, snapshot)
}

/** On Linux without a keyring safeStorage falls back to a hard-coded password; that does not count as encrypted. */
const safeStorageCodec: SecretCodec = {
  available: () =>
    safeStorage.isEncryptionAvailable() &&
    (process.platform !== 'linux' || safeStorage.getSelectedStorageBackend() !== 'basic_text'),
  encrypt: (plain) => safeStorage.encryptString(plain).toString('base64'),
  decrypt: (encoded) => safeStorage.decryptString(Buffer.from(encoded, 'base64'))
}
