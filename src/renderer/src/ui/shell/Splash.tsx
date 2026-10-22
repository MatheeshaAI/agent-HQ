import { HexLogo } from '../common/HexLogo'
import styles from './Shell.module.css'

/** Shown for the moment between window load and the engine's first snapshot. */
export function Splash(): JSX.Element {
  return (
    <div className={styles.splash}>
      <HexLogo size={48} />
    </div>
  )
}
