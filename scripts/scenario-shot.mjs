#!/usr/bin/env node
// Runs the built app (out/) against the fake Claude API, ingests a few sources so every panel has
// real data, and screenshots the window while the last source is still being processed.
//
//   npm run build
//   xvfb-run -a -s "-screen 0 1700x1200x24" node scripts/scenario-shot.mjs [out.png]

import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { _electron as electron } from 'playwright-core'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const out = resolve(process.argv[2] ?? join(root, '.shots/scenario.png'))
mkdirSync(dirname(out), { recursive: true })
const work = mkdtempSync(join(tmpdir(), 'agent-hq-scenario-'))
const inputs = join(work, 'inputs')
mkdirSync(inputs)

const SOURCES = {
  'llm-wiki.md': '# The LLM Wiki\n\nAndrej Karpathy proposed the LLM Wiki: Large Language Models keep a folder of Markdown Pages up to date. Raw Sources stay immutable while the Wiki Pages grow. An Index File and a Log File keep the Wiki navigable.\n',
  'stoicism.md': '# Stoicism notes\n\nMarcus Aurelius wrote Meditations. The Dichotomy Of Control separates what we control from what we do not. Seneca wrote Letters From A Stoic. Epictetus taught the Discipline Of Assent.\n',
  'rust.txt': 'Rust uses Ownership and Borrowing to guarantee Memory Safety. The Borrow Checker enforces Lifetimes. Cargo is the Rust Package Manager. Tokio provides an Async Runtime.\n',
  'transformers.md': '# Transformers\n\nThe Transformer Architecture uses Self Attention. Attention Is All You Need introduced it in 2017. Large Language Models such as Claude are built on Transformers. The Context Window limits how much text the model sees.\n'
}
for (const [name, text] of Object.entries(SOURCES)) writeFileSync(join(inputs, name), text)

const port = await freePort()
const fake = spawn(process.execPath, [join(root, 'scripts/fake-claude.mjs')], {
  env: { ...process.env, PORT: String(port), DELAY_MS: process.env.DELAY_MS ?? '1500' },
  stdio: ['ignore', 'pipe', 'inherit']
})
await new Promise((ready) => fake.stdout.on('data', (c) => c.toString().includes('listening') && ready()))

const app = await electron.launch({
  args: [join(root, 'out/main/index.js'), '--no-sandbox', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  env: { ...process.env, AGENT_HQ_DATA_DIR: join(work, 'data'), ANTHROPIC_BASE_URL: `http://127.0.0.1:${port}`, ANTHROPIC_API_KEY: 'test', AGENT_HQ_WIDTH: '1536', AGENT_HQ_HEIGHT: '1024' },
  timeout: 120_000
})
try {
  const page = await app.firstWindow()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await page.waitForLoadState('domcontentloaded')
  await page.evaluate(() => window.api.onSnapshot((s) => (window.__last = s)))
  const names = Object.keys(SOURCES)
  await page.evaluate((paths) => window.api.addFiles(paths), names.slice(0, 3).map((n) => join(inputs, n)))
  await until(page, () => window.__last?.sources.filter((s) => s.status === 'ingested').length === 3, 300_000)
  await page.evaluate(() => window.api.ask('What do I know about Stoicism?'))
  await page.evaluate((p) => window.api.addFiles([p]), join(inputs, names[3]))
  await page.evaluate(() => window.api.addUrl('https://karpathy.github.io/llm-wiki/').catch(() => null))
  await until(page, () => window.__last?.agents.some((a) => a.id === 'rex' && a.state !== 'idle'), 120_000)
  await page.waitForTimeout(Number(process.env.SETTLE_MS ?? 1200))
  await page.screenshot({ path: out, timeout: 180_000 })
  console.log('saved', out)
  if (errors.length) console.log('page errors:\n' + errors.slice(0, 20).join('\n'))
} finally {
  await app.close()
  fake.kill()
}

/** Polls a predicate in the page (waitForFunction needs eval, which the app's CSP blocks). */
async function until(page, predicate, timeout) {
  const deadline = Date.now() + timeout
  while (!(await page.evaluate(predicate))) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${predicate}`)
    await page.waitForTimeout(250)
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
