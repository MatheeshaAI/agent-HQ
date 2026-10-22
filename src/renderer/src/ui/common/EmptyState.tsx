import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import styles from './common.module.css'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  children?: ReactNode
  /** Buttons or links offering the next step */
  actions?: ReactNode
  compact?: boolean
}

export function EmptyState({ icon: Icon, title, children, actions, compact = false }: EmptyStateProps): JSX.Element {
  return (
    <div className={`${styles.empty} ${compact ? styles.emptyCompact : ''}`}>
      <span className={styles.emptyIcon}>
        <Icon size={compact ? 18 : 24} strokeWidth={1.75} />
      </span>
      <div className={styles.emptyTitle}>{title}</div>
      {children && <div className={styles.emptyBody}>{children}</div>}
      {actions && <div className={styles.emptyActions}>{actions}</div>}
    </div>
  )
}
