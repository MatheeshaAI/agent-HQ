// YAML front matter for wiki pages. Only the subset the wiki uses is understood (scalars and
// lists of scalars); any other keys a person adds by hand are kept verbatim when a page is rewritten.

export interface PageFrontmatter {
  title: string
  tags: string[]
  sources: string[]
  /** ISO 8601 timestamp */
  updated: string
  summary: string
}

export interface ParsedPage {
  frontmatter: Partial<PageFrontmatter>
  /** Raw YAML lines of keys this module does not manage, preserved on rewrite */
  extra: string[]
  body: string
}

const KNOWN_KEYS = new Set(['title', 'tags', 'sources', 'updated', 'summary'])
const FENCE = /^---\s*$/

export function parsePage(text: string): ParsedPage {
  const lines = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n').split('\n')
  if (!FENCE.test(lines[0] ?? '')) return { frontmatter: {}, extra: [], body: lines.join('\n') }
  const end = lines.findIndex((line, i) => i > 0 && FENCE.test(line))
  if (end === -1) return { frontmatter: {}, extra: [], body: lines.join('\n') }

  const yaml = lines.slice(1, end)
  const body = lines.slice(end + 1).join('\n').replace(/^\n+/, '')
  const values = new Map<string, string | string[]>()
  const extra: string[] = []

  for (let i = 0; i < yaml.length; i++) {
    const match = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(yaml[i])
    if (!match) continue
    const [, key, rest] = match
    // Collect the key's indented continuation lines (block lists, folded text).
    const block: string[] = []
    while (i + 1 < yaml.length && /^(\s+|\s*-\s)/.test(yaml[i + 1]) && !/^[A-Za-z_][\w-]*:/.test(yaml[i + 1])) {
      block.push(yaml[++i])
    }
    if (!KNOWN_KEYS.has(key)) {
      extra.push(yaml[i - block.length], ...block)
      continue
    }
    values.set(key, block.length > 0 && rest.trim() === '' ? parseBlockList(block) : parseInline(rest))
  }

  return {
    frontmatter: {
      title: asString(values.get('title')),
      tags: asList(values.get('tags')),
      sources: asList(values.get('sources')),
      updated: asString(values.get('updated')),
      summary: asString(values.get('summary'))
    },
    extra,
    body
  }
}

export function renderPage(frontmatter: PageFrontmatter, body: string, extra: string[] = []): string {
  const yaml = [
    `title: ${quote(frontmatter.title)}`,
    `tags: [${frontmatter.tags.map(quote).join(', ')}]`,
    `sources: [${frontmatter.sources.map(quote).join(', ')}]`,
    `updated: ${quote(frontmatter.updated)}`,
    `summary: ${quote(frontmatter.summary)}`,
    ...extra
  ]
  return `---\n${yaml.join('\n')}\n---\n\n${body.trim()}\n`
}

/** JSON string syntax is valid YAML double-quoted syntax. */
function quote(value: string): string {
  return JSON.stringify(value)
}

function parseBlockList(lines: string[]): string[] {
  return lines
    .map((line) => /^\s*-\s*(.*)$/.exec(line)?.[1])
    .filter((item): item is string => item !== undefined)
    .map(parseScalar)
    .filter(Boolean)
}

function parseInline(raw: string): string | string[] {
  const value = raw.trim()
  if (value.startsWith('[') && value.endsWith(']')) {
    return splitFlowList(value.slice(1, -1)).map(parseScalar).filter(Boolean)
  }
  return parseScalar(value)
}

/** Splits `a, "b, c", 'd'` on commas outside quotes. */
function splitFlowList(inner: string): string[] {
  const items: string[] = []
  let current = ''
  let quoteChar: string | null = null
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i]
    if (quoteChar) {
      current += ch
      if (ch === '\\' && quoteChar === '"') current += inner[++i] ?? ''
      else if (ch === quoteChar) quoteChar = null
    } else if (ch === '"' || ch === "'") {
      quoteChar = ch
      current += ch
    } else if (ch === ',') {
      items.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  if (current.trim()) items.push(current)
  return items
}

function parseScalar(raw: string): string {
  const value = raw.trim()
  if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
    try {
      return JSON.parse(value) as string
    } catch {
      return value.slice(1, -1)
    }
  }
  if (value.startsWith("'") && value.endsWith("'") && value.length >= 2) return value.slice(1, -1).replace(/''/g, "'")
  return value.replace(/\s+#.*$/, '')
}

function asString(value: string | string[] | undefined): string | undefined {
  if (value === undefined) return undefined
  return Array.isArray(value) ? value.join(', ') : value
}

function asList(value: string | string[] | undefined): string[] | undefined {
  if (value === undefined) return undefined
  if (Array.isArray(value)) return value
  return value ? value.split(',').map((item) => item.trim()).filter(Boolean) : []
}
