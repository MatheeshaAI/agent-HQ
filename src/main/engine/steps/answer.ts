import { z } from 'zod/v4'
import type { AskResult } from '@shared/types'
import type { Llm } from '../llm/claude'
import type { PageText } from '../wiki/store'
import { section, text } from './common'
import { rankPages } from './retrieval'

/** How many pages are read to answer one question. */
const PAGES_PER_ANSWER = 8

const AnswerOutput = z.object({
  answer: z.string().describe('The answer in Markdown'),
  citations: z.array(z.string()).describe('Slugs of the pages the answer relies on')
})

const SYSTEM = `You are Muse, the Librarian of a personal knowledge base: a wiki of markdown pages that AI agents maintain from collected sources.
Answer the person's question using ONLY the wiki pages you are given. Do not use outside knowledge.
If the pages do not contain the answer, say so plainly and mention what the wiki does cover that is closest.
Write the answer in concise Markdown and refer to pages with [[Page Title]] wikilinks.
citations: the slugs of the pages the answer relies on.`

/** The pages most relevant to a question, best first. Falls back to the best-connected pages. */
export function selectPages(pages: PageText[], question: string, degree: (slug: string) => number): PageText[] {
  const ranked = rankPages(pages, question).filter((r) => r.score > 0)
  if (ranked.length > 0) return ranked.slice(0, PAGES_PER_ANSWER).map((r) => r.page)
  return [...pages].sort((a, b) => degree(b.slug) - degree(a.slug)).slice(0, PAGES_PER_ANSWER)
}

export async function answerQuestion(llm: Llm, question: string, pages: PageText[]): Promise<AskResult> {
  const { answer, citations } = await llm.structured({
    system: SYSTEM,
    schema: AnswerOutput,
    content: [
      text(
        section('pages', pages.map((p) => ({ slug: p.slug, title: p.title, markdown: p.body }))),
        section('question', question)
      )
    ]
  })
  const available = new Set(pages.map((p) => p.slug))
  return { answer: answer.trim(), citations: [...new Set(citations.filter((slug) => available.has(slug)))] }
}
