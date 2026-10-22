import type { BetaContentBlockParam } from '@anthropic-ai/sdk/resources/beta/messages/messages'

/** A labelled JSON section of a prompt, e.g. <summary>{…}</summary>. */
export function section(tag: string, value: unknown): string {
  return `<${tag}>\n${typeof value === 'string' ? value : JSON.stringify(value, null, 2)}\n</${tag}>`
}

export function text(...paragraphs: string[]): BetaContentBlockParam {
  return { type: 'text', text: paragraphs.join('\n\n') }
}

/** Case-insensitive de-duplication that keeps the first spelling. */
export function uniqueBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    const k = key(item).trim().toLowerCase()
    if (!k || seen.has(k)) return false
    seen.add(k)
    return true
  })
}

export function cleanTags(tags: string[]): string[] {
  return uniqueBy(
    tags.map((tag) => tag.trim().toLowerCase().replace(/^#/, '').replace(/\s+/g, '-')),
    (tag) => tag
  )
}
