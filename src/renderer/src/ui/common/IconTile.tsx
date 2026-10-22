import type { LucideIcon } from 'lucide-react'
import type { TileTone } from './icons'
import styles from './common.module.css'

interface IconTileProps {
  icon: LucideIcon
  tone?: TileTone
  /** Tile diameter in px */
  size?: number
  shape?: 'circle' | 'rounded'
}

/** A tinted round tile holding a bold, partly filled icon, as used by every list row in the right column. */
export function IconTile({ icon: Icon, tone = 'teal', size = 32, shape = 'circle' }: IconTileProps): JSX.Element {
  return (
    <span
      className={`${styles.tile} ${styles[`tile_${tone}`]}`}
      style={{ width: size, height: size, borderRadius: shape === 'circle' ? '50%' : Math.round(size * 0.28) }}
      aria-hidden
    >
      <Icon size={Math.round(size * 0.55)} strokeWidth={2.3} fill="currentColor" fillOpacity={0.35} />
    </span>
  )
}
