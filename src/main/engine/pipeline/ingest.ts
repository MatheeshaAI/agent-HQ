import { relative } from 'node:path'
import type { SourceItem } from '@shared/types'
import type { KnowledgeBase } from '../knowledgeBase'
import type { Llm } from '../llm/claude'
import { loadSourceContent, type SourceParts } from '../sources/content'
import { kindLabel } from '../sources/kinds'
import type { EngineState } from '../state'
import { uniqueBy } from '../steps/common'
import { extractConcepts, type Extraction } from '../steps/extractor'
import { planPages, type PagePlan } from '../steps/linker'
import { summariseSource, type SourceSummary } from '../steps/reader'
import { writePage } from '../steps/writer'
import { errorMessage, plural } from '../util/text'
import { janitorSummary, type Janitor } from './janitor'
import { runStep, StepFailed } from './step'

interface PipelineTasks {
  read: string
  extract: string
  link: string
  write: string
  organize: string
}

interface QueuedSource {
  kb: KnowledgeBase
  sourceId: string
  tasks: PipelineTasks
}

interface WrittenPage {
  slug: string
  title: string
  created: boolean
}

export interface IngestDeps {
  state: EngineState
  llm: Llm
  janitor: Janitor
  now: () => number
  /** Pushes the knowledge base's sources, stats and graph into the snapshot */
  refresh: (kb: KnowledgeBase) => void
}

/**
 * The ingestion queue: one source at a time goes through Sage (read), Rex (extract),
 * Nova (plan links), Muse (write pages) and Axel (check). Each step is a task in the snapshot.
 */
export class IngestQueue {
  private readonly queue: QueuedSource[] = []
  private running: Promise<void> | null = null

  constructor(private readonly deps: IngestDeps) {}

  /** Queues a source and lists its five steps as queued tasks. */
  enqueue(kb: KnowledgeBase, source: SourceItem): void {
    if (this.queue.some((q) => q.kb === kb && q.sourceId === source.id)) return
    const { state } = this.deps
    const tasks: PipelineTasks = {
      read: state.addTask(`Process ${kindLabel(source.kind)} source`, 'sage', source.id).id,
      extract: state.addTask('Extract key concepts', 'rex', source.id).id,
      link: state.addTask('Build entity graph', 'nova', source.id).id,
      write: state.addTask('Write summary', 'muse', source.id).id,
      organize: state.addTask('Organize knowledge', 'axel', source.id).id
    }
    this.queue.push({ kb, sourceId: source.id, tasks })
    this.running ??= this.drain().finally(() => {
      this.running = null
    })
  }

  isQueued(kb: KnowledgeBase, sourceId: string): boolean {
    return this.queue.some((q) => q.kb === kb && q.sourceId === sourceId)
  }

  /** Forgets queued sources of a knowledge folder that is being closed; they stay queued on disk. */
  drop(kb: KnowledgeBase): void {
    const dropped = this.queue.filter((q) => q.kb === kb)
    if (dropped.length === 0) return
    this.queue.splice(0, this.queue.length, ...this.queue.filter((q) => q.kb !== kb))
    this.deps.state.removeTasks(dropped.flatMap((q) => Object.values(q.tasks)))
  }

  /** Resolves once the queue is empty. */
  async idle(): Promise<void> {
    while (this.running) await this.running
  }

  private async drain(): Promise<void> {
    for (let next = this.queue[0]; next; next = this.queue[0]) {
      // process() records step failures itself; this catches the rest (e.g. sources.json unwritable).
      const item = next
      await this.process(item).catch((error) => {
        this.deps.state.addActivity('error', 'Ingestion failed', errorMessage(error), 'pip')
        this.deps.state.removeQueuedTasks(Object.values(item.tasks))
      })
      this.queue.shift()
    }
  }

  private async process(item: QueuedSource): Promise<void> {
    const { kb, sourceId, tasks } = item
    const { state, refresh } = this.deps
    const source = kb.sources.get(sourceId)
    if (!source) {
      state.removeTasks(Object.values(tasks))
      return
    }

    await kb.sources.update(sourceId, { status: 'processing', error: undefined })
    refresh(kb)
    state.addActivity('ingest', 'Knowledge ingestion started', source.name, 'pip')

    const written: WrittenPage[] = []
    try {
      const { parts, summary } = await this.read(item, source)
      const extraction = await this.extract(item, source, parts, summary)
      const plan = await this.link(item, source, summary, extraction)
      await this.write(item, source, summary, extraction, plan, written)
      await this.organize(item, written)

      const pages = uniqueBy([...(source.pages ?? []), ...written.map((p) => p.slug)], (slug) => slug)
      await kb.sources.update(sourceId, { status: 'ingested', pages, error: undefined })
      state.addActivity('ingest', 'Knowledge ingestion finished', `${source.name} · ${plural(written.length, 'page')}`, 'pip')
    } catch (error) {
      const message = errorMessage(error)
      if (!(error instanceof StepFailed)) state.addActivity('error', 'Ingestion failed', message, 'pip')
      const pages = uniqueBy([...(source.pages ?? []), ...written.map((p) => p.slug)], (slug) => slug)
      await kb.sources.update(sourceId, { status: 'failed', error: message, ...(pages.length > 0 ? { pages } : {}) }).catch(() => null)
      state.removeQueuedTasks(Object.values(tasks))
    } finally {
      refresh(kb)
    }
  }

  private read(item: QueuedSource, source: SourceItem): Promise<{ parts: SourceParts; summary: SourceSummary }> {
    return runStep(this.deps.state, {
      taskId: item.tasks.read,
      agent: 'sage',
      activity: 'Summarizing docs',
      kind: 'reader',
      started: { title: 'Reader processing', detail: source.name },
      finished: ({ summary }) => ({ title: 'Reader completed', detail: summary.title }),
      run: async (job) => {
        const parts = await loadSourceContent(source.path, source.name)
        job.set('thinking', 'Summarizing docs')
        return { parts, summary: await summariseSource(this.deps.llm, parts, source.name) }
      }
    })
  }

  private extract(item: QueuedSource, source: SourceItem, parts: SourceParts, summary: SourceSummary): Promise<Extraction> {
    return runStep(this.deps.state, {
      taskId: item.tasks.extract,
      agent: 'rex',
      activity: 'Processing data',
      kind: 'extractor',
      started: { title: 'Extractor processing', detail: summary.title },
      finished: (result) => ({
        title: 'Extractor completed',
        detail: `${plural(result.concepts.length, 'concept')} · ${plural(result.claims.length, 'claim')} extracted`
      }),
      run: (job) => {
        job.set('thinking', 'Processing data')
        return extractConcepts(this.deps.llm, parts, source.name, summary)
      }
    })
  }

  private link(item: QueuedSource, source: SourceItem, summary: SourceSummary, extraction: Extraction): Promise<PagePlan[]> {
    return runStep(this.deps.state, {
      taskId: item.tasks.link,
      agent: 'nova',
      activity: 'Building graph',
      kind: 'linker',
      started: { title: 'Linker building graph', detail: plural(extraction.concepts.length, 'concept') },
      finished: (plan) => ({
        title: 'Relationships detected',
        detail: `${plural(plan.length, 'page')} planned · ${plural(plan.reduce((n, p) => n + p.links.length, 0), 'link')}`
      }),
      run: async (job) => {
        job.set('thinking', 'Building graph')
        const plan = await planPages(this.deps.llm, item.kb.wiki.texts(), { name: source.name, summary, extraction })
        if (plan.length === 0) throw new Error('The linker planned no pages for this source')
        return plan
      }
    })
  }

  private write(
    item: QueuedSource,
    source: SourceItem,
    summary: SourceSummary,
    extraction: Extraction,
    plan: PagePlan[],
    written: WrittenPage[]
  ): Promise<WrittenPage[]> {
    const { kb } = item
    const { state, llm, now } = this.deps
    return runStep(state, {
      taskId: item.tasks.write,
      agent: 'muse',
      activity: 'Writing wiki pages',
      kind: 'muse',
      started: { title: 'Muse writing', detail: `${plural(plan.length, 'page')} for ${summary.title}` },
      finished: () => ({ kind: 'librarian', title: 'Librarian indexing', detail: 'Knowledge base updated' }),
      run: async (job) => {
        const knownTitles = uniqueBy([...kb.wiki.list().map((p) => p.title), ...plan.map((p) => p.title)], (t) => t)
        try {
          for (const [i, page] of plan.entries()) {
            const existingSlug = kb.wiki.resolve(page.title)
            const existing = existingSlug ? kb.wiki.text(existingSlug) : null
            const existingMeta = existingSlug ? kb.wiki.meta(existingSlug) : null
            const title = existing?.title ?? page.title.trim()

            job.set('thinking', `Writing wiki pages (${i + 1}/${plan.length})`)
            const draft = await writePage(llm, {
              plan: { ...page, title },
              source: { name: source.name, summary, extraction },
              knownTitles,
              current: existing ? { markdown: existing.body, tags: existing.tags } : null
            })

            job.set('working', 'Filing pages')
            const slug = await kb.wiki.write(
              {
                title,
                tags: draft.tags.length > 0 ? draft.tags : (existing?.tags ?? extraction.tags),
                sources: uniqueBy([...(existingMeta?.sources ?? []), source.id], (id) => id),
                summary: draft.summary,
                body: `# ${title}\n\n${draft.markdown}`,
                updatedAt: now()
              },
              existingSlug ?? undefined
            )
            written.push({ slug, title, created: !existing })
            state.addActivity('muse', existing ? 'Draft updated' : 'Page created', title, 'muse')
            this.deps.refresh(kb)
          }
        } finally {
          if (written.length > 0) await this.file(kb, source, written)
        }
        return written
      }
    })
  }

  /** Regenerates index.md and appends the ingest to log.md. */
  private async file(kb: KnowledgeBase, source: SourceItem, written: WrittenPage[]): Promise<void> {
    const at = this.deps.now()
    await kb.writeIndex(at)
    await kb.appendLog(at, 'ingest', source.name, [
      `source: raw/${relative(kb.rawDir, source.path).split('\\').join('/')}`,
      ...written.map((p) => `${p.created ? 'created' : 'updated'} [[${p.title}]]`)
    ])
    this.deps.janitor.updateOrphans(kb)
  }

  private organize(item: QueuedSource, written: WrittenPage[]): Promise<void> {
    const { state, janitor } = this.deps
    return runStep(state, {
      taskId: item.tasks.organize,
      agent: 'axel',
      activity: 'Checking wiki',
      kind: 'janitor',
      started: { title: 'Janitor checking', detail: plural(written.length, 'updated page') },
      finished: () => ({ title: 'Janitor completed', detail: janitorSummary(state.getJanitor()) }),
      run: async (job) => {
        await janitor.check(item.kb, { touched: written.map((p) => p.slug) }, job)
      }
    })
  }
}
