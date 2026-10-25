import { readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import type { GraphData, RoomKind, WikiPageContent, WikiPageMeta } from '@shared/types'
import { isHiddenName, writeFileAtomic } from '../util/fsx'
import { Serial } from '../util/serial'
import { slugify } from '../util/text'
import { parsePage, renderPage, type PageFrontmatter } from './frontmatter'
import { extractWikilinks, LinkResolver } from './links'

interface PageRecord {
  slug: string
  title: string
  path: string
  tags: string[]
  sources: string[]
  summary: string
  room?: RoomKind
  updatedAt: number
  /** Raw [[wikilink]] targets as written */
  linkTargets: string[]
  /** The whole file, front matter included */
  markdown: string
  /** Body without front matter */
  body: string
  /** Front matter keys this app does not manage, kept on rewrite */
  extra: string[]
}

export interface PageWrite {
  title: string
  tags: string[]
  sources: string[]
  summary: string
  /** Room the page is written for (front matter `room`) */
  room?: RoomKind
  /** Markdown body, without front matter */
  body: string
  updatedAt: number
}

/** Plain-text view of a page used for retrieval and checks. */
export interface PageText {
  slug: string
  title: string
  tags: string[]
  summary: string
  body: string
}

/**
 * The wiki/ folder: one markdown file per page, named <slug>.md. Keeps every page in memory
 * (they are small) so the graph, stats and retrieval never touch the disk.
 */
export class WikiStore {
  private pages = new Map<string, PageRecord>()
  private resolved: { metas: Map<string, WikiPageMeta>; resolver: LinkResolver } | null = null
  /** Scans, reloads and writes never interleave, so a scan cannot drop a page written meanwhile. */
  private readonly disk = new Serial()

  constructor(readonly dir: string) {}

  scan(): Promise<void> {
    return this.disk.run(async () => {
      const entries = await readdir(this.dir, { withFileTypes: true })
      const next = new Map<string, PageRecord>()
      for (const entry of entries) {
        if (!entry.isFile() || isHiddenName(entry.name) || !entry.name.toLowerCase().endsWith('.md')) continue
        const record = await this.load(join(this.dir, entry.name))
        next.set(record.slug, record)
      }
      this.pages = next
      this.resolved = null
    })
  }

  get size(): number {
    return this.pages.size
  }

  has(slug: string): boolean {
    return this.pages.has(slug)
  }

  /** Slug of the page a title or wikilink target refers to, if it exists. */
  resolve(target: string): string | null {
    return this.index().resolver.resolve(target)
  }

  list(): WikiPageMeta[] {
    return [...this.index().metas.values()].sort((a, b) => a.title.localeCompare(b.title))
  }

  meta(slug: string): WikiPageMeta | null {
    return this.index().metas.get(slug) ?? null
  }

  read(slug: string): WikiPageContent | null {
    const record = this.pages.get(slug)
    const meta = this.meta(slug)
    if (!record || !meta) return null
    return { slug, title: record.title, markdown: record.markdown, meta }
  }

  text(slug: string): PageText | null {
    const record = this.pages.get(slug)
    if (!record) return null
    return { slug, title: record.title, tags: record.tags, summary: record.summary, body: record.body }
  }

  texts(): PageText[] {
    return [...this.pages.keys()].map((slug) => this.text(slug)).filter((page): page is PageText => page !== null)
  }

  /** Creates or replaces the page for `title`; returns its slug. */
  write(page: PageWrite, slug = slugify(page.title)): Promise<string> {
    if (!slug) return Promise.reject(new Error(`"${page.title}" is not a usable page title`))
    return this.disk.run(async () => {
      const frontmatter: PageFrontmatter = {
        title: page.title,
        tags: page.tags,
        sources: page.sources,
        updated: new Date(page.updatedAt).toISOString(),
        summary: page.summary,
        ...(page.room ? { room: page.room } : {})
      }
      const path = join(this.dir, `${slug}.md`)
      const markdown = renderPage(frontmatter, page.body, this.pages.get(slug)?.extra)
      await writeFileAtomic(path, markdown)
      this.pages.set(slug, toRecord(slug, path, markdown, page.updatedAt))
      this.resolved = null
      return slug
    })
  }

  /** Re-reads a single page after an outside edit; drops it when the file is gone. */
  reload(slug: string): Promise<void> {
    return this.disk.run(async () => {
      try {
        this.pages.set(slug, await this.load(join(this.dir, `${slug}.md`)))
      } catch {
        this.pages.delete(slug)
      }
      this.resolved = null
    })
  }

  graph(): GraphData {
    const metas = this.index().metas
    const edges: GraphData['edges'] = []
    const seen = new Set<string>()
    const neighbours = new Map<string, Set<string>>()
    for (const meta of metas.values()) {
      for (const target of meta.links) {
        const key = meta.slug < target ? `${meta.slug}\n${target}` : `${target}\n${meta.slug}`
        if (seen.has(key)) continue
        seen.add(key)
        edges.push({ source: meta.slug, target })
        addNeighbour(neighbours, meta.slug, target)
        addNeighbour(neighbours, target, meta.slug)
      }
    }
    const nodes = [...metas.values()].map((meta) => ({
      id: meta.slug,
      title: meta.title,
      degree: neighbours.get(meta.slug)?.size ?? 0,
      sources: meta.sources.length
    }))
    return { nodes, edges }
  }

  /** Pages that no other page links to. */
  orphans(): string[] {
    const linked = new Set<string>()
    for (const meta of this.index().metas.values()) for (const target of meta.links) linked.add(target)
    return [...this.pages.keys()].filter((slug) => !linked.has(slug)).sort()
  }

  /** Pages linking to or linked from any of `slugs`, excluding `slugs` themselves. */
  neighbours(slugs: Iterable<string>): string[] {
    const set = new Set(slugs)
    const result = new Set<string>()
    for (const meta of this.index().metas.values()) {
      if (set.has(meta.slug)) meta.links.forEach((target) => result.add(target))
      else if (meta.links.some((target) => set.has(target))) result.add(meta.slug)
    }
    for (const slug of set) result.delete(slug)
    return [...result]
  }

  /** Distinct tags across all pages, compared case-insensitively. */
  topicCount(): number {
    const tags = new Set<string>()
    for (const record of this.pages.values()) for (const tag of record.tags) tags.add(tag.trim().toLowerCase())
    tags.delete('')
    return tags.size
  }

  private index(): { metas: Map<string, WikiPageMeta>; resolver: LinkResolver } {
    if (this.resolved) return this.resolved
    const resolver = new LinkResolver(this.pages.values())
    const metas = new Map<string, WikiPageMeta>()
    for (const record of this.pages.values()) {
      const links = new Set<string>()
      for (const target of record.linkTargets) {
        const slug = resolver.resolve(target)
        if (slug && slug !== record.slug) links.add(slug)
      }
      metas.set(record.slug, {
        slug: record.slug,
        title: record.title,
        path: record.path,
        links: [...links],
        sources: record.sources,
        tags: record.tags,
        summary: record.summary,
        ...(record.room ? { room: record.room } : {}),
        updatedAt: record.updatedAt
      })
    }
    this.resolved = { metas, resolver }
    return this.resolved
  }

  private async load(path: string): Promise<PageRecord> {
    const [markdown, info] = await Promise.all([readFile(path, 'utf8'), stat(path)])
    const fileName = path.slice(this.dir.length + 1)
    return toRecord(fileName.replace(/\.md$/i, ''), path, markdown, info.mtimeMs)
  }
}

function toRecord(slug: string, path: string, markdown: string, fallbackUpdatedAt: number): PageRecord {
  const { frontmatter, extra, body } = parsePage(markdown)
  const heading = /^#\s+(.+?)\s*#*\s*$/m.exec(body)?.[1]
  const updated = frontmatter.updated ? Date.parse(frontmatter.updated) : NaN
  return {
    slug,
    title: frontmatter.title || heading || slug,
    path,
    tags: frontmatter.tags ?? [],
    sources: frontmatter.sources ?? [],
    summary: frontmatter.summary ?? '',
    room: frontmatter.room,
    updatedAt: Number.isFinite(updated) ? updated : Math.round(fallbackUpdatedAt),
    linkTargets: extractWikilinks(body),
    markdown,
    body,
    extra
  }
}

function addNeighbour(neighbours: Map<string, Set<string>>, slug: string, neighbour: string): void {
  let linked = neighbours.get(slug)
  if (!linked) {
    linked = new Set<string>()
    neighbours.set(slug, linked)
  }
  linked.add(neighbour)
}
