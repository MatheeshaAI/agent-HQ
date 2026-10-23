import { createStore, useStore } from './store'

/** Scene-wide motion switch; the office's Pause control (and anything else that freezes it) flips this. */
const motionStore = createStore<{ paused: boolean }>({ paused: false })

const reduced = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null

export const motion = {
  setPaused(paused: boolean): void {
    motionStore.set({ paused })
  },
  /** True when the user asked the OS for reduced motion. */
  prefersReduced(): boolean {
    return reduced?.matches ?? false
  },
  /** True when ambient animation should hold still: reduced motion, or the Pause control. Safe to call every frame. */
  isCalm(): boolean {
    return motionStore.get().paused || (reduced?.matches ?? false)
  }
}

export function usePaused(): boolean {
  return useStore(motionStore, (s) => s.paused)
}
