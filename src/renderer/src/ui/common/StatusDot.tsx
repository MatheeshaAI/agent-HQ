import type { Tone } from '../../state/derived'
import styles from './common.module.css'

interface StatusDotProps {
  tone: Tone
  /** Gently pulses, for states that are in progress */
  pulse?: boolean
  size?: number
}

export function StatusDot({ tone, pulse = false, size = 7 }: StatusDotProps): JSX.Element {
  return (
    <span
      className={`${styles.dot} ${styles[`dot_${tone}`]} ${pulse ? styles.pulse : ''}`}
      style={{ width: size, height: size }}
      aria-hidden
    />
  )
}

interface StatusChipProps {
  tone: Tone
  label: string
  pulse?: boolean
}

/** A pill with a coloured dot and a short label: Working, Queued, Failed... */
export function StatusChip({ tone, label, pulse }: StatusChipProps): JSX.Element {
  return (
    <span className={`${styles.chip} ${styles[`chip_${tone}`]}`}>
      <StatusDot tone={tone} pulse={pulse} size={6} />
      {label}
    </span>
  )
}
