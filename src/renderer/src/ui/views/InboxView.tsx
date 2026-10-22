import { useRef, useState, type FormEvent } from 'react'
import { FileUp, Globe, Inbox, Plus, RefreshCw, StickyNote } from 'lucide-react'
import type { SourceItem, SourceStatus } from '@shared/types'
import { useSnapshot } from '../../state/snapshot'
import { usePages } from '../../state/pages'
import { navigation } from '../../state/navigation'
import { formatBytes, formatRelative, useNow } from '../../state/clock'
import { inboxCount, normaliseUrl, type Tone } from '../../state/derived'
import { SOURCE_ICONS } from '../common/icons'
import { IconTile } from '../common/IconTile'
import { StatusChip } from '../common/StatusDot'
import { EmptyState } from '../common/EmptyState'
import { Button } from '../common/Button'
import { ViewFrame } from './ViewFrame'
import styles from './views.module.css'

const SOURCE_STATUS: Record<SourceStatus, { label: string; tone: Tone }> = {
  queued: { label: 'Queued', tone: 'amber' },
  processing: { label: 'Processing', tone: 'blue' },
  ingested: { label: 'Ingested', tone: 'green' },
  failed: { label: 'Failed', tone: 'red' }
}

type Notice = { kind: 'ok' | 'error'; text: string } | null

function errorText(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

export function InboxView(): JSX.Element {
  const { sources } = useSnapshot()
  const pending = inboxCount(sources)

  return (
    <ViewFrame
      title="Inbox"
      subtitle={pending > 0 ? `${pending} source${pending === 1 ? '' : 's'} waiting for the agents` : 'Everything here has been processed'}
      bare
    >
      <div className={styles.inbox}>
        <div className={styles.inboxAdd}>
          <DropZone />
          <AddUrl />
          <AddNote />
        </div>
        <div className={styles.inboxList}>
          {sources.length === 0 ? (
            <EmptyState icon={Inbox} title="Your inbox is empty">
              Sources you add land in raw/ inside your knowledge folder. The agents read each one and file what they learn into
              the wiki.
            </EmptyState>
          ) : (
            <ul className={styles.sourceList}>
              {sources.map((source) => (
                <SourceRow key={source.id} source={source} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </ViewFrame>
  )
}

function DropZone(): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null)
  const [notice, setNotice] = useState<Notice>(null)

  const addFiles = async (files: FileList | null): Promise<void> => {
    const paths = Array.from(files ?? [])
      .map((file) => window.api.pathForFile(file))
      .filter(Boolean)
    if (paths.length === 0) return
    try {
      const added = await window.api.addFiles(paths)
      setNotice({ kind: 'ok', text: `${added.length} file${added.length === 1 ? '' : 's'} added` })
    } catch (error) {
      setNotice({ kind: 'error', text: errorText(error, 'Those files could not be added') })
    }
  }

  return (
    <button className={styles.dropZone} onClick={() => inputRef.current?.click()}>
      <span className={styles.dropIcon}>
        <FileUp size={26} strokeWidth={1.7} />
      </span>
      <span className={styles.dropTitle}>Drop files anywhere</span>
      <span className={styles.dropText}>PDF, Markdown, text or images, or click to browse</span>
      {notice && <span className={notice.kind === 'ok' ? styles.noticeOk : styles.noticeError}>{notice.text}</span>}
      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          addFiles(e.target.files)
          e.target.value = ''
        }}
      />
    </button>
  )
}

function AddUrl(): JSX.Element {
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    const url = normaliseUrl(value)
    if (!url) {
      setNotice({ kind: 'error', text: 'Enter a valid http(s) URL' })
      return
    }
    setBusy(true)
    try {
      await window.api.addUrl(url)
      setValue('')
      setNotice({ kind: 'ok', text: 'URL added' })
    } catch (error) {
      setNotice({ kind: 'error', text: errorText(error, 'Could not add this URL') })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className={styles.addCard} onSubmit={submit}>
      <div className={styles.addLabel}>
        <Globe size={15} /> Add URL
      </div>
      <div className={styles.addRow}>
        <input
          className={styles.field}
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            setNotice(null)
          }}
          placeholder="https://…"
          spellCheck={false}
        />
        <Button type="submit" variant="primary" icon={Plus} busy={busy} disabled={!value.trim()}>
          Add
        </Button>
      </div>
      {notice && <div className={notice.kind === 'ok' ? styles.noticeOk : styles.noticeError}>{notice.text}</div>}
    </form>
  )
}

function AddNote(): JSX.Element {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    if (!text.trim()) return
    setBusy(true)
    try {
      await window.api.addNote(text.trim())
      setText('')
      setNotice({ kind: 'ok', text: 'Note added' })
    } catch (error) {
      setNotice({ kind: 'error', text: errorText(error, 'Could not save this note') })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className={styles.addCard} onSubmit={submit}>
      <div className={styles.addLabel}>
        <StickyNote size={15} /> Add note
      </div>
      <textarea
        className={`${styles.field} ${styles.textarea}`}
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setNotice(null)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) e.currentTarget.form?.requestSubmit()
        }}
        placeholder="Write a thought, a quote or meeting notes…"
      />
      <div className={styles.addFooter}>
        {notice ? (
          <span className={notice.kind === 'ok' ? styles.noticeOk : styles.noticeError}>{notice.text}</span>
        ) : (
          <span className={styles.muted}>Ctrl/⌘ + Enter to add</span>
        )}
        <Button type="submit" variant="primary" icon={Plus} busy={busy} disabled={!text.trim()}>
          Add note
        </Button>
      </div>
    </form>
  )
}

function SourceRow({ source }: { source: SourceItem }): JSX.Element {
  const now = useNow()
  const { bySlug } = usePages()
  const [retrying, setRetrying] = useState(false)
  const status = SOURCE_STATUS[source.status]
  const pages = source.pages ?? []

  const retry = async (): Promise<void> => {
    setRetrying(true)
    try {
      await window.api.retrySource(source.id)
    } finally {
      setRetrying(false)
    }
  }

  return (
    <li className={styles.sourceRow}>
      <IconTile icon={SOURCE_ICONS[source.kind]} tone={source.status === 'failed' ? 'red' : 'teal'} size={34} shape="rounded" />
      <div className={styles.sourceMain}>
        <div className={styles.sourceName} title={source.name}>
          {source.name}
        </div>
        <div className={styles.sourceMeta}>
          <span className={styles.kind}>{source.kind}</span>
          {source.size !== undefined && <span>{formatBytes(source.size)}</span>}
          <span>added {formatRelative(source.addedAt, now)}</span>
          {pages.length > 0 && (
            <span>
              {pages.length} page{pages.length === 1 ? '' : 's'}
            </span>
          )}
        </div>
        {pages.length > 0 && (
          <div className={styles.tagRow}>
            {pages.slice(0, 6).map((slug) => (
              <button key={slug} className={styles.linkChip} onClick={() => navigation.openPage(slug)}>
                {bySlug.get(slug)?.title ?? slug}
              </button>
            ))}
          </div>
        )}
        {source.error && <div className={styles.cellError}>{source.error}</div>}
      </div>
      <div className={styles.sourceSide}>
        <StatusChip tone={status.tone} label={status.label} pulse={source.status === 'processing'} />
        {source.status === 'failed' && (
          <Button variant="secondary" icon={RefreshCw} busy={retrying} onClick={retry}>
            Retry
          </Button>
        )}
      </div>
    </li>
  )
}
