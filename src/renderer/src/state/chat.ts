import type { AgentId } from '@shared/types'
import { createStore, useStore } from './store'

export interface ChatMessage {
  id: string
  from: 'user' | 'agent'
  text: string
  at: number
}

type Histories = Partial<Record<AgentId, ChatMessage[]>>

/** Each agent keeps its own conversation; switching agents in the drawer never mixes them. */
const chatStore = createStore<{ histories: Histories }>({ histories: {} })

const EMPTY: ChatMessage[] = []
let counter = 0

function append(agentId: AgentId, from: ChatMessage['from'], text: string): void {
  const message: ChatMessage = { id: `m${++counter}`, from, text, at: Date.now() }
  chatStore.set((s) => ({ histories: { ...s.histories, [agentId]: [...(s.histories[agentId] ?? EMPTY), message] } }))
}

export const chat = {
  /** Placeholder until the backend is connected: the reply is simulated. */
  send(agentId: AgentId, text: string): void {
    append(agentId, 'user', text)
    setTimeout(() => append(agentId, 'agent', 'Got it. (Simulated reply.)'), 600)
  }
}

export function useChatHistory(agentId: AgentId): ChatMessage[] {
  return useStore(chatStore, (s) => s.histories[agentId] ?? EMPTY)
}
