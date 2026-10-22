import { useEffect, useRef, type ReactNode, type RefObject } from 'react'
import styles from './common.module.css'

interface PopoverProps {
  open: boolean
  onClose: () => void
  /** The element that toggles the popover; clicks on it are not treated as outside clicks */
  anchorRef: RefObject<HTMLElement>
  placement?: 'top-start' | 'top-end' | 'bottom-end'
  width?: number
  children: ReactNode
}

/**
 * A floating panel positioned against its nearest positioned ancestor.
 * Closes on Escape and on any pointer press outside of it and its anchor.
 */
export function Popover({ open, onClose, anchorRef, placement = 'top-start', width = 320, children }: PopoverProps): JSX.Element | null {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent): void => {
      const target = event.target as Node
      if (panelRef.current?.contains(target) || anchorRef.current?.contains(target)) return
      onClose()
    }
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose, anchorRef])

  if (!open) return null
  return (
    <div ref={panelRef} className={`${styles.popover} ${styles[`popover_${placement.replace('-', '_')}`]}`} style={{ width }} role="dialog">
      {children}
    </div>
  )
}
