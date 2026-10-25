import { useEffect, useRef, useState } from 'react'
import type { BroadcastResult } from '@shared/types'
import { useSnapshot } from '../../state/snapshot'
import { chat } from '../../state/chat'
import styles from './BroadcastDialog.module.css'

/**
 * "Broadcast to all agents": write one message, confirm the recipients, send, then see what happened per agent.
 * This is its own channel; it never goes through a private conversation.
 */
export function BroadcastDialog({ onClose }: { onClose: () => void }): JSX.Element {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<BroadcastResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const field = useRef<HTMLTextAreaElement>(null)
  // Same rule as the engine: every agent except room agents that are switched off.
  const { agentDefs } = useSnapshot().settings
  const AGENTS = agentDefs.filter((d) => d.kind !== 'room' || d.enabled)
  const nameOf = (id: string): string => agentDefs.find((d) => d.id === id)?.name ?? id

  useEffect(() => field.current?.focus(), [])

  const send = async (): Promise<void> => {
    setSending(true)
    setError(null)
    try {
      setResult(await chat.broadcast(text, AGENTS.map((a) => a.id)))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSending(false)
    }
  }

  const delivered = result?.deliveries.filter((d) => d.status === 'delivered').length ?? 0

  return (
    <div className={styles.backdrop} onMouseDown={(e) => e.target === e.currentTarget && !sending && onClose()}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="broadcast-title"
        onKeyDown={(e) => {
          if (e.key === 'Escape' && !sending) {
            e.stopPropagation()
            onClose()
          }
        }}
      >
        <h2 id="broadcast-title" className={styles.title}>
          Broadcast to all agents
        </h2>

        {result ? (
          <>
            <div className={styles.summary}>
              Delivered to {delivered} of {result.deliveries.length} agents
            </div>
            <ul className={styles.recipients} aria-label="Delivery results">
              {result.deliveries.map((d) => (
                <li key={d.agent} className={styles.recipient}>
                  <span className={styles.who}>{nameOf(d.agent)}</span>
                  <span className={d.status === 'delivered' ? styles.ok : styles.bad}>
                    {d.status === 'delivered' ? 'Delivered' : `Failed${d.error ? `: ${d.error}` : ''}`}
                  </span>
                </li>
              ))}
            </ul>
            <div className={styles.actions}>
              <button className={styles.primary} onClick={onClose} autoFocus>
                Close
              </button>
            </div>
          </>
        ) : (
          <>
            <textarea
              ref={field}
              className={styles.text}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Message for every agent"
              aria-label="Broadcast message"
              rows={4}
              maxLength={2000}
              disabled={sending}
            />
            <div className={styles.summary}>This message will be sent to all {AGENTS.length} agents:</div>
            <ul className={styles.recipients} aria-label="Recipients">
              {AGENTS.map((a) => (
                <li key={a.id} className={styles.recipient}>
                  <span className={styles.who}>{a.name}</span>
                  <span className={styles.role}>{a.role}</span>
                </li>
              ))}
            </ul>
            {error && (
              <div className={styles.error} role="alert">
                {error}
              </div>
            )}
            <div className={styles.actions}>
              <button className={styles.secondary} onClick={onClose} disabled={sending}>
                Cancel
              </button>
              <button className={styles.primary} onClick={() => void send()} disabled={sending || !text.trim()}>
                {sending ? 'Sending…' : `Send to all ${AGENTS.length}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
