import { randomUUID } from 'node:crypto'
import { AGENTS, type AgentId, type AppSnapshot, type BroadcastDelivery, type BroadcastResult, type ChatExchange, type ChatMessage, type WikiPageMeta } from '@shared/types'
import type { Llm } from './llm/claude'
import { agentContext, agentReply } from './pipeline/agentChat'
import { errorMessage } from './util/text'

const MAX_LENGTH = 2000
const REPLY_TIMEOUT_MS = 60_000

export interface ChatDeps {
  now: () => number
  llm: Llm
  /** Whether a provider is configured; checked before any call so the error can say what to do */
  providerReady: () => boolean
  snapshot: () => AppSnapshot
  wiki: () => WikiPageMeta[]
  /** Overrides the reply timeout (tests) */
  timeoutMs?: number
}

/**
 * Talking to the agents. Each agent answers in character through the configured provider, from the live
 * facts it has (see agentChat.ts). Replies are read-only: chat cannot trigger actions. A failed call is an
 * error for that agent, never a made-up reply. Histories live in memory for the session.
 *
 * Private messages (`send`) and broadcasts (`broadcast`) are separate operations on purpose: a broadcast never
 * goes through the private path, and a private message can only ever reach the agent it names.
 */
export class ChatService {
  private readonly histories = new Map<AgentId, ChatMessage[]>()

  constructor(private readonly deps: ChatDeps) {}

  history(agent: AgentId): ChatMessage[] {
    return [...(this.histories.get(agent) ?? [])]
  }

  async send(agent: AgentId, text: string): Promise<ChatExchange> {
    const body = clean(text)
    const answer = await this.ask(agent, body)
    const sent = this.add(agent, 'user', body, 'private')
    const reply = this.add(agent, 'agent', answer, 'private')
    return { sent, reply }
  }

  async broadcast(text: string): Promise<BroadcastResult> {
    const body = clean(text)
    const at = this.deps.now()
    const deliveries = await Promise.all(
      AGENTS.map(async ({ id }): Promise<BroadcastDelivery> => {
        try {
          const answer = await this.ask(id, body)
          const sent = this.add(id, 'user', body, 'broadcast')
          const reply = this.add(id, 'agent', answer, 'broadcast')
          return { agent: id, status: 'delivered', sent, reply }
        } catch (error) {
          return { agent: id, status: 'failed', error: errorMessage(error) }
        }
      })
    )
    return { at, text: body, deliveries }
  }

  /** The agent's reply to a message; the message joins the history only once it has been answered. */
  private async ask(agent: AgentId, message: string): Promise<string> {
    if (!this.deps.providerReady()) throw new Error('No AI provider is set up. Add one in Settings to talk to the agents.')
    const context = agentContext(agent, this.deps.snapshot(), this.deps.wiki())
    const call = agentReply(this.deps.llm, agent, context, this.history(agent), message)
    let timer: NodeJS.Timeout | undefined
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('The agent took too long to answer. Try again.')), this.deps.timeoutMs ?? REPLY_TIMEOUT_MS)
    })
    try {
      return await Promise.race([call, timeout])
    } finally {
      clearTimeout(timer)
      call.catch(() => undefined)
    }
  }

  private add(agent: AgentId, from: ChatMessage['from'], text: string, channel: ChatMessage['channel']): ChatMessage {
    const message: ChatMessage = { id: randomUUID(), from, text, at: this.deps.now(), channel, simulated: false }
    this.histories.set(agent, [...(this.histories.get(agent) ?? []), message])
    return message
  }
}

function clean(text: string): string {
  const body = text.trim()
  if (!body) throw new Error('Write a message first')
  if (body.length > MAX_LENGTH) throw new Error(`Messages can be up to ${MAX_LENGTH} characters`)
  return body
}
