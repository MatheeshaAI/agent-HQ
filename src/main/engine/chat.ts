import { randomUUID } from 'node:crypto'
import { AGENTS, type AgentId, type BroadcastDelivery, type BroadcastResult, type ChatExchange, type ChatMessage } from '@shared/types'

const MAX_LENGTH = 2000

/**
 * Talking to the agents. The agents are pipeline stages rather than chat partners, so every reply here is a
 * placeholder marked `simulated` until a backend answers for them. Histories live in memory for the session.
 *
 * Private messages (`send`) and broadcasts (`broadcast`) are separate operations on purpose: a broadcast never
 * goes through the private path, and a private message can only ever reach the agent it names.
 */
export class ChatService {
  private readonly histories = new Map<AgentId, ChatMessage[]>()

  constructor(
    private readonly now: () => number,
    private readonly replyDelayMs: number
  ) {}

  history(agent: AgentId): ChatMessage[] {
    return [...(this.histories.get(agent) ?? [])]
  }

  async send(agent: AgentId, text: string): Promise<ChatExchange> {
    const body = clean(text)
    const sent = this.add(agent, 'user', body, 'private')
    await this.pause()
    const reply = this.add(agent, 'agent', simulatedReply(agent, body), 'private')
    return { sent, reply }
  }

  async broadcast(text: string): Promise<BroadcastResult> {
    const body = clean(text)
    const at = this.now()
    const deliveries = await Promise.all(
      AGENTS.map(async ({ id }): Promise<BroadcastDelivery> => {
        try {
          const sent = this.add(id, 'user', body, 'broadcast')
          await this.pause()
          const reply = this.add(id, 'agent', simulatedReply(id, body), 'broadcast')
          return { agent: id, status: 'delivered', sent, reply }
        } catch (error) {
          return { agent: id, status: 'failed', error: error instanceof Error ? error.message : String(error) }
        }
      })
    )
    return { at, text: body, deliveries }
  }

  private add(agent: AgentId, from: ChatMessage['from'], text: string, channel: ChatMessage['channel']): ChatMessage {
    const message: ChatMessage = { id: randomUUID(), from, text, at: this.now(), channel, simulated: from === 'agent' }
    this.histories.set(agent, [...(this.histories.get(agent) ?? []), message])
    return message
  }

  private pause(): Promise<void> {
    return this.replyDelayMs > 0 ? new Promise((resolve) => setTimeout(resolve, this.replyDelayMs)) : Promise.resolve()
  }
}

function clean(text: string): string {
  const body = text.trim()
  if (!body) throw new Error('Write a message first')
  if (body.length > MAX_LENGTH) throw new Error(`Messages can be up to ${MAX_LENGTH} characters`)
  return body
}

function simulatedReply(agent: AgentId, text: string): string {
  const { name, role } = AGENTS.find((a) => a.id === agent) ?? AGENTS[0]
  const quote = text.length > 60 ? `${text.slice(0, 57)}...` : text
  return `${name} the ${role} here. Noted: "${quote}"`
}
