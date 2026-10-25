import type { RoomKind } from '@shared/types'
import { ROOM_LABEL } from '../../state/rooms'
import styles from './common.module.css'

/** Small coloured label naming the room something belongs to. */
export function RoomChip({ room }: { room: RoomKind }): JSX.Element {
  return <span className={`${styles.roomChip} ${styles[`roomChip_${room}`]}`}>{ROOM_LABEL[room]}</span>
}
