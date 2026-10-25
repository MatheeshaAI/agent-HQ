import { roomFocus, useRoomFocus, type RoomFocus } from '../../state/rooms'
import styles from './views.module.css'

const OPTIONS: { id: RoomFocus; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'brain', label: 'Brain' },
  { id: 'office', label: 'Office' },
  { id: 'personal', label: 'Personal' }
]

/** Room focus control: narrows the Inbox, Knowledge and Graph to one room. Folders are not affected. */
export function RoomFilter(): JSX.Element {
  const room = useRoomFocus()
  return (
    <div className={styles.segmented} role="tablist" aria-label="Room focus">
      {OPTIONS.map((option) => (
        <button
          key={option.id}
          role="tab"
          aria-selected={room === option.id}
          className={room === option.id ? styles.segmentActive : undefined}
          onClick={() => roomFocus.set(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
