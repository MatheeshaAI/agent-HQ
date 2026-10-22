import { z } from 'zod/v4'
import type { Llm } from '../llm/claude'
import { cleanTags, section, text } from './common'
import type { Extraction } from './extractor'
import type { PagePlan } from './linker'
import type { SourceSummary } from './reader'

const WriterOutput = z.object({
  markdown: z.string().describe('The full page body in Markdown, without front matter and without a top-level # heading'),
  summary: z.string().describe('One line describing the page'),
  tags: z.array(z.string()).describe('Two to six short lowercase topic tags')
})
export type PageDraft = z.infer<typeof WriterOutput>

const SYSTEM = `You are Muse, the Librarian of a personal knowledge base: a wiki of markdown pages that AI agents maintain from collected sources.
Write one wiki page in Markdown.
- Do not include front matter or a top-level "# " heading; the app adds the title.
- Open with a short overview paragraph, then organise the page with "## " sections.
- Link related pages with [[Page Title]] wikilinks, using exact titles from the lists you are given. Link each related page at least once where it is relevant.
- Write only what the sources support. Be specific: keep names, numbers and dates.
- When updating an existing page: keep every existing fact, link and source, and integrate the new information where it belongs. If the new source contradicts the page, keep both statements and record the disagreement in a "## Conflicts" section that says which source claims what.
- End with a "## Sources" section listing every source that informed the page by name (keep existing entries).
- summary: one line (under 160 characters) describing the page. tags: two to six short lowercase topic tags.`

export interface WriteContext {
  plan: PagePlan
  source: { name: string; summary: SourceSummary; extraction: Extraction }
  /** Titles of every page that exists or is planned, for wikilinks */
  knownTitles: string[]
  /** The current page body when updating */
  current: { markdown: string; tags: string[] } | null
}

export async function writePage(llm: Llm, context: WriteContext): Promise<PageDraft> {
  const { plan, source, knownTitles, current } = context
  const relevant = relevantExtraction(plan, source.extraction)
  const draft = await llm.structured({
    system: SYSTEM,
    schema: WriterOutput,
    content: [
      text(
        section('page', { title: plan.title, action: current ? 'update' : 'create', reason: plan.reason, links: plan.links }),
        section('source', { name: source.name, ...source.summary }),
        section('concepts', relevant.concepts),
        section('claims', relevant.claims),
        section('known_titles', knownTitles),
        ...(current ? [section('current_page', current.markdown), section('current_tags', current.tags)] : []),
        current ? `Update the page "${plan.title}" with what this source adds.` : `Write the new page "${plan.title}".`
      )
    ]
  })
  return { markdown: stripTitleHeading(draft.markdown, plan.title), summary: oneLine(draft.summary), tags: cleanTags(draft.tags) }
}

/** The concepts and claims that concern this page; everything when the page is the source summary. */
function relevantExtraction(plan: PagePlan, extraction: Extraction): Extraction {
  const names = new Set([plan.title, ...plan.links].map((t) => t.toLowerCase()))
  const concepts = extraction.concepts.filter((c) => names.has(c.name.toLowerCase()))
  if (concepts.length === 0) return extraction
  const conceptNames = new Set(concepts.map((c) => c.name.toLowerCase()))
  return { ...extraction, concepts, claims: extraction.claims.filter((c) => conceptNames.has(c.concept.toLowerCase())) }
}

function stripTitleHeading(markdown: string, title: string): string {
  const trimmed = markdown.trim()
  const heading = /^#\s+(.+?)\s*\n/.exec(trimmed)
  return heading && heading[1].trim().toLowerCase() === title.trim().toLowerCase() ? trimmed.slice(heading[0].length).trim() : trimmed
}

function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}
