import type { AgentId } from '@shared/types'
import { createStore, useStore } from './store'

/** Agents currently producing a reply; the office shows them speaking. */
const voiceStore = createStore<{ speaking: ReadonlySet<AgentId> }>({ speaking: new Set() })

export const voice = {
  set(agentId: AgentId, speaking: boolean): void {
    voiceStore.set((s) => {
      if (s.speaking.has(agentId) === speaking) return s
      const next = new Set(s.speaking)
      if (speaking) next.add(agentId)
      else next.delete(agentId)
      return { speaking: next }
    })
  }
}

export function useSpeaking(agentId: AgentId): boolean {
  return useStore(voiceStore, (s) => s.speaking.has(agentId))
}
