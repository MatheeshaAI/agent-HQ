import { FileUp, MousePointerClick, ScanEye, type LucideIcon } from 'lucide-react'
import styles from './BottomBar.module.css'

const HINTS: { icon: LucideIcon; text: string }[] = [
  { icon: FileUp, text: 'Drop a file or drag a file onto the office to start a job.' },
  { icon: ScanEye, text: 'Click the big wall screen for the graph view.' },
  { icon: MousePointerClick, text: 'Click an agent to message it.' }
]

export function HintRow(): JSX.Element {
  return (
    <div className={styles.hints}>
      {HINTS.map(({ icon: Icon, text }) => (
        <div key={text} className={styles.hint}>
          <Icon size={20} strokeWidth={1.7} className={styles.hintIcon} />
          {text}
        </div>
      ))}
    </div>
  )
}
