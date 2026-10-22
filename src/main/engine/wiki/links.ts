import { slugify } from '../util/text'

const WIKILINK = /\[\[([^\]\n|#]+)(?:#[^\]\n|]*)?(?:\|[^\]\n]*)?\]\]/g
const CODE = /```[\s\S]*?```|`[^`\n]*`/g

/** Targets of every [[Target]], [[Target|label]] and [[Target#heading]] outside code. */
export function extractWikilinks(markdown: string): string[] {
  const text = markdown.replace(CODE, '')
  const targets: string[] = []
  for (const match of text.matchAll(WIKILINK)) {
    const target = match[1].trim()
    if (target) targets.push(target)
  }
  return targets
}

/** Resolves wikilink targets to page slugs by title (case-insensitive) or slug. */
export class LinkResolver {
  private readonly bySlug = new Map<string, string>()
  private readonly byTitle = new Map<string, string>()

  constructor(pages: Iterable<{ slug: string; title: string }>) {
    for (const page of pages) {
      this.bySlug.set(page.slug, page.slug)
      this.byTitle.set(page.title.trim().toLowerCase(), page.slug)
    }
  }

  resolve(target: string): string | null {
    const trimmed = target.trim()
    return (
      this.byTitle.get(trimmed.toLowerCase()) ?? this.bySlug.get(trimmed) ?? this.bySlug.get(slugify(trimmed)) ?? null
    )
  }
}
