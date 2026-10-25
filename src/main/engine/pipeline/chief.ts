import type { AgentDef, AppSnapshot, RoomKind } from '@shared/types'

/** What the person asked Chief to do, read from one message. Chief never acts on anything else. */
export type ChiefIntent =
  | { kind: 'run'; agents: AgentDef[]; label: string; instruction?: string }
  | { kind: 'note'; room: RoomKind; text: string }
  | { kind: 'digest' }

const ROOMS: RoomKind[] = ['brain', 'office', 'personal']
const ROOM_LABEL: Record<RoomKind, string> = { brain: 'Brain', office: 'Office work', personal: 'Personal work' }
const DAY_MS = 24 * 60 * 60 * 1000

const NOTE = /^\s*(?:add to (brain|office|personal)(?: inbox)?|note(?: for (brain|office|personal))?)\s*:\s*([\s\S]+)$/i
const DIGEST = /\b(digest|what'?s new|what is new)\b/i
const VERB = /\b(run|trigger|ask|tell|have|start|wake|kick off)\b/i
const ALL = /\b(all|every)\b/i
const ROOM_WORD = /\b(brain|office|personal)\b/i

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** True when the message names the agent by name, id or role. */
function mentions(message: string, def: AgentDef): boolean {
  const terms = new Set([def.name, def.id.replace(/-/g, ' '), def.role])
  return [...terms].some((term) => term.trim() && new RegExp(`\\b${escapeRegExp(term.trim())}\\b`, 'i').test(message))
}

/**
 * Deterministic reading of a Chief message. Returns null when the message is plain conversation,
 * in which case Chief just answers with the LLM.
 */
export function parseIntent(message: string, defs: AgentDef[]): ChiefIntent | null {
  const note = NOTE.exec(message)
  if (note) {
    const room = (note[1] ?? note[2] ?? 'brain').toLowerCase() as RoomKind
    const text = note[3].trim()
    if (text) return { kind: 'note', room, text }
  }
  if (DIGEST.test(message)) return { kind: 'digest' }
  if (!VERB.test(message)) return null

  const roomAgents = defs.filter((d) => d.kind === 'room')
  const roomWord = ROOM_WORD.exec(message)?.[1].toLowerCase() as RoomKind | undefined
  if (ALL.test(message)) {
    const agents = roomAgents.filter((d) => d.enabled && (!roomWord || d.room === roomWord))
    if (agents.length === 0) return null
    return { kind: 'run', agents, label: roomWord ? `all ${ROOM_LABEL[roomWord].toLowerCase()} agents` : 'all room agents', instruction: instructionOf(message) }
  }
  const named = roomAgents.filter((d) => mentions(message, d))
  if (named.length === 0) return null
  return { kind: 'run', agents: named, label: named.map((d) => d.name).join(', '), instruction: instructionOf(message) }
}

/**
 * What the person wants done in a run request: the part after "to" or ":" ("ask the scribe to sum up today"
 * gives "sum up today"). Undefined for a bare "run the scribe".
 */
export function instructionOf(message: string): string | undefined {
  const match = /(?:\bto\b|:)\s*([\s\S]+)$/i.exec(message)
  const text = match?.[1].trim().replace(/[.!]+$/, '').trim()
  return text ? text : undefined
}

/** Chief's extra system text: the rooms and the agents in them, from the current definitions. */
export function chiefBrief(defs: AgentDef[]): string {
  const lines = ROOMS.map((room) => {
    const members = defs
      .filter((d) => d.room === room && d.kind !== 'chief')
      .map((d) => `${d.name} (${d.role}${d.kind === 'room' && !d.enabled ? ', switched off' : ''})`)
    return `- ${ROOM_LABEL[room]}: ${members.join('; ') || 'no agents'}`
  })
  return [
    'Agent HQ has three rooms: Brain (the knowledge wiki), Office work and Personal work.',
    ...lines,
    'Room agents run when asked or on their schedule, and each run files a note in the Inbox of its room.',
    'What each agent is doing and did recently is in the context under "team".',
    'Actions taken in this turn are listed in the context under "actions". Report only those, and never claim an action that is not listed.'
  ].join('\n')
}

/**
 * Chief's shared view of the team: what each agent is doing and its latest activity and tasks, so Chief can
 * answer "what has Scribe been up to?" without reading every agent's memory.
 */
export function teamDigest(snapshot: AppSnapshot, defs: AgentDef[], perAgent = 3): Record<string, unknown>[] {
  return defs
    .filter((d) => d.kind !== 'chief')
    .map((d) => {
      const status = snapshot.agents.find((a) => a.id === d.id)
      return {
        agent: d.name,
        room: d.room,
        state: status?.state,
        activity: status?.activity,
        recent: snapshot.activity.filter((a) => a.agent === d.id).slice(0, perAgent).map((a) => a.title),
        tasks: snapshot.tasks.filter((t) => t.agent === d.id).slice(0, perAgent).map((t) => `${t.title} (${t.status})`)
      }
    })
}

/** Counts of sources added in the last 24 hours, by room and by who added them. */
export function digest(snapshot: AppSnapshot, defs: AgentDef[], now: number): Record<string, unknown> {
  const recent = snapshot.sources.filter((s) => s.addedAt >= now - DAY_MS)
  const byRoom: Record<RoomKind, number> = { brain: 0, office: 0, personal: 0 }
  const groups = new Map<string, { agent: string; room: RoomKind; count: number }>()
  for (const source of recent) {
    const room: RoomKind = source.origin?.room ?? 'brain'
    const agentId = source.origin?.kind === 'agent' ? (source.origin.agentId ?? 'unknown') : 'manual'
    byRoom[room] += 1
    const key = `${room}:${agentId}`
    const group = groups.get(key) ?? {
      agent: agentId === 'manual' ? 'added by you' : (defs.find((d) => d.id === agentId)?.name ?? agentId),
      room,
      count: 0
    }
    group.count += 1
    groups.set(key, group)
  }
  return {
    windowHours: 24,
    total: recent.length,
    failed: recent.filter((s) => s.status === 'failed').length,
    byRoom,
    byAgent: [...groups.values()].sort((a, b) => b.count - a.count)
  }
}
