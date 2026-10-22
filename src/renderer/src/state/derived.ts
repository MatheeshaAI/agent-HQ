import type { ActivityItem, AgentId, AgentState, AgentStatus, SourceItem, TaskItem } from '@shared/types'

export type Tone = 'green' | 'amber' | 'red' | 'blue' | 'grey'

/** Tasks the pipeline still has to finish. */
export function pendingTaskCount(tasks: TaskItem[]): number {
  return tasks.filter((t) => t.status === 'queued' || t.status === 'running').length
}

/** Sources waiting for, or currently in, ingestion. */
export function inboxCount(sources: SourceItem[]): number {
  return sources.filter((s) => s.status === 'queued' || s.status === 'processing').length
}

/** An agent counts as online unless its last step failed. */
export function onlineAgentCount(agents: AgentStatus[]): number {
  return agents.filter((a) => a.state !== 'error').length
}

/**
 * How an agent's state reads in compact status lists:
 * working or thinking -> Active (green), idle -> Idle (grey), error -> Error (red).
 */
export function agentPresence(state: AgentState): { label: string; tone: Tone } {
  switch (state) {
    case 'working':
    case 'thinking':
      return { label: 'Active', tone: 'green' }
    case 'error':
      return { label: 'Error', tone: 'red' }
    default:
      return { label: 'Idle', tone: 'grey' }
  }
}

/** The state as a verb, used on agent cards: Working, Thinking, Idle, Error. */
export function agentStateLabel(state: AgentState): string {
  return state.charAt(0).toUpperCase() + state.slice(1)
}

export function agentStateTone(state: AgentState): Tone {
  switch (state) {
    case 'working':
      return 'green'
    case 'thinking':
      return 'blue'
    case 'error':
      return 'red'
    default:
      return 'grey'
  }
}

const TASK_ORDER: Record<TaskItem['status'], number> = { running: 0, queued: 1, failed: 2, done: 3 }

/** Running work first, then the queue, then the most recent finished tasks. */
export function tasksForDisplay(tasks: TaskItem[]): TaskItem[] {
  return [...tasks].sort((a, b) => TASK_ORDER[a.status] - TASK_ORDER[b.status] || b.updatedAt - a.updatedAt)
}

export function activityFor(agentId: AgentId, activity: ActivityItem[], limit: number): ActivityItem[] {
  const items: ActivityItem[] = []
  for (const item of activity) {
    if (item.agent === agentId) items.push(item)
    if (items.length === limit) break
  }
  return items
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? ''
}

/** Normalises a wikilink target the way page slugs are written: lowercase words joined by dashes. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Accepts bare domains ("example.com/post") by assuming https; only http(s) URLs are allowed. */
export function normaliseUrl(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    const url = new URL(candidate)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    if (!url.hostname.includes('.') && url.hostname !== 'localhost') return null
    return url.toString()
  } catch {
    return null
  }
}
