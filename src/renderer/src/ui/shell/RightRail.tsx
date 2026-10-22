import type { ReactNode } from 'react'
import { CircleMinus, ListTodo, Radio } from 'lucide-react'
import { useSnapshot } from '../../state/snapshot'
import { navigation } from '../../state/navigation'
import { formatRelative, useNow } from '../../state/clock'
import { agentPresence, onlineAgentCount, tasksForDisplay } from '../../state/derived'
import { ACTIVITY_ICONS, AGENT_ICONS, activityTone, type TileTone } from '../common/icons'
import { IconTile } from '../common/IconTile'
import { StatusDot } from '../common/StatusDot'
import { EmptyState } from '../common/EmptyState'
import { useFitCount } from '../common/useFitCount'
import type { TaskItem } from '@shared/types'
import styles from './RightRail.module.css'

const ACTIVITY_ROW_H = 52
const TASK_ROW_H = 42

export function RightRail(): JSX.Element {
  return (
    <aside className={styles.rail}>
      <LiveActivityCard />
      <CurrentTasksCard />
      <AgentStatusCard />
    </aside>
  )
}

interface CardProps {
  title: string
  icon?: ReactNode
  aside?: ReactNode
  className: string
  children: ReactNode
}

function Card({ title, icon, aside, className, children }: CardProps): JSX.Element {
  return (
    <section className={`${styles.card} ${className}`}>
      <header className={styles.cardHeader}>
        {icon}
        <h2 className={styles.cardTitle}>{title}</h2>
        {aside}
      </header>
      {children}
    </section>
  )
}

function ViewAll({ onClick }: { onClick: () => void }): JSX.Element {
  return (
    <button className={styles.viewAll} onClick={onClick}>
      View All
    </button>
  )
}

function LiveActivityCard(): JSX.Element {
  const { activity } = useSnapshot()
  const now = useNow()
  const [listRef, fit] = useFitCount<HTMLUListElement>(ACTIVITY_ROW_H)

  return (
    <Card
      className={styles.activityCard}
      title="Live Activity"
      icon={<span className={styles.liveIcon} aria-hidden />}
      aside={<ViewAll onClick={() => navigation.go('agents')} />}
    >
      <ul ref={listRef} className={styles.list}>
        {activity.length === 0 ? (
          <EmptyState compact icon={Radio} title="All quiet">
            Agent activity appears here as soon as a source arrives.
          </EmptyState>
        ) : (
          activity.slice(0, fit).map((item) => (
            <li key={item.id} className={styles.activityRow} title={`${item.title}\n${item.detail}`}>
              <IconTile icon={ACTIVITY_ICONS[item.kind]} tone={activityTone(item.kind)} size={32} />
              <div className={styles.rowText}>
                <div className={styles.activityTitle}>{item.title}</div>
                <div className={styles.activityDetail}>{item.detail}</div>
              </div>
              <time className={styles.activityTime}>{formatRelative(item.at, now)}</time>
            </li>
          ))
        )}
      </ul>
    </Card>
  )
}

const TASK_TONES: Record<TaskItem['status'], TileTone> = {
  running: 'teal',
  queued: 'amber',
  done: 'slate',
  failed: 'red'
}

function CurrentTasksCard(): JSX.Element {
  const { tasks, agents } = useSnapshot()
  const now = useNow()
  const [listRef, fit] = useFitCount<HTMLUListElement>(TASK_ROW_H)
  const roleOf = new Map(agents.map((a) => [a.id, a.role]))

  return (
    <Card
      className={styles.tasksCard}
      title="Current Tasks"
      icon={<CircleMinus size={14} strokeWidth={2.6} className={styles.tasksIcon} aria-hidden />}
      aside={<ViewAll onClick={() => navigation.go('tasks')} />}
    >
      <ul ref={listRef} className={styles.list}>
        {tasks.length === 0 ? (
          <EmptyState compact icon={ListTodo} title="No tasks yet">
            Drop a file or paste a URL to give the agents work.
          </EmptyState>
        ) : (
          tasksForDisplay(tasks)
            .slice(0, fit)
            .map((task) => (
              <li key={task.id} className={styles.taskRow} title={task.error ?? task.title}>
                <IconTile icon={AGENT_ICONS[task.agent]} tone={TASK_TONES[task.status]} size={28} />
                <div className={styles.rowText}>
                  <div className={styles.taskTitle}>{task.title}</div>
                  <div className={styles.taskRole}>{roleOf.get(task.agent) ?? task.agent}</div>
                </div>
                <time className={styles.taskTime}>{formatRelative(task.updatedAt, now)}</time>
              </li>
            ))
        )}
      </ul>
    </Card>
  )
}

function AgentStatusCard(): JSX.Element {
  const { agents } = useSnapshot()
  const online = onlineAgentCount(agents)

  return (
    <Card
      className={styles.statusCard}
      title="Agent Status"
      aside={
        <span className={styles.onlineCount}>
          <StatusDot tone={online === agents.length ? 'green' : 'amber'} size={7} />
          {online} / {agents.length} online
        </span>
      }
    >
      <ul className={styles.statusList}>
        {agents.map((agent) => {
          const presence = agentPresence(agent.state)
          return (
            <li key={agent.id}>
              <button className={styles.statusRow} onClick={() => navigation.focusAgent(agent.id)} title={`${agent.name}: ${agent.activity}`}>
                <IconTile icon={AGENT_ICONS[agent.id]} tone={agent.state === 'error' ? 'red' : 'green'} size={24} />
                <span className={styles.statusRole}>{agent.role}</span>
                <StatusDot tone={presence.tone} size={7} />
                <span className={`${styles.presence} ${styles[`presence_${presence.tone}`]}`}>{presence.label}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
