import type { AgentId } from '@shared/types'

export interface Identity {
  /** Jacket colour on the avatar (the shared model has one top; shirts and accessories cannot show). */
  jacket: string
  hair: string
  /** Accent from the portrait: lanyard, scarf, shirt... used for UI highlights. */
  accent: string
}

/**
 * Per-agent colours. The scene is dim and tone-mapped, so jackets sit darker than their portrait colours while
 * staying distinguishable. Hair colours are guesses where the brief names none (Sage, Axel, Muse).
 */
export const IDENTITIES: Record<AgentId, Identity> = {
  pip: { jacket: '#1d3158', hair: '#0f0c0a', accent: '#38c6e0' },
  sage: { jacket: '#1d4a33', hair: '#2a1c14', accent: '#6fcf97' },
  rex: { jacket: '#36383d', hair: '#0d0c0b', accent: '#7ec3f0' },
  nova: { jacket: '#59295a', hair: '#0e0b0d', accent: '#b9a2f2' },
  axel: { jacket: '#7a4a1e', hair: '#35220f', accent: '#f0a830' },
  muse: { jacket: '#6e1f33', hair: '#2b1a12', accent: '#f08aa0' },
  // Chief of Staff in the brain: a deep gold-brown jacket, grey hair (placeholder look).
  chief: { jacket: '#3d3320', hair: '#8a8580', accent: '#e8c46a' },
  // Office room: slate and blue.
  scribe: { jacket: '#2b3a4f', hair: '#1a1410', accent: '#8fb4e8' },
  triager: { jacket: '#2e3b48', hair: '#3a2a1c', accent: '#7fa8d6' },
  // Personal room: terracotta and warm browns.
  journal: { jacket: '#5a3327', hair: '#2a1a12', accent: '#e8926a' },
  curator: { jacket: '#4d3a2c', hair: '#120d0a', accent: '#d9a47a' }
}

/** Colours for an agent id without an entry (a user-defined agent): a neutral jacket with the brain's warm accent. */
export const FALLBACK_IDENTITY: Identity = { jacket: '#2a2e36', hair: '#15110e', accent: '#c9b08a' }

export function identityOf(id: AgentId): Identity {
  return IDENTITIES[id] ?? FALLBACK_IDENTITY
}
