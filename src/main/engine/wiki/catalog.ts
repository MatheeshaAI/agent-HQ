import { appendFile, readFile } from 'node:fs/promises'
import type { WikiPageMeta } from '@shared/types'
import { pathExists, writeFileAtomic } from '../util/fsx'
import { formatStamp, plural } from '../util/text'

const UNCATEGORISED = 'Uncategorised'

/** index.md: every page with its one-line summary, grouped by its first tag. */
export function renderIndex(pages: WikiPageMeta[], at: number): string {
  const groups = new Map<string, WikiPageMeta[]>()
  for (const page of pages) {
    const group = page.tags[0]?.trim() ? capitalise(page.tags[0].trim()) : UNCATEGORISED
    const list = groups.get(group) ?? []
    list.push(page)
    groups.set(group, list)
  }
  const names = [...groups.keys()].sort((a, b) =>
    a === UNCATEGORISED ? 1 : b === UNCATEGORISED ? -1 : a.localeCompare(b)
  )

  const lines = ['# Index', '', `_${plural(pages.length, 'page')} · updated ${formatStamp(at)}_`, '']
  if (pages.length === 0) lines.push('The wiki is empty. Add a source to start it.', '')
  for (const name of names) {
    lines.push(`## ${name}`, '')
    const sorted = [...(groups.get(name) ?? [])].sort((a, b) => a.title.localeCompare(b.title))
    for (const page of sorted) lines.push(`- [[${page.title}]]${page.summary ? ` — ${page.summary}` : ''}`)
    lines.push('')
  }
  return lines.join('\n')
}

export async function writeIndex(path: string, pages: WikiPageMeta[], at: number): Promise<void> {
  await writeFileAtomic(path, renderIndex(pages, at))
}

/** Appends `## [YYYY-MM-DD HH:MM] <action> | <subject>` and its bullet lines to log.md. */
export async function appendLog(path: string, at: number, action: string, subject: string, lines: string[]): Promise<void> {
  const entry = [`## [${formatStamp(at)}] ${action} | ${subject.replace(/\s+/g, ' ')}`, '', ...lines.map((l) => `- ${l}`), '', ''].join('\n')
  if (!(await pathExists(path))) {
    await writeFileAtomic(path, `# Log\n\n${entry}`)
    return
  }
  const current = await readFile(path, 'utf8')
  await appendFile(path, current.endsWith('\n\n') || current.length === 0 ? entry : current.endsWith('\n') ? `\n${entry}` : `\n\n${entry}`)
}

export async function ensureLog(path: string): Promise<void> {
  if (!(await pathExists(path))) await writeFileAtomic(path, '# Log\n\n')
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
