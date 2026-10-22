// Starts the preview server and captures screenshots of the shell and every view.
// Usage: node scripts/ui-preview/shoot.mjs [outDir] [scenario...]
// Scenarios: office (default set) | views | states | sizes | all
// Env: OFFICE=real renders the real 3D OfficeScene; OFFICE_WAIT=ms lets it load before the office shot.
import { createServer } from 'vite'
import { execSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = resolve(process.argv[2] || '/tmp/ui-shots')
const wanted = new Set(process.argv.slice(3).length ? process.argv.slice(3) : ['office'])
const all = wanted.has('all')
mkdirSync(outDir, { recursive: true })

const { chromium } = await import(resolve(execSync('npm root -g').toString().trim(), 'playwright/index.mjs'))
const server = await createServer({ configFile: resolve(here, 'vite.config.mjs') })
await server.listen()
const base = server.resolvedUrls.local[0]

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const errors = []

async function open(query = '', size = { width: 1536, height: 1024 }) {
  const page = await browser.newPage({ viewport: size })
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`))
  page.on('console', (m) => m.type() === 'error' && errors.push(`[console] ${m.text()}`))
  await page.goto(base + query)
  await page.waitForSelector('nav[aria-label="Main"]')
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(400)
  return page
}

async function shot(page, name) {
  const path = resolve(outDir, `${name}.png`)
  await page.screenshot({ path })
  console.log('saved', path)
}

const nav = (page, label) => page.click(`nav[aria-label="Main"] button:has-text("${label}")`)

if (all || wanted.has('office')) {
  const page = await open()
  await page.fill('input[aria-label="Source URL"]', 'https://karpathy.github.io/llm-wiki/')
  await page.mouse.click(5, 600)
  await page.waitForTimeout(Number(process.env.OFFICE_WAIT || 0))
  await shot(page, 'office')
  await page.close()
}

if (all || wanted.has('views')) {
  const page = await open()
  for (const [label, name] of [['Agents', 'agents'], ['Tasks', 'tasks'], ['Inbox', 'inbox'], ['Settings', 'settings']]) {
    await nav(page, label)
    await page.waitForTimeout(300)
    await shot(page, `view-${name}`)
  }
  await nav(page, 'Graph')
  await page.waitForTimeout(3500)
  await shot(page, 'view-graph')
  const box = await page.locator('canvas').boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.waitForTimeout(200)
  await nav(page, 'Knowledge')
  await page.waitForTimeout(300)
  await shot(page, 'view-knowledge-list')
  await page.click('text=LLM Wiki >> nth=0')
  await page.waitForTimeout(400)
  await shot(page, 'view-knowledge-page')
  await page.close()
}

if (all || wanted.has('states')) {
  let page = await open()
  await page.fill('input[aria-label="Ask the wiki a question"]', 'What is an LLM wiki?')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(200)
  await shot(page, 'ask-loading')
  await page.waitForTimeout(1400)
  await shot(page, 'ask-answer')
  await page.keyboard.press('Escape')
  await page.click('button:has-text("contradictions found")')
  await page.waitForTimeout(200)
  await shot(page, 'popover-contradictions')
  await page.click('button:has-text("orphan pages")')
  await page.waitForTimeout(200)
  await shot(page, 'popover-orphans')
  await page.click('button[aria-haspopup="menu"]')
  await page.waitForTimeout(200)
  await shot(page, 'menu-user')
  await page.close()

  page = await open('?nokey=1')
  await page.fill('input[aria-label="Ask the wiki a question"]', 'Why is the sky blue?')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(1500)
  await shot(page, 'ask-nokey')
  await page.fill('input[aria-label="Source URL"]', 'not a url')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(200)
  await shot(page, 'url-invalid')
  await page.close()

  page = await open('?state=empty&offline=1')
  await shot(page, 'empty-office')
  for (const [label, name] of [['Knowledge', 'knowledge'], ['Graph', 'graph'], ['Tasks', 'tasks'], ['Inbox', 'inbox']]) {
    await nav(page, label)
    await page.waitForTimeout(250)
    await shot(page, `empty-${name}`)
  }
  await page.close()

  page = await open()
  await page.evaluate(() => {
    const dt = new DataTransfer()
    dt.items.add(new File(['hello'], 'notes.md', { type: 'text/markdown' }))
    window.dispatchEvent(new DragEvent('dragenter', { dataTransfer: dt, bubbles: true }))
  })
  await page.waitForTimeout(200)
  await shot(page, 'drop-overlay')
  await page.close()
}

if (all || wanted.has('sizes')) {
  for (const size of [{ width: 1280, height: 800 }, { width: 1920, height: 1200 }]) {
    const page = await open('', size)
    await shot(page, `size-${size.width}x${size.height}`)
    await page.close()
  }
}

await browser.close()
await server.close()
if (errors.length) console.log(errors.join('\n'))
