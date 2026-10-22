import type { AgentId } from '@shared/types'
import { createStore, useStore } from './store'

export type ViewId = 'office' | 'agents' | 'knowledge' | 'tasks' | 'graph' | 'inbox' | 'settings'

interface NavigationState {
  view: ViewId
  /** Page open in the Knowledge reader */
  pageSlug: string | null
  /** Agent highlighted in the Agents view */
  agentId: AgentId | null
  /** Incremented to ask the Ask input to take focus */
  askFocusRequest: number
}

const navigationStore = createStore<NavigationState>({
  view: 'office',
  pageSlug: null,
  agentId: null,
  askFocusRequest: 0
})

export const navigation = {
  go(view: ViewId): void {
    navigationStore.set({ view })
  },
  openPage(slug: string): void {
    navigationStore.set({ view: 'knowledge', pageSlug: slug })
  },
  closePage(): void {
    navigationStore.set({ pageSlug: null })
  },
  focusAgent(agentId: AgentId): void {
    navigationStore.set({ view: 'agents', agentId })
  },
  focusAsk(): void {
    navigationStore.set((s) => ({ askFocusRequest: s.askFocusRequest + 1 }))
  }
}

export function useNavigation<S>(selector: (state: NavigationState) => S): S {
  return useStore(navigationStore, selector)
}
