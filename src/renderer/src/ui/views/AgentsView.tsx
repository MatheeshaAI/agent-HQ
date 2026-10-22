import { useEffect, useRef } from 'react'
import { Users } from 'lucide-react'
import type { AgentStatus } from '@shared/types'
import { useSnapshot } from '../../state/snapshot'
import { navigation, useNavigation } from '../../state/navigation'
import { formatRelative, useNow } from '../../state/clock'
import { activityFor, agentStateLabel, agentStateTone, onlineAgentCount, pendingTaskCount } from '../../state/derived'
import { ACTIVITY_ICONS, AGENT_ICONS, activityTone } from '../common/icons'
import { IconTile } from '../common/IconTile'
import { StatusChip } from '../common/StatusDot'
import { EmptyState } from '../common/EmptyState'
import { ViewFrame } from './ViewFrame'
import styles from './views.module.css'

const RECENT_PER_AGENT = 4

export function AgentsView(): JSX.Element {
  const { agents, tasks } = useSnapshot()
  const focused = useNavigation((s) => s.agentId)
  const online = onlineAgentCount(agents)

  return (
    <ViewFrame
      title="Agents"
      subtitle={`${online} of ${agents.length} online · ${pendingTaskCount(tasks)} tasks in the pipeline`}
    >
      {agents.length === 0 ? (
        <EmptyState icon={Users} title="No agents running">
          The engine has not reported any agents yet.
        </EmptyState>
      ) : (
        <div className={styles.agentGrid}>
          {agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} focused={agent.id === focused} />
          ))}
        </div>
      )}
    </ViewFrame>
  )
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
        <IconTile icon={AGENT_ICONS[agent.id]} tone={agent.state === 'error' ? 'red' : agent.id === 'muse' ? 'indigo' : 'teal'} size={42} shape="rounded" />
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
