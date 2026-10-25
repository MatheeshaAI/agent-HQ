import { randomUUID } from 'node:crypto'
import {
  type ActivityItem,
  type ActivityKind,
  type AgentDef,
  type AgentId,
  type AgentState,
  type AgentStatus,
  type AppSnapshot,
  type GraphData,
  type JanitorReport,
  type SettingsView,
  type SourceItem,
  type Stats,
  type TaskItem,
  type TaskStatus
} from '@shared/types'

const FEED_LIMIT = 200
const PUSH_INTERVAL_MS = 100

export const EMPTY_JANITOR: JanitorReport = { checkedAt: null, running: false, contradictions: [], orphans: [] }

/** One piece of work an agent is doing. The agent shows its newest unfinished job. */
export interface AgentJob {
  set(state: Exclude<AgentState, 'idle' | 'error'>, activity: string): void
  done(): void
  fail(message: string): void
}

interface AgentSlot {
  status: AgentStatus
  jobs: { state: AgentState; activity: string }[]
  idleText: string
  /** Pipeline agents are the ones the office UI draws; other agents keep a slot but are not in the snapshot. */
  pipeline: boolean
}

/**
 * The in-memory AppSnapshot plus the operations that change it. Every change schedules a push
 * to the renderer; pushes are throttled to one per 100 ms and always carry the latest state.
 */
export class EngineState {
  private readonly agents = new Map<AgentId, AgentSlot>()
  private activity: ActivityItem[] = []
  private tasks: TaskItem[] = []
  private sources: SourceItem[] = []
  private stats: Stats = { pages: 0, topics: 0, sources: 0 }
  private graph: GraphData = { nodes: [], edges: [] }
  private janitor: JanitorReport = EMPTY_JANITOR
  private online = false
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor(
    private settings: SettingsView,
    private readonly push: (snapshot: AppSnapshot) => void,
    private readonly now: () => number = Date.now
  ) {
    this.syncAgents(settings.agentDefs)
  }

  /** Creates slots for new definitions and refreshes names and idle text of existing ones. Job state is kept. */
  syncAgents(defs: AgentDef[]): void {
    for (const def of defs) {
      const idle = def.idle ?? 'Ready for work'
      const slot = this.agents.get(def.id)
      if (slot) {
        slot.status = { ...slot.status, name: def.name, role: def.role, activity: slot.jobs.length > 0 ? slot.status.activity : idle }
        slot.idleText = idle
        slot.pipeline = def.kind === 'pipeline'
        continue
      }
      this.agents.set(def.id, this.newSlot(def.id, def.name, def.role, idle, def.kind === 'pipeline'))
    }
  }

  snapshot(): AppSnapshot {
    return {
      settings: { ...this.settings },
      stats: { ...this.stats },
      agents: [...this.agents.values()].filter((slot) => slot.pipeline).map((slot) => ({ ...slot.status })),
      activity: [...this.activity],
      tasks: this.tasks.map((t) => ({ ...t })),
      sources: this.sources.map((s) => (s.pages ? { ...s, pages: [...s.pages] } : { ...s })),
      graph: { nodes: [...this.graph.nodes], edges: [...this.graph.edges] },
      janitor: { ...this.janitor, contradictions: [...this.janitor.contradictions], orphans: [...this.janitor.orphans] },
      online: this.online
    }
  }

  /** Starts a job for an agent; the agent leaves any error state. */
  beginJob(id: AgentId, state: Exclude<AgentState, 'idle' | 'error'>, activity: string): AgentJob {
    const slot = this.slot(id)
    const job = { state: state as AgentState, activity }
    slot.jobs.push(job)
    this.showAgent(id)
    let finished = false
    const finish = (error?: string): void => {
      if (finished) return
      finished = true
      slot.jobs.splice(slot.jobs.indexOf(job), 1)
      this.showAgent(id, error)
    }
    return {
      set: (nextState, nextActivity) => {
        if (finished) return
        job.state = nextState
        job.activity = nextActivity
        this.showAgent(id)
      },
      done: () => finish(),
      fail: (message) => finish(message)
    }
  }

  addActivity(kind: ActivityKind, title: string, detail: string, agent?: AgentId): void {
    const item: ActivityItem = { id: randomUUID(), at: this.now(), kind, title, detail }
    if (agent) item.agent = agent
    this.activity = [item, ...this.activity].slice(0, FEED_LIMIT)
    this.changed()
  }

  addTask(title: string, agent: AgentId, sourceId?: string): TaskItem {
    const at = this.now()
    const task: TaskItem = { id: randomUUID(), title, agent, status: 'queued', createdAt: at, updatedAt: at }
    if (sourceId) task.sourceId = sourceId
    this.tasks = trimTasks([task, ...this.tasks])
    this.changed()
    return task
  }

  setTaskStatus(id: string, status: TaskStatus, error?: string): void {
    this.tasks = this.tasks.map((task) => {
      if (task.id !== id) return task
      const next: TaskItem = { ...task, status, updatedAt: this.now() }
      if (error) next.error = error
      else delete next.error
      return next
    })
    this.changed()
  }

  removeTasks(ids: string[]): void {
    const remove = new Set(ids)
    this.tasks = this.tasks.filter((task) => !remove.has(task.id))
    this.changed()
  }

  /** Removes those of `ids` that never started, e.g. the steps after a failed one. */
  removeQueuedTasks(ids: string[]): void {
    const remove = new Set(ids)
    this.tasks = this.tasks.filter((task) => !(remove.has(task.id) && task.status === 'queued'))
    this.changed()
  }

  setSources(sources: SourceItem[]): void {
    this.sources = sources
    this.changed()
  }

  setWiki(stats: Stats, graph: GraphData): void {
    this.stats = stats
    this.graph = graph
    this.changed()
  }

  getJanitor(): JanitorReport {
    return { ...this.janitor }
  }

  setJanitor(report: JanitorReport): void {
    this.janitor = report
    this.changed()
  }

  setSettings(settings: SettingsView): void {
    this.settings = settings
    this.syncAgents(settings.agentDefs)
    this.changed()
  }

  setOnline(online: boolean): void {
    if (this.online === online) return
    this.online = online
    this.changed()
  }

  /** Clears the session's tasks, used when another knowledge folder is opened. */
  resetSession(): void {
    this.tasks = []
    this.changed()
  }

  /** Sends any pending push right away (used on shutdown and in tests). */
  flush(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    this.push(this.snapshot())
  }

  private changed(): void {
    if (this.timer) return
    this.timer = setTimeout(() => {
      this.timer = null
      this.push(this.snapshot())
    }, PUSH_INTERVAL_MS)
  }

  /** The agent's slot. An id without a definition gets a generic slot the first time it is used. */
  private slot(id: AgentId): AgentSlot {
    const existing = this.agents.get(id)
    if (existing) return existing
    const slot = this.newSlot(id, id.charAt(0).toUpperCase() + id.slice(1), 'Agent', 'Ready for work', false)
    this.agents.set(id, slot)
    return slot
  }

  private newSlot(id: AgentId, name: string, role: string, idle: string, pipeline: boolean): AgentSlot {
    return {
      status: { id, name, role, state: 'idle', activity: idle, updatedAt: this.now() },
      jobs: [],
      idleText: idle,
      pipeline
    }
  }

  private showAgent(id: AgentId, error?: string): void {
    const slot = this.slot(id)
    const current = slot.jobs[slot.jobs.length - 1]
    let state: AgentState
    let activity: string
    if (current) [state, activity] = [current.state, current.activity]
    else if (error) [state, activity] = ['error', error]
    else [state, activity] = ['idle', slot.idleText]
    slot.status = { ...slot.status, state, activity, updatedAt: this.now() }
    this.changed()
  }
}

/** Keeps the newest 200 tasks, dropping finished ones before anything still queued or running. */
function trimTasks(tasks: TaskItem[]): TaskItem[] {
  if (tasks.length <= FEED_LIMIT) return tasks
  const excess = tasks.length - FEED_LIMIT
  const finished = new Set(
    tasks
      .filter((t) => t.status === 'done' || t.status === 'failed')
      .sort((a, b) => a.updatedAt - b.updatedAt)
      .slice(0, excess)
      .map((t) => t.id)
  )
  return tasks.filter((t) => !finished.has(t.id)).slice(0, FEED_LIMIT)
}
