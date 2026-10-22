import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { WikiPageContent, WikiPageMeta } from '@shared/types'
import { useSnapshot } from './snapshot'
import { slugify } from './derived'

const RELOAD_DEBOUNCE_MS = 400

interface PagesValue {
  /** null until the first listing arrives */
  pages: WikiPageMeta[] | null
  bySlug: Map<string, WikiPageMeta>
  /** Maps a wikilink target (slug or title) to an existing page slug */
  resolve: (target: string) => string | null
}

const PagesContext = createContext<PagesValue | null>(null)

/**
 * Keeps the wiki page index for the whole UI. Reloads whenever the engine reports new
 * wiki work (page count, link count or the newest activity changes).
 */
export function PagesProvider({ children }: { children: ReactNode }): JSX.Element {
  const snapshot = useSnapshot()
  const [pages, setPages] = useState<WikiPageMeta[] | null>(null)
  const loaded = useRef(false)
  const version = `${snapshot.stats.pages}:${snapshot.graph.edges.length}:${snapshot.activity[0]?.id ?? ''}`

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(
      () => {
        window.api.listPages().then((list) => {
          loaded.current = true
          if (!cancelled) setPages(list)
        })
      },
      loaded.current ? RELOAD_DEBOUNCE_MS : 0
    )
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [version])

  const value = useMemo<PagesValue>(() => {
    const bySlug = new Map<string, WikiPageMeta>()
    const aliases = new Map<string, string>()
    for (const page of pages ?? []) {
      bySlug.set(page.slug, page)
      aliases.set(slugify(page.slug), page.slug)
      aliases.set(slugify(page.title), page.slug)
    }
    const resolve = (target: string): string | null =>
      bySlug.has(target) ? target : (aliases.get(slugify(target)) ?? null)
    return { pages, bySlug, resolve }
  }, [pages])

  return <PagesContext.Provider value={value}>{children}</PagesContext.Provider>
}

export function usePages(): PagesValue {
  const value = useContext(PagesContext)
  if (!value) throw new Error('usePages must be used inside <PagesProvider>')
  return value
}

export type PageLoad =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'missing'; slug: string }
  | { status: 'ready'; page: WikiPageContent }

/** Reads one page and re-reads it whenever the index reports a newer version of it. */
export function usePage(slug: string | null): PageLoad {
  const { bySlug } = usePages()
  const updatedAt = slug ? bySlug.get(slug)?.updatedAt : undefined
  const [load, setLoad] = useState<PageLoad>({ status: 'idle' })

  useEffect(() => {
    if (!slug) {
      setLoad({ status: 'idle' })
      return
    }
    let cancelled = false
    setLoad((current) => (current.status === 'ready' && current.page.slug === slug ? current : { status: 'loading' }))
    window.api.readPage(slug).then((page) => {
      if (!cancelled) setLoad(page ? { status: 'ready', page } : { status: 'missing', slug })
    })
    return () => {
      cancelled = true
    }
  }, [slug, updatedAt])

  return load
}

