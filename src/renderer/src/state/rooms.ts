import type { AgentDef, AgentId, RoomKind, SourceItem, WikiPageMeta } from '@shared/types'
import { createStore, useStore } from './store'

export const ROOM_KINDS: RoomKind[] = ['brain', 'office', 'personal']

export const ROOM_LABEL: Record<RoomKind, string> = { brain: 'Brain', office: 'Office', personal: 'Personal' }

/** Room focus shared by the Inbox, Knowledge and Graph filters. 'all' shows every room. */
export type RoomFocus = RoomKind | 'all'

/** Starts on 'all' so the lists show items from every room. */
const focusStore = createStore<{ room: RoomFocus }>({ room: 'all' })

export const roomFocus = {
  set(room: RoomFocus): void {
    focusStore.set({ room })
  }
}

export function useRoomFocus(): RoomFocus {
  return useStore(focusStore, (s) => s.room)
}

/** Sources and pages without a room belong to the Brain. */
export function roomOfSource(source: SourceItem): RoomKind {
  return source.origin?.room ?? 'brain'
}

export function roomOfPage(page: WikiPageMeta | undefined): RoomKind {
  return page?.room ?? 'brain'
}

/** Name of the agent that added a source, or who added it. */
export function addedBy(source: SourceItem, defs: AgentDef[]): string {
  const origin = source.origin
  if (!origin || origin.kind === 'manual') return 'you'
  const agentId: AgentId | undefined = origin.agentId
  if (!agentId) return 'an agent'
  return defs.find((d) => d.id === agentId)?.name ?? agentId
}
