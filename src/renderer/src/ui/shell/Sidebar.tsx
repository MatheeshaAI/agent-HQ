import { BookOpen, CircleCheckBig, House, Inbox, Settings, Share2, User, type LucideIcon } from 'lucide-react'
import { useSnapshot } from '../../state/snapshot'
import { navigation, useNavigation, type ViewId } from '../../state/navigation'
import { inboxCount, pendingTaskCount } from '../../state/derived'
import styles from './Sidebar.module.css'

interface NavItem {
  view: ViewId
  label: string
  icon: LucideIcon
  /** Solid glyph, as drawn in the reference; outline-only icons keep their strokes readable */
  filled: boolean
}

const ITEMS: NavItem[] = [
  { view: 'office', label: 'Office', icon: House, filled: true },
  { view: 'agents', label: 'Agents', icon: User, filled: true },
  { view: 'knowledge', label: 'Knowledge', icon: BookOpen, filled: true },
  { view: 'tasks', label: 'Tasks', icon: CircleCheckBig, filled: false },
  { view: 'graph', label: 'Graph', icon: Share2, filled: false },
  { view: 'inbox', label: 'Inbox', icon: Inbox, filled: true },
  { view: 'settings', label: 'Settings', icon: Settings, filled: true }
]

export function Sidebar(): JSX.Element {
  const { tasks, sources } = useSnapshot()
  const current = useNavigation((s) => s.view)
  const badges: Partial<Record<ViewId, number>> = {
    tasks: pendingTaskCount(tasks),
    inbox: inboxCount(sources)
  }

  return (
    <nav className={styles.sidebar} aria-label="Main">
      {ITEMS.map(({ view, label, icon: Icon, filled }) => {
        const active = view === current
        const badge = badges[view] ?? 0
        return (
          <button
            key={view}
            className={`${styles.item} ${active ? styles.active : ''}`}
            onClick={() => navigation.go(view)}
            aria-current={active ? 'page' : undefined}
          >
            <Icon size={20} strokeWidth={2} className={`${styles.icon} ${filled ? styles.filled : ''}`} />
            <span className={styles.label}>{label}</span>
            {badge > 0 && <span className={styles.badge}>{badge > 99 ? '99+' : badge}</span>}
          </button>
        )
      })}
    </nav>
  )
}
