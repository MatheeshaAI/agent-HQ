import { CircleCheck, Share2 } from 'lucide-react'
import { useSnapshot } from '../../state/snapshot'
import { navigation, useNavigation, type ViewId } from '../../state/navigation'
import { inboxCount, pendingTaskCount } from '../../state/derived'
import { BookGlyph, GearGlyph, HouseGlyph, InboxGlyph, UserGlyph, type IconComponent } from '../common/glyphs'
import styles from './Sidebar.module.css'

interface NavItem {
  view: ViewId
  label: string
  /** Solid glyphs where the reference draws them solid; Tasks and Graph stay outline icons */
  icon: IconComponent
}

const ITEMS: NavItem[] = [
  { view: 'office', label: 'Office', icon: HouseGlyph },
  { view: 'agents', label: 'Agents', icon: UserGlyph },
  { view: 'knowledge', label: 'Knowledge', icon: BookGlyph },
  { view: 'tasks', label: 'Tasks', icon: CircleCheck },
  { view: 'graph', label: 'Graph', icon: Share2 },
  { view: 'inbox', label: 'Inbox', icon: InboxGlyph },
  { view: 'settings', label: 'Settings', icon: GearGlyph }
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
      {ITEMS.map(({ view, label, icon: Icon }) => {
        const active = view === current
        const badge = badges[view] ?? 0
        return (
          <button
            key={view}
            className={`${styles.item} ${active ? styles.active : ''}`}
            onClick={() => navigation.go(view)}
            aria-current={active ? 'page' : undefined}
          >
            <Icon size={22} className={styles.icon} />
            <span className={styles.label}>{label}</span>
            {badge > 0 && <span className={styles.badge}>{badge > 99 ? '99+' : badge}</span>}
          </button>
        )
      })}
    </nav>
  )
}
