import { lazy, Suspense } from 'react'
import { useSnapshot } from '../../state/snapshot'
import { navigation } from '../../state/navigation'
import type { AgentId } from '@shared/types'
import styles from './views.module.css'

const OfficeScene = lazy(() => import('../../office/OfficeScene'))

/** Clicking Muse focuses the Ask box (she answers questions); any other agent opens its card. */
function handleAgentClick(id: AgentId): void {
  if (id === 'muse') navigation.focusAsk()
  else navigation.focusAgent(id)
}

export function OfficeView(): JSX.Element {
  const { agents, graph } = useSnapshot()
  return (
    <div className={styles.office}>
      <Suspense fallback={<div className={styles.officeLoading}>Loading the office…</div>}>
        <OfficeScene agents={agents} graph={graph} onOpenGraph={() => navigation.go('graph')} onAgentClick={handleAgentClick} />
      </Suspense>
    </div>
  )
}
