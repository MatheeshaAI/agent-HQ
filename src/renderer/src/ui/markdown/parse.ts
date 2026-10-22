// A small, safe Markdown parser for wiki pages and answers. It produces a plain AST that is
// rendered with React elements only, so no HTML from a page ever reaches the DOM as markup.
// Supported: front matter (skipped), headings, paragraphs, nested lists, simple GFM tables,
// blockquotes, fenced code, rules, and inline code, bold, italic, strikethrough, links,
// autolinks and [[wikilinks]] (optionally [[target|label]]).

export type Inline =
  | { type: 'text'; value: string }
  | { type: 'code'; value: string }
  | { type: 'strong' | 'em' | 'del'; children: Inline[] }
  | { type: 'link'; href: string; children: Inline[] }
  | { type: 'wikilink'; target: string; label: string }
  | { type: 'break' }

export type Block =
  | { type: 'heading'; level: number; children: Inline[] }
  | { type: 'paragraph'; children: Inline[] }
  | { type: 'code'; lang: string; value: string }
  | { type: 'quote'; children: Block[] }
  | { type: 'list'; ordered: boolean; start: number; items: Block[][] }
  | { type: 'table'; head: Inline[][]; rows: Inline[][][]; align: ('left' | 'center' | 'right' | null)[] }
  | { type: 'rule' }

const FENCE = /^ {0,3}(`{3,}|~{3,})\s*([\w+-]*)/
const HEADING = /^ {0,3}(#{1,6})\s+(.*?)\s*#*\s*$/
const RULE = /^ {0,3}([-*_])(\s*\1){2,}\s*$/
const QUOTE = /^ {0,3}>\s?/
const LIST_ITEM = /^( *)([-*+]|\d{1,9}[.)])\s+(.*)$/
const TABLE_DIVIDER = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/

export function parseMarkdown(source: string): Block[] {
  const lines = stripFrontMatter(source.replace(/\r\n?/g, '\n')).split('\n')
  return parseBlocks(lines)
}

function stripFrontMatter(text: string): string {
  if (!text.startsWith('---\n')) return text
  const end = text.indexOf('\n---', 4)
  if (end === -1) return text
  const after = text.indexOf('\n', end + 4)
  return after === -1 ? '' : text.slice(after + 1)
}

function parseBlocks(lines: string[]): Block[] {
  const blocks: Block[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) {
      i++
      continue
    }

    const fence = FENCE.exec(line)
    if (fence) {
      const marker = fence[1]
      const body: string[] = []
      i++
      while (i < lines.length && !lines[i].trimStart().startsWith(marker)) body.push(lines[i++])
      i++ // closing fence (or end of input)
      blocks.push({ type: 'code', lang: fence[2], value: body.join('\n') })
      continue
    }

    const heading = HEADING.exec(line)
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length, children: parseInline(heading[2]) })
      i++
      continue
    }

    if (RULE.test(line)) {
      blocks.push({ type: 'rule' })
      i++
      continue
    }

    if (QUOTE.test(line)) {
      const body: string[] = []
      while (i < lines.length && lines[i].trim() && QUOTE.test(lines[i])) body.push(lines[i++].replace(QUOTE, ''))
      blocks.push({ type: 'quote', children: parseBlocks(body) })
      continue
    }

    if (LIST_ITEM.test(line)) {
      const [list, next] = parseList(lines, i)
      blocks.push(list)
      i = next
      continue
    }

    if (line.includes('|') && i + 1 < lines.length && TABLE_DIVIDER.test(lines[i + 1])) {
      const [table, next] = parseTable(lines, i)
      blocks.push(table)
      i = next
      continue
    }

    const body: string[] = []
    while (i < lines.length && lines[i].trim() && !startsBlock(lines[i])) body.push(lines[i++].trim())
    blocks.push({ type: 'paragraph', children: parseInline(body.join('\n')) })
  }
  return blocks
}

function startsBlock(line: string): boolean {
  return FENCE.test(line) || HEADING.test(line) || RULE.test(line) || QUOTE.test(line) || LIST_ITEM.test(line)
}

function parseList(lines: string[], from: number): [Block, number] {
  const first = LIST_ITEM.exec(lines[from])!
  const indent = first[1].length
  const ordered = /\d/.test(first[2])
  const items: Block[][] = []
  let i = from
  while (i < lines.length) {
    const match = LIST_ITEM.exec(lines[i])
    if (!match || match[1].length !== indent || /\d/.test(match[2]) !== ordered) break
    const body = [match[3]]
    const contentIndent = match[1].length + match[2].length + 1
    i++
    while (i < lines.length) {
      const line = lines[i]
      if (!line.trim()) {
        const nextLine = lines[i + 1]
        if (nextLine !== undefined && leadingSpaces(nextLine) >= contentIndent) {
          body.push('')
          i++
          continue
        }
        break
      }
      const nested = LIST_ITEM.exec(line)
      if (nested && nested[1].length <= indent) break
      if (!nested && leadingSpaces(line) < contentIndent && startsBlock(line)) break
      body.push(line.slice(Math.min(leadingSpaces(line), contentIndent)))
      i++
    }
    items.push(parseBlocks(body))
  }
  return [{ type: 'list', ordered, start: ordered ? parseInt(first[2], 10) : 1, items }, i]
}

function leadingSpaces(line: string): number {
  return line.length - line.trimStart().length
}

function splitRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '')
  return trimmed.split(/(?<!\\)\|/).map((cell) => cell.trim())
}

function parseTable(lines: string[], from: number): [Block, number] {
  const head = splitRow(lines[from])
  const align = splitRow(lines[from + 1]).map((cell) => {
    const left = cell.startsWith(':')
    const right = cell.endsWith(':')
    return left && right ? 'center' : right ? 'right' : left ? 'left' : null
  })
  const rows: Inline[][][] = []
  let i = from + 2
  while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
    const cells = splitRow(lines[i++])
    rows.push(head.map((_, c) => parseInline(cells[c] ?? '')))
  }
  return [{ type: 'table', head: head.map((cell) => parseInline(cell)), rows, align }, i]
}

const LINK = /^\[([^\]]+)\]\(\s*<?([^)\s>]+)>?(?:\s+["'][^"']*["'])?\s*\)/
const WIKILINK = /^\[\[([^\]|]+?)(?:\|([^\]]+))?\]\]/
const AUTOLINK = /^<(https?:\/\/[^>\s]+)>/
const BARE_URL = /^https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"]/

/** Parses inline Markdown. Unclosed markers are kept as literal text. */
export function parseInline(source: string): Inline[] {
  const out: Inline[] = []
  let text = ''
  const flush = (): void => {
    if (text) out.push({ type: 'text', value: text })
    text = ''
  }
  const push = (node: Inline): void => {
    flush()
    out.push(node)
  }

  let i = 0
  while (i < source.length) {
    const rest = source.slice(i)
    const ch = source[i]

    if (ch === '\\' && i + 1 < source.length && /[\\`*_{}[\]()#+\-.!|~<>]/.test(source[i + 1])) {
      text += source[i + 1]
      i += 2
      continue
    }

    if (ch === '\n') {
      if (text.endsWith('  ')) {
        text = text.trimEnd()
        push({ type: 'break' })
      } else {
        text += ' '
      }
      i++
      continue
    }

    if (ch === '`') {
      const run = /^`+/.exec(rest)![0]
      const close = source.indexOf(run, i + run.length)
      if (close !== -1) {
        push({ type: 'code', value: source.slice(i + run.length, close).trim() })
        i = close + run.length
        continue
      }
    }

    if (rest.startsWith('[[')) {
      const wiki = WIKILINK.exec(rest)
      if (wiki) {
        const target = wiki[1].trim()
        push({ type: 'wikilink', target, label: (wiki[2] ?? wiki[1]).trim() })
        i += wiki[0].length
        continue
      }
    }

    if (ch === '[') {
      const link = LINK.exec(rest)
      if (link) {
        push({ type: 'link', href: link[2], children: parseInline(link[1]) })
        i += link[0].length
        continue
      }
    }

    if (ch === '<') {
      const auto = AUTOLINK.exec(rest)
      if (auto) {
        push({ type: 'link', href: auto[1], children: [{ type: 'text', value: auto[1] }] })
        i += auto[0].length
        continue
      }
    }

    if (ch === 'h' && (i === 0 || /[\s(]/.test(source[i - 1]))) {
      const url = BARE_URL.exec(rest)
      if (url) {
        push({ type: 'link', href: url[0], children: [{ type: 'text', value: url[0] }] })
        i += url[0].length
        continue
      }
    }

    const emphasis = matchEmphasis(source, i)
    if (emphasis) {
      push(emphasis.node)
      i = emphasis.end
      continue
    }

    text += ch
    i++
  }
  flush()
  return out
}

function matchEmphasis(source: string, i: number): { node: Inline; end: number } | null {
  const ch = source[i]
  if (ch !== '*' && ch !== '_' && ch !== '~') return null
  const double = source[i + 1] === ch
  if (ch === '~' && !double) return null
  const marker = double ? ch + ch : ch
  const openEnd = i + marker.length
  if (openEnd >= source.length || /\s/.test(source[openEnd])) return null
  // Underscores inside words (snake_case) are literal.
  if (ch === '_' && i > 0 && /\w/.test(source[i - 1])) return null

  let search = openEnd
  while (search < source.length) {
    const close = source.indexOf(marker, search)
    if (close === -1) return null
    const valid =
      !/\s/.test(source[close - 1]) &&
      (marker.length === 2 || source[close + 1] !== ch) &&
      !(ch === '_' && /\w/.test(source[close + marker.length] ?? ''))
    if (valid && close > openEnd) {
      const type = ch === '~' ? 'del' : double ? 'strong' : 'em'
      return { node: { type, children: parseInline(source.slice(openEnd, close)) }, end: close + marker.length }
    }
    search = close + marker.length
  }
  return null
}
