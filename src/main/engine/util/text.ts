/** Lowercase words joined by dashes. Matches the renderer's slugify so links resolve the same way on both sides. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Local "YYYY-MM-DD HH:MM", the timestamp format used in log.md and index.md. */
export function formatStamp(at: number): string {
  const d = new Date(at)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** First `maxWords` words of a text, with an ellipsis when it was cut. */
export function firstWords(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean)
  const head = words.slice(0, maxWords).join(' ')
  return words.length > maxWords ? `${head}…` : head
}

export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`
}

/** A URL as people read it: no protocol, no trailing slash. */
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//i, '').replace(/\/$/, '')
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}
