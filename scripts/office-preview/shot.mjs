// Serves the office harness with Vite and screenshots it in Chromium (SwiftShader WebGL).
// Usage (repo root): node scripts/office-preview/shot.mjs [out.png] [waitMs]
// Env: SCALE=2 (device pixel ratio), QUERY='?nodes=0&states=error' (harness props), CLICK_TEST=1 (interaction check)
// Writes <out>.png (1060x800, the reference's office region) and <out>-compare.png (reference | render).
import { createServer } from 'vite'
import { execFileSync } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdirSync } from 'node:fs'

const here = dirname(fileURLToPath(import.meta.url))
const out = resolve(process.argv[2] || '/tmp/office-preview/office.png')
const waitMs = Number(process.argv[3] || 25000)
mkdirSync(dirname(out), { recursive: true })

const globalRoot = execFileSync('npm', ['root', '-g']).toString().trim()
const { chromium } = await import(`${globalRoot}/playwright/index.mjs`)

const server = await createServer({ configFile: resolve(here, 'vite.config.ts'), logLevel: 'warn' })
await server.listen()
const url = server.resolvedUrls.local[0]

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
})
const page = await browser.newPage({ viewport: { width: 1060, height: 840 }, deviceScaleFactor: Number(process.env.SCALE || 1) })
const logs = []
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`)
})
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`))
await page.goto(url + (process.env.QUERY || ''))
await page.waitForSelector('canvas', { timeout: 60000 })
await page.waitForTimeout(waitMs)
await page.screenshot({ path: out, clip: { x: 0, y: 0, width: 1060, height: 800 }, timeout: 120000 })
if (process.env.CLICK_TEST) {
  // Click the graph wall screen, Pip's avatar and Axel's card, then report what the harness received.
  // Screen points come from fit_camera.py's projection of the layout.
  for (const [x, y] of [
    [870, 246],
    [259, 356]
  ]) {
    await page.mouse.move(x, y)
    await page.waitForTimeout(500)
    await page.mouse.click(x, y)
    await page.waitForTimeout(1500)
  }
  await page.locator('.hq-agent-card', { hasText: 'AXEL' }).click()
  await page.waitForTimeout(1500)
  console.log('harness log:', await page.locator('#harness-log').innerText())
}
console.log('saved', out)
console.log('stats', JSON.stringify(await page.evaluate(() => window.__stats)))
if (logs.length) console.log(logs.slice(0, 30).join('\n'))
await browser.close()
await server.close()

execFileSync('python3', [resolve(here, 'compare.py'), out], { stdio: 'inherit' })
