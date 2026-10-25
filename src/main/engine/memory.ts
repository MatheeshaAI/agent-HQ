import { appendFile, mkdir, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { z } from 'zod/v4'
import type { AgentDef, AgentId, ChatMessage } from '@shared/types'
import type { Llm } from './llm/claude'
import { section, text } from './steps/common'
import { writeFileAtomic } from './util/fsx'
import { Serial } from './util/serial'

/** Folder (inside the knowledge folder) for agent memory. Not under raw/ or wiki/, so never ingested or watched. */
export const MEMORY_DIR = 'memory'
/** Longest memory file kept after a merge, and the most of it put in a prompt. */
export const MAX_MEMORY_CHARS = 4000
/** Chat messages loaded back per agent. */
export const MAX_CHAT_MESSAGES = 200

/** A file-system-safe name for an agent id. */
export function memoryFileName(agentId: AgentId): string {
  const safe = agentId.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '')
  return safe || 'agent'
}

/** Memory text as it goes into a system prompt: trimmed and capped, or '' when empty. */
export function memoryForPrompt(memory: string, max = MAX_MEMORY_CHARS): string {
  const body = memory.trim()
  if (!body) return ''
  return body.length > max ? `${body.slice(0, max).trimEnd()}\n…` : body
}

/** Keeps the end of an over-long memory on whole lines, so a merge can never grow it without bound. */
export function capMemory(memory: string, max = MAX_MEMORY_CHARS): string {
  const body = memory.trim()
  if (body.length <= max) return body
  const lines = body.split('\n')
  while (lines.length > 1 && lines.join('\n').length > max) lines.shift()
  const kept = lines.join('\n')
  return kept.length > max ? kept.slice(0, max) : kept
}

/** Parses a JSONL transcript, skipping broken lines, keeping the last `max` messages. */
export function parseTranscript(raw: string, max = MAX_CHAT_MESSAGES): ChatMessage[] {
  const messages: ChatMessage[] = []
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue
    try {
      const m = JSON.parse(line) as Partial<ChatMessage>
      if (typeof m.id === 'string' && typeof m.text === 'string' && (m.from === 'user' || m.from === 'agent') && typeof m.at === 'number') {
        messages.push({ id: m.id, from: m.from, text: m.text, at: m.at, channel: m.channel === 'broadcast' ? 'broadcast' : 'private', simulated: false })
      }
    } catch {
      // A half-written last line after a crash is skipped.
    }
  }
  return messages.slice(-max)
}

/**
 * Per-agent memory and chat transcripts, stored in the open knowledge folder:
 *   memory/<agentId>.md           what the agent remembers (markdown, editable by the person)
 *   memory/chats/<agentId>.jsonl  every chat message, one JSON object per line
 * `root` is read on every call, so a knowledge folder switch takes effect at once. Without a folder,
 * reads return nothing and writes are skipped.
 */
export class AgentMemoryStore {
  private readonly locks = new Map<string, Serial>()

  constructor(private readonly root: () => string | null) {}

  private dir(): string | null {
    const root = this.root()
    return root ? join(root, MEMORY_DIR) : null
  }

  private lock(key: string): Serial {
    let lock = this.locks.get(key)
    if (!lock) this.locks.set(key, (lock = new Serial()))
    return lock
  }

  async read(agentId: AgentId): Promise<string> {
    const dir = this.dir()
    if (!dir) return ''
    return readFile(join(dir, `${memoryFileName(agentId)}.md`), 'utf8').catch(() => '')
  }

  async write(agentId: AgentId, memory: string): Promise<void> {
    const dir = this.dir()
    if (!dir) throw new Error('The knowledge folder is not available; choose one in Settings')
    const path = join(dir, `${memoryFileName(agentId)}.md`)
    const body = memory.trim()
    await this.lock(path).run(async () => {
      if (body) await writeFileAtomic(path, `${body}\n`)
      else await rm(path, { force: true })
    })
  }

  async loadChat(agentId: AgentId): Promise<ChatMessage[]> {
    const dir = this.dir()
    if (!dir) return []
    const raw = await readFile(join(dir, 'chats', `${memoryFileName(agentId)}.jsonl`), 'utf8').catch(() => '')
    return parseTranscript(raw)
  }

  async appendChat(agentId: AgentId, messages: ChatMessage[]): Promise<void> {
    const dir = this.dir()
    if (!dir || messages.length === 0) return
    const chats = join(dir, 'chats')
    const path = join(chats, `${memoryFileName(agentId)}.jsonl`)
    await this.lock(path).run(async () => {
      await mkdir(chats, { recursive: true })
      await appendFile(path, messages.map((m) => `${JSON.stringify(m)}\n`).join(''), 'utf8')
    })
  }

  /** Read-merge-write under the memory file's lock, so two updates for one agent never overwrite each other. */
  async update(agentId: AgentId, merge: (current: string) => Promise<string | null>): Promise<void> {
    const dir = this.dir()
    if (!dir) return
    const path = join(dir, `${memoryFileName(agentId)}.md`)
    await this.lock(path).run(async () => {
      const current = await readFile(path, 'utf8').catch(() => '')
      const next = await merge(current)
      if (next === null) return
      const body = capMemory(next)
      if (body === current.trim()) return
      if (body) await writeFileAtomic(path, `${body}\n`)
      else await rm(path, { force: true })
    })
  }
}

const MemoryOutput = z.object({
  changed: z.boolean().describe('False when nothing new is worth remembering'),
  memory: z.string().describe('The full updated memory as compact markdown bullet points')
})

/**
 * One cheap LLM call that folds what just happened into the agent's memory. Returns the new memory,
 * or null when nothing changed.
 */
export async function mergeMemory(llm: Llm, def: AgentDef, current: string, happened: string): Promise<string | null> {
  const { changed, memory } = await llm.structured({
    system: `You maintain the long-term memory of ${def.name}, the ${def.role} in Agent HQ.
Keep only durable facts: the person's preferences, decisions, standing instructions, recurring topics and facts about their work or life that will matter later.
Leave out small talk, one-off questions, and anything already in the memory. Merge duplicates, drop facts the new exchange contradicts.
Write compact markdown bullet points grouped under short headings, at most ${MAX_MEMORY_CHARS} characters in total.
If nothing new is worth remembering, set changed to false and return the memory unchanged.`,
    schema: MemoryOutput,
    content: [text(section('memory', current.trim() || '(empty)'), section('new', happened), 'Return the full updated memory.')]
  })
  if (!changed) return null
  const body = memory.trim()
  return body ? body : null
}
