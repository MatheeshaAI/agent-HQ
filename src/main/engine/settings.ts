import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { basename, isAbsolute, join, resolve } from 'node:path'
import type { ProviderId, Room, SettingsUpdate, SettingsView } from '@shared/types'
import { writeFileAtomic } from './util/fsx'

const DEFAULT_MODEL = 'claude-opus-5-5'
const DEFAULT_USER_NAME = 'Matheesha Sarathchandra'

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
      rooms: this.data.rooms ?? [], currentRoomId: this.data.currentRoomId ?? 'work'
    }
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
