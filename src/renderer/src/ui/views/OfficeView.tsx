import { lazy, Suspense } from 'react'
import { useSnapshot } from '../../state/snapshot'
import { navigation } from '../../state/navigation'
import { drawer } from '../../state/drawer'
import { AgentDrawer } from '../shell/AgentDrawer'
import styles from './views.module.css'

const OfficeScene = lazy(() => import('../../office/OfficeScene'))

/** `active` is false while another view covers the office, which pauses its rendering. */
export function OfficeView({ active }: { active: boolean }): JSX.Element {
  const { agents, graph } = useSnapshot()
  return (
    <div className={styles.office}>
      <Suspense fallback={<div className={styles.officeLoading}>Loading the office…</div>}>
        <OfficeScene agents={agents} graph={graph} onOpenGraph={() => navigation.go('graph')} onAgentClick={drawer.open} active={active} />
      </Suspense>
      <AgentDrawer />
    </div>
  )
}
