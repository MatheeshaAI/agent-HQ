#!/usr/bin/env node
// Clicks through the built app (out/) like a person would, against the fake Claude API:
// starts without a key, saves one in Settings, adds a note, a picked file and a URL, waits for
// ingestion, then exercises every view, the Ask box, citations and the janitor. Screenshots each step.
//
//   npm run build
//   xvfb-run -a -s "-screen 0 1700x1200x24" node scripts/ui-e2e.mjs [shotDir]

import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { _electron as electron } from 'playwright-core'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const shots = resolve(process.argv[2] ?? join(root, '.shots/e2e'))
mkdirSync(shots, { recursive: true })
const work = mkdtempSync(join(tmpdir(), 'agent-hq-e2e-'))
const sample = join(work, 'stoicism.md')
writeFileSync(sample, '# Stoicism\n\nMarcus Aurelius wrote Meditations. The Dichotomy Of Control separates what we control from what we do not. Seneca wrote Letters From A Stoic.\n')

const port = await freePort()
const fake = spawn(process.execPath, [join(root, 'scripts/fake-claude.mjs')], { env: { ...process.env, PORT: String(port), DELAY_MS: '300' }, stdio: ['ignore', 'pipe', 'inherit'] })
await new Promise((ready) => fake.stdout.on('data', (c) => c.toString().includes('listening') && ready()))

const env = { ...process.env, AGENT_HQ_DATA_DIR: join(work, 'data'), ANTHROPIC_BASE_URL: `http://127.0.0.1:${port}`, AGENT_HQ_WIDTH: '1536', AGENT_HQ_HEIGHT: '1024' }
delete env.ANTHROPIC_API_KEY
const app = await electron.launch({
  args: [join(root, 'out/main/index.js'), '--no-sandbox', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  env,
  timeout: 120_000
})
const results = []
const check = (name, ok, detail = '') => results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
const errors = []
try {
  const page = await app.firstWindow()
  page.on('pageerror', (e) => errors.push(e.message))
  await page.waitForLoadState('domcontentloaded')
  await page.evaluate(() => window.api.onSnapshot((s) => (window.__last = s)))
  const nav = (label) => page.getByRole('navigation', { name: 'Main' }).getByText(label, { exact: true }).click()
  const snap = () => page.evaluate(() => window.__last ?? window.api.getSnapshot())
  const shot = (name) => page.screenshot({ path: join(shots, name), timeout: 180_000 }).catch((e) => check(`screenshot ${name}`, false, e.message.split('\n')[0]))

  // 1. No key yet: a note fails with a readable error.
  await nav('Inbox')
  await page.getByPlaceholder('Write a thought, a quote or meeting notes…').fill('The Dichotomy Of Control is the core of Stoicism.')
  await page.getByRole('button', { name: 'Add note' }).last().click()
  await until(page, () => window.__last?.sources.some((s) => s.status === 'failed'), 60_000)
  const failed = (await snap()).sources.find((s) => s.status === 'failed')
  check('ingest without a key fails readably', /API key/.test(failed?.error ?? ''), failed?.error)
  await shot('01-inbox-no-key.png')

  // 2. Save a key in Settings; the failed source is retried automatically.
  await nav('Settings')
  await page.getByPlaceholder('Paste API key').fill('sk-ant-test-key')
  await page.getByRole('button', { name: 'Save provider' }).click()
  await until(page, () => window.__last?.settings.apiKeySet === true, 20_000)
  check('API key saved (never shown)', !(await page.content()).includes('sk-ant-test-key'))
  await shot('02-settings.png')

  // 3. A picked file and a URL.
  await nav('Inbox')
  await page.locator('input[type="file"]').setInputFiles(sample)
  await page.getByPlaceholder('https://…').fill('https://example.com/article')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  // This sandbox has no internet, so the URL fetch fails; the Inbox must say why, in plain words.
  const urlError = page.getByText(/Could not fetch/).first()
  await urlError.waitFor({ timeout: 60_000 })
  const urlMessage = await urlError.textContent()
  check('unreachable URL reported cleanly', !/invoking remote method/.test(urlMessage ?? ''), urlMessage)
  await until(page, () => (window.__last?.sources.filter((s) => s.status === 'ingested').length ?? 0) >= 2, 240_000)
  const s1 = await snap()
  check('note retried + file ingested', s1.sources.filter((s) => s.status === 'ingested').length >= 2, s1.sources.map((s) => `${s.kind}:${s.status}`).join(', '))
  check('stats updated', s1.stats.pages > 0 && s1.stats.sources >= 2, JSON.stringify(s1.stats))
  await shot('03-inbox.png')

  // 4. Every view renders.
  for (const [label, file] of [['Agents', '04-agents.png'], ['Tasks', '05-tasks.png'], ['Graph', '06-graph.png'], ['Knowledge', '07-knowledge.png']]) {
    await nav(label)
    await page.waitForTimeout(800)
    await shot(file)
  }
  const firstPage = page.locator('button', { hasText: s1.graph.nodes[0]?.title ?? '' }).first()
  await firstPage.click()
  await page.waitForTimeout(500)
  check('page reader shows markdown', (await page.locator('h1, h2').count()) > 0)
  await shot('08-page.png')

  // 5. Ask from the bottom bar; open a citation.
  await nav('Office')
  await page.getByPlaceholder('Ask a question...').fill('What is the Dichotomy Of Control?')
  await page.keyboard.press('Enter')
  const cite = page.locator('[class*="cite"]').first()
  await cite.waitFor({ timeout: 60_000 })
  check('ask answers with citations', (await page.locator('[class*="cite"]').count()) > 0)
  await shot('09-answer.png')
  await cite.click()
  await page.waitForTimeout(600)
  check('citation opens the page', (await page.locator('h1, h2').count()) > 0)

  // 6. Janitor: run the check from the bottom bar.
  await nav('Office')
  await page.getByTitle("Run the janitor's checks now").click()
  await until(page, () => window.__last?.janitor.running === false && window.__last?.janitor.checkedAt > Date.now() - 60_000, 60_000)
  check('janitor runs from the bottom bar', true)

  // 7. URL bar validation.
  await page.getByPlaceholder('Paste a URL to ingest, then press Enter').fill('not a url')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(500)
  // 8. The Agent Status list is gone from the rail; clicking an agent in the office opens its drawer.
  check('rail has no Agent Status list', (await page.getByText('Agent Status', { exact: true }).count()) === 0)
  await page.getByRole('button', { name: /^Axel:/ }).click()
  const drawerPanel = page.getByRole('complementary', { name: /Axel/ })
  await drawerPanel.waitFor({ timeout: 10_000 }).catch(() => {})
  check('clicking an agent opens its drawer', (await drawerPanel.count()) === 1)
  await page.getByRole('button', { name: /^Sage,/ }).click()
  await page.getByLabel('Private message to Sage').fill('hello')
  await page.keyboard.press('Enter')
  const voiceBars = await page.locator('.hq-agent-card__voice').first().waitFor({ timeout: 3000 }).then(() => true, () => false)
  check('speaking cue shows while a reply is generated', voiceBars)
  await page.getByRole('button', { name: /^Rex,/ }).click()
  check('each agent keeps its own conversation', (await page.getByText('hello', { exact: true }).count()) === 0)
  await page.getByRole('button', { name: /^Sage,/ }).click()
  check('history returns when switching back', (await page.getByText('hello', { exact: true }).count()) === 1)
  await page.getByRole('button', { name: 'Close agent panel' }).click()
  check('drawer closes', (await page.getByRole('complementary', { name: /Sage/ }).count()) === 0)
  // 9. Camera controls: buttons and keys work and the view resets.
  const bar = page.getByRole('toolbar', { name: 'Office view controls' })
  const view = page.getByRole('group', { name: /^Office view/ })
  await view.focus()
  await bar.getByLabel('Zoom in').click()
  await page.keyboard.press('ArrowLeft')
  await bar.getByLabel('Rotate right').click()
  await bar.getByLabel('Fit the whole office').click()
  await bar.getByLabel('Reset the view').click()
  await view.focus()
  await page.keyboard.press('0')
  await bar.getByLabel('Pause motion').click()
  check('pause control toggles', (await bar.getByLabel('Resume motion').getAttribute('aria-pressed')) === 'true')
  await bar.getByLabel('Resume motion').click()
  await shot('10-office.png')
  check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '))
} catch (error) {
  check('run', false, error.message.split('\n').slice(0, 12).join(' / '))
} finally {
  await app.close()
  fake.kill()
}
console.log(results.join('\n'))
console.log(`screenshots in ${shots}`)
process.exitCode = results.some((r) => r.startsWith('FAIL')) ? 1 : 0

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
