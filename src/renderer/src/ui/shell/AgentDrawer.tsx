import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import type { AgentDef, AgentId, AgentStatus } from '@shared/types'
import { useSnapshot } from '../../state/snapshot'
import { drawer, useDrawerAgent } from '../../state/drawer'
import { navigation } from '../../state/navigation'
import { chat, useChatHistory } from '../../state/chat'
import { BroadcastDialog } from './BroadcastDialog'
import { agentPresence, agentStateLabel, agentStateTone } from '../../state/derived'
import { IDENTITIES } from '../../office/agents/identities'
import { AgentPortrait } from '../common/AgentPortrait'
import { StatusChip, StatusDot } from '../common/StatusDot'
import styles from './AgentDrawer.module.css'

/**
 * Right-side panel for one agent: who it is, what it is doing, a private conversation and its memory.
 * Mounted by the Shell, so it opens over any view.
 */
export function AgentDrawer(): JSX.Element | null {
  const agentId = useDrawerAgent()
  const { agents, settings } = useSnapshot()
  // Pipeline agents carry live status; Chief and room agents are listed from their definitions.
  const all = useMemo<AgentStatus[]>(() => {
    const live = new Set(agents.map((a) => a.id))
    return [...agents, ...settings.agentDefs.filter((d) => !live.has(d.id)).map(statusFromDef)]
  }, [agents, settings.agentDefs])
  const agent = all.find((a) => a.id === agentId)

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
        {all.map((a) => (
          <button
            key={a.id}
            className={`${styles.switch} ${a.id === agent.id ? styles.switchActive : ''}`}
            aria-pressed={a.id === agent.id}
            aria-label={`${a.name}, ${a.role}, ${agentPresence(a.state).label}`}
            title={`${a.name} · ${a.role}`}
            style={a.id === agent.id && IDENTITIES[a.id] ? { borderColor: IDENTITIES[a.id].accent } : undefined}
            onClick={() => drawer.open(a.id)}
          >
            <AgentPortrait id={a.id} size={34} />
            <StatusDot tone={agentPresence(a.state).tone} size={7} />
          </button>
        ))}
      </nav>

      {!settings.providerReady && (
        <div className={styles.setup} role="status">
          No AI provider is set up, so agents cannot reply.{' '}
          <button className={styles.link} onClick={() => navigation.go('settings')}>
            Open Settings
          </button>
        </div>
      )}

      <Conversation key={agent.id} agentId={agent.id} name={agent.name} />
      <Memory key={`memory-${agent.id}-${settings.knowledgeDir}`} agentId={agent.id} name={agent.name} />
    </aside>
  )
}

function statusFromDef(def: AgentDef): AgentStatus {
  return { id: def.id, name: def.name, role: def.role, state: 'idle', activity: def.kind === 'room' && !def.enabled ? 'Switched off' : (def.idle ?? 'Waiting'), updatedAt: 0 }
}

function Conversation({ agentId, name }: { agentId: AgentId; name: string }): JSX.Element {
  const messages = useChatHistory(agentId)
  const [text, setText] = useState('')
  const [broadcasting, setBroadcasting] = useState(false)
  const waiting = messages.some((m) => m.pending)

  useEffect(() => {
    void chat.load(agentId)
  }, [agentId])
  const listRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    const list = listRef.current
    if (list) list.scrollTop = list.scrollHeight
  }, [messages])

  const submit = (e: FormEvent): void => {
    e.preventDefault()
    const value = text.trim()
    if (!value || waiting) return
    void chat.send(agentId, value)
    setText('')
  }

  return (
    <section className={styles.conversation}>
      <div className={styles.private}>Private message to {name}</div>
      <ul ref={listRef} className={styles.messages} aria-live="polite">
        {messages.length === 0 && <li className={styles.empty}>No messages yet.</li>}
        {messages.map((m) => (
          <li
            key={m.id}
            className={`${styles.message} ${m.from === 'user' ? styles.fromUser : styles.fromAgent} ${m.failed ? styles.failed : ''} ${m.pending ? styles.pending : ''}`}
          >
            {m.channel === 'broadcast' && <span className={styles.tag}>Broadcast</span>}
            {m.text}
            {m.failed && (
              <span className={styles.error} role="alert">
                Not sent: {m.error ?? 'unknown error'}
                <span className={styles.errorActions}>
                  <button className={styles.link} onClick={() => void chat.retry(agentId, m)}>
                    Retry
                  </button>
                  <button className={styles.link} onClick={() => chat.dismiss(agentId, m.id)}>
                    Dismiss
                  </button>
                </span>
              </span>
            )}
          </li>
        ))}
        {waiting && <li className={`${styles.message} ${styles.fromAgent} ${styles.typing}`}>{name} is thinking…</li>}
      </ul>
      <form className={styles.compose} onSubmit={submit}>
        <input
          className={styles.input}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Message ${name}`}
          aria-label={`Private message to ${name}`}
          maxLength={2000}
        />
        <button className={styles.send} type="submit" disabled={!text.trim() || waiting}>
          Send
        </button>
      </form>
      <button className={styles.broadcast} onClick={() => setBroadcasting(true)}>
        Broadcast to all agents
      </button>
      {broadcasting && <BroadcastDialog onClose={() => setBroadcasting(false)} />}
    </section>
  )
}

/** What the agent remembers (memory/<id>.md in the knowledge folder): read, edit or clear it. */
function Memory({ agentId, name }: { agentId: AgentId; name: string }): JSX.Element {
  const [open, setOpen] = useState(false)
  const [saved, setSaved] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = (): void => {
    setError(null)
    window.api
      .getAgentMemory(agentId)
      .then((memory) => {
        setSaved(memory)
        setDraft(memory)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
  }

  useEffect(() => {
    if (open) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, agentId])

  const save = async (value: string): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const stored = await window.api.setAgentMemory(agentId, value)
      setSaved(stored)
      setDraft(stored)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className={styles.memory}>
      <button className={styles.memoryToggle} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {open ? '▾' : '▸'} Memory
      </button>
      {open && (
        <>
          <textarea
            className={styles.memoryText}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={saved === null ? 'Loading…' : `${name} has not remembered anything yet. It learns from chats and runs, or write notes here.`}
            aria-label={`${name}'s memory`}
            rows={6}
            disabled={busy || saved === null}
          />
          {error && (
            <div className={styles.memoryError} role="alert">
              {error}
            </div>
          )}
          <div className={styles.memoryActions}>
            <button className={styles.link} onClick={load} disabled={busy}>
              Reload
            </button>
            <button className={styles.link} onClick={() => void save('')} disabled={busy || !saved}>
              Clear
            </button>
            <button className={styles.send} onClick={() => void save(draft)} disabled={busy || saved === null || draft === saved}>
              Save
            </button>
          </div>
        </>
      )}
    </section>
  )
}
