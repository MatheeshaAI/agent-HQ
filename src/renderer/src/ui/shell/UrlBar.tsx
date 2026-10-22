import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Check, Globe, LoaderCircle, X } from 'lucide-react'
import { normaliseUrl } from '../../state/derived'
import styles from './TopBar.module.css'

type Feedback = { kind: 'error' | 'added'; message: string } | null

const FEEDBACK_MS = 3200

export function UrlBar(): JSX.Element {
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<Feedback>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!feedback) return
    const timer = setTimeout(() => setFeedback(null), FEEDBACK_MS)
    return () => clearTimeout(timer)
  }, [feedback])

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    if (busy || !value.trim()) return
    const url = normaliseUrl(value)
    if (!url) {
      setFeedback({ kind: 'error', message: 'Enter a valid http(s) URL' })
      return
    }
    setBusy(true)
    try {
      await window.api.addUrl(url)
      setValue('')
      setFeedback({ kind: 'added', message: 'Added to the inbox' })
    } catch (error) {
      setFeedback({ kind: 'error', message: error instanceof Error ? error.message : 'Could not add this URL' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className={`${styles.url} ${feedback?.kind === 'error' ? styles.urlInvalid : ''}`} onSubmit={submit}>
      <Globe size={20} strokeWidth={1.7} className={styles.urlIcon} />
      <input
        ref={inputRef}
        className={styles.urlInput}
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
          if (feedback?.kind === 'error') setFeedback(null)
        }}
        placeholder="Paste a URL to ingest, then press Enter"
        spellCheck={false}
        aria-label="Source URL"
        aria-invalid={feedback?.kind === 'error'}
      />
      {busy ? (
        <LoaderCircle size={16} className={`${styles.urlAction} spin`} />
      ) : (
        value && (
          <button
            type="button"
            className={styles.urlAction}
            onClick={() => {
              setValue('')
              setFeedback(null)
              inputRef.current?.focus()
            }}
            aria-label="Clear URL"
          >
            <X size={17} strokeWidth={1.8} />
          </button>
        )
      )}
      {feedback && (
        <div className={`${styles.urlFeedback} ${feedback.kind === 'error' ? styles.urlFeedbackError : ''}`} role="alert">
          {feedback.kind === 'added' && <Check size={13} strokeWidth={2.4} />}
          {feedback.message}
        </div>
      )}
    </form>
  )
}
