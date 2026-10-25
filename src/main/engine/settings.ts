import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { basename, isAbsolute, join, resolve } from 'node:path'
import { DEFAULT_AGENT_DEFS, type AgentDef, type ProviderId, type Room, type RoomKind, type SettingsUpdate, type SettingsView } from '@shared/types'
import { writeFileAtomic } from './util/fsx'

const DEFAULT_MODEL = 'claude-opus-5-5'
const DEFAULT_USER_NAME = 'Matheesha Sarathchandra'
const ROOM_KINDS: RoomKind[] = ['brain', 'office', 'personal']
const AGENT_KINDS: AgentDef['kind'][] = ['pipeline', 'room', 'chief']
const ID_PATTERN = /^[a-z][a-z0-9-]{0,39}$/

/** Parses one agent definition; returns null when it is not usable. */
export function parseAgentDef(value: unknown): AgentDef | null {
  if (typeof value !== 'object' || value === null) return null
  const v = value as Record<string, unknown>
  if (typeof v.id !== 'string' || !ID_PATTERN.test(v.id)) return null
  if (typeof v.name !== 'string' || !v.name.trim()) return null
  if (typeof v.role !== 'string') return null
  if (!ROOM_KINDS.includes(v.room as RoomKind)) return null
  if (!AGENT_KINDS.includes(v.kind as AgentDef['kind'])) return null
  const def: AgentDef = {
    id: v.id,
    name: v.name.trim(),
    role: v.role.trim(),
    room: v.room as RoomKind,
    kind: v.kind as AgentDef['kind'],
    enabled: v.enabled !== false
  }
  if (typeof v.prompt === 'string' && v.prompt.trim()) def.prompt = v.prompt
  if (typeof v.idle === 'string') def.idle = v.idle
  if (typeof v.schedule === 'object' && v.schedule !== null) {
    const s = v.schedule as Record<string, unknown>
    const mode = s.mode === 'interval' || s.mode === 'daily' ? s.mode : 'off'
    def.schedule = { mode }
    if (typeof s.everyMinutes === 'number' && s.everyMinutes > 0) def.schedule.everyMinutes = s.everyMinutes
    if (typeof s.at === 'string') def.schedule.at = s.at
  }
  return def
}

/**
 * Strict parse for updates from the renderer: every entry must be valid and ids must be unique.
 * Throws with the first problem found.
 */
export function parseAgentDefList(value: unknown): AgentDef[] {
  if (!Array.isArray(value)) throw new Error('Expected a list of agents')
  const seen = new Set<string>()
  return value.map((item) => {
    const def = parseAgentDef(item)
    if (!def) throw new Error('An agent has an invalid id, name, room or kind')
    if (seen.has(def.id)) throw new Error(`Two agents use the id "${def.id}"`)
    seen.add(def.id)
    return def
  })
}

/**
 * Keeps the stored agents (user edits win), drops unusable entries, and adds any default agent
 * whose id is not stored yet.
 */
export function mergeAgentDefs(stored: unknown): AgentDef[] {
  const merged: AgentDef[] = []
  const seen = new Set<string>()
  if (Array.isArray(stored)) {
    for (const item of stored) {
      const def = parseAgentDef(item)
      if (!def || seen.has(def.id)) continue
      seen.add(def.id)
      merged.push(def)
    }
  }
  for (const fallback of DEFAULT_AGENT_DEFS) {
    if (seen.has(fallback.id)) continue
    seen.add(fallback.id)
    merged.push(structuredClone(fallback))
  }
  return merged
}

/** Encrypts secrets at rest; in the app this is Electron's safeStorage. */
export interface SecretCodec {
  available(): boolean
  encrypt(plain: string): string
  decrypt(encoded: string): string
}

interface StoredKey {
  encrypted: boolean
  value: string
}

interface SettingsFile {
  rooms?: Room[]
  currentRoomId?: string
  agentDefs?: AgentDef[]
  knowledgeDir?: string
  model?: string
  userName?: string
  apiKey?: StoredKey
  apiKeys?: Partial<Record<ProviderId, StoredKey>>
  providerId?: ProviderId
  baseUrl?: string
  command?: string
  args?: string
}

export interface SettingsDefaults {
  knowledgeDir: string
  documentsDir?: string
  /** Used when no key is saved, e.g. process.env.ANTHROPIC_API_KEY */
  envApiKey?: string
}

export interface SaveResult {
  view: SettingsView
  knowledgeDirChanged: boolean
  apiKeyChanged: boolean
  providerChanged: boolean
  /** True when a key had to be stored without encryption */
  storedPlain: boolean
}

/** settings.json in the data folder. The API key never leaves this module except to the LLM layer. */
export class SettingsStore {
  private data: SettingsFile = {}
  private apiKeys: Partial<Record<ProviderId, string>> = {}

  constructor(
    private readonly dataDir: string,
    private readonly defaults: SettingsDefaults,
    private readonly codec: SecretCodec
  ) {}

  private get path(): string {
    return join(this.dataDir, 'settings.json')
  }

  /** Loads settings; returns a warning when a stored key could not be decrypted. */
  async load(): Promise<string | null> {
    try {
      this.data = JSON.parse(await readFile(this.path, 'utf8')) as SettingsFile
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error(`settings.json could not be read: ${(error as Error).message}`)
      this.data = {}
    }
    this.apiKeys = {}
    if (!this.data.rooms?.length) {
      const id = 'work'
      this.data.rooms = [{ id, name: 'Work', knowledgeDir: this.data.knowledgeDir || this.defaults.knowledgeDir }]
      this.data.currentRoomId = id
    }
    if (!this.data.rooms.some((room) => room.id === this.data.currentRoomId)) this.data.currentRoomId = this.data.rooms[0].id
    this.data.knowledgeDir = this.currentRoom().knowledgeDir
    this.data.agentDefs = mergeAgentDefs(this.data.agentDefs)
    await writeFileAtomic(this.path, `${JSON.stringify(this.data, null, 2)}\n`)
    const storedKeys = { ...(this.data.apiKeys ?? {}) }
    if (this.data.apiKey?.value && !storedKeys.anthropic) storedKeys.anthropic = this.data.apiKey
    this.data.apiKeys = storedKeys
    for (const [provider, stored] of Object.entries(storedKeys) as Array<[ProviderId, StoredKey]>) {
      if (!stored?.value) continue
      try {
        this.apiKeys[provider] = stored.encrypted ? this.codec.decrypt(stored.value) : stored.value
      } catch {
        return `The saved ${provider} credential could not be decrypted on this computer; add it again in Settings`
      }
    }
    return null
  }

  view(): SettingsView {
    return {
      knowledgeDir: this.knowledgeDir(),
      apiKeySet: this.resolvedApiKey() !== null,
      providerReady: this.providerReady(),
      configuredProviders: [...new Set<ProviderId>([
        ...(Object.keys(this.apiKeys) as ProviderId[]),
        ...(this.defaults.envApiKey?.trim() ? ['anthropic' as const] : [])
      ])],
      providerId: this.data.providerId ?? 'anthropic',
      baseUrl: this.data.baseUrl ?? '',
      command: this.data.command ?? '',
      args: this.data.args ?? '',
      model: this.model(),
      userName: this.data.userName?.trim() || DEFAULT_USER_NAME,
      rooms: this.data.rooms ?? [], currentRoomId: this.data.currentRoomId ?? 'work',
      agentDefs: this.agentDefs()
    }
  }

  /** Copies of the agent definitions, in stored order. */
  agentDefs(): AgentDef[] {
    return (this.data.agentDefs ?? []).map((def) => structuredClone(def))
  }

  knowledgeDir(): string {
    return this.currentRoom().knowledgeDir
  }

  private currentRoom(): Room {
    return this.data.rooms?.find((room) => room.id === this.data.currentRoomId) ??
      this.data.rooms?.[0] ??
      { id: 'work', name: 'Work', knowledgeDir: this.data.knowledgeDir || this.defaults.knowledgeDir }
  }

  listRooms(): Room[] {
    return (this.data.rooms ?? []).map((room) => ({ ...room }))
  }

  async switchRoom(id: string): Promise<boolean> {
    const room = this.data.rooms?.find((item) => item.id === id)
    if (!room) throw new Error('Room not found')
    const changed = this.knowledgeDir() !== room.knowledgeDir
    this.data.currentRoomId = id
    this.data.knowledgeDir = room.knowledgeDir
    await writeFileAtomic(this.path, `${JSON.stringify(this.data, null, 2)}\n`)
    return changed
  }
  async addRoom(name: string): Promise<Room[]> {
    const clean = name.trim()
    if (!clean) throw new Error('Room name is required')

    this.data.rooms ??= []
    if (this.data.rooms.some((room) => room.name.toLowerCase() === clean.toLowerCase())) {
      throw new Error(`A room named "${clean}" already exists`)
    }

    const baseName = sanitizeFolderName(clean) || 'Room'
    const parentDir = this.defaults.documentsDir ?? this.defaults.knowledgeDir
    let folderName = baseName
    let suffix = 2
    while (this.data.rooms.some((room) =>
      basename(resolve(room.knowledgeDir)).toLowerCase() === `agent hq knowledge - ${folderName}`.toLowerCase()
    )) {
      const marker = ` (${suffix++})`
      folderName = `${baseName.slice(0, 60 - marker.length).trimEnd()}${marker}`
    }

    const id = randomUUID()
    this.data.rooms.push({
      id,
      name: clean,
      knowledgeDir: resolve(join(parentDir, `Agent HQ Knowledge - ${folderName}`))
    })
    await writeFileAtomic(this.path, `${JSON.stringify(this.data, null, 2)}\n`)
    return this.listRooms()
  }

  async renameRoom(id: string, name: string): Promise<Room[]> {
    const room = this.data.rooms?.find((item) => item.id === id)
    if (!room) throw new Error('Room not found')
    const clean = name.trim()
    if (!clean) throw new Error('Room name is required')
    room.name = clean
    await writeFileAtomic(this.path, `${JSON.stringify(this.data, null, 2)}\n`)
    return this.listRooms()
  }

  model(): string {
    return this.data.model?.trim() || DEFAULT_MODEL
  }

  /** The saved key, or the environment's key when none is saved. */
  resolvedApiKey(): string | null {
    return this.apiKeys[this.providerId()] || (this.providerId() === 'anthropic' ? this.defaults.envApiKey?.trim() : undefined) || null
  }

  /** True when the selected provider is usable: a key for key-based providers, or a command for CLI/ACP agents. */
  providerReady(): boolean {
    const provider = this.providerId()
    if (provider === 'claude-code') return true
    if (provider === 'codex' || provider === 'opencode' || provider === 'antigravity' || provider === 'kilocode' || provider === 'acp') return Boolean(this.data.command?.trim())
    return this.resolvedApiKey() !== null
  }

  private providerId(): ProviderId { return this.data.providerId ?? 'anthropic' }

  async save(update: SettingsUpdate): Promise<SaveResult> {
    const previousDir = this.knowledgeDir()
    const previousProviderConfig = [this.data.providerId ?? 'anthropic', this.data.baseUrl ?? '', this.data.command ?? '', this.data.args ?? '', this.data.model ?? ''].join('\0')
    let apiKeyChanged = false
    let storedPlain = false

    if (update.knowledgeDir !== undefined) {
      const dir = update.knowledgeDir.trim()
      if (dir && !isAbsolute(dir)) throw new Error('The knowledge folder must be an absolute path')
      this.data.knowledgeDir = dir ? resolve(dir) : undefined
      const active = this.data.rooms?.find((room) => room.id === this.data.currentRoomId)
      if (active) active.knowledgeDir = this.data.knowledgeDir || this.defaults.knowledgeDir
    }
    if (update.model !== undefined) this.data.model = update.model.trim() || undefined
    if (update.providerId !== undefined) this.data.providerId = update.providerId
    if (update.baseUrl !== undefined) this.data.baseUrl = update.baseUrl.trim() || undefined
    if (update.command !== undefined) this.data.command = update.command.trim() || undefined
    if (update.args !== undefined) this.data.args = update.args.trim() || undefined
    if (update.userName !== undefined) this.data.userName = update.userName.trim() || undefined
    if (update.agentDefs !== undefined) this.data.agentDefs = parseAgentDefList(update.agentDefs)
    if (update.apiKey !== undefined) {
      const key = update.apiKey.trim()
      const provider = this.providerId()
      apiKeyChanged = key !== (this.apiKeys[provider] ?? '')
      if (key) this.apiKeys[provider] = key
      else delete this.apiKeys[provider]
      this.data.apiKeys = { ...this.data.apiKeys }
      if (!key) delete this.data.apiKeys[provider]
      else if (this.codec.available()) this.data.apiKeys[provider] = { encrypted: true, value: this.codec.encrypt(key) }
      else {
        this.data.apiKeys[provider] = { encrypted: false, value: key }
        storedPlain = true
      }
      delete this.data.apiKey
    }

    await writeFileAtomic(this.path, `${JSON.stringify(this.data, null, 2)}\n`)
    const providerConfig = [this.data.providerId ?? 'anthropic', this.data.baseUrl ?? '', this.data.command ?? '', this.data.args ?? '', this.data.model ?? ''].join('\0')
    return { view: this.view(), knowledgeDirChanged: this.knowledgeDir() !== previousDir, apiKeyChanged, providerChanged: providerConfig !== previousProviderConfig, storedPlain }
  }
}

function sanitizeFolderName(name: string): string {
  return name
    .replace(/[\\/]/g, '')
    .replace(/\.\./g, '')
    .replace(/[:*?"<>|]/g, '')
    .trim()
    .replace(/^[. ]+|[. ]+$/g, '')
    .slice(0, 60)
    .replace(/[. ]+$/g, '')
}
