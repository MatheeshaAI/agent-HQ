import styles from './TopBar.module.css'

/**
 * Close / minimise / zoom buttons for frameless windows on Windows and Linux.
 * macOS draws its own traffic lights (titleBarStyle: hiddenInset), so nothing is rendered there.
 */
export function WindowControls(): JSX.Element | null {
  const { platform, close, minimize, toggleMaximize } = window.api.window
  if (platform === 'darwin') return null
  return (
    <div className={styles.lights}>
      <button className={`${styles.light} ${styles.lightClose}`} onClick={close} aria-label="Close window">
        <svg viewBox="0 0 12 12" aria-hidden>
          <path d="M3.8 3.8l4.4 4.4M8.2 3.8l-4.4 4.4" />
        </svg>
      </button>
      <button className={`${styles.light} ${styles.lightMin}`} onClick={minimize} aria-label="Minimize window">
        <svg viewBox="0 0 12 12" aria-hidden>
          <path d="M3.3 6h5.4" />
        </svg>
      </button>
      <button className={`${styles.light} ${styles.lightMax}`} onClick={toggleMaximize} aria-label="Maximize window">
        <svg viewBox="0 0 12 12" aria-hidden>
          <path d="M3.6 6.9V3.6h3.3M8.4 5.1v3.3H5.1" />
        </svg>
      </button>
    </div>
  )
}
