import { useEffect, useRef } from 'react'
import type { AgentId, AgentState, AgentStatus } from '@shared/types'
import { motion } from '../../state/motion'
import { PIPELINE, hasRoute } from '../routes'
import type { Choreographer } from './choreography'

const busy = (state: AgentState | undefined): boolean => state === 'working' || state === 'thinking'

/** How long after finishing a stage an agent still counts as handing its work over. */
const HANDOFF_WINDOW_MS = 6000

/**
 * Hand-offs: when an agent finishes its stage while the next stage is already at work, it walks over to tell it,
 * then returns. If it gets new work on the way, it heads back to its desk. Reduced motion keeps everyone seated.
 */
export function useHandoffs(choreo: Choreographer, agents: AgentStatus[]): void {
  const previous = useRef(new Map<AgentId, AgentState>())
  const finishedAt = useRef(new Map<AgentId, number>())

  useEffect(() => {
    const now = Date.now()
    for (const agent of agents) {
      const before = previous.current.get(agent.id)
      if (busy(before) && agent.state === 'idle') finishedAt.current.set(agent.id, now)
      if (busy(agent.state) && choreo.walker === agent.id) choreo.recall(agent.id)
      previous.current.set(agent.id, agent.state)
    }
    if (motion.prefersReduced() || choreo.busy) return
    const state = new Map(agents.map((a) => [a.id, a.state]))
    for (let i = 0; i + 1 < PIPELINE.length; i++) {
      const from = PIPELINE[i]
      const to = PIPELINE[i + 1]
      const finished = finishedAt.current.get(from)
      if (finished === undefined || now - finished > HANDOFF_WINDOW_MS) continue
      if (state.get(from) !== 'idle' || !busy(state.get(to)) || !hasRoute(from, to)) continue
      if (choreo.start(from, to)) {
        finishedAt.current.delete(from)
        return
      }
    }
  }, [agents, choreo])
}
