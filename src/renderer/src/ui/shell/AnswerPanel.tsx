import { useState } from 'react'
import { Check, Copy, KeyRound, Library, X } from 'lucide-react'
import type { AskResult } from '@shared/types'
import { useSnapshot } from '../../state/snapshot'
import { usePages } from '../../state/pages'
import { navigation } from '../../state/navigation'
import { Markdown } from '../markdown/Markdown'
import { Button } from '../common/Button'
import styles from './AnswerPanel.module.css'

export type AskState = { status: 'loading'; question: string } | { status: 'done'; question: string; result: AskResult }

interface AnswerPanelProps {
  state: AskState
  onClose: () => void
}

export function AnswerPanel({ state, onClose }: AnswerPanelProps): JSX.Element {
  const { settings } = useSnapshot()
  const { bySlug, resolve } = usePages()
  const [copied, setCopied] = useState(false)
  const openPage = (target: string): void => navigation.openPage(resolve(target) ?? target)
  const result = state.status === 'done' ? state.result : null
  const failed = result !== null && (Boolean(result.error) || !result.answer.trim())
  const needsKey = !settings.providerReady || /api key|unauthori[sz]ed|authentication|\b401\b/i.test(result?.error ?? '')

  const copy = async (): Promise<void> => {
    if (!result) return
    await navigator.clipboard.writeText(result.answer)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <section className={styles.panel} aria-live="polite">
      <header className={styles.header}>
        <span className={styles.muse}>
          <Library size={16} strokeWidth={2} />
        </span>
        <div className={styles.heading}>
          <div className={styles.who}>Muse · Librarian</div>
          <div className={styles.question}>{state.question}</div>
        </div>
        {result && !failed && (
          <button type="button" className={styles.iconButton} onClick={copy} aria-label="Copy answer" title="Copy answer">
            {copied ? <Check size={15} /> : <Copy size={15} />}
          </button>
        )}
        <button type="button" className={styles.iconButton} onClick={onClose} aria-label="Close answer" title="Close">
          <X size={16} />
        </button>
      </header>

      <div className={styles.body}>
        {state.status === 'loading' && (
          <div className={styles.loading}>
            <div className={styles.thinking}>
              <span />
              <span />
              <span />
            </div>
            Muse is reading the wiki…
            <div className={styles.skeleton} style={{ width: '92%' }} />
            <div className={styles.skeleton} style={{ width: '78%' }} />
            <div className={styles.skeleton} style={{ width: '85%' }} />
          </div>
        )}

        {result && failed && (
          <div className={styles.error}>
            <div className={styles.errorTitle}>{settings.providerReady ? 'Muse could not answer' : 'Set up an AI provider'}</div>
            <div className={styles.errorText}>
              {settings.providerReady
                ? (result.error ?? 'No answer came back. Try asking again.')
                : 'Muse answers questions with the AI provider you choose. Set it up in Settings to start asking the wiki.'}
            </div>
            {needsKey && (
              <Button
                type="button"
                variant="primary"
                icon={KeyRound}
                onClick={() => {
                  navigation.go('settings')
                  onClose()
                }}
              >
                Open Settings
              </Button>
            )}
          </div>
        )}

        {result && !failed && <Markdown source={result.answer} onWikiLink={openPage} hasPage={(t) => resolve(t) !== null} className={styles.answer} />}
      </div>

      {result && !failed && result.citations.length > 0 && (
        <footer className={styles.citations}>
          <span className={styles.citeLabel}>Sources</span>
          {result.citations.map((slug) => (
            <button type="button" key={slug} className={styles.cite} onClick={() => openPage(slug)}>
              {bySlug.get(slug)?.title ?? slug}
            </button>
          ))}
        </footer>
      )}
    </section>
  )
}
