import { extname } from 'node:path'
import type { SourceKind } from '@shared/types'

type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

const IMAGE_TYPES: Record<string, ImageMediaType> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp'
}

const MARKDOWN = new Set(['.md', '.markdown', '.mdx'])
const HTML = new Set(['.html', '.htm', '.xhtml'])
const TEXT = new Set([
  '.txt', '.text', '.csv', '.tsv', '.json', '.jsonl', '.xml', '.yaml', '.yml', '.toml', '.ini', '.log', '.rst',
  '.tex', '.org', '.adoc', '.srt', '.vtt', '.py', '.js', '.ts', '.tsx', '.jsx', '.java', '.go', '.rs', '.c', '.h',
  '.cpp', '.cs', '.rb', '.php', '.swift', '.kt', '.sql', '.sh', '.css', '.scss'
])

export function imageMediaType(path: string): ImageMediaType | null {
  return IMAGE_TYPES[extname(path).toLowerCase()] ?? null
}

export function isPdf(path: string): boolean {
  return extname(path).toLowerCase() === '.pdf'
}

export function isHtml(path: string): boolean {
  return HTML.has(extname(path).toLowerCase())
}

/** How a source reads in the Inbox, judged from its file name. */
export function kindForFile(path: string): SourceKind {
  const ext = extname(path).toLowerCase()
  if (ext === '.pdf') return 'pdf'
  if (IMAGE_TYPES[ext]) return 'image'
  if (MARKDOWN.has(ext)) return 'markdown'
  if (TEXT.has(ext) || HTML.has(ext)) return 'text'
  return 'other'
}

/** Short label used in task titles, e.g. "Process PDF source". */
export function kindLabel(kind: SourceKind): string {
  switch (kind) {
    case 'pdf':
      return 'PDF'
    case 'url':
      return 'URL'
    case 'other':
      return 'file'
    default:
      return kind
  }
}
