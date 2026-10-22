import { copyFile, rename, rm, stat } from 'node:fs/promises'
import { basename, join } from 'node:path'
import type { SourceKind } from '@shared/types'
import { uniquePath, writeFileAtomic } from '../util/fsx'
import { displayUrl, firstWords, slugify } from '../util/text'
import { htmlToText } from './htmlToText'
import { kindForFile } from './kinds'

/** A file that has just been placed in raw/. */
export interface RawFile {
  path: string
  name: string
  kind: SourceKind
  size: number
}

/** A source on its way into raw/: either bytes in memory or a user file to copy. */
export type Incoming = {
  /** Preferred file name inside raw/ */
  fileName: string
  /** How the source is shown: file name, URL or the first words of a note */
  name: string
  kind: SourceKind
} & ({ data: Uint8Array | string } | { copyFrom: string })

export interface FetchOptions {
  timeoutMs: number
  maxBytes: number
}

const DEFAULT_FETCH: FetchOptions = { timeoutMs: 20_000, maxBytes: 10 * 1024 * 1024 }

const BINARY_TYPES: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp'
}

/** A user file, to be copied into raw/. The original is never touched. */
export async function fileSource(sourcePath: string): Promise<Incoming> {
  const info = await stat(sourcePath).catch(() => null)
  if (!info) throw new Error(`File not found: ${sourcePath}`)
  if (!info.isFile()) throw new Error(`Not a file: ${sourcePath}`)
  const name = basename(sourcePath)
  return { fileName: name, name, kind: kindForFile(name), copyFrom: sourcePath }
}

/** A typed note, stored as raw/note-<timestamp>.md. */
export function noteSource(text: string, at: number): Incoming {
  const body = text.trim()
  if (!body) throw new Error('The note is empty')
  const stamp = new Date(at).toISOString().replace(/[:.]/g, '-')
  return { fileName: `note-${stamp}.md`, name: noteName(body), kind: 'note', data: `${body}\n` }
}

/**
 * Downloads a URL. Web pages become readable text (raw/<slug>.md, with the URL and fetch date
 * on top); PDFs and images keep their original bytes.
 */
export async function urlSource(url: string, at: number, options = DEFAULT_FETCH): Promise<Incoming> {
  const parsed = parseHttpUrl(url)
  const name = displayUrl(parsed.toString())
  const stem = slugify(`${parsed.hostname}${parsed.pathname}`).slice(0, 80) || 'page'

  let response: Response
  try {
    response = await fetch(parsed, {
      redirect: 'follow',
      signal: AbortSignal.timeout(options.timeoutMs),
      headers: {
        'user-agent': 'AgentHQ/1.0 (desktop knowledge app)',
        accept: 'text/html,text/plain,text/markdown,application/pdf,image/*;q=0.8,*/*;q=0.5'
      }
    })
  } catch (error) {
    const reason = (error as Error).name === 'TimeoutError' ? `no response after ${options.timeoutMs / 1000}s` : (error as Error).message
    throw new Error(`Could not fetch ${name}: ${reason}`)
  }
  if (!response.ok) throw new Error(`Could not fetch ${name}: the server answered ${response.status} ${response.statusText}`.trim())

  const contentType = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
  const bytes = await readCapped(response, options.maxBytes, name)

  const binaryExt = BINARY_TYPES[contentType]
  if (binaryExt) return { fileName: `${stem}${binaryExt}`, name, kind: 'url', data: bytes }

  const isHtml = contentType === 'text/html' || contentType === 'application/xhtml+xml'
  if (!isHtml && !contentType.startsWith('text/') && contentType !== '') {
    throw new Error(`Could not use ${name}: unsupported content type ${contentType}`)
  }
  const decoded = new TextDecoder(charsetOf(response) ?? 'utf-8').decode(bytes)
  const looksHtml = isHtml || (contentType === '' && /<html[\s>]/i.test(decoded))
  const { title, text } = looksHtml ? htmlToText(decoded) : { title: '', text: decoded.trim() }
  if (!text) throw new Error(`${name} has no readable text (the page may need JavaScript to render)`)

  const header = [`# ${title || name}`, '', `Source: ${parsed.toString()}`, `Fetched: ${new Date(at).toISOString()}`, '', '---', '']
  return { fileName: `${stem}.md`, name, kind: 'url', data: `${header.join('\n')}\n${text}\n` }
}

/**
 * Puts an incoming source into raw/ under a free name. The bytes land in a hidden temp file
 * first, so folder watchers only ever see complete files.
 */
export async function placeInRaw(rawDir: string, incoming: Incoming): Promise<RawFile> {
  const path = await uniquePath(rawDir, incoming.fileName)
  if ('copyFrom' in incoming) {
    const temp = join(rawDir, `.${basename(path)}.incoming`)
    try {
      await copyFile(incoming.copyFrom, temp)
      await rename(temp, path)
    } catch (error) {
      await rm(temp, { force: true })
      throw error
    }
  } else {
    await writeFileAtomic(path, incoming.data)
  }
  const { size } = await stat(path)
  return { path, name: incoming.name, kind: incoming.kind, size }
}

/** The first words of a note's first line, without markdown markers. */
function noteName(body: string): string {
  const firstLine = body.split('\n').find((line) => line.trim()) ?? body
  return firstWords(firstLine.replace(/^\s*(?:#{1,6}|[-*+>]|\d+[.)])\s+/, '').replace(/[*_`~]/g, ''), 8)
}

function parseHttpUrl(input: string): URL {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    throw new Error(`"${input}" is not a valid URL`)
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Only http and https links can be added')
  url.hash = ''
  return url
}

async function readCapped(response: Response, maxBytes: number, name: string): Promise<Uint8Array> {
  const declared = Number(response.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > maxBytes) throw tooLarge(name, maxBytes)
  if (!response.body) return new Uint8Array(await response.arrayBuffer())

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel()
      throw tooLarge(name, maxBytes)
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}

function tooLarge(name: string, maxBytes: number): Error {
  return new Error(`${name} is larger than ${Math.round(maxBytes / (1024 * 1024))} MB`)
}

function charsetOf(response: Response): string | null {
  const charset = /charset=([^;]+)/i.exec(response.headers.get('content-type') ?? '')?.[1]?.trim().replace(/["']/g, '')
  if (!charset) return null
  try {
    new TextDecoder(charset)
    return charset
  } catch {
    return null
  }
}
