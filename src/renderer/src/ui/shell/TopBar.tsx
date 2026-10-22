import { useSnapshot } from '../../state/snapshot'
import { HexLogo } from '../common/HexLogo'
import { ChatGlyph, PageGlyph, ShareGlyph, type IconComponent } from '../common/glyphs'
import { WindowControls } from './WindowControls'
import { UrlBar } from './UrlBar'
import { UserMenu } from './UserMenu'
import styles from './TopBar.module.css'

export function TopBar(): JSX.Element {
  const { stats, online } = useSnapshot()
  return (
    <header className={styles.bar}>
      <WindowControls />
      <div className={styles.brand}>
        <HexLogo size={42} />
        <div className={styles.brandText}>
          <div className={styles.brandName}>Agent HQ</div>
          <div className={styles.brandTagline}>AI Agent Office</div>
        </div>
      </div>
      <div className={styles.stats}>
        <StatChip icon={PageGlyph} value={stats.pages} label="Total Pages" />
        <StatChip icon={ChatGlyph} value={stats.topics} label="Topics" />
        <StatChip icon={ShareGlyph} value={stats.sources} label="Sources" />
      </div>
      <UrlBar />
      <div className={`${styles.system} ${online ? styles.systemOnline : styles.systemOffline}`} role="status">
        <span className={styles.systemDot} />
        {online ? 'System Online' : 'Offline'}
      </div>
      <UserMenu />
    </header>
  )
}

interface StatChipProps {
  icon: IconComponent
  value: number
  label: string
}

function StatChip({ icon: Icon, value, label }: StatChipProps): JSX.Element {
  return (
    <div className={styles.stat}>
      <Icon size={22} className={styles.statIcon} />
      <div>
        <div className={styles.statValue}>{value.toLocaleString()}</div>
        <div className={styles.statLabel}>{label}</div>
      </div>
    </div>
  )
}
