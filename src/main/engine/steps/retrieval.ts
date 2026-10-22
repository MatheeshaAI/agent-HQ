import type { PageText } from '../wiki/store'

const STOPWORDS = new Set(
  (
    'the and for are but not you all any can had her was one our out has have him his how its may new now old see ' +
    'two way who did get let say she too use what when where which while with from that this they them then than ' +
    'there their these those been being into onto over under about after before again also just only some such very ' +
    'will would could should does doing done each more most other own same both few why yes your yours ours hers ' +
    'whom were what tell know give show explain describe much many like make made'
  ).split(' ')
)

function keywords(text: string): string[] {
  return (text.toLowerCase().normalize('NFKD').match(/[\p{L}\p{N}]+/gu) ?? []).filter(
    (word) => word.length >= 3 && !STOPWORDS.has(word)
  )
}

interface Scored {
  page: PageText
  score: number
}

/**
 * Ranks pages by keyword overlap with the query: title matches weigh most, then tags, summary
 * and body. Body hits are dampened logarithmically so long pages do not win by length alone.
 */
export function rankPages(pages: PageText[], query: string): Scored[] {
  const terms = [...new Set(keywords(query))]
  if (terms.length === 0) return pages.map((page) => ({ page, score: 0 }))
  return pages
    .map((page) => {
      const title = countTerms(page.title, terms)
      const tags = countTerms(page.tags.join(' '), terms)
      const summary = countTerms(page.summary, terms)
      const body = countTerms(page.body, terms)
      let score = 0
      for (const term of terms) {
        score += 4 * Math.min(title.get(term) ?? 0, 2)
        score += 3 * Math.min(tags.get(term) ?? 0, 2)
        score += 2 * Math.min(summary.get(term) ?? 0, 3)
        score += Math.log2(1 + (body.get(term) ?? 0))
      }
      return { page, score }
    })
    .sort((a, b) => b.score - a.score || a.page.title.localeCompare(b.page.title))
}

function countTerms(text: string, terms: string[]): Map<string, number> {
  const wanted = new Set(terms)
  const counts = new Map<string, number>()
  for (const word of keywords(text)) if (wanted.has(word)) counts.set(word, (counts.get(word) ?? 0) + 1)
  return counts
}
