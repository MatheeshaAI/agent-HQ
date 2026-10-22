import { JanitorStrip } from './JanitorStrip'
import { AskBox } from './AskBox'
import { HintRow } from './HintRow'
import styles from './BottomBar.module.css'

export function BottomBar(): JSX.Element {
  return (
    <footer className={styles.bottom}>
      <div className={styles.bar}>
        <JanitorStrip />
        <AskBox />
      </div>
      <HintRow />
    </footer>
  )
}
