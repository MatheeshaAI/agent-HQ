import { z } from 'zod/v4'
import type { Contradiction } from '@shared/types'
import type { Llm } from '../llm/claude'
import type { PageText } from '../wiki/store'
import { section, text } from './common'

/** Pages sent to one contradiction check, at most; the rest are checked in further batches. */
const BATCH_CHARS = 300_000

const CheckerOutput = z.object({
  contradictions: z.array(
    z.object({
      pages: z.array(z.string()).describe('Slugs of the pages involved'),
      description: z.string().describe('One sentence naming the conflicting statements')
    })
  )
})

const SYSTEM = `You are Axel, the Janitor of a personal knowledge base: a wiki of markdown pages that AI agents maintain from collected sources.
Check the pages you are given for contradictions: statements that cannot both be true, on different pages or within one page (different dates, numbers, definitions, attributions or conclusions about the same thing).
Include contradictions that a page already records under "## Conflicts"; they are still unresolved.
Ignore differences of emphasis, wording or level of detail. Report each contradiction once, with the slugs of the pages involved and one sentence naming the conflicting statements.
Return an empty list when the pages agree.`

/** Finds contradictions across pages, in batches small enough for one request each. */
export async function findContradictions(llm: Llm, pages: PageText[]): Promise<Contradiction[]> {
  const known = new Set(pages.map((p) => p.slug))
  const found: Contradiction[] = []
  for (const batch of batches(pages)) {
    const { contradictions } = await llm.structured({
      system: SYSTEM,
      schema: CheckerOutput,
      content: [
        text(
          section('pages', batch.map((p) => ({ slug: p.slug, title: p.title, markdown: p.body }))),
          `Check these ${batch.length} pages for contradictions.`
        )
      ]
    })
    for (const item of contradictions) {
      const slugs = [...new Set(item.pages.filter((slug) => known.has(slug)))]
      if (slugs.length > 0 && item.description.trim()) found.push({ pages: slugs, description: item.description.trim() })
    }
  }
  return found
}

function batches(pages: PageText[]): PageText[][] {
  const result: PageText[][] = []
  let current: PageText[] = []
  let size = 0
  for (const page of pages) {
    const pageSize = page.body.length + page.title.length + 64
    if (current.length > 0 && size + pageSize > BATCH_CHARS) {
      result.push(current)
      current = []
      size = 0
    }
    current.push(page)
    size += pageSize
  }
  if (current.length > 0) result.push(current)
  return result
}
