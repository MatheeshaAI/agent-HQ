import type { ComponentType } from 'react'
import { useNavigation, type ViewId } from '../../state/navigation'
import { TopBar } from './TopBar'
import { Sidebar } from './Sidebar'
import { RightRail } from './RightRail'
import { BottomBar } from './BottomBar'
import { DropOverlay } from './DropOverlay'
import { OfficeView } from '../views/OfficeView'
import { AgentsView } from '../views/AgentsView'
import { KnowledgeView } from '../views/KnowledgeView'
import { TasksView } from '../views/TasksView'
import { GraphView } from '../views/GraphView'
import { InboxView } from '../views/InboxView'
import { SettingsView } from '../views/SettingsView'
import styles from './Shell.module.css'

const VIEWS: Record<Exclude<ViewId, 'office'>, ComponentType> = {
  agents: AgentsView,
  knowledge: KnowledgeView,
  tasks: TasksView,
  graph: GraphView,
  inbox: InboxView,
  settings: SettingsView
}

/**
 * The app frame. The office scene stays mounted behind the other views so its models and
 * GPU resources survive navigation; other views are laid over it.
 */
export function Shell(): JSX.Element {
  const view = useNavigation((s) => s.view)
  const Overlay = view === 'office' ? null : VIEWS[view]
  return (
    <div className={styles.shell}>
      <TopBar />
      <Sidebar />
      <main className={styles.center}>
        <div className={styles.officeLayer} aria-hidden={view !== 'office'} data-hidden={view !== 'office'}>
          <OfficeView />
        </div>
        {Overlay && <Overlay key={view} />}
      </main>
      <RightRail />
      <BottomBar />
      <DropOverlay />
    </div>
  )
}
