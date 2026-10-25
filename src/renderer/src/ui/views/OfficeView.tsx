import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import type { AgentRunInfo, AgentStatus } from '@shared/types'
import { useSnapshot } from '../../state/snapshot'
import { navigation } from '../../state/navigation'
import { drawer } from '../../state/drawer'
import styles from './views.module.css'

const OfficeScene = lazy(() => import('../../office/OfficeScene'))

/** How often the office asks for room agents' run state while it is mounted. */
const RUN_POLL_MS = 3000

/** Last run and running state of each room agent (the snapshot only carries the brain's pipeline). */
function useAgentRunState(active: boolean): Record<string, AgentRunInfo> {
  const [runs, setRuns] = useState<Record<string, AgentRunInfo>>({})
  useEffect(() => {
    if (!active) return
    let alive = true
    const load = (): void => {
      window.api
        .agentRuns()
        .then((list) => {
          // Keep the old object when nothing changed, so the scene does not rebuild every poll.
          const next = Object.fromEntries(list.map((run) => [run.agentId, run]))
          if (alive) setRuns((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next))
        })
        .catch(() => undefined)
    }
    load()
    const timer = window.setInterval(load, RUN_POLL_MS)
    return () => {
      alive = false
      window.clearInterval(timer)
    }
  }, [active])
  return runs
}

/** `active` is false while another view covers the office, which pauses its rendering. */
export function OfficeView({ active }: { active: boolean }): JSX.Element {
  const { agents, graph, settings } = useSnapshot()
  const runs = useAgentRunState(active)
  // Room agents (the Chief, Scribe, Triager, Journal Keeper, Reading Curator) have no pipeline status: show them idle,
  // or working while a run is in progress.
  const roomAgents = useMemo<AgentStatus[]>(() => {
    const pipeline = new Set(agents.map((a) => a.id))
    return settings.agentDefs
      .filter((def) => def.kind !== 'pipeline' && !pipeline.has(def.id))
      .map((def) => {
        const run = runs[def.id]
        const working = run?.running === true
        return {
          id: def.id,
          name: def.name,
          role: def.role,
          state: working ? 'working' : 'idle',
          activity: working ? 'Working on a step' : (def.idle ?? ''),
          updatedAt: run?.lastRunAt ?? 0
        }
      })
  }, [agents, settings.agentDefs, runs])
  const all = useMemo(() => [...agents, ...roomAgents], [agents, roomAgents])
  return (
    <div className={styles.office}>
      <Suspense fallback={<div className={styles.officeLoading}>Loading the office…</div>}>
        <OfficeScene agents={all} graph={graph} onOpenGraph={() => navigation.go('graph')} onAgentClick={drawer.open} active={active} />
      </Suspense>
    </div>
  )
}
