import { z } from 'zod/v4'
import type { Llm } from '../llm/claude'
import type { PageText } from '../wiki/store'
import { section, text, uniqueBy } from './common'
import type { Extraction } from './extractor'
import type { SourceSummary } from './reader'
import { rankPages } from './retrieval'

const MAX_PAGES_PER_SOURCE = 8
/** Above this many characters the existing-page index is narrowed to the most relevant pages. */
const INDEX_BUDGET_CHARS = 200_000

const LinkerOutput = z.object({
  pages: z.array(
    z.object({
      title: z.string().describe('Page title; for updates, the exact title of the existing page'),
      // Advisory only: the librarian checks the wiki itself to decide between creating and updating.
      action: z.string().describe('"create" for a new page or "update" for an existing one'),
      reason: z.string().describe('One sentence on why this page is created or updated'),
      links: z.array(z.string()).describe('Titles of other pages (planned or existing) this page should link to')
    })
  )
})
export type PagePlan = z.infer<typeof LinkerOutput>['pages'][number]

const SYSTEM = `You are Nova, the Linker of a personal knowledge base: a wiki of markdown pages that AI agents maintain from collected sources.
A new source has been read. Decide which wiki pages it should create or update so its knowledge is woven into the wiki.
- Prefer updating an existing page when it already covers the same concept (match by meaning, not only by exact title).
- Plan one page that summarises the source itself, titled after the source, unless an existing page already is that summary.
- Create other pages only for concepts substantial enough to stand on their own.
- Plan at most ${MAX_PAGES_PER_SOURCE} pages in total, most important first.
- For each page list the titles it should link to: related planned pages and relevant existing pages.
- For an update, use the exact title of the existing page.`

interface ExistingPage {
  title: string
  summary: string
  tags: string[]
}

/** Plans which pages to create or update for a source. */
export async function planPages(
  llm: Llm,
  pages: PageText[],
  source: { name: string; summary: SourceSummary; extraction: Extraction }
): Promise<PagePlan[]> {
  const index = existingIndex(pages, `${source.summary.title} ${source.extraction.concepts.map((c) => c.name).join(' ')}`)
  const { pages: plan } = await llm.structured({
    system: SYSTEM,
    schema: LinkerOutput,
    content: [
      text(
        section('existing_pages', index),
        section('source', { name: source.name, ...source.summary }),
        section('concepts', source.extraction.concepts),
        section('tags', source.extraction.tags),
        `Plan the wiki pages for this source (${index.length === 0 ? 'the wiki is empty' : `${index.length} existing pages listed`}).`
      )
    ]
  })
  return uniqueBy(plan, (page) => page.title).slice(0, MAX_PAGES_PER_SOURCE)
}

function existingIndex(pages: PageText[], focus: string): ExistingPage[] {
  const all = pages.map((p) => ({ title: p.title, summary: p.summary, tags: p.tags }))
  const size = all.reduce((sum, p) => sum + p.title.length + p.summary.length + 40, 0)
  if (size <= INDEX_BUDGET_CHARS) return all
  const ranked = rankPages(pages, focus)
  const kept: ExistingPage[] = []
  let used = 0
  for (const { page } of ranked) {
    used += page.title.length + page.summary.length + 40
    if (used > INDEX_BUDGET_CHARS) break
    kept.push({ title: page.title, summary: page.summary, tags: page.tags })
  }
  return kept
}
