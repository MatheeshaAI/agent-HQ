import { AGENTS, type AgentId, type BroadcastResult, type ChatMessage } from '@shared/types'
import { createStore, useStore } from './store'
import { voice } from './voice'

/** A message as the drawer shows it: engine messages plus the ones still on their way or that failed. */
export type DisplayMessage = ChatMessage & { pending?: boolean; failed?: boolean; error?: string }

type Histories = Partial<Record<AgentId, DisplayMessage[]>>

/** Each agent keeps its own conversation; switching agents in the drawer never mixes them. */
const chatStore = createStore<{ histories: Histories }>({ histories: {} })

const EMPTY: DisplayMessage[] = []
const loaded = new Map<AgentId, Promise<void>>()
let counter = 0

function setHistory(agentId: AgentId, update: (messages: DisplayMessage[]) => DisplayMessage[]): void {
  chatStore.set((s) => ({ histories: { ...s.histories, [agentId]: update(s.histories[agentId] ?? EMPTY) } }))
}

/** Replaces the agent's messages with the engine's, keeping local ones that never made it there. */
async function sync(agentId: AgentId): Promise<void> {
  const fromEngine = await window.api.chatHistory(agentId)
  setHistory(agentId, (messages) => [...fromEngine, ...messages.filter((m) => m.pending || m.failed)])
}

function localMessage(text: string, from: ChatMessage['from'], extra: Partial<DisplayMessage>): DisplayMessage {
  return { id: `local-${++counter}`, from, text, at: Date.now(), channel: 'private', simulated: false, ...extra }
}

export const chat = {
  /** Drops every loaded history (the knowledge folder changed); open conversations reload from the engine. */
  reset(): void {
    loaded.clear()
    chatStore.set({ histories: {} })
  },

  /** Loads the agent's history from the engine once. */
  load(agentId: AgentId): Promise<void> {
    const cached = loaded.get(agentId)
    if (cached) return cached
    const pending = sync(agentId).catch(() => {
      loaded.delete(agentId)
    })
    loaded.set(agentId, pending)
    return pending
  },

  /** Private message to one agent. */
  async send(agentId: AgentId, text: string): Promise<void> {
    await chat.load(agentId)
    const draft = localMessage(text, 'user', { pending: true })
    setHistory(agentId, (m) => [...m, draft])
    voice.set(agentId, true)
    try {
      const { sent, reply } = await window.api.chatSend(agentId, text)
      setHistory(agentId, (m) => [...m.filter((x) => x.id !== draft.id), sent, reply])
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      setHistory(agentId, (m) => [...m.filter((x) => x.id !== draft.id), { ...draft, pending: false, failed: true, error: reason }])
    } finally {
      voice.set(agentId, false)
    }
  },

  /** Sends a failed message again. */
  retry(agentId: AgentId, message: DisplayMessage): Promise<void> {
    setHistory(agentId, (m) => m.filter((x) => x.id !== message.id))
    return chat.send(agentId, message.text)
  },

  /** Removes a failed message from the conversation. */
  dismiss(agentId: AgentId, id: string): void {
    setHistory(agentId, (m) => m.filter((x) => x.id !== id))
  },

  /** One message to the given agents (the engine decides the final list); resolves with each delivery result. */
  async broadcast(text: string, recipients: AgentId[] = AGENTS.map((a) => a.id)): Promise<BroadcastResult> {
    for (const id of recipients) voice.set(id, true)
    try {
      const result = await window.api.broadcastSend(text)
      await Promise.all(result.deliveries.map((d) => (d.status === 'delivered' ? sync(d.agent).catch(() => undefined) : undefined)))
      return result
    } finally {
      for (const id of recipients) voice.set(id, false)
    }
  }
}

export function useChatHistory(agentId: AgentId): DisplayMessage[] {
  return useStore(chatStore, (s) => s.histories[agentId] ?? EMPTY)
}
