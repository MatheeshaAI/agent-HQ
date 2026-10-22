#!/usr/bin/env node
// Drives the real Electron app (main + preload + renderer) through window.api against the fake
// Claude API, and saves screenshots while the agents work and after they finish.
//
//   npx electron-vite build --outDir "$PWD/scripts/engine-test/.build"
//   xvfb-run -a -s "-screen 0 1700x1200x24" node scripts/engine-test/app-smoke.mjs [shotDir]

import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { _electron as electron } from 'playwright-core'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../..')
const shots = resolve(process.argv[2] ?? join(root, '.shots/engine'))
mkdirSync(shots, { recursive: true })
const work = mkdtempSync(join(tmpdir(), 'agent-hq-app-smoke-'))
const inputs = join(work, 'inputs')
mkdirSync(inputs)

const port = await freePort()
// Slow answers a little so the screenshot taken mid-ingestion shows agents at work.
const fake = spawn(process.execPath, [join(root, 'scripts/fake-claude.mjs')], {
  env: { ...process.env, PORT: String(port), DELAY_MS: process.env.DELAY_MS ?? '1200' },
  stdio: ['ignore', 'pipe', 'inherit']
})
await new Promise((ready) => fake.stdout.on('data', (c) => c.toString().includes('listening') && ready()))

writeFileSync(join(inputs, 'llm-wiki.md'), '# The LLM Wiki\n\nAndrej Karpathy proposed the LLM Wiki: Large Language Models keep a folder of Markdown Pages up to date. Raw Sources stay immutable while the Wiki Pages grow. An Index File and a Log File keep the Wiki navigable.\n')
writeFileSync(join(inputs, 'agents.txt'), 'Agent HQ runs six agents. Sage reads sources, Rex extracts concepts, Nova links the Knowledge Graph and Muse writes the Wiki Pages. Axel checks the Knowledge Graph for contradictions.\n')

const results = {}
const app = await electron.launch({
  args: [join(here, '.build/main/index.js'), '--no-sandbox', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  env: { ...process.env, AGENT_HQ_DATA_DIR: join(work, 'data'), ANTHROPIC_BASE_URL: `http://127.0.0.1:${port}`, ANTHROPIC_API_KEY: 'test', AGENT_HQ_WIDTH: '1536', AGENT_HQ_HEIGHT: '1024' },
  timeout: 120_000
})
try {
  const page = await app.firstWindow()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.waitForLoadState('domcontentloaded')

  results.initial = await page.evaluate(async () => {
    const s = await window.api.getSnapshot()
    window.__pushes = 0
    window.api.onSnapshot((next) => {
      window.__pushes++
      window.__last = next
    })
    return { online: s.online, stats: s.stats, agents: s.agents.map((a) => `${a.name}:${a.state}:${a.activity}`), activity: s.activity.map((a) => a.title), settings: s.settings, platform: window.api.window.platform }
  })
  await page.waitForTimeout(4000)
  await shoot(page, '1-empty.png')

  results.added = await page.evaluate(
    async ([md, txt]) => {
      const note = await window.api.addNote('Muse keeps the Agent Office tidy. The Agent Office has six desks and a Meeting Room.')
      const files = await window.api.addFiles([md, txt])
      return [note, ...files].map((s) => `${s.kind}:${s.name}:${s.status}`)
    },
    [join(inputs, 'llm-wiki.md'), join(inputs, 'agents.txt')]
  )
  await page.waitForTimeout(2500)
  results.whileWorking = await page.evaluate(() => window.__last?.agents.map((a) => `${a.name}:${a.state}:${a.activity}`))
  await shoot(page, '2-working.png')

  await page.waitForFunction(() => window.__last && window.__last.sources.length === 3 && window.__last.sources.every((s) => s.status === 'ingested' || s.status === 'failed'), null, { timeout: 240_000 })
  results.after = await page.evaluate(async () => {
    const s = window.__last
    const pages = await window.api.listPages()
    const first = await window.api.readPage(pages[0].slug)
    const answer = await window.api.ask('What does the Agent Office have?')
    const janitor = await window.api.runJanitor()
    let openOutside = 'allowed'
    try {
      await window.api.openPath('/etc/passwd')
    } catch (e) {
      openOutside = String(e.message).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
    }
    return {
      pushes: window.__pushes,
      stats: s.stats,
      sources: s.sources.map((x) => `${x.name}:${x.status}:${(x.pages ?? []).length} pages${x.error ? `:${x.error}` : ''}`),
      tasks: s.tasks.map((t) => `${t.title}:${t.agent}:${t.status}`),
      graph: `${s.graph.nodes.length} nodes / ${s.graph.edges.length} edges`,
      activity: s.activity.slice(0, 12).map((a) => `${a.kind}:${a.title}:${a.detail}`),
      pages: pages.map((p) => p.title),
      firstPageStartsWithFrontmatter: first.markdown.startsWith('---\n'),
      answer,
      janitor,
      openOutside
    }
  })

  await page.evaluate(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.id = '__smoke_file'
    input.style.display = 'none'
    document.body.append(input)
  })
  await page.setInputFiles('#__smoke_file', join(inputs, 'agents.txt'))
  results.pathForFile = await page.evaluate(() => window.api.pathForFile(document.getElementById('__smoke_file').files[0]))
  results.pathForFileMatches = results.pathForFile === join(inputs, 'agents.txt')

  await page.waitForTimeout(2500)
  await shoot(page, '3-after.png')
  results.pageErrors = errors
} finally {
  await app.close()
  fake.kill()
}
console.log(JSON.stringify(results, null, 2))
console.log(`screenshots in ${shots}`)

/** The 3D office renders through SwiftShader here, so a frame can take a while. */
async function shoot(page, name) {
  try {
    await page.screenshot({ path: join(shots, name), timeout: 120_000 })
  } catch (error) {
    results[`screenshot ${name}`] = String(error.message).split('\n')[0]
  }
}

function freePort() {
  return new Promise((done, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      server.close(() => done(port))
    })
  })
}
