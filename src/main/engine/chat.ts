import { randomUUID } from 'node:crypto'
import type {
  AgentDef, AgentId, AgentRunResult, AppSnapshot, BroadcastDelivery, BroadcastResult, ChatExchange, ChatMessage, SourceItem, SourceOrigin, WikiPageMeta
} from '@shared/types'
import type { Llm } from './llm/claude'
import { mergeMemory, type AgentMemoryStore } from './memory'
import { agentContext, agentReply } from './pipeline/agentChat'
import { chiefBrief, digest, parseIntent, teamDigest } from './pipeline/chief'
import { errorMessage } from './util/text'

const MAX_LENGTH = 2000
const REPLY_TIMEOUT_MS = 60_000

/** What Chief can do on the person's request: start room agents and file Inbox notes. */
export interface ChiefDeps {
  run: (agentId: AgentId, instruction?: string) => Promise<AgentRunResult>
  note: (text: string, origin: SourceOrigin) => Promise<SourceItem>
}

export interface ChatDeps {
  now: () => number
  llm: Llm
  /** Whether a provider is configured; checked before any call so the error can say what to do */
  providerReady: () => boolean
  snapshot: () => AppSnapshot
  /** The agents that exist right now (from settings) */
  agents: () => AgentDef[]
  wiki: () => WikiPageMeta[]
  chief: ChiefDeps
  /** Per-agent memory and transcripts in the knowledge folder */
  memory: AgentMemoryStore
  /** Reports a memory update that failed (never blocks a reply) */
  onMemoryError?: (agent: AgentId, error: unknown) => void
  /** Overrides the reply timeout (tests) */
  timeoutMs?: number
}

const NO_PROVIDER = 'No AI provider is set up. Open Settings and choose a provider (and API key) to talk to the agents.'

/**
 * Talking to the agents. Each agent answers in character through the configured provider, from the live
 * facts it has (see agentChat.ts) and its memory. A failed call is an error for that agent, never a made-up
 * reply. Histories are persisted per agent in the knowledge folder (memory/chats/<id>.jsonl) and loaded
 * lazily; `reset()` drops the cache when the folder changes.
 *
 * Private messages (`send`) and broadcasts (`broadcast`) are separate operations on purpose: a broadcast never
 * goes through the private path, never triggers Chief's actions, and a private message only reaches the agent it names.
 */
export class ChatService {
  private histories = new Map<AgentId, Promise<ChatMessage[]>>()

  constructor(private readonly deps: ChatDeps) {}

  /** Forget cached histories (the knowledge folder changed); they reload from the new folder. */
  reset(): void {
    this.histories = new Map()
  }

  async history(agent: AgentId): Promise<ChatMessage[]> {
    return [...(await this.loaded(agent))]
  }

  async send(agent: AgentId, text: string): Promise<ChatExchange> {
    const body = clean(text)
    if (!this.deps.providerReady()) throw new Error(NO_PROVIDER)
    const def = this.deps.agents().find((a) => a.id === agent)
    // Chief acts on requests before it answers; the actions are reported back to the LLM so the reply matches them.
    const actions = def?.kind === 'chief' ? await this.chiefActions(def, body) : []
    let answer: string
    try {
      answer = await this.ask(agent, body, actions.length > 0 ? { actions } : undefined)
    } catch (error) {
      // Actions already ran: keep the message and say so, instead of showing it as "not sent".
      if (actions.length === 0) throw error
      answer = `I did what you asked but could not write a reply (${errorMessage(error)}). Results: ${describeActions(actions)}`
    }
    const sent = await this.add(agent, 'user', body, 'private')
    const reply = await this.add(agent, 'agent', answer, 'private')
    this.remember(agent, `The person said: ${body}\nYou replied: ${answer}`)
    return { sent, reply }
  }

  /** One message to every enabled agent (switched-off room agents are skipped). */
  async broadcast(text: string): Promise<BroadcastResult> {
    const body = clean(text)
    if (!this.deps.providerReady()) throw new Error(NO_PROVIDER)
    const at = this.deps.now()
    const deliveries = await Promise.all(
      broadcastRecipients(this.deps.agents()).map(async ({ id }): Promise<BroadcastDelivery> => {
        try {
          const answer = await this.ask(id, body)
          const sent = await this.add(id, 'user', body, 'broadcast')
          const reply = await this.add(id, 'agent', answer, 'broadcast')
          return { agent: id, status: 'delivered', sent, reply }
        } catch (error) {
          return { agent: id, status: 'failed', error: errorMessage(error) }
        }
      })
    )
    return { at, text: body, deliveries }
  }

  /** The agent's reply to a message; the message joins the history only once it has been answered. */
  private async ask(agent: AgentId, message: string, extra?: Record<string, unknown>): Promise<string> {
    if (!this.deps.providerReady()) throw new Error(NO_PROVIDER)
    const def = this.deps.agents().find((a) => a.id === agent)
    if (!def) throw new Error(`Unknown agent ${agent}`)
    const snapshot = this.deps.snapshot()
    const context = {
      ...agentContext(agent, snapshot, this.deps.wiki(), def),
      ...(def.kind === 'chief' ? { team: teamDigest(snapshot, this.deps.agents()) } : {}),
      ...extra
    }
    const extraSystem = def.kind === 'chief' ? chiefBrief(this.deps.agents()) : undefined
    const [history, memory] = await Promise.all([this.history(agent), this.deps.memory.read(agent)])
    const call = agentReply(this.deps.llm, def, context, history, message, extraSystem, memory)
    let timer: NodeJS.Timeout | undefined
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('The agent took too long to answer. Try again.')), this.deps.timeoutMs ?? REPLY_TIMEOUT_MS)
    })
    try {
      return await Promise.race([call, timeout])
    } catch (error) {
      throw new Error(friendlyError(error))
    } finally {
      clearTimeout(timer)
      call.catch(() => undefined)
    }
  }

  /** Folds a private exchange into the agent's memory in the background. Failures are reported, never thrown. */
  private remember(agent: AgentId, happened: string): void {
    const def = this.deps.agents().find((a) => a.id === agent)
    if (!def || !this.deps.providerReady()) return
    this.deps.memory
      .update(agent, (current) => mergeMemory(this.deps.llm, def, current, happened))
      .catch((error) => this.deps.onMemoryError?.(agent, error))
  }

  /**
   * Runs what the person asked Chief to do in this message, and reports each outcome. Only private messages
   * reach this (never broadcasts), so a broadcast cannot start agents.
   */
  private async chiefActions(def: AgentDef, message: string): Promise<Record<string, unknown>[]> {
    const defs = this.deps.agents()
    const intent = parseIntent(message, defs)
    if (!intent) return []
    if (intent.kind === 'digest') return [{ action: 'digest', ...digest(this.deps.snapshot(), defs, this.deps.now()) }]
    if (intent.kind === 'note') {
      try {
        const item = await this.deps.chief.note(intent.text, { room: intent.room, agentId: def.id, kind: 'agent' })
        return [{ action: 'note', room: intent.room, name: item.name, status: item.status }]
      } catch (error) {
        return [{ action: 'note', room: intent.room, ok: false, error: errorMessage(error) }]
      }
    }
    const results: Record<string, unknown>[] = []
    for (const agent of intent.agents) {
      if (!agent.enabled) {
        results.push({ action: 'run', agent: agent.name, room: agent.room, ok: false, error: 'it is switched off in Settings' })
        continue
      }
      const outcome = await this.deps.chief.run(agent.id, intent.instruction)
      results.push({ action: 'run', agent: agent.name, room: agent.room, instruction: intent.instruction, ok: outcome.ok, title: outcome.title, error: outcome.error })
    }
    return [{ action: 'summary', requested: intent.label }, ...results]
  }

  private loaded(agent: AgentId): Promise<ChatMessage[]> {
    let history = this.histories.get(agent)
    if (!history) {
      history = this.deps.memory.loadChat(agent).catch(() => [])
      this.histories.set(agent, history)
    }
    return history
  }

  private async add(agent: AgentId, from: ChatMessage['from'], text: string, channel: ChatMessage['channel']): Promise<ChatMessage> {
    const message: ChatMessage = { id: randomUUID(), from, text, at: this.deps.now(), channel, simulated: false }
    const histories = this.histories
    const list = await this.loaded(agent)
    // The folder may have changed while the reply was written; the message then belongs to no open folder.
    if (histories !== this.histories) return message
    list.push(message)
    await this.deps.memory.appendChat(agent, [message]).catch((error) => this.deps.onMemoryError?.(agent, error))
    return message
  }
}

/** Agents a broadcast goes to: everyone except room agents that are switched off. */
export function broadcastRecipients(defs: AgentDef[]): AgentDef[] {
  return defs.filter((d) => d.kind !== 'room' || d.enabled)
}

function describeActions(actions: Record<string, unknown>[]): string {
  return actions
    .filter((a) => a.action !== 'summary')
    .map((a) => (a.action === 'run' ? `${String(a.agent)}: ${a.ok ? `filed ${String(a.title ?? 'a note')}` : `failed (${String(a.error)})`}` : String(a.action)))
    .join('; ')
}

/** Provider errors as something the person can act on. */
function friendlyError(error: unknown): string {
  const message = errorMessage(error)
  if (/\b401\b|unauthori[sz]ed|invalid.*api.?key|authentication/i.test(message)) return `The AI provider rejected the API key. Check it in Settings. (${message})`
  if (/\b429\b|rate.?limit|quota/i.test(message)) return `The AI provider is rate limiting or out of credit. Try again later. (${message})`
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|fetch failed|network/i.test(message)) return `Could not reach the AI provider. Check your connection or the provider URL in Settings. (${message})`
  return message
}

function clean(text: string): string {
  const body = text.trim()
  if (!body) throw new Error('Write a message first')
  if (body.length > MAX_LENGTH) throw new Error(`Messages can be up to ${MAX_LENGTH} characters`)
  return body
}
