// Contract between the main process (wiki engine), the preload bridge and the renderer.
// Everything the UI shows comes from AppSnapshot; the main process pushes a fresh snapshot on every change.

/** Ids of built-in agents are 'pip', 'sage', ...; user-defined agents can use any string id. */
export type AgentId = string

/** The part of the app an agent or source belongs to. */
export type RoomKind = 'brain' | 'office' | 'personal'

/** Where a source came from: a person, or an agent working in a room. */
export interface SourceOrigin {
  room: RoomKind
  agentId?: string
  kind: 'manual' | 'agent'
}

/** A configurable agent. Built-in defaults come from DEFAULT_AGENT_DEFS; the list is stored in settings.json. */
export interface AgentDef {
  id: AgentId
  name: string
  role: string
  room: RoomKind
  /** LLM job description used as the agent's system prompt when it chats */
  prompt?: string
  /** Idle text shown on the agent card when it has no work */
  idle?: string
  schedule?: { mode: 'off' | 'interval' | 'daily'; everyMinutes?: number; at?: string }
  enabled: boolean
  kind: 'pipeline' | 'room' | 'chief'
}

/** idle = waiting, working = running a step, thinking = waiting on the LLM, error = last step failed */
export type AgentState = 'idle' | 'working' | 'thinking' | 'error'

export interface AgentStatus {
  id: AgentId
  /** Display name, e.g. "Sage" */
  name: string
  /** Role label, e.g. "Reader" */
  role: string
  state: AgentState
  /** Short present-tense activity, e.g. "Summarizing docs" or "Waiting for mail" */
  activity: string
  updatedAt: number
}

export type ActivityKind =
  | 'ingest' | 'reader' | 'extractor' | 'linker' | 'muse' | 'janitor' | 'librarian' | 'ask' | 'system' | 'error'

export interface ActivityItem {
  id: string
  at: number
  kind: ActivityKind
  agent?: AgentId
  /** e.g. "Knowledge ingestion started" */
  title: string
  /** e.g. "karpathy.bearblog.dev/llm-wiki" */
  detail: string
}

export type TaskStatus = 'queued' | 'running' | 'done' | 'failed'

export interface TaskItem {
  id: string
  /** e.g. "Extract key concepts" */
  title: string
  agent: AgentId
  status: TaskStatus
  createdAt: number
  updatedAt: number
  sourceId?: string
  error?: string
}

export type SourceKind = 'pdf' | 'url' | 'text' | 'markdown' | 'note' | 'image' | 'other'
export type SourceStatus = 'queued' | 'processing' | 'ingested' | 'failed'

export interface SourceItem {
  id: string
  /** File name, URL or the first words of a note */
  name: string
  kind: SourceKind
  /** Absolute path of the copy inside raw/ */
  path: string
  addedAt: number
  status: SourceStatus
  size?: number
  /** Wiki page slugs created or updated from this source */
  pages?: string[]
  error?: string
  /** Who or what added the source. Defaults to { room: 'brain', kind: 'manual' } for older entries. */
  origin?: SourceOrigin
}

export interface WikiPageMeta {
  slug: string
  title: string
  path: string
  /** Room the page was written for, from the front matter */
  room?: RoomKind
  /** Slugs this page links to via [[wikilinks]] */
  links: string[]
  /** Source ids this page was built from */
  sources: string[]
  tags: string[]
  summary: string
  updatedAt: number
}

export interface GraphNode {
  id: string
  title: string
  degree: number
  sources: number
}

export interface GraphData {
  nodes: GraphNode[]
  edges: { source: string; target: string }[]
}

export interface Stats {
  /** Number of wiki pages */
  pages: number
  /** Number of distinct tags across wiki pages */
  topics: number
  /** Number of sources in raw/ */
  sources: number
}

export interface Contradiction {
  pages: string[]
  description: string
}

export interface JanitorReport {
  checkedAt: number | null
  running: boolean
  contradictions: Contradiction[]
  /** Slugs of pages that no other page links to */
  orphans: string[]
  /** Set when the contradiction check could not run (e.g. no API key) */
  note?: string
}

export interface SettingsView {
  knowledgeDir: string
  apiKeySet: boolean
  /** True when the selected provider can be used (key saved, or CLI/ACP command configured). */
  providerReady: boolean
  configuredProviders: ProviderId[]
  providerId: ProviderId
  baseUrl: string
  command: string
  args: string
  model: string
  userName: string
  rooms: Room[]
  currentRoomId: string
  agentDefs: AgentDef[]
}

export interface Room { id: string; name: string; knowledgeDir: string }

export type ProviderId = 'anthropic' | 'claude-code' | 'openai' | 'openrouter' | 'codex' | 'opencode' | 'antigravity' | 'kilocode' | 'acp'

export interface ModelOption {
  id: string
  name: string
}

export interface SettingsUpdate {
  knowledgeDir?: string
  /** Empty string clears the stored key */
  apiKey?: string
  providerId?: ProviderId
  baseUrl?: string
  command?: string
  args?: string
  model?: string
  userName?: string
  /** Replaces the whole agent list when given */
  agentDefs?: AgentDef[]
}

export interface AppSnapshot {
  settings: SettingsView
  stats: Stats
  agents: AgentStatus[]
  /** Newest first, capped at 200 */
  activity: ActivityItem[]
  /** Newest first, capped at 200 */
  tasks: TaskItem[]
  /** Newest first */
  sources: SourceItem[]
  graph: GraphData
  janitor: JanitorReport
  /** True when the engine is running and the knowledge folder is readable */
  online: boolean
}

/** Outcome of running a room agent once. */
export interface AgentRunResult {
  ok: boolean
  /** e.g. "Scribe – 2026-10-25" */
  title?: string
  error?: string
}

/** Last run of one room agent. */
export interface AgentRunInfo {
  agentId: AgentId
  running: boolean
  lastRunAt?: number
  ok?: boolean
  title?: string
  error?: string
}

export interface AskResult {
  answer: string
  /** Page slugs cited in the answer */
  citations: string[]
  error?: string
}

export interface ChatMessage {
  id: string
  from: 'user' | 'agent'
  text: string
  at: number
  /** `private` = sent to this agent alone, `broadcast` = sent to all agents at once */
  channel: 'private' | 'broadcast'
  /** True while replies are placeholders (the agents are pipeline stages, not chat partners yet) */
  simulated: boolean
}

/** One private exchange: what the user sent and the agent's reply. */
export interface ChatExchange {
  sent: ChatMessage
  reply: ChatMessage
}

export interface BroadcastDelivery {
  agent: AgentId
  status: 'delivered' | 'failed'
  error?: string
  /** The broadcast and the agent's reply, as they now appear in that agent's history. */
  sent?: ChatMessage
  reply?: ChatMessage
}

export interface BroadcastResult {
  at: number
  text: string
  /** One entry per agent, in the UI's order */
  deliveries: BroadcastDelivery[]
}

export interface WikiPageContent {
  slug: string
  title: string
  markdown: string
  meta: WikiPageMeta
}

export interface AgentHqApi {
  getSnapshot(): Promise<AppSnapshot>
  /** Subscribe to snapshot pushes. Returns an unsubscribe function. */
  onSnapshot(cb: (snapshot: AppSnapshot) => void): () => void

  addUrl(url: string, origin?: SourceOrigin): Promise<SourceItem>
  addFiles(paths: string[], origin?: SourceOrigin): Promise<SourceItem[]>
  addNote(text: string, origin?: SourceOrigin): Promise<SourceItem>
  /** Returns the absolute path of a File dropped onto the window (Electron webUtils). */
  pathForFile(file: File): string
  retrySource(id: string): Promise<void>

  ask(question: string): Promise<AskResult>
  /** Private message to one agent. Never reaches the other agents. */
  chatSend(agentId: AgentId, text: string): Promise<ChatExchange>
  /** Everything said to and by one agent (private messages and broadcasts), oldest first. */
  chatHistory(agentId: AgentId): Promise<ChatMessage[]>
  /** One message to all agents at once, with a delivery result per agent. */
  broadcastSend(text: string): Promise<BroadcastResult>
  runJanitor(): Promise<JanitorReport>
  /** Runs one room agent now (Scribe, Triager, ...) and files its note in the Inbox. */
  runAgent(agentId: AgentId, instruction?: string): Promise<AgentRunResult>
  /** The agent's memory (memory/<id>.md in the knowledge folder); '' when empty. */
  getAgentMemory(agentId: AgentId): Promise<string>
  /** Replaces the agent's memory; '' clears it. Resolves with the stored text. */
  setAgentMemory(agentId: AgentId, memory: string): Promise<string>
  /** Last run and running state of each room agent. */
  agentRuns(): Promise<AgentRunInfo[]>

  listPages(): Promise<WikiPageMeta[]>
  readPage(slug: string): Promise<WikiPageContent | null>

  getSettings(): Promise<SettingsView>
  listRooms(): Promise<Room[]>
  switchRoom(id: string): Promise<Room[]>
  addRoom(name: string): Promise<Room[]>
  renameRoom(id: string, name: string): Promise<Room[]>
  saveSettings(update: SettingsUpdate): Promise<SettingsView>
  listModels(): Promise<ModelOption[]>
  openClaudeLogin(): Promise<void>
  chooseKnowledgeDir(): Promise<string | null>
  openPath(path: string): Promise<void>

  window: {
    platform: NodeJS.Platform
    minimize(): void
    toggleMaximize(): void
    close(): void
  }
}

/** IPC channel names, shared by main and preload. */
export const IPC = {
  getSnapshot: 'hq:getSnapshot',
  snapshot: 'hq:snapshot',
  addUrl: 'hq:addUrl',
  addFiles: 'hq:addFiles',
  addNote: 'hq:addNote',
  retrySource: 'hq:retrySource',
  ask: 'hq:ask',
  chatSend: 'chat:send',
  chatHistory: 'chat:history',
  broadcastSend: 'broadcast:send',
  runJanitor: 'hq:runJanitor',
  agentRun: 'hq:agent-run',
  agentRuns: 'hq:agent-runs',
  getAgentMemory: 'hq:agent-memory:get',
  setAgentMemory: 'hq:agent-memory:set',
  listPages: 'hq:listPages',
  readPage: 'hq:readPage',
  getSettings: 'hq:getSettings',
  saveSettings: 'hq:saveSettings',
  listRooms: 'hq:listRooms', switchRoom: 'hq:switchRoom', addRoom: 'hq:addRoom', renameRoom: 'hq:renameRoom',
  listModels: 'hq:listModels',
  openClaudeLogin: 'hq:openClaudeLogin',
  chooseKnowledgeDir: 'hq:chooseKnowledgeDir',
  openPath: 'hq:openPath',
  winMinimize: 'hq:win:minimize',
  winToggleMaximize: 'hq:win:toggleMaximize',
  winClose: 'hq:win:close'
} as const

const BRAIN_PIPELINE: AgentDef[] = [
  {
    id: 'pip', name: 'Pip', role: 'Mail Clerk', room: 'brain', kind: 'pipeline', enabled: true, idle: 'Waiting for mail',
    prompt: 'You receive new sources (files, links, notes) and sort them into the inbox, then pass them to Sage.'
  },
  {
    id: 'sage', name: 'Sage', role: 'Reader', room: 'brain', kind: 'pipeline', enabled: true, idle: 'Waiting for sources',
    prompt: 'You read each source and write a summary with its key points.'
  },
  {
    id: 'rex', name: 'Rex', role: 'Extractor', room: 'brain', kind: 'pipeline', enabled: true, idle: 'Waiting for text',
    prompt: 'You extract claims, concepts and tags from what Sage has read.'
  },
  {
    id: 'nova', name: 'Nova', role: 'Linker', room: 'brain', kind: 'pipeline', enabled: true, idle: 'Watching the graph',
    prompt: 'You decide which wiki pages to write or update and link related pages with [[wikilinks]].'
  },
  {
    id: 'axel', name: 'Axel', role: 'Janitor', room: 'brain', kind: 'pipeline', enabled: true, idle: 'Patrolling the wiki',
    prompt: 'You check the wiki for contradictions and orphan pages.'
  },
  {
    id: 'muse', name: 'Muse', role: 'Librarian', room: 'brain', kind: 'pipeline', enabled: true, idle: 'Tidying the shelves',
    prompt: 'You are the librarian: you answer questions from the wiki pages and cite them.'
  }
]

const OFF_DAILY = { mode: 'off' as const, at: '09:00' }

/** Agents shipped with the app. Schedules are off by default so nothing runs unexpectedly. */
export const DEFAULT_AGENT_DEFS: AgentDef[] = [
  ...BRAIN_PIPELINE,
  {
    id: 'chief', name: 'Chief', role: 'Chief of Staff', room: 'brain', kind: 'chief', enabled: true, idle: 'Keeping the team on track',
    prompt: 'You coordinate the other agents in the brain: you explain what the team is doing and point the person to the right agent.'
  },
  {
    id: 'scribe', name: 'Scribe', role: 'Meeting Scribe', room: 'office', kind: 'room', enabled: true, idle: 'Waiting for meeting notes',
    prompt: 'You turn meeting notes and transcripts into a short record: attendees, decisions, action items with owners, and open questions. Write only what the notes say.',
    schedule: { ...OFF_DAILY }
  },
  {
    id: 'triager', name: 'Triager', role: 'Task Triager', room: 'office', kind: 'room', enabled: true, idle: 'Waiting for tasks',
    prompt: 'You review the open tasks and messages for the office and suggest a priority order, what can wait, and what needs a decision from the person. Keep it brief.',
    schedule: { ...OFF_DAILY }
  },
  {
    id: 'journal', name: 'Journal Keeper', role: 'Journal Keeper', room: 'personal', kind: 'room', enabled: true, idle: 'Waiting for entries',
    prompt: 'You keep the personal journal: you summarise the day from the entries you are given, note mood and recurring themes, and list follow-ups the person wrote down. Do not add anything they did not write.',
    schedule: { ...OFF_DAILY }
  },
  {
    id: 'curator', name: 'Reading Curator', role: 'Reading Curator', room: 'personal', kind: 'room', enabled: true, idle: 'Waiting for reading',
    prompt: 'You curate the personal reading list: you group saved articles by theme, suggest what to read next, and flag duplicates. Only recommend items that are in the list you are given.',
    schedule: { ...OFF_DAILY }
  }
]

/** The six brain pipeline agents, in the order the UI lists them. Derived from the defaults. */
export const AGENTS: { id: AgentId; name: string; role: string; idle: string }[] = DEFAULT_AGENT_DEFS
  .filter((def) => def.kind === 'pipeline')
  .map((def) => ({ id: def.id, name: def.name, role: def.role, idle: def.idle ?? '' }))
