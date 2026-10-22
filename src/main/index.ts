import { app, BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { startEngine } from './engine'

const WIDTH = Number(process.env.AGENT_HQ_WIDTH) || 1536
const HEIGHT = Number(process.env.AGENT_HQ_HEIGHT) || 1024

function createWindow(): BrowserWindow {
  const isMac = process.platform === 'darwin'
  const win = new BrowserWindow({
    width: WIDTH,
    height: HEIGHT,
    minWidth: 1280,
    minHeight: 800,
    show: false,
    frame: false,
    titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
    trafficLightPosition: { x: 16, y: 14 },
    backgroundColor: '#000000',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })
  win.on('ready-to-show', () => win.show())
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
  return win
}

app.whenReady().then(() => {
  const win = createWindow()
  startEngine(win)
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) startEngine(createWindow())
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
