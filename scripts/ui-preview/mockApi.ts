// Mock of the engine bridge (window.api) with realistic content, for UI previews only.
// Never imported by the app. URL params: ?state=empty, ?nokey=1, ?offline=1, ?platform=darwin
import { AGENTS, type ActivityItem, type AgentHqApi, type AgentStatus, type AppSnapshot, type GraphData, type SourceItem, type TaskItem, type WikiPageMeta } from '@shared/types'

const MIN = 60_000
const now = Date.now()

const CONCEPTS = [
  'LLM Wiki', 'Second Brain', 'Retrieval Augmented Generation', 'Embeddings', 'Vector Search', 'Context Window', 'Prompt Caching',
  'Agentic Workflows', 'Tool Use', 'Knowledge Graph', 'Zettelkasten', 'Backlinks', 'Spaced Repetition', 'Andrej Karpathy',
  'Transformers', 'Attention', 'Tokenization', 'Fine-tuning', 'RLHF', 'Constitutional AI', 'Claude', 'Model Context Protocol',
  'Markdown', 'Obsidian', 'Personal Knowledge Management', 'Note Taking', 'Information Diet', 'Summarization', 'Entity Extraction',
  'Contradiction Detection', 'Orphan Pages', 'Wikilinks', 'Atomic Notes', 'Evergreen Notes', 'Literature Notes', 'Source Ingestion',
  'PDF Parsing', 'Web Clipping', 'Chunking', 'Hallucination', 'Grounding', 'Citations', 'Evaluation', 'Benchmarks', 'Scaling Laws',
  'Mixture of Experts', 'Distillation', 'Inference Cost', 'Latency', 'Streaming', 'Structured Output', 'JSON Schema', 'Agents',
  'Multi-agent Systems', 'Planning', 'Memory', 'Episodic Memory', 'Semantic Memory', 'Reflection', 'Self-critique'
]

const slug = (title: string): string => title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

function seeded(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

function buildGraph(): GraphData {
  const rand = seeded(7)
  const ids = CONCEPTS.map(slug)
  const edges: GraphData['edges'] = []
  const seen = new Set<string>()
  const add = (a: number, b: number): void => {
    if (a === b) return
    const key = a < b ? `${a}:${b}` : `${b}:${a}`
    if (seen.has(key)) return
    seen.add(key)
    edges.push({ source: ids[a], target: ids[b] })
  }
  ids.forEach((_, i) => {
    add(i, Math.floor(rand() * Math.max(1, i)))
    if (rand() < 0.55) add(i, Math.floor(rand() * 8))
    if (rand() < 0.35) add(i, Math.floor(rand() * ids.length))
  })
  const degree = new Map<string, number>()
  for (const e of edges) {
    degree.set(e.source, (degree.get(e.source) ?? 0) + 1)
    degree.set(e.target, (degree.get(e.target) ?? 0) + 1)
  }
  return {
    nodes: CONCEPTS.map((title, i) => ({ id: ids[i], title, degree: degree.get(ids[i]) ?? 0, sources: 1 + (i % 4) })),
    edges
  }
}

const graph = buildGraph()

const pages: WikiPageMeta[] = graph.nodes.map((node, i) => ({
  slug: node.id,
  title: node.title,
  path: `/Users/matheesha/Agent HQ/wiki/${node.id}.md`,
  links: graph.edges.filter((e) => e.source === node.id).map((e) => e.target),
  sources: [`src-${i % 9}`],
  tags: [['ai', 'llm'], ['knowledge', 'pkm'], ['agents'], ['retrieval', 'search']][i % 4],
  summary: `How ${node.title.toLowerCase()} fits into an LLM-maintained wiki, with notes from ${1 + (i % 4)} sources.`,
  updatedAt: now - (i * 7 + 3) * MIN
}))

function pageMarkdown(meta: WikiPageMeta): string {
  const links = meta.links.length ? meta.links : graph.edges.filter((e) => e.target === meta.slug).map((e) => e.source)
  const linkTitles = links.map((l) => pages.find((p) => p.slug === l)?.title ?? l)
  return `---
title: ${meta.title}
tags: [${meta.tags.join(', ')}]
---
# ${meta.title}

**${meta.title}** is one of the ideas the agents keep running into while reading your sources. ${meta.summary}

## Key points

- An LLM can *maintain* a wiki the way a librarian would: reading, filing and cross-linking.
- Pages stay plain Markdown, so they work in any editor${linkTitles[0] ? `, and connect to [[${linkTitles[0]}]]` : ''}.
- Contradictions are flagged by the janitor instead of silently overwritten.
  - Nested detail: the janitor compares claims across pages.
  - Orphans get surfaced so nothing is lost.

## Related

${linkTitles.map((t) => `- [[${t}]]`).join('\n') || '- Nothing linked yet.'}

## Example

\`\`\`ts
const page = await wiki.read('${meta.slug}')
\`\`\`

| Source | Claims | Confidence |
| --- | ---: | :---: |
| karpathy.bearblog.dev | 4 | high |
| Personal notes | 2 | medium |

> "The wiki is the memory; the model is the clerk." See also [[Missing Concept]] and <https://karpathy.github.io/llm-wiki/>.
`
}

function agents(): AgentStatus[] {
  const states: Record<string, [AgentStatus['state'], string]> = {
    pip: ['idle', 'Waiting for mail'],
    sage: ['working', 'Summarizing docs'],
    rex: ['working', 'Processing data'],
    nova: ['thinking', 'Building graph'],
    axel: ['working', '2 contradictions'],
    muse: ['working', 'Reading wiki']
  }
  return AGENTS.map((a, i) => ({ id: a.id, name: a.name, role: a.role, state: states[a.id][0], activity: states[a.id][1], updatedAt: now - i * MIN }))
}

const activity: ActivityItem[] = [
  { id: 'a1', at: now - 2 * MIN, kind: 'ingest', agent: 'pip', title: 'Knowledge ingestion started', detail: 'karpathy.bearblog.dev/llm-wiki' },
  { id: 'a2', at: now - 5 * MIN, kind: 'reader', agent: 'sage', title: 'Reader completed', detail: '132 pages processed' },
  { id: 'a3', at: now - 8 * MIN, kind: 'extractor', agent: 'rex', title: 'Extractor processing', detail: '35 topics extracted' },
  { id: 'a4', at: now - 12 * MIN, kind: 'linker', agent: 'nova', title: 'Linker building graph', detail: 'Relationships detected' },
  { id: 'a5', at: now - 15 * MIN, kind: 'muse', agent: 'muse', title: 'Muse writing', detail: 'Draft updated' },
  { id: 'a6', at: now - 18 * MIN, kind: 'janitor', agent: 'axel', title: 'Janitor completed', detail: 'Temp files cleaned' },
  { id: 'a7', at: now - 21 * MIN, kind: 'librarian', agent: 'muse', title: 'Librarian indexing', detail: 'Knowledge base updated' },
  { id: 'a8', at: now - 26 * MIN, kind: 'ask', agent: 'muse', title: 'Question answered', detail: 'What is an LLM wiki?' },
  { id: 'a9', at: now - 31 * MIN, kind: 'error', agent: 'sage', title: 'Reader failed', detail: 'scanned-receipt.pdf has no text layer' }
]

const tasks: TaskItem[] = [
  { id: 't1', title: 'Process LLM article', agent: 'sage', status: 'running', createdAt: now - 3 * MIN, updatedAt: now - 2 * MIN, sourceId: 's1' },
  { id: 't2', title: 'Extract key concepts', agent: 'rex', status: 'queued', createdAt: now - 6 * MIN, updatedAt: now - 5 * MIN, sourceId: 's1' },
  { id: 't3', title: 'Build entity graph', agent: 'nova', status: 'done', createdAt: now - 10 * MIN, updatedAt: now - 8 * MIN, sourceId: 's2' },
  { id: 't4', title: 'Write summary', agent: 'muse', status: 'done', createdAt: now - 17 * MIN, updatedAt: now - 15 * MIN, sourceId: 's2' },
  { id: 't5', title: 'Organize knowledge', agent: 'muse', status: 'done', createdAt: now - 24 * MIN, updatedAt: now - 21 * MIN },
  { id: 't6', title: 'Read scanned-receipt.pdf', agent: 'sage', status: 'failed', createdAt: now - 33 * MIN, updatedAt: now - 31 * MIN, sourceId: 's3', error: 'The PDF has no text layer. Run OCR on it first, then retry.' }
]

const sources: SourceItem[] = [
  { id: 's1', name: 'https://karpathy.bearblog.dev/llm-wiki/', kind: 'url', path: '/Users/matheesha/Agent HQ/raw/llm-wiki.html', addedAt: now - 3 * MIN, status: 'processing', size: 48_210 },
  { id: 's4', name: 'Meeting notes: second brain roadmap', kind: 'note', path: '/Users/matheesha/Agent HQ/raw/note-roadmap.md', addedAt: now - 4 * MIN, status: 'queued', size: 2_311 },
  { id: 's2', name: 'attention-is-all-you-need.pdf', kind: 'pdf', path: '/Users/matheesha/Agent HQ/raw/attention.pdf', addedAt: now - 40 * MIN, status: 'ingested', size: 2_215_000, pages: ['attention', 'transformers', 'tokenization', 'scaling-laws'] },
  { id: 's3', name: 'scanned-receipt.pdf', kind: 'pdf', path: '/Users/matheesha/Agent HQ/raw/receipt.pdf', addedAt: now - 34 * MIN, status: 'failed', size: 812_000, error: 'The PDF has no text layer.' },
  { id: 's5', name: 'zettelkasten-method.md', kind: 'markdown', path: '/Users/matheesha/Agent HQ/raw/zettelkasten.md', addedAt: now - 3 * 60 * MIN, status: 'ingested', size: 14_022, pages: ['zettelkasten', 'atomic-notes', 'evergreen-notes'] }
]

function fullSnapshot(params: URLSearchParams): AppSnapshot {
  return {
    settings: {
      knowledgeDir: '/Users/matheesha/Agent HQ',
      apiKeySet: params.get('nokey') !== '1',
      model: 'claude-sonnet-4-5',
      userName: 'Matheesha Sarathchandra',
      rooms: [{ id: 'main', name: 'Main', knowledgeDir: '/Users/matheesha/Agent HQ' }],
      currentRoomId: 'main'
    },
    stats: { pages: 132, topics: 35, sources: 424 },
    agents: agents(),
    activity,
    tasks,
    sources,
    graph,
    janitor: {
      checkedAt: now - 4 * MIN,
      running: false,
      contradictions: [
        { pages: ['context-window', 'prompt-caching'], description: '"Context Window" says 200k tokens is the limit; "Prompt Caching" cites 1M tokens for the same model.' },
        { pages: ['rlhf', 'constitutional-ai'], description: 'The two pages disagree on whether RLHF is still used after constitutional training.' }
      ],
      orphans: ['information-diet', 'latency', 'self-critique']
    },
    online: params.get('offline') !== '1'
  }
}

function emptySnapshot(params: URLSearchParams): AppSnapshot {
  const full = fullSnapshot(params)
  return {
    ...full,
    stats: { pages: 0, topics: 0, sources: 0 },
    agents: AGENTS.map((a) => ({ id: a.id, name: a.name, role: a.role, state: 'idle', activity: a.idle, updatedAt: now })),
    activity: [],
    tasks: [],
    sources: [],
    graph: { nodes: [], edges: [] },
    janitor: { checkedAt: null, running: false, contradictions: [], orphans: [] }
  }
}

const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

export function installMockApi(params: URLSearchParams): void {
  const empty = params.get('state') === 'empty'
  let snapshot = empty ? emptySnapshot(params) : fullSnapshot(params)
  const listeners = new Set<(s: AppSnapshot) => void>()
  const push = (next: AppSnapshot): void => {
    snapshot = next
    listeners.forEach((l) => l(snapshot))
  }
  const visiblePages = (): WikiPageMeta[] => (empty ? [] : pages)

  const api: AgentHqApi = {
    getSnapshot: async () => snapshot,
    onSnapshot(cb) {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    async addUrl(url) {
      await delay(300)
      const item: SourceItem = { id: `s${Date.now()}`, name: url, kind: 'url', path: '', addedAt: Date.now(), status: 'queued' }
      push({ ...snapshot, sources: [item, ...snapshot.sources] })
      return item
    },
    async addFiles(paths) {
      const items = paths.map((p, i): SourceItem => ({ id: `f${Date.now()}${i}`, name: p.split('/').pop() ?? p, kind: 'other', path: p, addedAt: Date.now(), status: 'queued' }))
      push({ ...snapshot, sources: [...items, ...snapshot.sources] })
      return items
    },
    async addNote(text) {
      const item: SourceItem = { id: `n${Date.now()}`, name: text.slice(0, 48), kind: 'note', path: '', addedAt: Date.now(), status: 'queued' }
      push({ ...snapshot, sources: [item, ...snapshot.sources] })
      return item
    },
    pathForFile: (file) => `/tmp/${file.name}`,
    async retrySource(id) {
      await delay(400)
      push({ ...snapshot, sources: snapshot.sources.map((s) => (s.id === id ? { ...s, status: 'queued', error: undefined } : s)) })
    },
    async ask(question) {
      await delay(params.get('slowask') === '1' ? 60_000 : 1200)
      if (!snapshot.settings.apiKeySet) return { answer: '', citations: [], error: 'No Claude API key is set.' }
      return {
        answer: `An **LLM wiki** is a folder of Markdown pages that a language model keeps up to date for you, as described in [[LLM Wiki]].\n\n- Sources go into \`raw/\` and are never modified.\n- Agents read them and write *concept pages* into \`wiki/\`, linking related ideas with [[Wikilinks]].\n- The janitor flags contradictions, like the one between [[Context Window]] and [[Prompt Caching]].\n\nYou asked: _${question}_`,
        citations: ['llm-wiki', 'wikilinks', 'context-window', 'prompt-caching']
      }
    },
    async chatSend(agentId, text) {
      await delay(600)
      const at = Date.now()
      const sent = { id: `u${at}`, from: 'user' as const, text, at, channel: 'private' as const, simulated: false }
      return { sent, reply: { id: `a${at}`, from: 'agent' as const, text: `Noted: "${text}"`, at, channel: 'private' as const, simulated: false } }
    },
    async chatHistory() {
      return []
    },
    async broadcastSend(text) {
      await delay(600)
      return { at: Date.now(), text, deliveries: AGENTS.map((a) => ({ agent: a.id, status: 'delivered' as const })) }
    },
    async runJanitor() {
      push({ ...snapshot, janitor: { ...snapshot.janitor, running: true } })
      await delay(1500)
      push({ ...snapshot, janitor: { ...snapshot.janitor, running: false, checkedAt: Date.now() } })
      return snapshot.janitor
    },
    listPages: async () => visiblePages(),
    async readPage(s) {
      const meta = visiblePages().find((p) => p.slug === s)
      return meta ? { slug: s, title: meta.title, markdown: pageMarkdown(meta), meta } : null
    },
    getSettings: async () => snapshot.settings,
    async saveSettings(update) {
      const settings = { ...snapshot.settings }
      if (update.apiKey !== undefined) settings.apiKeySet = update.apiKey !== ''
      if (update.model) settings.model = update.model
      if (update.userName) settings.userName = update.userName
      if (update.knowledgeDir) settings.knowledgeDir = update.knowledgeDir
      push({ ...snapshot, settings })
      return settings
    },
    chooseKnowledgeDir: async () => '/Users/matheesha/Documents/Second Brain',
    openPath: async () => undefined,
    window: {
      platform: (params.get('platform') as NodeJS.Platform) ?? 'linux',
      minimize: () => undefined,
      toggleMaximize: () => undefined,
      close: () => undefined
    }
  }
  window.api = api
}
