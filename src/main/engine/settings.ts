import { readFile } from 'node:fs/promises'
import { isAbsolute, join, resolve } from 'node:path'
import type { SettingsUpdate, SettingsView } from '@shared/types'
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
  knowledgeDir?: string
  model?: string
  userName?: string
  apiKey?: StoredKey
}

export interface SettingsDefaults {
  knowledgeDir: string
  /** Used when no key is saved, e.g. process.env.ANTHROPIC_API_KEY */
  envApiKey?: string
}

export interface SaveResult {
  view: SettingsView
  knowledgeDirChanged: boolean
  apiKeyChanged: boolean
  /** True when a key had to be stored without encryption */
  storedPlain: boolean
}

/** settings.json in the data folder. The API key never leaves this module except to the LLM layer. */
export class SettingsStore {
  private data: SettingsFile = {}
  private apiKey: string | null = null

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
    this.apiKey = null
    const stored = this.data.apiKey
    if (!stored?.value) return null
    if (!stored.encrypted) {
      this.apiKey = stored.value
      return null
    }
    try {
      this.apiKey = this.codec.decrypt(stored.value)
      return null
    } catch {
      return 'The saved Claude API key could not be decrypted on this computer; add it again in Settings'
    }
  }

  view(): SettingsView {
    return {
      knowledgeDir: this.knowledgeDir(),
      apiKeySet: this.resolvedApiKey() !== null,
      model: this.model(),
      userName: this.data.userName?.trim() || DEFAULT_USER_NAME
    }
  }

  knowledgeDir(): string {
    return this.data.knowledgeDir || this.defaults.knowledgeDir
  }

  model(): string {
    return this.data.model?.trim() || DEFAULT_MODEL
  }

  /** The saved key, or the environment's key when none is saved. */
  resolvedApiKey(): string | null {
    return this.apiKey || this.defaults.envApiKey?.trim() || null
  }

  async save(update: SettingsUpdate): Promise<SaveResult> {
    const previousDir = this.knowledgeDir()
    let apiKeyChanged = false
    let storedPlain = false

    if (update.knowledgeDir !== undefined) {
      const dir = update.knowledgeDir.trim()
      if (dir && !isAbsolute(dir)) throw new Error('The knowledge folder must be an absolute path')
      this.data.knowledgeDir = dir ? resolve(dir) : undefined
    }
    if (update.model !== undefined) this.data.model = update.model.trim() || undefined
    if (update.userName !== undefined) this.data.userName = update.userName.trim() || undefined
    if (update.apiKey !== undefined) {
      const key = update.apiKey.trim()
      apiKeyChanged = key !== (this.apiKey ?? '')
      this.apiKey = key || null
      if (!key) delete this.data.apiKey
      else if (this.codec.available()) this.data.apiKey = { encrypted: true, value: this.codec.encrypt(key) }
      else {
        this.data.apiKey = { encrypted: false, value: key }
        storedPlain = true
      }
    }

    await writeFileAtomic(this.path, `${JSON.stringify(this.data, null, 2)}\n`)
    return { view: this.view(), knowledgeDirChanged: this.knowledgeDir() !== previousDir, apiKeyChanged, storedPlain }
  }
}
