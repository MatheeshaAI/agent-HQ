import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { MessageSquare, Play, Users } from 'lucide-react'
import type { AgentDef, AgentRunInfo, AgentStatus } from '@shared/types'
import { useSnapshot } from '../../state/snapshot'
import { navigation, useNavigation } from '../../state/navigation'
import { drawer } from '../../state/drawer'
import { formatRelative, useNow } from '../../state/clock'
import { activityFor, agentStateLabel, agentStateTone, onlineAgentCount, pendingTaskCount } from '../../state/derived'
import { ROOM_LABEL } from '../../state/rooms'
import { ACTIVITY_ICONS, activityTone, agentIcon, agentTone } from '../common/icons'
import { IconTile } from '../common/IconTile'
import { RoomChip } from '../common/RoomChip'
import { StatusChip } from '../common/StatusDot'
import { EmptyState } from '../common/EmptyState'
import { Button } from '../common/Button'
import { ViewFrame } from './ViewFrame'
import styles from './views.module.css'

const RECENT_PER_AGENT = 4

type Runs = Record<string, AgentRunInfo>

/** Last run of each room agent. Reloads when the snapshot reports new activity, and on demand. */
function useAgentRuns(): [Runs, () => void] {
  const { activity } = useSnapshot()
  const [runs, setRuns] = useState<Runs>({})
  const load = useCallback(() => {
    window.api
      .agentRuns()
      .then((list) => setRuns(Object.fromEntries(list.map((run) => [run.agentId, run]))))
      .catch(() => undefined)
  }, [])
  const latest = activity[0]?.id
  useEffect(() => {
    load()
  }, [load, latest])
  return [runs, load]
}

export function AgentsView(): JSX.Element {
  const { agents, tasks, settings } = useSnapshot()
  const focused = useNavigation((s) => s.agentId)
  const [runs, reloadRuns] = useAgentRuns()
  const online = onlineAgentCount(agents)
  const defs = settings.agentDefs
  const chiefs = defs.filter((d) => d.kind === 'chief')
  const inRoom = (room: AgentDef['room']): AgentDef[] => defs.filter((d) => d.kind === 'room' && d.room === room)

  return (
    <ViewFrame
      title="Agents"
      subtitle={`${online} of ${agents.length} online · ${pendingTaskCount(tasks)} tasks in the pipeline`}
    >
      {agents.length === 0 && defs.length === 0 ? (
        <EmptyState icon={Users} title="No agents running">
          The engine has not reported any agents yet.
        </EmptyState>
      ) : (
        <div className={styles.agentGroups}>
          {chiefs.length > 0 && (
            <AgentGroup title="Chief">
              {chiefs.map((def) => (
                <RoomAgentCard key={def.id} def={def} run={runs[def.id]} onRan={reloadRuns} />
              ))}
            </AgentGroup>
          )}
          <AgentGroup title="Brain">
            {agents.map((agent) => (
              <AgentCard key={agent.id} agent={agent} focused={agent.id === focused} />
            ))}
          </AgentGroup>
          {(['office', 'personal'] as const).map((room) => {
            const list = inRoom(room)
            if (list.length === 0) return null
            return (
              <AgentGroup key={room} title={room === 'office' ? 'Office work' : 'Personal work'}>
                {list.map((def) => (
                  <RoomAgentCard key={def.id} def={def} run={runs[def.id]} onRan={reloadRuns} />
                ))}
              </AgentGroup>
            )
          })}
        </div>
      )}
    </ViewFrame>
  )
}

function AgentGroup({ title, children }: { title: string; children: ReactNode }): JSX.Element | null {
  const count = Array.isArray(children) ? children.filter(Boolean).length : children ? 1 : 0
  if (count === 0) return null
  return (
    <section className={styles.agentGroup}>
      <h2 className={styles.groupTitle}>{title}</h2>
      <div className={styles.agentGrid}>{children}</div>
    </section>
  )
}

/** A Chief or room agent: not in the pipeline, so it has no live state. Room agents can be run by hand. */
function RoomAgentCard({ def, run, onRan }: { def: AgentDef; run: AgentRunInfo | undefined; onRan: () => void }): JSX.Element {
  const now = useNow()
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const running = busy || run?.running === true
  const isRoom = def.kind === 'room'

  const runNow = async (): Promise<void> => {
    setBusy(true)
    setNotice(null)
    try {
      const result = await window.api.runAgent(def.id)
      setNotice(result.ok ? { kind: 'ok', text: `Filed ${result.title ?? 'a note'} in the Inbox` } : { kind: 'error', text: result.error ?? 'The run failed' })
    } catch (error) {
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'The run failed' })
    } finally {
      setBusy(false)
      onRan()
    }
  }

  // The drawer is mounted by the Shell, so it opens right here over the Agents view.
  const chat = (): void => drawer.open(def.id)

  return (
    <article className={styles.agentCard}>
      <header className={styles.agentHead}>
        <IconTile icon={agentIcon(def.id)} tone={agentTone(def.id)} size={42} shape="rounded" />
        <div className={styles.agentIdentity}>
          <div className={styles.agentName}>{def.name}</div>
          <div className={styles.agentRole}>{def.role}</div>
        </div>
        {def.enabled ? (
          <StatusChip tone={running ? 'green' : 'grey'} label={running ? 'Working' : 'Ready'} pulse={running} />
        ) : (
          <StatusChip tone="grey" label="Off" />
        )}
      </header>

      <div className={styles.agentMetaRow}>
        <RoomChip room={def.room} />
        {isRoom && <span className={styles.muted}>{scheduleText(def)}</span>}
      </div>

      <div className={styles.agentMetaRow}>
        <span>
          {run?.lastRunAt ? `Last run ${formatRelative(run.lastRunAt, now)}` : 'Not run yet'}
          {run?.ok === false && run.error ? <span className={styles.cellError}> · {run.error}</span> : null}
          {run?.ok && run.title ? <span className={styles.muted}> · {run.title}</span> : null}
        </span>
      </div>

      {notice && <div className={notice.kind === 'ok' ? styles.noticeOk : styles.noticeError}>{notice.text}</div>}

      <div className={styles.agentActions}>
        {isRoom && (
          <Button variant="secondary" icon={Play} busy={running} disabled={!def.enabled || running} onClick={runNow}>
            Run now
          </Button>
        )}
        <Button variant="ghost" icon={MessageSquare} onClick={chat}>
          Chat
        </Button>
      </div>
    </article>
  )
}

function scheduleText(def: AgentDef): string {
  const schedule = def.schedule
  if (!schedule || schedule.mode === 'off') return `Runs by hand · ${ROOM_LABEL[def.room]} room`
  if (schedule.mode === 'interval') return `Every ${schedule.everyMinutes ?? '?'} min`
  return `Daily at ${schedule.at ?? '??:??'}`
}

function AgentCard({ agent, focused }: { agent: AgentStatus; focused: boolean }): JSX.Element {
  const { activity, tasks } = useSnapshot()
  const now = useNow()
  const ref = useRef<HTMLElement>(null)
  const recent = activityFor(agent.id, activity, RECENT_PER_AGENT)
  const busy = agent.state === 'working' || agent.state === 'thinking'
  const queue = tasks.filter((t) => t.agent === agent.id && (t.status === 'queued' || t.status === 'running')).length

  useEffect(() => {
    if (focused) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [focused])

  return (
    <article ref={ref} className={`${styles.agentCard} ${focused ? styles.agentCardFocused : ''}`}>
      <header className={styles.agentHead}>
        <IconTile icon={agentIcon(agent.id)} tone={agent.state === 'error' ? 'red' : agentTone(agent.id)} size={42} shape="rounded" />
        <div className={styles.agentIdentity}>
          <div className={styles.agentName}>{agent.name}</div>
          <div className={styles.agentRole}>{agent.role}</div>
        </div>
        <StatusChip tone={agentStateTone(agent.state)} label={agentStateLabel(agent.state)} pulse={busy} />
      </header>

      <div className={styles.agentNow}>
        <span className={styles.agentNowLabel}>Now</span>
        <span className={styles.agentNowText}>{agent.activity}</span>
        <span className={styles.agentNowTime}>{formatRelative(agent.updatedAt, now)}</span>
      </div>

      <div className={styles.agentMetaRow}>
        <span>{queue === 0 ? 'Queue empty' : `${queue} task${queue === 1 ? '' : 's'} queued`}</span>
        {agent.id === 'muse' && (
          <button className={styles.textLink} onClick={() => navigation.focusAsk()}>
            Ask Muse
          </button>
        )}
      </div>

      <div className={styles.agentRecentTitle}>Recent activity</div>
      {recent.length === 0 ? (
        <div className={styles.agentRecentEmpty}>Nothing yet.</div>
      ) : (
        <ul className={styles.agentRecent}>
          {recent.map((item) => (
            <li key={item.id}>
              <IconTile icon={ACTIVITY_ICONS[item.kind]} tone={activityTone(item.kind)} size={26} />
              <div className={styles.agentRecentText}>
                <div>{item.title}</div>
                <div className={styles.muted}>{item.detail}</div>
              </div>
              <time className={styles.muted}>{formatRelative(item.at, now)}</time>
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}
