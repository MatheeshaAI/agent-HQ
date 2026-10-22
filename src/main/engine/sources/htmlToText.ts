// Turns a fetched HTML page into readable markdown-ish text: headings become "#" lines,
// paragraphs and list items keep their breaks, scripts/styles/markup are dropped and entities decoded.

const DROP_ELEMENTS = ['head', 'title', 'script', 'style', 'noscript', 'template', 'svg', 'canvas', 'iframe', 'object']
const CHROME_ELEMENTS = ['nav', 'header', 'footer', 'aside', 'form']
const BLOCK_TAGS =
  'p|div|section|article|main|blockquote|pre|table|thead|tbody|tfoot|tr|ul|ol|dl|dt|dd|figure|figcaption|hr|address|details|summary'

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', laquo: '«', raquo: '»', middot: '·', bull: '•',
  copy: '©', reg: '®', trade: '™', deg: '°', times: '×', divide: '÷', euro: '€', pound: '£', yen: '¥',
  cent: '¢', sect: '§', para: '¶', shy: '', zwj: '', zwnj: '', thinsp: ' ', ensp: ' ', emsp: ' ',
  larr: '←', rarr: '→', uarr: '↑', darr: '↓', harr: '↔', le: '≤', ge: '≥', ne: '≠', plusmn: '±', minus: '−'
}

interface HtmlDocument {
  title: string
  text: string
}

export function htmlToText(html: string): HtmlDocument {
  const title = decodeEntities(stripTags(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? '')).replace(/\s+/g, ' ').trim()

  let doc = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '')
  for (const tag of DROP_ELEMENTS) doc = removeElement(doc, tag)

  // Prefer the page's main content when it marks one up and it is substantial.
  const main = largestElement(doc, 'article') ?? largestElement(doc, 'main')
  if (main && visibleLength(main) > 500) doc = main
  else for (const tag of CHROME_ELEMENTS) doc = removeElement(doc, tag)

  const text = doc
    .replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, level: string, inner: string) => {
      const heading = stripTags(inner).replace(/\s+/g, ' ').trim()
      return heading ? `\n\n${'#'.repeat(Number(level))} ${heading}\n\n` : '\n\n'
    })
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(?:td|th)[^>]*>/gi, ' ')
    .replace(new RegExp(`</?(?:${BLOCK_TAGS})(?:\\s[^>]*)?>`, 'gi'), '\n\n')

  return { title, text: tidy(decodeEntities(stripTags(text))) }
}

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (match, entity: string) => {
    if (entity[0] === '#') {
      const code = entity[1] === 'x' || entity[1] === 'X' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10)
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match
  })
}

function stripTags(html: string): string {
  return html.replace(/<\/?[a-z][^>]*>/gi, '')
}

function removeElement(html: string, tag: string): string {
  return html
    .replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}\\s*>`, 'gi'), ' ')
    .replace(new RegExp(`<${tag}\\b[^>]*/?>`, 'gi'), ' ')
}

function largestElement(html: string, tag: string): string | null {
  let best: string | null = null
  for (const match of html.matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}\\s*>`, 'gi'))) {
    if (!best || match[1].length > best.length) best = match[1]
  }
  return best
}

function visibleLength(html: string): number {
  return stripTags(html).replace(/\s+/g, ' ').trim().length
}

/** Collapses runs of spaces, trims lines and keeps at most one blank line between blocks. */
function tidy(text: string): string {
  return text
    .replace(/ /g, ' ')
    .split('\n')
    .map((line) => line.replace(/[ \t\f\v]+/g, ' ').trim())
    .join('\n')
    .replace(/^- *$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
