import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { SendHorizontal } from 'lucide-react'
import type { AskResult } from '@shared/types'
import { useNavigation } from '../../state/navigation'
import { AnswerPanel, type AskState } from './AnswerPanel'
import styles from './BottomBar.module.css'

/** The "Ask a question..." box: sends the question to Muse and shows the answer above the bar. */
export function AskBox(): JSX.Element {
  const [question, setQuestion] = useState('')
  const [state, setState] = useState<AskState | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const requestId = useRef(0)
  const focusRequest = useNavigation((s) => s.askFocusRequest)

  useEffect(() => {
    if (focusRequest > 0) inputRef.current?.focus()
  }, [focusRequest])

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    const asked = question.trim()
    if (!asked || state?.status === 'loading') return
    const id = ++requestId.current
    setState({ status: 'loading', question: asked })
    let result: AskResult
    try {
      result = await window.api.ask(asked)
    } catch (error) {
      result = { answer: '', citations: [], error: error instanceof Error ? error.message : 'The question could not be answered.' }
    }
    if (id !== requestId.current) return
    setState({ status: 'done', question: asked, result })
    setQuestion('')
  }

  const dismiss = useCallback(() => {
    requestId.current++
    setState(null)
  }, [])

  return (
    <form className={styles.ask} onSubmit={submit}>
      {state && <AnswerPanel state={state} onClose={dismiss} />}
      <input
        ref={inputRef}
        className={styles.askInput}
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') dismiss()
        }}
        placeholder="Ask a question..."
        aria-label="Ask the wiki a question"
      />
      <button type="submit" className={styles.send} disabled={!question.trim() || state?.status === 'loading'} aria-label="Ask">
        <SendHorizontal size={20} strokeWidth={1.8} />
      </button>
    </form>
  )
}
