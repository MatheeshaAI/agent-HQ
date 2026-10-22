import type { AskResult } from '@shared/types'
import type { KnowledgeBase } from '../knowledgeBase'
import type { Llm } from '../llm/claude'
import type { EngineState } from '../state'
import { answerQuestion, selectPages } from '../steps/answer'
import { errorMessage, firstWords } from '../util/text'
import { shortMessage } from './step'

const EMPTY_WIKI_ANSWER =
  'Your wiki is empty, so there is nothing to answer from yet. Add a file, a link or a note and the agents will build pages you can ask about.'

/** Muse answers a question from the wiki pages only, citing the pages it used. */
export async function askWiki(state: EngineState, llm: Llm, kb: KnowledgeBase, question: string): Promise<AskResult> {
  const asked = question.trim()
  if (!asked) return { answer: '', citations: [], error: 'Type a question first' }

  const pages = kb.wiki.texts()
  if (pages.length === 0) {
    state.addActivity('ask', 'Question asked', firstWords(asked, 12), 'muse')
    return { answer: EMPTY_WIKI_ANSWER, citations: [] }
  }

  const job = state.beginJob('muse', 'thinking', 'Reading wiki')
  try {
    const graph = kb.wiki.graph()
    const degree = new Map(graph.nodes.map((n) => [n.id, n.degree]))
    const selected = selectPages(pages, asked, (slug) => degree.get(slug) ?? 0)
    const result = await answerQuestion(llm, asked, selected)
    job.done()
    state.addActivity('ask', 'Question answered', firstWords(asked, 12), 'muse')
    return result
  } catch (error) {
    const message = errorMessage(error)
    job.fail(shortMessage(message))
    state.addActivity('error', 'Muse could not answer', message, 'muse')
    return { answer: '', citations: [], error: message }
  }
}
