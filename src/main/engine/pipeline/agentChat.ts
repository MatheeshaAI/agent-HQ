import { z } from 'zod/v4'
import { AGENTS, type AgentId, type AppSnapshot, type ChatMessage, type WikiPageMeta } from '@shared/types'
import type { Llm } from '../llm/claude'
import { section, text } from '../steps/common'

/** How many of the agent's own latest messages go into one prompt. */
const HISTORY_MESSAGES = 12
const MAX_REPLY = 1500
const MAX_WIKI_PAGES = 60

const ChatOutput = z.object({ reply: z.string().describe('The agent\'s reply, in plain text') })

const JOBS: Record<AgentId, string> = {
  pip: 'You receive new sources (files, links, notes) and sort them into the inbox, then pass them to Sage.',
  sage: 'You read each source and write a summary with its key points.',
  rex: 'You extract claims, concepts and tags from what Sage has read.',
  nova: 'You decide which wiki pages to write or update and link related pages with [[wikilinks]].',
  axel: 'You check the wiki for contradictions and orphan pages.',
  muse: 'You are the librarian: you answer questions from the wiki pages and cite them.'
}

/** Agents that also see the wiki index. */
const SEES_WIKI: AgentId[] = ['muse', 'nova']

function systemPrompt(agent: AgentId): string {
  const { name, role } = AGENTS.find((a) => a.id === agent)!
  return `You are ${name}, the ${role} in Agent HQ, a team of six AI agents that build a personal wiki from the person's sources.
${JOBS[agent]}
Speak as ${name}, briefly and in plain language. Answer only from the <context> you are given: your status, your recent tasks and activity${SEES_WIKI.includes(agent) ? ' and the wiki index' : ''}.
You can only talk right now; you cannot take actions, so if asked to do something, say you cannot do it from chat yet and what the person can do instead.
If the context does not say, say you do not know rather than guessing.
The person may be messaging the whole team at once; reply for yourself only.`
}

/** The live facts an agent can speak about. */
export function agentContext(agent: AgentId, snapshot: AppSnapshot, wiki: WikiPageMeta[]): Record<string, unknown> {
  const status = snapshot.agents.find((a) => a.id === agent)
  const context: Record<string, unknown> = {
    status: status ? { state: status.state, activity: status.activity } : undefined,
    recentTasks: snapshot.tasks.filter((t) => t.agent === agent).slice(0, 8).map((t) => ({ title: t.title, status: t.status, error: t.error })),
    recentActivity: snapshot.activity.filter((a) => a.agent === agent).slice(0, 8).map((a) => ({ title: a.title, detail: a.detail }))
  }
  if (SEES_WIKI.includes(agent)) {
    context.wikiPages = wiki.slice(0, MAX_WIKI_PAGES).map((p) => ({ title: p.title, summary: p.summary, links: p.links.length }))
    context.wikiPageCount = wiki.length
  }
  return context
}

/** One reply from one agent. `history` is that agent's earlier messages, oldest first. */
export async function agentReply(llm: Llm, agent: AgentId, context: Record<string, unknown>, history: ChatMessage[], message: string): Promise<string> {
  const turns = history.slice(-HISTORY_MESSAGES).map((m) => ({ from: m.from === 'user' ? 'person' : 'you', text: m.text }))
  const { reply } = await llm.structured({
    system: systemPrompt(agent),
    schema: ChatOutput,
    content: [text(section('context', context), section('conversation', turns), section('message', message))]
  })
  const cleaned = reply.trim()
  if (!cleaned) throw new Error('The agent sent an empty reply')
  return cleaned.length > MAX_REPLY ? `${cleaned.slice(0, MAX_REPLY).trimEnd()}…` : cleaned
}
