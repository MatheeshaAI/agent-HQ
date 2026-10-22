import { useMemo, useState } from 'react'
import { BookOpen, FileQuestion, FolderOpen, Inbox, Search, X } from 'lucide-react'
import type { WikiPageMeta } from '@shared/types'
import { usePage, usePages } from '../../state/pages'
import { navigation, useNavigation } from '../../state/navigation'
import { formatRelative, useNow } from '../../state/clock'
import { Markdown } from '../markdown/Markdown'
import { EmptyState } from '../common/EmptyState'
import { Button } from '../common/Button'
import { ViewFrame } from './ViewFrame'
import styles from './views.module.css'

function matches(page: WikiPageMeta, query: string): boolean {
  const q = query.toLowerCase()
  return (
    page.title.toLowerCase().includes(q) ||
    page.slug.includes(q) ||
    page.summary.toLowerCase().includes(q) ||
    page.tags.some((tag) => tag.toLowerCase().includes(q))
  )
}

export function KnowledgeView(): JSX.Element {
  const { pages } = usePages()
  const selected = useNavigation((s) => s.pageSlug)
  const [query, setQuery] = useState('')

  const visible = useMemo(() => {
    const list = (pages ?? []).filter((page) => !query.trim() || matches(page, query.trim()))
    return list.sort((a, b) => b.updatedAt - a.updatedAt)
  }, [pages, query])

  if (pages && pages.length === 0) {
    return (
      <ViewFrame title="Knowledge" subtitle="Your wiki, written by the agents">
        <EmptyState
          icon={BookOpen}
          title="No wiki pages yet"
          actions={
            <Button variant="primary" icon={Inbox} onClick={() => navigation.go('inbox')}>
              Add a source
            </Button>
          }
        >
          Drop a PDF, Markdown or text file anywhere on the window, or paste a URL in the top bar. Pip files it in raw/,
          Sage reads it, Rex pulls out the concepts and Nova links them into pages that show up here.
        </EmptyState>
      </ViewFrame>
    )
  }

  return (
    <ViewFrame title="Knowledge" subtitle={pages ? `${pages.length} pages in the wiki` : 'Loading pages…'} bare>
      <div className={styles.split}>
        <div className={styles.listPane}>
          <label className={styles.search}>
            <Search size={15} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search pages, tags…" spellCheck={false} />
            {query && (
              <button onClick={() => setQuery('')} aria-label="Clear search">
                <X size={14} />
              </button>
            )}
          </label>
          <ul className={styles.pageList}>
            {visible.map((page) => (
              <PageListItem key={page.slug} page={page} active={page.slug === selected} />
            ))}
            {pages && visible.length === 0 && <li className={styles.listEmpty}>No pages match “{query}”.</li>}
          </ul>
        </div>
        <div className={styles.readerPane}>
          <PageReader slug={selected} />
        </div>
      </div>
    </ViewFrame>
  )
}

function PageListItem({ page, active }: { page: WikiPageMeta; active: boolean }): JSX.Element {
  const now = useNow()
  return (
    <li>
      <button className={`${styles.pageItem} ${active ? styles.pageItemActive : ''}`} onClick={() => navigation.openPage(page.slug)}>
        <div className={styles.pageItemTop}>
          <span className={styles.pageItemTitle}>{page.title}</span>
          <time className={styles.muted}>{formatRelative(page.updatedAt, now)}</time>
        </div>
        {page.summary && <div className={styles.pageItemSummary}>{page.summary}</div>}
        {page.tags.length > 0 && (
          <div className={styles.tagRow}>
            {page.tags.slice(0, 3).map((tag) => (
              <span key={tag} className={styles.tag}>
                #{tag}
              </span>
            ))}
          </div>
        )}
      </button>
    </li>
  )
}

function PageReader({ slug }: { slug: string | null }): JSX.Element {
  const { pages, bySlug, resolve } = usePages()
  const load = usePage(slug)
  const now = useNow()
  const openTarget = (target: string): void => navigation.openPage(resolve(target) ?? target)

  const backlinks = useMemo(
    () => (slug && pages ? pages.filter((p) => p.slug !== slug && p.links.includes(slug)) : []),
    [pages, slug]
  )

  if (load.status === 'idle') {
    return (
      <EmptyState icon={BookOpen} title="Pick a page to read">
        Choose a page on the left, click a node in the Graph, or follow a citation from one of Muse’s answers.
      </EmptyState>
    )
  }
  if (load.status === 'loading') return <div className={styles.readerLoading}>Opening page…</div>
  if (load.status === 'missing') {
    return (
      <EmptyState icon={FileQuestion} title="This page does not exist yet">
        Nothing in the wiki is called “{load.slug}”. Nova creates pages for concepts once a source mentions them.
      </EmptyState>
    )
  }

  const { page } = load
  return (
    <article className={styles.reader}>
      <header className={styles.readerHeader}>
        <div className={styles.readerMeta}>
          <span>Updated {formatRelative(page.meta.updatedAt, now)}</span>
          <span>·</span>
          <span>
            {page.meta.sources.length} source{page.meta.sources.length === 1 ? '' : 's'}
          </span>
          <span>·</span>
          <span>{page.meta.links.length} links</span>
        </div>
        <Button variant="ghost" icon={FolderOpen} onClick={() => window.api.openPath(page.meta.path)}>
          Open file
        </Button>
      </header>
      {page.meta.tags.length > 0 && (
        <div className={styles.tagRow}>
          {page.meta.tags.map((tag) => (
            <span key={tag} className={styles.tag}>
              #{tag}
            </span>
          ))}
        </div>
      )}
      <Markdown source={withTitle(page.markdown, page.title)} onWikiLink={openTarget} hasPage={(t) => resolve(t) !== null} className={styles.readerBody} />
      {backlinks.length > 0 && (
        <footer className={styles.backlinks}>
          <div className={styles.backlinksTitle}>Linked from</div>
          <div className={styles.tagRow}>
            {backlinks.map((p) => (
              <button key={p.slug} className={styles.linkChip} onClick={() => navigation.openPage(p.slug)}>
                {bySlug.get(p.slug)?.title ?? p.slug}
              </button>
            ))}
          </div>
        </footer>
      )}
    </article>
  )
}

/** Pages normally start with their own H1; add one when they do not so every page reads the same. */
function withTitle(markdown: string, title: string): string {
  const body = markdown.replace(/^---\n[\s\S]*?\n---\n?/, '')
  return /^\s*#\s/.test(body) ? body : `# ${title}\n\n${body}`
}
