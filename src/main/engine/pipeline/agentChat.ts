import { z } from 'zod/v4'
import type { AgentDef, AgentId, AppSnapshot, ChatMessage, WikiPageMeta } from '@shared/types'
import type { Llm } from '../llm/claude'
import { memoryForPrompt } from '../memory'
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

/** Every brain agent and Chief see the wiki index; room agents see only the pages of their own room. */
function seesWiki(def: AgentDef | undefined): boolean {
  return def !== undefined && (def.room === 'brain' || def.kind === 'chief')
}

/** Brain agents keep their pipeline job text; every other agent uses the prompt in its definition. */
function jobFor(def: AgentDef): string {
  if (def.room === 'brain' && JOBS[def.id]) return JOBS[def.id]
  return def.prompt ?? `You are the ${def.role} for the ${def.room} room.`
}

function systemPrompt(def: AgentDef, memory: string): string {
  const { name, role } = def
  const team = def.room === 'brain'
    ? 'a team of AI agents that build a personal wiki from the person\'s sources'
    : `the ${def.room} room of Agent HQ, a team of AI agents that help the person`
  return `You are ${name}, the ${role} in Agent HQ, ${team}.
${jobFor(def)}
Speak as ${name}, briefly and in plain language. Answer only from the <context> you are given: your status, your recent tasks and activity, the wiki pages listed there${memory ? ' and your memory below' : ''}.
${def.kind === 'chief'
  ? 'You can start room agents (passing along what the person asked) and file Inbox notes only through the actions listed in <context>; say you cannot do anything else from chat.'
  : def.kind === 'room'
    ? 'You cannot take actions from chat. If asked to do your job, tell the person to press Run now on your card or ask Chief (for example "ask ' + def.name + ' to ...").'
    : 'You can only talk right now; you cannot take actions, so if asked to do something, say you cannot do it from chat yet and what the person can do instead.'}
If the context does not say, say you do not know rather than guessing.
The person may be messaging the whole team at once; reply for yourself only.${memory ? `\n<memory>\nWhat you remember from earlier conversations and runs (the person can edit this):\n${memory}\n</memory>` : ''}`
}

/** The live facts an agent can speak about. */
export function agentContext(agent: AgentId, snapshot: AppSnapshot, wiki: WikiPageMeta[], def?: AgentDef): Record<string, unknown> {
  const status = snapshot.agents.find((a) => a.id === agent)
  const context: Record<string, unknown> = {
    status: status ? { state: status.state, activity: status.activity } : undefined,
    recentTasks: snapshot.tasks.filter((t) => t.agent === agent).slice(0, 8).map((t) => ({ title: t.title, status: t.status, error: t.error })),
    recentActivity: snapshot.activity.filter((a) => a.agent === agent).slice(0, 8).map((a) => ({ title: a.title, detail: a.detail }))
  }
  const pages = seesWiki(def) ? wiki : def ? wiki.filter((p) => p.room === def.room) : []
  if (pages.length > 0) {
    context.wikiPages = [...pages].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_WIKI_PAGES).map((p) => ({ title: p.title, summary: p.summary, links: p.links.length }))
    context.wikiPageCount = pages.length
  }
  return context
}

/** One reply from one agent. `history` is that agent's earlier messages, oldest first. */
export async function agentReply(
  llm: Llm,
  def: AgentDef,
  context: Record<string, unknown>,
  history: ChatMessage[],
  message: string,
  extraSystem?: string,
  memory = ''
): Promise<string> {
  const turns = history.slice(-HISTORY_MESSAGES).map((m) => ({ from: m.from === 'user' ? 'person' : 'you', text: m.text }))
  const system = systemPrompt(def, memoryForPrompt(memory))
  const { reply } = await llm.structured({
    system: extraSystem ? `${system}\n${extraSystem}` : system,
    schema: ChatOutput,
    content: [text(section('context', context), section('conversation', turns), section('message', message))]
  })
  const cleaned = reply.trim()
  if (!cleaned) throw new Error('The agent sent an empty reply')
  return cleaned.length > MAX_REPLY ? `${cleaned.slice(0, MAX_REPLY).trimEnd()}…` : cleaned
}
