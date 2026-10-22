import { useCallback, useRef, useState } from 'react'
import { ChevronDown, FolderOpen, Settings } from 'lucide-react'
import { useSnapshot } from '../../state/snapshot'
import { navigation } from '../../state/navigation'
import { firstName, initials } from '../../state/derived'
import { Popover } from '../common/Popover'
import styles from './TopBar.module.css'

export function UserMenu(): JSX.Element {
  const { settings } = useSnapshot()
  const [open, setOpen] = useState(false)
  const anchorRef = useRef<HTMLButtonElement>(null)
  const close = useCallback(() => setOpen(false), [])

  return (
    <div className={styles.user}>
      <button ref={anchorRef} className={styles.userButton} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu">
        <span className={styles.avatar}>{initials(settings.userName)}</span>
        <span className={styles.userName}>{firstName(settings.userName)}</span>
        <ChevronDown size={20} strokeWidth={2} className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`} />
      </button>
      <Popover open={open} onClose={close} anchorRef={anchorRef} placement="bottom-end" width={232}>
        <div className={styles.menuHeader}>
          <div className={styles.menuName}>{settings.userName}</div>
          <div className={styles.menuPath} title={settings.knowledgeDir}>
            {settings.knowledgeDir}
          </div>
        </div>
        <button
          className={styles.menuItem}
          role="menuitem"
          onClick={() => {
            navigation.go('settings')
            close()
          }}
        >
          <Settings size={15} /> Settings
        </button>
        <button
          className={styles.menuItem}
          role="menuitem"
          onClick={() => {
            window.api.openPath(settings.knowledgeDir)
            close()
          }}
        >
          <FolderOpen size={15} /> Open knowledge folder
        </button>
      </Popover>
    </div>
  )
}
