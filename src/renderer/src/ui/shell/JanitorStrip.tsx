import { useCallback, useRef, useState } from 'react'
import { CircleCheck, Clock, Link2Off, LoaderCircle, TriangleAlert } from 'lucide-react'
import type { JanitorReport } from '@shared/types'
import { useSnapshot } from '../../state/snapshot'
import { usePages } from '../../state/pages'
import { navigation } from '../../state/navigation'
import { formatRelative, useNow } from '../../state/clock'
import type { Tone } from '../../state/derived'
import { Popover } from '../common/Popover'
import { JanitorBot } from '../common/glyphs'
import { StatusDot } from '../common/StatusDot'
import styles from './BottomBar.module.css'

function janitorStatus(janitor: JanitorReport, failed: boolean): { label: string; tone: Tone } {
  if (janitor.running) return { label: 'Checking…', tone: 'blue' }
  if (failed) return { label: 'Error', tone: 'red' }
  if (janitor.checkedAt !== null) return { label: 'Active', tone: 'green' }
  return { label: 'Standby', tone: 'grey' }
}

/** Axel the janitor: status, wiki health findings and the manual "check now" trigger. */
export function JanitorStrip(): JSX.Element {
  const { janitor, agents } = useSnapshot()
  const now = useNow()
  const axel = agents.find((a) => a.id === 'axel')
  const status = janitorStatus(janitor, axel?.state === 'error')
  const [open, setOpen] = useState<'contradictions' | 'orphans' | null>(null)
  const contradictionsRef = useRef<HTMLButtonElement>(null)
  const orphansRef = useRef<HTMLButtonElement>(null)
  const close = useCallback(() => setOpen(null), [])
  const toggle = (which: 'contradictions' | 'orphans'): void => setOpen((o) => (o === which ? null : which))

  const contradictionCount = janitor.contradictions.length
  const lastCheck = janitor.running ? (
    'Checking now…'
  ) : janitor.checkedAt === null ? (
    'Not checked yet'
  ) : (
    <span>
      <span className={styles.wide}>Last check </span>
      {formatRelative(janitor.checkedAt, now)}
    </span>
  )

  return (
    <div className={styles.janitor}>
      <div className={styles.identity} title={axel?.activity}>
        <span className={styles.avatarTile}>
          <JanitorBot size={34} />
        </span>
        <span className={styles.identityName}>{axel ? `${axel.name} - ${axel.role}` : 'Axel - Janitor'}</span>
        <span className={`${styles.statusPill} ${styles[`statusPill_${status.tone}`]}`}>
          <span className={styles.ringDot}>
            <StatusDot tone={status.tone} size={7} pulse={janitor.running} />
          </span>
          {status.label}
        </span>
      </div>

      <div className={styles.anchor}>
        <button
          ref={contradictionsRef}
          className={`${styles.pill} ${contradictionCount > 0 ? styles.pillWarn : ''}`}
          onClick={() => toggle('contradictions')}
          aria-expanded={open === 'contradictions'}
        >
          {contradictionCount > 0 ? (
            <TriangleAlert size={18} strokeWidth={2.2} className={styles.warnIcon} />
          ) : (
            <CircleCheck size={17} strokeWidth={2} className={styles.okIcon} />
          )}
          {contradictionCount > 0 ? (
            <span>
              {contradictionCount} contradiction{contradictionCount === 1 ? '' : 's'}
              <span className={styles.wide}> found</span>
            </span>
          ) : (
            'No contradictions'
          )}
        </button>
        <Popover open={open === 'contradictions'} onClose={close} anchorRef={contradictionsRef} width={380}>
          <ContradictionList janitor={janitor} onOpen={close} />
        </Popover>
      </div>

      <div className={styles.anchor}>
        <button ref={orphansRef} className={styles.pill} onClick={() => toggle('orphans')} aria-expanded={open === 'orphans'}>
          <Link2Off size={16} strokeWidth={2.2} className={styles.orphanIcon} />
          <span>
            {janitor.orphans.length} orphan<span className={styles.wide}> page</span>
            {janitor.orphans.length === 1 ? '' : 's'}
          </span>
        </button>
        <Popover open={open === 'orphans'} onClose={close} anchorRef={orphansRef} width={320}>
          <OrphanList orphans={janitor.orphans} onOpen={close} />
        </Popover>
      </div>

      <button
        className={styles.pill}
        onClick={() => window.api.runJanitor()}
        disabled={janitor.running}
        title="Run the janitor's checks now"
      >
        {janitor.running ? (
          <LoaderCircle size={17} strokeWidth={2} className="spin" />
        ) : (
          <Clock size={17} strokeWidth={2} className={styles.clockIcon} />
        )}
        {lastCheck}
      </button>
    </div>
  )
}

function PageChip({ slug, onOpen }: { slug: string; onOpen: () => void }): JSX.Element {
  const { bySlug } = usePages()
  return (
    <button
      className={styles.pageChip}
      onClick={() => {
        navigation.openPage(slug)
        onOpen()
      }}
    >
      {bySlug.get(slug)?.title ?? slug}
    </button>
  )
}

function ContradictionList({ janitor, onOpen }: { janitor: JanitorReport; onOpen: () => void }): JSX.Element {
  return (
    <div className={styles.popList}>
      <div className={styles.popTitle}>Contradictions</div>
      {janitor.note && <div className={styles.popNote}>{janitor.note}</div>}
      {janitor.contradictions.length === 0 ? (
        <div className={styles.popEmpty}>
          {janitor.checkedAt === null ? 'Axel has not checked the wiki yet.' : 'No pages disagree with each other.'}
        </div>
      ) : (
        janitor.contradictions.map((item, index) => (
          <div key={index} className={styles.popItem}>
            <div className={styles.popText}>{item.description}</div>
            <div className={styles.chipRow}>
              {item.pages.map((slug) => (
                <PageChip key={slug} slug={slug} onOpen={onOpen} />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}

function OrphanList({ orphans, onOpen }: { orphans: string[]; onOpen: () => void }): JSX.Element {
  return (
    <div className={styles.popList}>
      <div className={styles.popTitle}>Orphan pages</div>
      <div className={styles.popNote}>No other page links to these yet.</div>
      {orphans.length === 0 ? (
        <div className={styles.popEmpty}>Every page is linked from somewhere.</div>
      ) : (
        <div className={styles.chipRow}>
          {orphans.map((slug) => (
            <PageChip key={slug} slug={slug} onOpen={onOpen} />
          ))}
        </div>
      )}
    </div>
  )
}
