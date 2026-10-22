// Launches the built Electron app (out/) and saves a screenshot of the window.
// Usage: xvfb-run -a -s "-screen 0 1700x1200x24" node scripts/shot.mjs [out.png] [waitMs]
// Env: AGENT_HQ_DATA_DIR (isolated settings + knowledge folder), ANTHROPIC_BASE_URL (test stub), SHOT_ACTIONS (path to an .mjs exporting default async (page) => {})
import { _electron as electron } from 'playwright-core'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const out = resolve(process.argv[2] || '.shots/app.png')
const waitMs = Number(process.argv[3] || 8000)
mkdirSync(dirname(out), { recursive: true })

const app = await electron.launch({
  args: ['.', '--no-sandbox', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  env: { ...process.env, AGENT_HQ_WIDTH: '1536', AGENT_HQ_HEIGHT: '1024' },
  timeout: 120000
})
const page = await app.firstWindow()
const logs = []
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`) })
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`))
await page.setViewportSize({ width: 1536, height: 1024 }).catch(() => {})
await page.waitForLoadState('domcontentloaded')
if (process.env.SHOT_ACTIONS) {
  const mod = await import(resolve(process.env.SHOT_ACTIONS))
  await mod.default(page, app)
}
await page.waitForTimeout(waitMs)
await page.screenshot({ path: out })
console.log('saved', out)
if (logs.length) console.log(logs.slice(0, 40).join('\n'))
await app.close()
