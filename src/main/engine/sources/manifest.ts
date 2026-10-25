import { readFile } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import type { SourceItem, SourceKind, SourceOrigin, SourceStatus } from '@shared/types'
import { writeFileAtomic } from '../util/fsx'

/** Used for sources stored before origins existed, and for sources added without one. */
export const DEFAULT_ORIGIN: SourceOrigin = { room: 'brain', kind: 'manual' }

/** A source as stored in sources.json: the raw/ path is relative so the folder can move. */
interface StoredSource {
  id: string
  name: string
  kind: SourceKind
  file: string
  addedAt: number
  status: SourceStatus
  size?: number
  pages?: string[]
  error?: string
  origin?: SourceOrigin
}

interface ManifestFile {
  version: 1
  sources: StoredSource[]
}

export type SourcePatch = Partial<Pick<SourceItem, 'status' | 'pages' | 'error' | 'size'>>

/** sources.json in the knowledge folder: every source in raw/ with its ingestion status. */
export class SourceManifest {
  private sources = new Map<string, StoredSource>()

  constructor(
    private readonly manifestPath: string,
    private readonly rawDir: string
  ) {}

  async load(): Promise<void> {
    let parsed: Partial<ManifestFile> = {}
    try {
      parsed = JSON.parse(await readFile(this.manifestPath, 'utf8')) as Partial<ManifestFile>
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw new Error(`sources.json could not be read: ${(error as Error).message}`)
      }
    }
    this.sources = new Map((parsed.sources ?? []).filter(isStoredSource).map((s) => [s.id, s]))
  }

  async save(): Promise<void> {
    const file: ManifestFile = { version: 1, sources: [...this.sources.values()] }
    await writeFileAtomic(this.manifestPath, `${JSON.stringify(file, null, 2)}\n`)
  }

  /** Newest first. */
  list(): SourceItem[] {
    return [...this.sources.values()].sort((a, b) => b.addedAt - a.addedAt).map((s) => this.toItem(s))
  }

  get(id: string): SourceItem | null {
    const stored = this.sources.get(id)
    return stored ? this.toItem(stored) : null
  }

  /** Relative raw/ file names already tracked, in the platform's separator style. */
  trackedFiles(): Set<string> {
    return new Set([...this.sources.values()].map((s) => s.file.split('/').join(sep)))
  }

  async add(item: SourceItem): Promise<SourceItem> {
    const stored: StoredSource = {
      id: item.id,
      name: item.name,
      kind: item.kind,
      file: relative(this.rawDir, item.path).split(sep).join('/'),
      addedAt: item.addedAt,
      status: item.status,
      size: item.size,
      origin: { ...(item.origin ?? DEFAULT_ORIGIN) }
    }
    this.sources.set(stored.id, stored)
    await this.save()
    return this.toItem(stored)
  }

  async update(id: string, patch: SourcePatch): Promise<SourceItem | null> {
    const stored = this.sources.get(id)
    if (!stored) return null
    Object.assign(stored, patch)
    if (patch.error === undefined && 'error' in patch) delete stored.error
    await this.save()
    return this.toItem(stored)
  }

  /** Drops entries whose raw/ file no longer exists. */
  async prune(exists: (path: string) => Promise<boolean>): Promise<number> {
    let removed = 0
    for (const stored of [...this.sources.values()]) {
      if (!(await exists(this.absolute(stored)))) {
        this.sources.delete(stored.id)
        removed++
      }
    }
    if (removed > 0) await this.save()
    return removed
  }

  private absolute(stored: StoredSource): string {
    return join(this.rawDir, ...stored.file.split('/'))
  }

  private toItem(stored: StoredSource): SourceItem {
    const item: SourceItem = {
      id: stored.id,
      name: stored.name,
      kind: stored.kind,
      path: this.absolute(stored),
      addedAt: stored.addedAt,
      status: stored.status,
      origin: stored.origin ? { ...stored.origin } : { ...DEFAULT_ORIGIN }
    }
    if (stored.size !== undefined) item.size = stored.size
    if (stored.pages) item.pages = [...stored.pages]
    if (stored.error) item.error = stored.error
    return item
  }
}

function isStoredSource(value: unknown): value is StoredSource {
  const s = value as StoredSource
  return (
    typeof s === 'object' &&
    s !== null &&
    typeof s.id === 'string' &&
    typeof s.name === 'string' &&
    typeof s.file === 'string' &&
    typeof s.addedAt === 'number' &&
    typeof s.status === 'string' &&
    typeof s.kind === 'string'
  )
}
