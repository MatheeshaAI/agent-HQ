import { AGENTS, type ActivityKind, type AgentId } from '@shared/types'
import type { AgentJob, EngineState } from '../state'
import { errorMessage } from '../util/text'

/** Thrown once a step has recorded its failure; callers stop the run without reporting it again. */
export class StepFailed extends Error {
  override name = 'StepFailed'
}

export interface StepSpec<T> {
  /** The TaskItem this step runs as */
  taskId: string
  agent: AgentId
  /** Agent activity while the step runs, e.g. "Summarizing docs" */
  activity: string
  kind: ActivityKind
  started: { title: string; detail: string }
  /** The finish entry; `kind` defaults to the step's kind */
  finished: (result: T) => { title: string; detail: string; kind?: ActivityKind }
  run: (job: AgentJob) => Promise<T>
}

/**
 * Runs one pipeline step: marks its task running, puts the agent to work, records start and
 * finish in the activity feed, and on failure marks the task failed and flags the agent.
 */
export async function runStep<T>(state: EngineState, spec: StepSpec<T>): Promise<T> {
  state.setTaskStatus(spec.taskId, 'running')
  state.addActivity(spec.kind, spec.started.title, spec.started.detail, spec.agent)
  const job = state.beginJob(spec.agent, 'working', spec.activity)
  try {
    const result = await spec.run(job)
    job.done()
    state.setTaskStatus(spec.taskId, 'done')
    const finished = spec.finished(result)
    state.addActivity(finished.kind ?? spec.kind, finished.title, finished.detail, spec.agent)
    return result
  } catch (error) {
    const message = errorMessage(error)
    job.fail(shortMessage(message))
    state.setTaskStatus(spec.taskId, 'failed', message)
    state.addActivity('error', `${agentName(spec.agent)} failed`, message, spec.agent)
    throw new StepFailed(message)
  }
}

function agentName(id: AgentId): string {
  return AGENTS.find((a) => a.id === id)?.name ?? id
}

/** Agent cards have room for a few words only. */
export function shortMessage(message: string): string {
  const firstSentence = message.split(/(?<=[.;:])\s/)[0]
  return firstSentence.length > 60 ? `${firstSentence.slice(0, 57).trimEnd()}…` : firstSentence
}
