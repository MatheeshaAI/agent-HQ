// End-to-end tests of the wiki engine core against scripts/fake-claude.mjs.
// Run through scripts/engine-test/run.mjs, which bundles this file and starts the fake API.

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import { join } from 'node:path'
import { after, before, test } from 'node:test'
import type { AppSnapshot, SourceItem } from '../../src/shared/types'
import { Engine } from '../../src/main/engine/engine'
import { spawnProgram } from '../../src/main/engine/llm/providers'
import type { SecretCodec } from '../../src/main/engine/settings'
import { parsePage, renderPage } from '../../src/main/engine/wiki/frontmatter'
import { extractWikilinks } from '../../src/main/engine/wiki/links'
import { htmlToText } from '../../src/main/engine/sources/htmlToText'
import { splitText } from '../../src/main/engine/sources/content'
import { makePdf } from './pdf'

const API = process.env.ANTHROPIC_BASE_URL as string
const ROOT = process.env.ENGINE_TEST_DIR as string
const DATA = join(ROOT, 'data')
const KNOWLEDGE = join(DATA, 'knowledge')
const INPUT = join(ROOT, 'input')

/** Test stand-in for Electron's safeStorage: reversible, but never stores the key as given. */
const codec: SecretCodec = {
  available: () => true,
  encrypt: (plain) => `enc:${Buffer.from(plain).toString('base64')}`,
  decrypt: (encoded) => Buffer.from(encoded.replace(/^enc:/, ''), 'base64').toString()
}

const pushes: AppSnapshot[] = []
let engine: Engine
let web: Server
let webUrl = ''

function start(): Promise<Engine> {
  return Engine.start({ dataDir: DATA, defaults: { knowledgeDir: KNOWLEDGE }, codec, push: (s) => pushes.push(s) })
}

async function fake(path: string, body?: unknown): Promise<any> {
  const response = await fetch(`${API}${path}`, body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) })
  return response.json()
}

function wikiFiles(): string[] {
  return readdirSync(join(KNOWLEDGE, 'wiki')).filter((f) => f.endsWith('.md') && !f.startsWith('.'))
}

function source(id: string): SourceItem {
  const found = engine.getSnapshot().sources.find((s) => s.id === id)
  assert.ok(found, `source ${id} is in the snapshot`)
  return found
}

async function waitFor(check: () => boolean, what: string, timeoutMs = 5000): Promise<void> {
  const until = Date.now() + timeoutMs
  while (!check()) {
    if (Date.now() > until) throw new Error(`Timed out waiting for ${what}`)
    await new Promise((r) => setTimeout(r, 50))
  }
}

before(async () => {
  mkdirSync(INPUT, { recursive: true })
  web = createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end(`<!doctype html><html><head><title>Karpathy &amp; the LLM Wiki</title><style>body{color:red}</style>
      <script>window.track = "should not appear"</script></head><body><nav>Home · About</nav>
      <article><h1>The LLM Wiki Pattern</h1><p>Andrej Karpathy describes an LLM Wiki where Large Language Models maintain a folder of markdown pages.</p>
      <p>Sources are kept immutable in a raw folder &mdash; the Wiki Pages are rewritten as knowledge grows. Andrej Karpathy calls this a Second Brain &#8212; one that compounds.</p>
      <h2>Index and Log</h2><ul><li>The Index File catalogues every page.</li><li>The Log File records each ingest &amp; lint pass.</li></ul>
      <p>${'Large Language Models read every new source carefully. '.repeat(12)}</p></article></body></html>`)
  })
  await new Promise<void>((r) => web.listen(0, '127.0.0.1', () => r()))
  const address = web.address()
  webUrl = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}/llm-wiki/`
  engine = await start()
})

after(() => {
  engine?.close()
  web?.close()
})

test('opens an empty knowledge base without seeding anything', () => {
  for (const path of ['raw', 'wiki', 'index.md', 'log.md']) assert.ok(existsSync(join(KNOWLEDGE, path)), `${path} exists`)
  assert.deepEqual(wikiFiles(), [])
  const snapshot = engine.getSnapshot()
  assert.equal(snapshot.online, true)
  assert.deepEqual(snapshot.stats, { pages: 0, topics: 0, sources: 0 })
  assert.deepEqual(
    snapshot.agents.map((a) => [a.id, a.state, a.activity]),
    [
      ['pip', 'idle', 'Waiting for mail'],
      ['sage', 'idle', 'Waiting for sources'],
      ['rex', 'idle', 'Waiting for text'],
      ['nova', 'idle', 'Watching the graph'],
      ['axel', 'idle', 'Patrolling the wiki'],
      ['muse', 'idle', 'Tidying the shelves']
    ]
  )
  assert.deepEqual(
    snapshot.activity.map((a) => [a.kind, a.title, a.detail]),
    [['system', 'Knowledge base opened', '0 pages, 0 sources']]
  )
  assert.equal(snapshot.settings.userName, 'Matheesha Sarathchandra')
  assert.equal(snapshot.settings.model, 'claude-opus-5-5')
  assert.deepEqual(snapshot.janitor, { checkedAt: null, running: false, contradictions: [], orphans: [] })
})

test('without an API key a step fails with a readable message and makes no request', async () => {
  const before = (await fake('/__fake/requests')).length
  const note = await engine.addNote('A note written before any key was saved. It mentions Project Atlas once.')
  await engine.idle()
  assert.equal(source(note.id).status, 'failed')
  assert.equal(source(note.id).error, 'Add your Claude API key in Settings')
  assert.equal((await fake('/__fake/requests')).length, before)
  const sage = engine.getSnapshot().agents.find((a) => a.id === 'sage')
  assert.equal(sage?.state, 'error')
})

test('saves the API key encrypted, never exposes it, and retries sources that lacked one', async () => {
  const view = await engine.saveSettings({ apiKey: 'test-secret-key' })
  assert.equal(view.apiKeySet, true)
  const stored = readFileSync(join(DATA, 'settings.json'), 'utf8')
  assert.ok(!stored.includes('test-secret-key'), 'settings.json does not hold the plain key')
  assert.match(stored, /"encrypted": true/)
  assert.ok(!JSON.stringify(engine.getSnapshot()).includes('test-secret-key'), 'snapshot does not hold the key')
  await engine.idle()
  const retried = engine.getSnapshot().sources.find((s) => s.name.startsWith('A note written'))
  assert.equal(retried?.status, 'ingested')
})

test('ingests a markdown note, a text file and a PDF through all five agents', async () => {
  writeFileSync(
    join(INPUT, 'eiffel.txt'),
    'Gustave Eiffel designed iron structures across Europe. The Eiffel Tower was completed in 1887. ' +
      'Gustave Eiffel also engineered the internal frame of the Statue of Liberty. The Eiffel Tower is in Paris.'
  )
  writeFileSync(
    join(INPUT, 'tower.pdf'),
    makePdf([
      'The Eiffel Tower is a wrought iron lattice tower in Paris.',
      'The Eiffel Tower was completed in 1889.',
      'It was built for the Exposition Universelle and designed by the company of Gustave Eiffel.'
    ])
  )
  const pushesBefore = pushes.length
  const note = await engine.addNote('# Paris Landmarks\n\nThe Eiffel Tower and the Louvre Museum are the best known landmarks of Paris. The Louvre Museum holds the Mona Lisa.')
  const [text, pdf] = await engine.addFiles([join(INPUT, 'eiffel.txt'), join(INPUT, 'tower.pdf')])
  assert.equal(note.kind, 'note')
  assert.equal(text.kind, 'text')
  assert.equal(pdf.kind, 'pdf')
  assert.ok(existsSync(text.path) && text.path.startsWith(join(KNOWLEDGE, 'raw')), 'file copied into raw/')
  assert.ok(existsSync(join(INPUT, 'eiffel.txt')), 'original untouched')

  const queued = engine.getSnapshot().tasks.filter((t) => t.sourceId === pdf.id)
  assert.deepEqual(
    queued.map((t) => [t.title, t.agent]).reverse(),
    [
      ['Process PDF source', 'sage'],
      ['Extract key concepts', 'rex'],
      ['Build entity graph', 'nova'],
      ['Write summary', 'muse'],
      ['Organize knowledge', 'axel']
    ]
  )

  await engine.idle()
  const snapshot = engine.getSnapshot()
  for (const item of [note, text, pdf]) {
    const s = source(item.id)
    assert.equal(s.status, 'ingested', `${s.name} ingested (${s.error ?? ''})`)
    assert.ok((s.pages ?? []).length > 0, `${s.name} produced pages`)
    assert.equal(snapshot.tasks.filter((t) => t.sourceId === item.id && t.status === 'done').length, 5)
  }
  assert.ok(snapshot.agents.every((a) => a.state === 'idle'), 'agents are idle again')
  assert.ok(pushes.length > pushesBefore, 'snapshots were pushed')
  assert.ok(pushes.length - pushesBefore < 60, `pushes are throttled (${pushes.length - pushesBefore})`)

  const titles = snapshot.activity.map((a) => a.title)
  for (const title of ['Knowledge ingestion started', 'Reader completed', 'Extractor completed', 'Relationships detected', 'Librarian indexing', 'Janitor completed', 'Knowledge ingestion finished']) {
    assert.ok(titles.includes(title), `activity has "${title}"`)
  }
})

test('writes wiki pages with front matter and wikilinks, plus index.md and log.md', () => {
  const files = wikiFiles()
  assert.ok(files.length >= 4, `pages written (${files.join(', ')})`)
  let linked = 0
  for (const file of files) {
    const markdown = readFileSync(join(KNOWLEDGE, 'wiki', file), 'utf8')
    const { frontmatter, body } = parsePage(markdown)
    assert.ok(frontmatter.title, `${file} has a title`)
    assert.ok(frontmatter.summary, `${file} has a summary`)
    assert.ok(frontmatter.updated && !Number.isNaN(Date.parse(frontmatter.updated)), `${file} has an ISO updated date`)
    assert.ok((frontmatter.tags ?? []).length > 0, `${file} has tags`)
    assert.ok((frontmatter.sources ?? []).length > 0, `${file} lists its sources`)
    assert.match(body, /^# /, `${file} starts with its title`)
    if (extractWikilinks(body).length > 0) linked++
  }
  assert.ok(linked >= files.length - 1, 'pages link to each other')

  const index = readFileSync(join(KNOWLEDGE, 'index.md'), 'utf8')
  for (const page of engine.listPages()) assert.ok(index.includes(`[[${page.title}]]`), `index lists ${page.title}`)
  const log = readFileSync(join(KNOWLEDGE, 'log.md'), 'utf8')
  const entries = log.match(/^## \[\d{4}-\d\d-\d\d \d\d:\d\d\] ingest \| .+$/gm) ?? []
  assert.equal(entries.length, 4, 'one log entry per ingested source')
  assert.ok(log.includes('ingest | tower.pdf'))

  const sample = engine.readPage(engine.listPages()[0].slug)
  assert.ok(sample && sample.markdown.startsWith('---\n'), 'readPage returns the whole file')
})

test('stats and graph reflect the wiki', () => {
  const { stats, graph } = engine.getSnapshot()
  const pages = engine.listPages()
  assert.equal(stats.pages, wikiFiles().length)
  assert.equal(stats.pages, pages.length)
  assert.equal(stats.sources, readdirSync(join(KNOWLEDGE, 'raw')).filter((f) => !f.startsWith('.')).length)
  assert.equal(stats.topics, new Set(pages.flatMap((p) => p.tags.map((t) => t.toLowerCase()))).size)

  const slugs = new Set(pages.map((p) => p.slug))
  assert.deepEqual(new Set(graph.nodes.map((n) => n.id)), slugs)
  assert.ok(graph.edges.length > 0, 'graph has edges')
  const seen = new Set<string>()
  for (const edge of graph.edges) {
    assert.ok(slugs.has(edge.source) && slugs.has(edge.target), 'edge ends are pages')
    assert.notEqual(edge.source, edge.target, 'no self loops')
    const key = [edge.source, edge.target].sort().join('|')
    assert.ok(!seen.has(key), 'edges are deduplicated')
    seen.add(key)
  }
  for (const node of graph.nodes) {
    const degree = graph.edges.filter((e) => e.source === node.id || e.target === node.id).length
    assert.equal(node.degree, degree, `degree of ${node.id}`)
    assert.equal(node.sources, pages.find((p) => p.slug === node.id)?.sources.length)
  }
})

test('the janitor finds the contradiction and the orphans', async () => {
  const before = engine.getSnapshot().janitor
  assert.ok(before.checkedAt, 'checked during ingestion')
  assert.ok(before.contradictions.some((c) => /1887/.test(c.description) && /1889/.test(c.description)), 'the 1887/1889 contradiction is found')

  const report = await engine.runJanitor()
  assert.equal(report.running, false)
  assert.equal(report.note, undefined)
  const pages = engine.listPages()
  const linked = new Set(pages.flatMap((p) => p.links))
  assert.deepEqual(report.orphans, pages.map((p) => p.slug).filter((s) => !linked.has(s)).sort())
  for (const c of report.contradictions) for (const slug of c.pages) assert.ok(pages.some((p) => p.slug === slug))
  assert.match(readFileSync(join(KNOWLEDGE, 'log.md'), 'utf8'), /\] lint \| \d+ pages checked/)
  assert.ok(existsSync(join(KNOWLEDGE, 'janitor.json')))
  assert.deepEqual(engine.getSnapshot().janitor.contradictions, report.contradictions)
})

test('ask answers from the wiki and cites pages', async () => {
  const result = await engine.ask('When was the Eiffel Tower completed?')
  assert.equal(result.error, undefined)
  assert.ok(result.answer.length > 0)
  assert.ok(result.citations.length > 0, 'cites pages')
  const slugs = new Set(engine.listPages().map((p) => p.slug))
  for (const slug of result.citations) assert.ok(slugs.has(slug), `${slug} is a page`)
  assert.equal(engine.getSnapshot().activity[0].kind, 'ask')
  assert.equal(engine.getSnapshot().agents.find((a) => a.id === 'muse')?.state, 'idle')
})

test('a rejected key fails one source with a readable error and the queue continues', async () => {
  await fake('/__fake/script', { status: 401 })
  const first = await engine.addNote('The Hubble Space Telescope was launched by NASA. Hubble Space Telescope images changed astronomy.')
  const second = await engine.addNote('The James Webb Space Telescope observes infrared light. James Webb Space Telescope launched in 2021.')
  await engine.idle()

  const failed = source(first.id)
  assert.equal(failed.status, 'failed')
  assert.equal(failed.error, 'Your Claude API key was rejected')
  const tasks = engine.getSnapshot().tasks.filter((t) => t.sourceId === first.id)
  assert.deepEqual(tasks.map((t) => [t.title, t.status, t.error]), [['Process note source', 'failed', 'Your Claude API key was rejected']])
  assert.ok(engine.getSnapshot().activity.some((a) => a.kind === 'error' && a.title === 'Sage failed'))
  assert.equal(source(second.id).status, 'ingested', 'the next source still ran')
  assert.equal(engine.getSnapshot().agents.find((a) => a.id === 'sage')?.state, 'idle', 'Sage recovered on the next job')

  await engine.retrySource(first.id)
  await engine.idle()
  assert.equal(source(first.id).status, 'ingested', 'retry succeeds')
  assert.equal(source(first.id).error, undefined)
})

test('a refusal is reported with its category', async () => {
  await fake('/__fake/script', { refusal: 'cyber' })
  const note = await engine.addNote('A short note about Firewall Rules for the Home Network.')
  await engine.idle()
  assert.equal(source(note.id).status, 'failed')
  assert.equal(source(note.id).error, 'Claude declined this request (cyber)')
})

test('after a server-side fallback only the fallback model\'s answer is parsed', async () => {
  await fake('/__fake/script', { fallback: true })
  const note = await engine.addNote('The Golden Gate Bridge spans the Golden Gate strait. The Golden Gate Bridge opened in 1937.')
  await engine.idle()
  assert.equal(source(note.id).status, 'ingested', source(note.id).error)
})

test('an image goes to Claude as an image block', async () => {
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
  writeFileSync(join(INPUT, 'diagram.png'), Buffer.from(png, 'base64'))
  const [image] = await engine.addFiles([join(INPUT, 'diagram.png')])
  assert.equal(image.kind, 'image')
  await engine.idle()
  assert.equal(source(image.id).status, 'ingested', source(image.id).error)
})

test('a URL is fetched in main, stored as text in raw/ and ingested', async () => {
  const item = await engine.addUrl(webUrl)
  assert.equal(item.kind, 'url')
  assert.equal(item.name, webUrl.replace('http://', '').replace(/\/$/, ''))
  const raw = readFileSync(item.path, 'utf8')
  assert.ok(item.path.endsWith('.md'))
  assert.match(raw, /^# Karpathy & the LLM Wiki\n\nSource: http:\/\/127\.0\.0\.1:\d+\/llm-wiki\/\nFetched: \d{4}-/)
  assert.ok(raw.includes('# The LLM Wiki Pattern'))
  assert.ok(raw.includes('## Index and Log'))
  assert.ok(raw.includes('- The Log File records each ingest & lint pass.'))
  assert.ok(raw.includes('raw folder — the Wiki Pages'))
  assert.ok(!raw.includes('should not appear') && !raw.includes('color:red') && !raw.includes('<p>'))
  await engine.idle()
  assert.equal(source(item.id).status, 'ingested')
  await assert.rejects(engine.addUrl('ftp://example.com/file'), /Only http and https/)
})

test('a very large text source is read in parts, not truncated', async () => {
  const before = (await fake('/__fake/requests')).length
  const paragraph = 'The Great Library of Alexandria collected scrolls from every ship in the harbour. '.repeat(40)
  writeFileSync(join(INPUT, 'library.txt'), Array.from({ length: 260 }, (_, i) => `Chapter ${i + 1}. ${paragraph}`).join('\n\n'))
  const [item] = await engine.addFiles([join(INPUT, 'library.txt')])
  assert.ok((item.size ?? 0) > 600_000)
  await engine.idle()
  assert.equal(source(item.id).status, 'ingested')
  const steps = (await fake('/__fake/requests')).slice(before).map((r: { step: string }) => r.step)
  assert.ok(steps.filter((s: string) => s === 'reader').length >= 3, `parts summarised and merged (${steps.join(',')})`)
  assert.ok(steps.filter((s: string) => s === 'extractor').length >= 2, 'each part extracted')
})

test('a file dropped into raw/ by hand is picked up and ingested', async () => {
  writeFileSync(join(KNOWLEDGE, 'raw', 'dropped.md'), '# Dropped Note\n\nThe Rosetta Stone helped scholars decode Egyptian Hieroglyphs. The Rosetta Stone is in the British Museum.\n')
  // The source can show up in a snapshot a moment before it is queued, so wait for the outcome itself.
  const settled = (): boolean => engine.getSnapshot().sources.some((s) => s.name === 'dropped.md' && (s.status === 'ingested' || s.status === 'failed'))
  await waitFor(settled, 'the dropped file to be ingested', 10_000)
  await engine.idle()
  const dropped = engine.getSnapshot().sources.filter((s) => s.name === 'dropped.md')
  assert.equal(dropped.length, 1, 'registered once')
  assert.equal(dropped[0].status, 'ingested', dropped[0].error)
})

test('every request used the model, structured outputs, effort and server-side fallbacks', async () => {
  const requests: { step: string; model: string; betas: string[]; fallbacks: unknown; effort: string }[] = await fake('/__fake/requests')
  assert.ok(requests.length > 20)
  for (const r of requests) {
    assert.equal(r.model, 'claude-opus-5-5')
    assert.ok(r.betas.includes('server-side-fallback-2026-07-01'))
    assert.equal(r.fallbacks, 'default')
    assert.equal(r.effort, 'medium')
    assert.notEqual(r.step, 'unknown')
  }
})

test('the inbox, wiki and janitor report survive a restart', async () => {
  const before = engine.getSnapshot()
  engine.close()
  engine = await start()
  const afterRestart = engine.getSnapshot()
  assert.deepEqual(
    afterRestart.sources.map((s) => [s.id, s.status, s.error ?? null]),
    before.sources.map((s) => [s.id, s.status, s.error ?? null])
  )
  assert.deepEqual(afterRestart.stats, before.stats)
  assert.deepEqual(afterRestart.janitor.contradictions, before.janitor.contradictions)
  assert.equal(afterRestart.activity[0].detail, `${before.stats.pages} pages, ${before.stats.sources} sources`)
  assert.equal(afterRestart.settings.apiKeySet, true, 'the encrypted key is read back')
  assert.deepEqual(afterRestart.tasks, [], 'tasks are per session')
})

test('switching the knowledge folder rescans it', async () => {
  const other = join(ROOT, 'other-knowledge')
  const view = await engine.saveSettings({ knowledgeDir: other })
  assert.equal(view.knowledgeDir, other)
  assert.deepEqual(engine.getSnapshot().stats, { pages: 0, topics: 0, sources: 0 })
  assert.ok(existsSync(join(other, 'wiki')))
  await engine.saveSettings({ knowledgeDir: KNOWLEDGE })
  assert.ok(engine.getSnapshot().stats.pages > 0)
})

test('room migration, switching and wiki isolation', async () => {
  const migrated = JSON.parse(readFileSync(join(DATA, 'settings.json'), 'utf8'))
  assert.equal(migrated.rooms[0].name, 'Work')
  assert.equal(migrated.rooms[0].knowledgeDir, KNOWLEDGE)
  assert.equal(migrated.currentRoomId, migrated.rooms[0].id)
  const [work] = engine.listRooms()
  const before = engine.listPages().map((page) => page.slug)
  const rooms = await engine.addRoom('Personal')
  const personal = rooms.find((room) => room.name === 'Personal')!
  assert.ok(personal.knowledgeDir.endsWith('Agent HQ Knowledge - Personal'))
  await engine.switchRoom(personal.id)
  assert.deepEqual(engine.listPages(), [])
  await engine.addNote('A private note for the Personal room mentioning Moonstone.'); await engine.idle()
  assert.ok(engine.listPages().length > 0)
  await engine.switchRoom(work.id)
  assert.deepEqual(engine.listPages().map((page) => page.slug), before)
  await engine.switchRoom(personal.id)
  assert.ok(engine.listPages().some((page) => /Moonstone/i.test(page.title)))
  await engine.switchRoom(work.id)
})

test('front matter round-trips and keeps hand-written keys', () => {
  const page = renderPage(
    { title: 'Quotes "and" colons: yes', tags: ['a', 'b c'], sources: ['s1'], updated: '2026-10-22T10:00:00.000Z', summary: 'One line.' },
    'Body [[Link]]',
    ['aliases:', '  - Other Name']
  )
  const parsed = parsePage(page)
  assert.deepEqual(parsed.frontmatter, { title: 'Quotes "and" colons: yes', tags: ['a', 'b c'], sources: ['s1'], updated: '2026-10-22T10:00:00.000Z', summary: 'One line.' })
  assert.deepEqual(parsed.extra, ['aliases:', '  - Other Name'])
  const handWritten = parsePage("---\ntitle: Plain title\ntags:\n  - one\n  - 'two'\nsummary: >\n---\nText")
  assert.equal(handWritten.frontmatter.title, 'Plain title')
  assert.deepEqual(handWritten.frontmatter.tags, ['one', 'two'])
  assert.deepEqual(extractWikilinks('See [[A]], [[B|label]], [[C#part]] and `[[not code]]`.'), ['A', 'B', 'C'])
})

test('html to text and text splitting', () => {
  const { title, text } = htmlToText('<title>T &lt;1&gt;</title><p>One&nbsp;two &#x41;&#66;</p><h3>Head</h3><p>Three</p>')
  assert.equal(title, 'T <1>')
  assert.equal(text, 'One two AB\n\n### Head\n\nThree')
  const parts = splitText('alpha beta. '.repeat(1000), 1000)
  assert.ok(parts.every((p) => p.length <= 1000))
  assert.equal(parts.join(' ').replace(/\s+/g, ' ').trim(), 'alpha beta. '.repeat(1000).trim())
})

/** `where` lists the shim only when `claude` can be started from the PATH. */
function claudeOnPath(): boolean {
  return process.platform === 'win32' && spawnSync('where', ['claude'], { stdio: 'ignore' }).status === 0
}

test('spawnProgram runs a .cmd file with quoted arguments and stdin on Windows', { skip: process.platform !== 'win32' }, async () => {
  const script = join(ROOT, 'echo.cmd')
  writeFileSync(script, '@echo off\r\necho ARG:%~1\r\nmore\r\n')
  const child = spawnProgram(script, ['hello world'], { cwd: ROOT, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] })
  let stdout = ''
  let stderr = ''
  child.stdout.setEncoding('utf8')
  child.stdout.on('data', (chunk: string) => { stdout += chunk })
  child.stderr.setEncoding('utf8')
  child.stderr.on('data', (chunk: string) => { stderr += chunk })
  child.stdin.write('stdin marker')
  child.stdin.end()
  assert.equal(await new Promise((r) => child.once('close', r)), 0, stderr)
  assert.ok(stdout.includes('ARG:hello world'), `batch argument missing: ${stdout}`)
  assert.ok(stdout.includes('stdin marker'), `batch stdin missing: ${stdout}`)
})

test('spawnProgram runs the claude shim and prints a version', { skip: !claudeOnPath() }, async () => {
  const child = spawnProgram('claude', ['--version'], { cwd: ROOT, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] })
  let output = ''
  child.stdout.setEncoding('utf8')
  child.stdout.on('data', (chunk: string) => { output += chunk })
  child.stderr.setEncoding('utf8')
  child.stderr.on('data', (chunk: string) => { output += chunk })
  child.stdin.end()
  assert.equal(await new Promise((r) => child.once('close', r)), 0, output)
  assert.match(output, /\d+\.\d+/, 'claude prints a version')
  console.log(`claude --version via spawnProgram: ${output.trim()}`)
})
