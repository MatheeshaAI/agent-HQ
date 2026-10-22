import type { ButtonHTMLAttributes } from 'react'
import type { LucideIcon } from 'lucide-react'
import styles from './common.module.css'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  icon?: LucideIcon
  busy?: boolean
}

export function Button({
  variant = 'secondary',
  icon: Icon,
  busy = false,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps): JSX.Element {
  return (
    <button
      {...rest}
      disabled={disabled || busy}
      className={`${styles.button} ${styles[`button_${variant}`]} ${className ?? ''}`}
    >
      {Icon && <Icon size={15} strokeWidth={2} className={busy ? 'spin' : undefined} />}
      {children}
    </button>
  )
}
