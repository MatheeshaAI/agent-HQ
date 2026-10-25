import { useEffect, useRef, type ComponentType } from 'react'
import { useSnapshot } from '../../state/snapshot'
import { chat } from '../../state/chat'
import { AgentDrawer } from './AgentDrawer'
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
  const knowledgeDir = useSnapshot().settings.knowledgeDir
  const firstDir = useRef(knowledgeDir)
  // Chat histories live in the knowledge folder: a folder switch reloads them.
  useEffect(() => {
    if (firstDir.current === knowledgeDir) return
    firstDir.current = knowledgeDir
    chat.reset()
  }, [knowledgeDir])
  return (
    <div className={styles.shell}>
      <TopBar />
      <Sidebar />
      <main className={styles.center}>
        <div className={styles.officeLayer} aria-hidden={view !== 'office'} data-hidden={view !== 'office'}>
          <OfficeView active={view === 'office'} />
        </div>
        {Overlay && <Overlay key={view} />}
        <AgentDrawer />
      </main>
      <RightRail />
      <BottomBar />
      <DropOverlay />
    </div>
  )
}
