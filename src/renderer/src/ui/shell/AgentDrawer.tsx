import { useEffect, useRef, useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { useSnapshot } from '../../state/snapshot'
import { drawer, useDrawerAgent } from '../../state/drawer'
import { chat, useChatHistory } from '../../state/chat'
import { agentPresence, agentStateLabel, agentStateTone } from '../../state/derived'
import { IDENTITIES } from '../../office/agents/identities'
import { AgentPortrait } from '../common/AgentPortrait'
import { StatusChip, StatusDot } from '../common/StatusDot'
import styles from './AgentDrawer.module.css'

/** Right-side panel for the agent clicked in the office: who it is, what it is doing, and a private conversation. */
export function AgentDrawer(): JSX.Element | null {
  const agentId = useDrawerAgent()
  const { agents } = useSnapshot()
  const agent = agents.find((a) => a.id === agentId)

  useEffect(() => {
    if (!agentId) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') drawer.close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [agentId])

  if (!agent) return null
  const busy = agent.state === 'working' || agent.state === 'thinking'

  return (
    <aside className={styles.drawer} aria-label={`${agent.name}, ${agent.role}`}>
      <header className={styles.head}>
        <AgentPortrait id={agent.id} size={52} />
        <div className={styles.identity}>
          <div className={styles.name}>{agent.name}</div>
          <div className={styles.role}>{agent.role}</div>
        </div>
        <button className={styles.close} onClick={drawer.close} aria-label="Close agent panel" title="Close (Esc)">
          <X size={16} />
        </button>
      </header>

      <div className={styles.status}>
        <StatusChip tone={agentStateTone(agent.state)} label={agentStateLabel(agent.state)} pulse={busy} />
        <span className={styles.activity}>{agent.activity}</span>
      </div>

      <nav className={styles.switcher} aria-label="Switch agent">
        {agents.map((a) => (
          <button
            key={a.id}
            className={`${styles.switch} ${a.id === agent.id ? styles.switchActive : ''}`}
            aria-pressed={a.id === agent.id}
            aria-label={`${a.name}, ${a.role}, ${agentPresence(a.state).label}`}
            title={`${a.name} · ${a.role}`}
            style={a.id === agent.id ? { borderColor: IDENTITIES[a.id].accent } : undefined}
            onClick={() => drawer.open(a.id)}
          >
            <AgentPortrait id={a.id} size={34} />
            <StatusDot tone={agentPresence(a.state).tone} size={7} />
          </button>
        ))}
      </nav>

      <Conversation key={agent.id} agentId={agent.id} name={agent.name} />
    </aside>
  )
}

function Conversation({ agentId, name }: { agentId: Parameters<typeof chat.send>[0]; name: string }): JSX.Element {
  const messages = useChatHistory(agentId)
  const [text, setText] = useState('')
  const listRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    const list = listRef.current
    if (list) list.scrollTop = list.scrollHeight
  }, [messages])

  const submit = (e: FormEvent): void => {
    e.preventDefault()
    const value = text.trim()
    if (!value) return
    chat.send(agentId, value)
    setText('')
  }

  return (
    <section className={styles.conversation}>
      <div className={styles.private}>Private message to {name}</div>
      <div className={styles.notice}>Simulated replies until the backend is connected.</div>
      <ul ref={listRef} className={styles.messages} aria-live="polite">
        {messages.length === 0 && <li className={styles.empty}>No messages yet.</li>}
        {messages.map((m) => (
          <li key={m.id} className={`${styles.message} ${m.from === 'user' ? styles.fromUser : styles.fromAgent}`}>
            {m.text}
          </li>
        ))}
      </ul>
      <form className={styles.compose} onSubmit={submit}>
        <input
          className={styles.input}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Message ${name}`}
          aria-label={`Private message to ${name}`}
        />
        <button className={styles.send} type="submit" disabled={!text.trim()}>
          Send
        </button>
      </form>
    </section>
  )
}
