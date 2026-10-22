import { readFile } from 'node:fs/promises'
import type { BetaContentBlockParam } from '@anthropic-ai/sdk/resources/beta/messages/messages'
import { htmlToText } from './htmlToText'
import { imageMediaType, isHtml, isPdf } from './kinds'

/** Text sources above this size are read in parts so nothing is silently cut. */
const TEXT_CHUNK_THRESHOLD = 600_000
const TEXT_CHUNK_SIZE = 400_000
const PDF_LIMIT_BYTES = 32 * 1024 * 1024
const IMAGE_LIMIT_BYTES = 5 * 1024 * 1024

/**
 * A source ready for Claude: one or more parts, each the content blocks of one request.
 * PDFs and images are a single part; long text is split into several.
 */
export type SourceParts = BetaContentBlockParam[][]

export async function loadSourceContent(path: string, name: string): Promise<SourceParts> {
  const bytes = await readFile(path)

  if (isPdf(path)) {
    if (bytes.byteLength > PDF_LIMIT_BYTES) throw new Error(`${name} is ${megabytes(bytes.byteLength)} MB; Claude reads PDFs up to 32 MB`)
    const document: BetaContentBlockParam = {
      type: 'document',
      title: name,
      source: { type: 'base64', media_type: 'application/pdf', data: bytes.toString('base64') }
    }
    return [[document]]
  }

  const mediaType = imageMediaType(path)
  if (mediaType) {
    if (bytes.byteLength > IMAGE_LIMIT_BYTES) throw new Error(`${name} is ${megabytes(bytes.byteLength)} MB; Claude reads images up to 5 MB`)
    const image: BetaContentBlockParam = {
      type: 'image',
      source: { type: 'base64', media_type: mediaType, data: bytes.toString('base64') }
    }
    return [[image]]
  }

  if (looksBinary(bytes)) throw new Error(`${name} is not a format Agent HQ can read (use PDF, images, text, markdown or HTML)`)
  const decoded = bytes.toString('utf8')
  const text = (isHtml(path) ? htmlToText(decoded).text : decoded).trim()
  if (!text) throw new Error(`${name} is empty`)

  const chunks = text.length > TEXT_CHUNK_THRESHOLD ? splitText(text, TEXT_CHUNK_SIZE) : [text]
  return chunks.map((chunk, i): BetaContentBlockParam[] => [
    {
      type: 'text',
      text: `<source name=${JSON.stringify(name)}${chunks.length > 1 ? ` part="${i + 1} of ${chunks.length}"` : ''}>\n${chunk}\n</source>`
    }
  ])
}

/** Splits at paragraph, then line, then sentence boundaries; never mid-word unless a run has no spaces. */
export function splitText(text: string, maxChars: number): string[] {
  const chunks: string[] = []
  let rest = text
  while (rest.length > maxChars) {
    const window = rest.slice(0, maxChars)
    const cut = [window.lastIndexOf('\n\n'), window.lastIndexOf('\n'), window.lastIndexOf('. '), window.lastIndexOf(' ')].find(
      (index) => index > maxChars * 0.5
    )
    const end = cut !== undefined ? cut + 1 : maxChars
    chunks.push(rest.slice(0, end).trim())
    rest = rest.slice(end)
  }
  if (rest.trim()) chunks.push(rest.trim())
  return chunks
}

function looksBinary(bytes: Buffer): boolean {
  const sample = bytes.subarray(0, 8192)
  return sample.includes(0)
}

function megabytes(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1)
}
