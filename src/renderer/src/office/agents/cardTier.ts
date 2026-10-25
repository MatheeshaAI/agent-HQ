// How large the agent name cards are drawn, from the camera's distance to its target. The scene writes this store
// only when the camera crosses a threshold, so the cards re-render on a zoom step, not every frame.
import { createStore, useStore } from '../../state/store'
import { CAMERA } from '../layout'

export type CardTier = 'full' | 'compact' | 'far'

/** Beyond this distance the cards shrink to a dot-and-name chip (the All view sits past it). */
export const COMPACT_DISTANCE = CAMERA.distance * 1.5
/** Beyond this distance the cards hide, and show again only on hover. */
export const FAR_DISTANCE = CAMERA.distance * 3.6

const cardTierStore = createStore<{ tier: CardTier }>({ tier: 'full' })

export function setCardTier(tier: CardTier): void {
  cardTierStore.set({ tier })
}

export function tierForDistance(distance: number): CardTier {
  if (distance > FAR_DISTANCE) return 'far'
  if (distance > COMPACT_DISTANCE) return 'compact'
  return 'full'
}

export function useCardTier(): CardTier {
  return useStore(cardTierStore, (s) => s.tier)
}
