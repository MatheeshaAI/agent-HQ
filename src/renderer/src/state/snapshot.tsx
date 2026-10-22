import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { AppSnapshot } from '@shared/types'

const SnapshotContext = createContext<AppSnapshot | null>(null)

interface SnapshotProviderProps {
  /** Rendered until the first snapshot arrives from the engine */
  fallback: ReactNode
  children: ReactNode
}

/** Loads the engine snapshot once and keeps it current with every push from the main process. */
export function SnapshotProvider({ fallback, children }: SnapshotProviderProps): JSX.Element {
  const [snapshot, setSnapshot] = useState<AppSnapshot | null>(null)

  useEffect(() => {
    let pushed = false
    const unsubscribe = window.api.onSnapshot((next) => {
      pushed = true
      setSnapshot(next)
    })
    window.api.getSnapshot().then((initial) => {
      if (!pushed) setSnapshot(initial)
    })
    return unsubscribe
  }, [])

  if (!snapshot) return <>{fallback}</>
  return <SnapshotContext.Provider value={snapshot}>{children}</SnapshotContext.Provider>
}

export function useSnapshot(): AppSnapshot {
  const snapshot = useContext(SnapshotContext)
  if (!snapshot) throw new Error('useSnapshot must be used inside <SnapshotProvider>')
  return snapshot
}
