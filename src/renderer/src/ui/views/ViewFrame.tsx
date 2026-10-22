import type { ReactNode } from 'react'
import styles from './views.module.css'

interface ViewFrameProps {
  title: string
  subtitle?: ReactNode
  actions?: ReactNode
  children: ReactNode
  /** Lets the body manage its own scrolling and padding (split panes, canvases) */
  bare?: boolean
}

/** Common chrome for the non-office views: a glass panel with a title row. */
export function ViewFrame({ title, subtitle, actions, children, bare = false }: ViewFrameProps): JSX.Element {
  return (
    <section className={styles.frame}>
      <header className={styles.frameHeader}>
        <div>
          <h1 className={styles.frameTitle}>{title}</h1>
          {subtitle && <div className={styles.frameSubtitle}>{subtitle}</div>}
        </div>
        {actions && <div className={styles.frameActions}>{actions}</div>}
      </header>
      <div className={bare ? styles.frameBodyBare : styles.frameBody}>{children}</div>
    </section>
  )
}
