import { watch, type FSWatcher } from 'node:fs'
import { mkdir, readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import type { JanitorReport } from '@shared/types'
import { placeInRaw, type Incoming, type RawFile } from './sources/intake'
import { SourceManifest } from './sources/manifest'
import { isHiddenName, isReadWritable, pathExists, writeFileAtomic } from './util/fsx'
import { Serial } from './util/serial'
import { appendLog, ensureLog, renderIndex, writeIndex as writeIndexFile } from './wiki/catalog'
import { WikiStore } from './wiki/store'

const WATCH_DEBOUNCE_MS = 400

export type FolderChange = { folder: 'wiki'; slugs: string[] | null } | { folder: 'raw' }

/**
 * One knowledge folder:
 *   raw/          immutable copies of every source
 *   wiki/         markdown pages the agents maintain
 *   index.md      catalogue of pages, regenerated after each change
 *   log.md        append-only record of ingests and checks
 *   sources.json  every source with its ingestion status
 *   janitor.json  the latest janitor report
 */
export class KnowledgeBase {
  readonly rawDir: string
  readonly wikiDir: string
  readonly indexPath: string
  readonly logPath: string
  readonly wiki: WikiStore
  readonly sources: SourceManifest
  private readonly janitorPath: string
  private watchers: FSWatcher[] = []
  private readonly rawLock = new Serial()

  private constructor(readonly root: string) {
    this.rawDir = join(root, 'raw')
    this.wikiDir = join(root, 'wiki')
    this.indexPath = join(root, 'index.md')
    this.logPath = join(root, 'log.md')
    this.janitorPath = join(root, 'janitor.json')
    this.wiki = new WikiStore(this.wikiDir)
    this.sources = new SourceManifest(join(root, 'sources.json'), this.rawDir)
  }

  /** Creates the folder layout when missing and loads pages and sources. */
  static async open(root: string): Promise<KnowledgeBase> {
    const kb = new KnowledgeBase(root)
    await mkdir(kb.rawDir, { recursive: true })
    await mkdir(kb.wikiDir, { recursive: true })
    await kb.sources.load()
    await kb.sources.prune(pathExists)
    await kb.wiki.scan()
    await ensureLog(kb.logPath)
    await kb.refreshIndexIfStale()
    return kb
  }

  accessible(): Promise<boolean> {
    return isReadWritable(this.root)
  }

  /** Places a source in raw/ and registers it as one step, so a raw/ rescan never sees it untracked. */
  intake<T>(incoming: Incoming, register: (file: RawFile) => Promise<T>): Promise<T> {
    return this.rawLock.run(async () => register(await placeInRaw(this.rawDir, incoming)))
  }

  /** Runs `task` while no source is being placed in raw/. */
  withRawLock<T>(task: () => Promise<T>): Promise<T> {
    return this.rawLock.run(task)
  }

  /** Files in raw/ that sources.json does not know about, e.g. dropped in by hand. */
  async untrackedRawFiles(): Promise<string[]> {
    const tracked = this.sources.trackedFiles()
    const found: string[] = []
    const walk = async (dir: string): Promise<void> => {
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        if (isHiddenName(entry.name)) continue
        const path = join(dir, entry.name)
        if (entry.isDirectory()) await walk(path)
        else if (entry.isFile() && !tracked.has(relative(this.rawDir, path))) found.push(path)
      }
    }
    await walk(this.rawDir)
    return found.sort()
  }

  async writeIndex(at: number): Promise<void> {
    await writeIndexFile(this.indexPath, this.wiki.list(), at)
  }

  async appendLog(at: number, action: string, subject: string, lines: string[]): Promise<void> {
    await appendLog(this.logPath, at, action, subject, lines)
  }

  async loadJanitor(): Promise<Pick<JanitorReport, 'checkedAt' | 'contradictions' | 'note'> | null> {
    try {
      const parsed = JSON.parse(await readFile(this.janitorPath, 'utf8')) as Partial<JanitorReport>
      return {
        checkedAt: typeof parsed.checkedAt === 'number' ? parsed.checkedAt : null,
        contradictions: Array.isArray(parsed.contradictions) ? parsed.contradictions : [],
        note: typeof parsed.note === 'string' ? parsed.note : undefined
      }
    } catch {
      return null
    }
  }

  async saveJanitor(report: JanitorReport): Promise<void> {
    const { checkedAt, contradictions, orphans, note } = report
    await writeFileAtomic(this.janitorPath, `${JSON.stringify({ checkedAt, contradictions, orphans, note }, null, 2)}\n`)
  }

  /** Reports outside changes to wiki/ and raw/, debounced. Our own writes are reported too and must be idempotent. */
  watch(onChange: (change: FolderChange) => void): void {
    this.unwatch()
    let wikiTimer: ReturnType<typeof setTimeout> | null = null
    let rawTimer: ReturnType<typeof setTimeout> | null = null
    let changedSlugs: Set<string> | null = new Set()

    const watchDir = (dir: string, listener: (file: string | null) => void): void => {
      try {
        const watcher = watch(dir, (_event, file) => listener(file ? String(file) : null))
        watcher.on('error', () => watcher.close())
        this.watchers.push(watcher)
      } catch {
        // Some file systems cannot be watched; the folder is still rescanned on open.
      }
    }

    watchDir(this.wikiDir, (file) => {
      if (file && (isHiddenName(file) || !file.toLowerCase().endsWith('.md'))) return
      if (file && changedSlugs) changedSlugs.add(file.replace(/\.md$/i, ''))
      else changedSlugs = null
      if (wikiTimer) clearTimeout(wikiTimer)
      wikiTimer = setTimeout(() => {
        if (this.watchers.length === 0) return
        const slugs = changedSlugs ? [...changedSlugs] : null
        changedSlugs = new Set()
        onChange({ folder: 'wiki', slugs })
      }, WATCH_DEBOUNCE_MS)
    })
    watchDir(this.rawDir, (file) => {
      if (file && isHiddenName(file)) return
      if (rawTimer) clearTimeout(rawTimer)
      rawTimer = setTimeout(() => {
        if (this.watchers.length > 0) onChange({ folder: 'raw' })
      }, WATCH_DEBOUNCE_MS)
    })
  }

  unwatch(): void {
    for (const watcher of this.watchers) watcher.close()
    this.watchers = []
  }

  private async refreshIndexIfStale(): Promise<void> {
    const at = Date.now()
    const withoutStamp = (text: string): string => text.replace(/^_.*updated .*_$/m, '')
    const current = await readFile(this.indexPath, 'utf8').catch(() => null)
    if (current === null || withoutStamp(current) !== withoutStamp(renderIndex(this.wiki.list(), at))) await this.writeIndex(at)
  }
}
