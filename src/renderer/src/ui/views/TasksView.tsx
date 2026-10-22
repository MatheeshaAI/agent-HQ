import { useState } from 'react'
import { ListTodo, RefreshCw } from 'lucide-react'
import type { TaskItem, TaskStatus } from '@shared/types'
import { useSnapshot } from '../../state/snapshot'
import { navigation } from '../../state/navigation'
import { formatClock, formatRelative, useNow } from '../../state/clock'
import { tasksForDisplay, type Tone } from '../../state/derived'
import { AGENT_ICONS } from '../common/icons'
import { IconTile } from '../common/IconTile'
import { StatusChip } from '../common/StatusDot'
import { EmptyState } from '../common/EmptyState'
import { Button } from '../common/Button'
import { ViewFrame } from './ViewFrame'
import styles from './views.module.css'

type Filter = 'all' | 'active' | 'failed' | 'done'

const FILTERS: { id: Filter; label: string; accepts: (status: TaskStatus) => boolean }[] = [
  { id: 'all', label: 'All', accepts: () => true },
  { id: 'active', label: 'In progress', accepts: (s) => s === 'queued' || s === 'running' },
  { id: 'failed', label: 'Failed', accepts: (s) => s === 'failed' },
  { id: 'done', label: 'Done', accepts: (s) => s === 'done' }
]

const TASK_STATUS: Record<TaskStatus, { label: string; tone: Tone }> = {
  queued: { label: 'Queued', tone: 'amber' },
  running: { label: 'Running', tone: 'blue' },
  done: { label: 'Done', tone: 'green' },
  failed: { label: 'Failed', tone: 'red' }
}

export function TasksView(): JSX.Element {
  const { tasks } = useSnapshot()
  const [filter, setFilter] = useState<Filter>('all')
  const accepts = FILTERS.find((f) => f.id === filter)!.accepts
  const rows = tasksForDisplay(tasks).filter((t) => accepts(t.status))

  return (
    <ViewFrame
      title="Tasks"
      subtitle="Every step the agents take on your sources"
      actions={
        <div className={styles.segmented} role="tablist">
          {FILTERS.map((f) => (
            <button key={f.id} role="tab" aria-selected={filter === f.id} className={filter === f.id ? styles.segmentActive : ''} onClick={() => setFilter(f.id)}>
              {f.label}
              <span className={styles.segmentCount}>{tasks.filter((t) => f.accepts(t.status)).length}</span>
            </button>
          ))}
        </div>
      }
      bare
    >
      {tasks.length === 0 ? (
        <EmptyState
          icon={ListTodo}
          title="No tasks yet"
          actions={
            <Button variant="primary" onClick={() => navigation.go('inbox')}>
              Add a source
            </Button>
          }
        >
          Tasks appear when a source enters the pipeline: reading, extracting concepts, linking pages and writing summaries.
        </EmptyState>
      ) : rows.length === 0 ? (
        <EmptyState icon={ListTodo} title="Nothing here">
          No tasks match this filter.
        </EmptyState>
      ) : (
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ width: 118 }}>Status</th>
                <th>Task</th>
                <th style={{ width: 190 }}>Agent</th>
                <th style={{ width: 110 }}>Started</th>
                <th style={{ width: 110 }}>Updated</th>
                <th style={{ width: 96 }} aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {rows.map((task) => (
                <TaskRow key={task.id} task={task} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ViewFrame>
  )
}

function TaskRow({ task }: { task: TaskItem }): JSX.Element {
  const { agents } = useSnapshot()
  const now = useNow()
  const [retrying, setRetrying] = useState(false)
  const agent = agents.find((a) => a.id === task.agent)
  const status = TASK_STATUS[task.status]
  const retrySourceId = task.status === 'failed' ? task.sourceId : undefined

  const retry = async (sourceId: string): Promise<void> => {
    setRetrying(true)
    try {
      await window.api.retrySource(sourceId)
    } finally {
      setRetrying(false)
    }
  }

  return (
    <tr>
      <td>
        <StatusChip tone={status.tone} label={status.label} pulse={task.status === 'running'} />
      </td>
      <td>
        <div className={styles.cellTitle}>{task.title}</div>
        {task.error && <div className={styles.cellError}>{task.error}</div>}
      </td>
      <td>
        <div className={styles.cellAgent}>
          <IconTile icon={AGENT_ICONS[task.agent]} size={26} tone={task.agent === 'muse' ? 'indigo' : 'teal'} />
          <div>
            <div>{agent?.name ?? task.agent}</div>
            <div className={styles.muted}>{agent?.role}</div>
          </div>
        </div>
      </td>
      <td className={styles.muted} title={new Date(task.createdAt).toLocaleString()}>
        {formatClock(task.createdAt)}
      </td>
      <td className={styles.muted} title={new Date(task.updatedAt).toLocaleString()}>
        {formatRelative(task.updatedAt, now)}
      </td>
      <td>
        {retrySourceId && (
          <Button variant="secondary" icon={RefreshCw} busy={retrying} onClick={() => retry(retrySourceId)}>
            Retry
          </Button>
        )}
      </td>
    </tr>
  )
}
