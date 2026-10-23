import { randomUUID } from 'node:crypto'
import { stat } from 'node:fs/promises'
import { basename, isAbsolute, relative, resolve } from 'node:path'
import type {
  AppSnapshot,
  AskResult,
  JanitorReport,
  SettingsUpdate,
  SettingsView,
  SourceItem,
  WikiPageContent,
  WikiPageMeta
} from '@shared/types'
import type { ModelOption } from '@shared/types'
import { KnowledgeBase, type FolderChange } from './knowledgeBase'
import type { Llm } from './llm/claude'
import { createProvider, listProviderModels } from './llm/providers'
import { askWiki } from './pipeline/ask'
import { IngestQueue } from './pipeline/ingest'
import { Janitor, janitorSummary } from './pipeline/janitor'
import { runStep, shortMessage, StepFailed } from './pipeline/step'
import { SettingsStore, type SecretCodec, type SettingsDefaults } from './settings'
import { fileSource, noteSource, urlSource, type Incoming, type RawFile } from './sources/intake'
import { kindForFile } from './sources/kinds'
import { EMPTY_JANITOR, EngineState } from './state'
import { pathExists } from './util/fsx'
import { errorMessage, plural } from './util/text'

export interface EngineOptions {
  /** Folder for settings.json */
  dataDir: string
  defaults: SettingsDefaults
  codec: SecretCodec
  /** Receives every (throttled) snapshot */
  push: (snapshot: AppSnapshot) => void
  now?: () => number
}

/**
 * The LLM Wiki engine. Owns the settings, the open knowledge folder, the ingestion queue and the
 * snapshot. Free of Electron so it runs (and is tested) in plain Node.
 */
export class Engine {
  private kb: KnowledgeBase | null = null
  private readonly state: EngineState
  private readonly settings: SettingsStore
  private readonly llm: Llm
  private readonly janitor: Janitor
  private readonly queue: IngestQueue
  private readonly now: () => number
  private fullCheck: Promise<JanitorReport> | null = null

  private constructor(options: EngineOptions) {
    this.now = options.now ?? Date.now
    this.settings = new SettingsStore(options.dataDir, options.defaults, options.codec)
    this.state = new EngineState(this.settings.view(), options.push, this.now)
    this.llm = createProvider(() => ({
      providerId: this.settings.view().providerId,
      apiKey: this.settings.resolvedApiKey(),
      baseUrl: this.settings.view().baseUrl,
      command: this.settings.view().command,
      args: this.settings.view().args,
      model: this.settings.model()
    }))
    this.janitor = new Janitor(this.state, this.llm, () => this.settings.providerReady(), this.now)
    this.queue = new IngestQueue({
      state: this.state,
      llm: this.llm,
      janitor: this.janitor,
      now: this.now,
      refresh: (kb) => this.refresh(kb)
    })
  }

  static async start(options: EngineOptions): Promise<Engine> {
    const engine = new Engine(options)
    await engine.boot()
    return engine
  }

  getSnapshot(): AppSnapshot {
    return this.state.snapshot()
  }

  async addFiles(paths: string[]): Promise<SourceItem[]> {
    const added: SourceItem[] = []
    const errors: string[] = []
    for (const path of paths) {
      try {
        added.push(await this.receive('Sorting mail', basename(path), () => fileSource(path)))
      } catch (error) {
        errors.push(errorMessage(error))
      }
    }
    if (added.length === 0 && errors.length > 0) throw new Error(errors.join('\n'))
    return added
  }

  addUrl(url: string): Promise<SourceItem> {
    return this.receive('Fetching link', url, () => urlSource(url, this.now()))
  }

  addNote(text: string): Promise<SourceItem> {
    return this.receive('Filing note', 'Note', async () => noteSource(text, this.now()))
  }

  async retrySource(id: string): Promise<void> {
    const kb = this.requireKnowledge()
    const source = kb.sources.get(id)
    if (!source) throw new Error('That source is no longer in the inbox')
    if (this.queue.isQueued(kb, id)) return
    const updated = await kb.sources.update(id, { status: 'queued', error: undefined })
    this.state.addActivity('ingest', 'Source re-queued', source.name, 'pip')
    this.refresh(kb)
    if (updated) this.queue.enqueue(kb, updated)
  }

  async ask(question: string): Promise<AskResult> {
    if (!this.kb) return { answer: '', citations: [], error: 'The knowledge folder is not available' }
    return askWiki(this.state, this.llm, this.kb, question)
  }

  /** Runs Axel over the whole wiki. Calls made while a run is in flight share it. */
  runJanitor(): Promise<JanitorReport> {
    this.fullCheck ??= this.checkAll().finally(() => {
      this.fullCheck = null
    })
    return this.fullCheck
  }

  listPages(): WikiPageMeta[] {
    return this.kb?.wiki.list() ?? []
  }

  readPage(slug: string): WikiPageContent | null {
    return this.kb?.wiki.read(slug) ?? null
  }

  getSettings(): SettingsView {
    return this.settings.view()
  }

  listRooms() { return this.settings.listRooms() }
  async switchRoom(id: string) {
    const changed = await this.settings.switchRoom(id)
    if (changed) { this.state.setSettings(this.settings.view()); await this.openKnowledge(this.settings.knowledgeDir()) }
    return this.settings.listRooms()
  }
  async addRoom(name: string) { const rooms = await this.settings.addRoom(name); this.state.setSettings(this.settings.view()); return rooms }
  async renameRoom(id: string, name: string) { const rooms = await this.settings.renameRoom(id, name); this.state.setSettings(this.settings.view()); return rooms }

  listModels(): Promise<ModelOption[]> {
    const view = this.settings.view()
    return listProviderModels({ providerId: view.providerId, apiKey: this.settings.resolvedApiKey(), baseUrl: view.baseUrl, command: view.command, args: view.args, model: view.model })
  }

  async saveSettings(update: SettingsUpdate): Promise<SettingsView> {
    const result = await this.settings.save(update)
    this.state.setSettings(result.view)
    if (result.storedPlain) {
      this.state.addActivity(
        'system',
        'API key stored without encryption',
        'This system has no secure key storage, so the key is saved as plain text in settings.json'
      )
    }
    if (result.knowledgeDirChanged) await this.openKnowledge(result.view.knowledgeDir)
    else if ((result.apiKeyChanged || result.providerChanged) && result.view.providerReady) await this.retryMissingKeyFailures()
    return result.view
  }

  /** True when `path` is the knowledge folder or inside it. */
  isInsideKnowledge(path: string): boolean {
    if (!this.kb || !isAbsolute(path)) return false
    const rel = relative(this.kb.root, resolve(path))
    return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
  }

  /** Resolves when every queued source has been processed. */
  idle(): Promise<void> {
    return this.queue.idle()
  }

  close(): void {
    this.kb?.unwatch()
    this.state.flush()
  }

  private async boot(): Promise<void> {
    try {
      const warning = await this.settings.load()
      if (warning) this.state.addActivity('system', 'API key needs attention', warning)
    } catch (error) {
      this.state.addActivity('error', 'Settings could not be loaded', errorMessage(error))
    }
    this.state.setSettings(this.settings.view())
    await this.openKnowledge(this.settings.knowledgeDir())
  }

  private async openKnowledge(dir: string): Promise<void> {
    if (this.kb) {
      this.kb.unwatch()
      this.queue.drop(this.kb)
      this.state.resetSession()
      this.kb = null
    }
    let kb: KnowledgeBase
    try {
      kb = await KnowledgeBase.open(dir)
    } catch (error) {
      this.state.setOnline(false)
      this.state.setSources([])
      this.state.setWiki({ pages: 0, topics: 0, sources: 0 }, { nodes: [], edges: [] })
      this.state.setJanitor(EMPTY_JANITOR)
      this.state.addActivity('error', 'Knowledge folder unavailable', `${dir}: ${errorMessage(error)}`)
      return
    }

    this.kb = kb
    await this.janitor.restore(kb)
    this.refresh(kb)
    this.state.addActivity(
      'system',
      'Knowledge base opened',
      `${plural(kb.wiki.size, 'page')}, ${plural(kb.sources.list().length, 'source')}`
    )

    // Sources that were waiting (or interrupted) when the app last closed go back in the queue.
    for (const source of kb.sources.list().reverse()) {
      if (source.status !== 'queued' && source.status !== 'processing') continue
      const queued = source.status === 'processing' ? await kb.sources.update(source.id, { status: 'queued' }) : source
      if (queued) this.queue.enqueue(kb, queued)
    }
    await this.registerUntracked(kb)
    kb.watch((change) => void this.onFolderChange(kb, change))
  }

  /** Pip receives a source: places it in raw/, registers it and queues it for ingestion. */
  private async receive(activity: string, label: string, prepare: () => Promise<Incoming>): Promise<SourceItem> {
    const kb = this.requireKnowledge()
    const job = this.state.beginJob('pip', 'working', activity)
    try {
      const incoming = await prepare()
      const source = await kb.intake(incoming, (file) => this.register(kb, file))
      job.done()
      return source
    } catch (error) {
      const message = errorMessage(error)
      job.fail(shortMessage(message))
      this.state.addActivity('error', 'Source not added', `${label}: ${message}`, 'pip')
      throw error instanceof Error ? error : new Error(message)
    }
  }

  private async register(kb: KnowledgeBase, file: RawFile): Promise<SourceItem> {
    const source = await kb.sources.add({
      id: randomUUID(),
      name: file.name,
      kind: file.kind,
      path: file.path,
      addedAt: this.now(),
      status: 'queued',
      size: file.size
    })
    this.state.addActivity('ingest', 'New source received', source.name, 'pip')
    this.refresh(kb)
    this.queue.enqueue(kb, source)
    return source
  }

  /** Files dropped into raw/ by hand become sources like any other. */
  private async registerUntracked(kb: KnowledgeBase): Promise<void> {
    const added = await kb.withRawLock(async () => {
      const sources: SourceItem[] = []
      for (const path of await kb.untrackedRawFiles()) {
        const size = await stat(path).then((info) => info.size, () => undefined)
        sources.push(
          await kb.sources.add({ id: randomUUID(), name: basename(path), kind: kindForFile(path), path, addedAt: this.now(), status: 'queued', size })
        )
      }
      return sources
    })
    if (added.length === 0 || kb !== this.kb) return
    this.state.addActivity('ingest', 'New files found in raw/', plural(added.length, 'file'), 'pip')
    this.refresh(kb)
    for (const source of added) this.queue.enqueue(kb, source)
  }

  private async onFolderChange(kb: KnowledgeBase, change: FolderChange): Promise<void> {
    if (kb !== this.kb) return
    try {
      if (change.folder === 'wiki') {
        if (change.slugs) await Promise.all(change.slugs.map((slug) => kb.wiki.reload(slug)))
        else await kb.wiki.scan()
        this.janitor.updateOrphans(kb)
      } else {
        await kb.sources.prune(pathExists)
        await this.registerUntracked(kb)
      }
      this.refresh(kb)
    } catch (error) {
      this.state.addActivity('error', 'Knowledge folder could not be read', errorMessage(error))
      this.state.setOnline(await kb.accessible())
    }
  }

  private async checkAll(): Promise<JanitorReport> {
    const kb = this.requireKnowledge()
    const task = this.state.addTask('Organize knowledge', 'axel')
    try {
      return await runStep(this.state, {
        taskId: task.id,
        agent: 'axel',
        activity: 'Checking wiki',
        kind: 'janitor',
        started: { title: 'Janitor checking', detail: plural(kb.wiki.size, 'page') },
        finished: (report) => ({ title: 'Janitor completed', detail: janitorSummary(report) }),
        run: (job) => this.janitor.check(kb, { all: true }, job)
      })
    } catch (error) {
      if (!(error instanceof StepFailed)) throw error
      const report = { ...this.state.getJanitor(), running: false, note: error.message }
      this.state.setJanitor(report)
      return report
    }
  }

  /** Re-try failed sources when a usable provider or provider configuration is added. */
  private async retryMissingKeyFailures(): Promise<void> {
    const kb = this.kb
    if (!kb) return
    for (const source of kb.sources.list().reverse()) {
      if (source.status === 'failed') await this.retrySource(source.id)
    }
  }

  private refresh(kb: KnowledgeBase): void {
    if (kb !== this.kb) return
    const sources = kb.sources.list()
    this.state.setSources(sources)
    this.state.setWiki({ pages: kb.wiki.size, topics: kb.wiki.topicCount(), sources: sources.length }, kb.wiki.graph())
    void kb.accessible().then((online) => kb === this.kb && this.state.setOnline(online))
  }

  private requireKnowledge(): KnowledgeBase {
    if (!this.kb) throw new Error('The knowledge folder is not available; choose one in Settings')
    return this.kb
  }
}
