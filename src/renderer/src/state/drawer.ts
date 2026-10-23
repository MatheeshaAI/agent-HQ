import type { AgentId } from '@shared/types'
import { createStore, useStore } from './store'

/** Which agent's drawer is open in the Office view (null = closed). */
const drawerStore = createStore<{ agentId: AgentId | null }>({ agentId: null })

export const drawer = {
  open(agentId: AgentId): void {
    drawerStore.set({ agentId })
  },
  close(): void {
    drawerStore.set({ agentId: null })
  }
}

export function useDrawerAgent(): AgentId | null {
  return useStore(drawerStore, (s) => s.agentId)
}
