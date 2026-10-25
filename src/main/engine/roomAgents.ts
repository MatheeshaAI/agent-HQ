import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { z } from 'zod/v4'
import type { ActivityKind, AgentDef, AgentId, AgentRunInfo, AgentRunResult, SourceItem, SourceOrigin, WikiPageMeta } from '@shared/types'
import type { Llm } from './llm/claude'
import { mergeMemory, memoryForPrompt, type AgentMemoryStore } from './memory'
import { section, text } from './steps/common'
import { writeFileAtomic } from './util/fsx'
import { errorMessage } from './util/text'

/** How often the scheduler looks at the agent list. */
const TICK_MS = 60_000
/** Wiki pages given to the agent as context for one run. */
const MAX_CONTEXT_PAGES = 20
const MAX_TITLE = 120
const RUNS_FILE = 'agent-runs.json'

/** Last outcome of one agent's run. Persisted so schedules survive a restart. */
export interface AgentRunRecord {
  lastRunAt: number
  ok: boolean
  title?: string
  error?: string
}

export interface RoomAgentDeps {
  dataDir: string
  llm: Llm
  /** Whether an AI provider is configured (checked before any LLM call). */
  providerReady: () => boolean
  /** Whether a knowledge folder is open (notes can only be filed when it is). */
  canFile: () => boolean
  getAgentDefs: () => AgentDef[]
  /** Files a markdown note into the Inbox with its origin. */
  addNote: (text: string, origin: SourceOrigin) => Promise<SourceItem>
  /** Wiki pages, for the agent's recent context. */
  wikiPages: () => WikiPageMeta[]
  /** Activity feed hook (the Office / Activity list). */
  activity: (kind: ActivityKind, title: string, detail: string, agent?: AgentId) => void
  /** Per-agent memory: injected into each run and updated after it. */
  memory?: AgentMemoryStore
  now?: () => number
}

const AgentOutput = z.object({
  title: z.string().describe('A short title for this run, without the date'),
  markdown: z.string().describe('The note body in markdown')
})

/** Only room agents run on a schedule; pipeline agents run from ingestion and the chief answers in chat. */
export function isScheduled(def: AgentDef): boolean {
  return def.enabled && def.kind === 'room' && def.schedule !== undefined && def.schedule.mode !== 'off'
}

/**
 * True when a scheduled agent should run now. Interval: `everyMinutes` after the last run (or at once if
 * it never ran). Daily: once per local calendar day, after the `at` time (HH:MM).
 */
export function isDue(def: AgentDef, lastRunAt: number | undefined, now: number): boolean {
  const schedule = def.schedule
  if (!schedule || !isScheduled(def)) return false
  if (schedule.mode === 'interval') {
    const every = schedule.everyMinutes
    if (!every || every <= 0) return false
    return lastRunAt === undefined || now - lastRunAt >= every * 60_000
  }
  if (schedule.mode === 'daily') {
    const minutes = parseTime(schedule.at)
    if (minutes === null) return false
    const at = new Date(now)
    const due = new Date(now)
    due.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0)
    if (at < due) return false
    return lastRunAt === undefined || localDay(lastRunAt) !== localDay(now)
  }
  return false
}

/** `YYYY-MM-DD` in local time, used in titles and to compare days. */
export function localDay(ms: number): string {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function parseTime(value: string | undefined): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value ?? '')
  return match ? Number(match[1]) * 60 + Number(match[2]) : null
}

/**
 * Runs room agents (Scribe, Triager, Journal Keeper, Reading Curator, ...) on demand or on their schedule.
 * Each run asks the LLM for a short markdown note and files it in the Inbox with origin { room, agentId, kind: 'agent' },
 * so it flows through the normal ingest queue. Runs of the same agent never overlap.
 */
export class RoomAgentRunner {
  private readonly runs = new Map<AgentId, AgentRunRecord>()
  private readonly running = new Set<AgentId>()
  private timer: ReturnType<typeof setInterval> | null = null
  private ticking = false
  private loaded: Promise<void> | null = null
  private readonly now: () => number

  constructor(private readonly deps: RoomAgentDeps) {
    this.now = deps.now ?? Date.now
  }

  /** Begins the scheduler. Safe to call more than once. */
  async start(): Promise<void> {
    await this.load()
    this.reschedule()
  }

  /** Stops the scheduler. A run already in flight finishes on its own. */
  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  /** Call when the agent list or its schedules change. Restarts the tick loop so the new settings apply at once. */
  reschedule(): void {
    this.stop()
    this.timer = setInterval(() => void this.tick(), TICK_MS)
    this.timer.unref?.()
  }

  /** Last run and running state for each room agent. */
  async infos(): Promise<AgentRunInfo[]> {
    await this.load()
    return this.deps.getAgentDefs()
      .filter((def) => def.kind === 'room')
      .map((def) => ({ agentId: def.id, running: this.running.has(def.id), ...this.runs.get(def.id) }))
  }

  /** Runs one room agent now and files the result. Failures are returned, never thrown. */
  async runNow(agentId: AgentId, instruction?: string): Promise<AgentRunResult> {
    await this.load()
    const def = this.deps.getAgentDefs().find((a) => a.id === agentId)
    if (!def) return { ok: false, error: 'Unknown agent' }
    if (def.kind !== 'room') return { ok: false, error: `${def.name} does not run on its own` }
    if (this.running.has(agentId)) return { ok: false, error: `${def.name} is already working` }
    if (!this.deps.providerReady()) return this.finish(def, { ok: false, error: 'No AI provider is set up. Add one in Settings.' })
    if (!this.deps.canFile()) return this.finish(def, { ok: false, error: 'The knowledge folder is not available' })

    this.running.add(agentId)
    const ask = instruction?.trim().slice(0, 2000) || undefined
    this.deps.activity('system', `${def.name} started`, ask ?? def.role, agentId)
    try {
      const day = localDay(this.now())
      const pages = this.deps.wikiPages().filter((p) => p.room === def.room).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_CONTEXT_PAGES)
      const memory = (await this.deps.memory?.read(agentId).catch(() => '')) ?? ''
      const { title, markdown } = await this.deps.llm.structured({
        system: systemPrompt(def, memoryForPrompt(memory)),
        schema: AgentOutput,
        content: [
          text(
            section('date', day),
            section('recent_pages', pages.map((p) => ({ title: p.title, summary: p.summary }))),
            ...(ask ? [section('request', ask), 'The person asked for the request above: do it in this run\'s note.'] : []),
            'Write this run\'s note. Use only what is given above.'
          )
        ]
      })
      const cleanTitle = title.trim().slice(0, MAX_TITLE)
      const body = markdown.trim()
      if (!cleanTitle || !body) throw new Error('The agent returned an empty note')
      const fullTitle = `${def.name} – ${day}`
      await this.deps.addNote(`# ${fullTitle}\n\n${cleanTitle}\n\n${body}`, { room: def.room, agentId, kind: 'agent' })
      this.remember(def, `Run on ${day}${ask ? ` for the request: ${ask}` : ''}. Note: ${cleanTitle}\n${body.slice(0, 1500)}`)
      return this.finish(def, { ok: true, title: fullTitle })
    } catch (error) {
      return this.finish(def, { ok: false, error: errorMessage(error) })
    } finally {
      this.running.delete(agentId)
    }
  }

  /** Folds a run into the agent's memory in the background; never blocks or fails the run. */
  private remember(def: AgentDef, happened: string): void {
    const memory = this.deps.memory
    if (!memory || !this.deps.providerReady()) return
    memory
      .update(def.id, (current) => mergeMemory(this.deps.llm, def, current, happened))
      .catch((error) => this.deps.activity('error', `${def.name} memory not updated`, errorMessage(error), def.id))
  }

  /** One scheduler pass: runs every room agent that is due, one at a time. */
  private async tick(): Promise<void> {
    if (this.ticking) return
    this.ticking = true
    try {
      await this.load()
      const now = this.now()
      for (const def of this.deps.getAgentDefs()) {
        if (!isDue(def, this.runs.get(def.id)?.lastRunAt, now)) continue
        if (this.running.has(def.id)) continue
        if (!this.deps.providerReady()) {
          // Recorded as a run so the schedule moves on instead of retrying every minute.
          this.finish(def, { ok: false, error: 'Skipped: no AI provider is set up' })
          continue
        }
        await this.runNow(def.id)
      }
    } finally {
      this.ticking = false
    }
  }

  /** Stores the outcome, writes it to disk and records it in the activity feed. */
  private finish(def: AgentDef, result: AgentRunResult): AgentRunResult {
    const record: AgentRunRecord = { lastRunAt: this.now(), ok: result.ok, ...(result.title ? { title: result.title } : {}), ...(result.error ? { error: result.error } : {}) }
    this.runs.set(def.id, record)
    if (result.ok) this.deps.activity('system', `${def.name} filed a note`, result.title ?? def.role, def.id)
    else this.deps.activity('error', `${def.name} did not run`, result.error ?? 'Unknown error', def.id)
    void this.save()
    return result
  }

  private load(): Promise<void> {
    this.loaded ??= readFile(join(this.deps.dataDir, RUNS_FILE), 'utf8')
      .then((raw) => {
        const data = JSON.parse(raw) as Record<string, AgentRunRecord>
        for (const [id, record] of Object.entries(data)) {
          if (typeof record?.lastRunAt === 'number') this.runs.set(id, record)
        }
      })
      .catch(() => undefined)
    return this.loaded
  }

  private async save(): Promise<void> {
    const data = Object.fromEntries(this.runs)
    try {
      await writeFileAtomic(join(this.deps.dataDir, RUNS_FILE), `${JSON.stringify(data, null, 2)}\n`)
    } catch (error) {
      this.deps.activity('error', 'Agent run log not saved', errorMessage(error))
    }
  }
}

function systemPrompt(def: AgentDef, memory: string): string {
  return `You are ${def.name}, the ${def.role} in the ${def.room} room of Agent HQ, a team of AI agents that help the person.
${def.prompt ?? ''}
You are running on your schedule or when the person asked. You cannot take actions outside your note.
Reply with a short title and a markdown note. If the context has nothing for you to say, say so briefly in the note rather than inventing content.${memory ? `\n<memory>\nWhat you remember from earlier runs and conversations:\n${memory}\n</memory>` : ''}`
}
