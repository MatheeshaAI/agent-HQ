// Contract between the main process (wiki engine), the preload bridge and the renderer.
// Everything the UI shows comes from AppSnapshot; the main process pushes a fresh snapshot on every change.

export type AgentId = 'pip' | 'sage' | 'rex' | 'nova' | 'axel' | 'muse'

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
}

export interface WikiPageMeta {
  slug: string
  title: string
  path: string
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

  addUrl(url: string): Promise<SourceItem>
  addFiles(paths: string[]): Promise<SourceItem[]>
  addNote(text: string): Promise<SourceItem>
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

/** The six agents, in the order the UI lists them. */
export const AGENTS: { id: AgentId; name: string; role: string; idle: string }[] = [
  { id: 'pip', name: 'Pip', role: 'Mail Clerk', idle: 'Waiting for mail' },
  { id: 'sage', name: 'Sage', role: 'Reader', idle: 'Waiting for sources' },
  { id: 'rex', name: 'Rex', role: 'Extractor', idle: 'Waiting for text' },
  { id: 'nova', name: 'Nova', role: 'Linker', idle: 'Watching the graph' },
  { id: 'axel', name: 'Axel', role: 'Janitor', idle: 'Patrolling the wiki' },
  { id: 'muse', name: 'Muse', role: 'Librarian', idle: 'Tidying the shelves' }
]
