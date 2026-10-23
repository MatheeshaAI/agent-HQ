import type { AgentId } from '@shared/types'
import { AGENT_ICONS, AGENT_TONES } from './icons'
import { IconTile } from './IconTile'

const PORTRAITS = import.meta.glob('../../assets/portraits/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>

/**
 * An agent's portrait: assets/portraits/<id>.png when the file exists, otherwise the agent's icon tile.
 * Drop a PNG named after the agent's id into that folder to replace the fallback.
 */
export function AgentPortrait({ id, size }: { id: AgentId; size: number }): JSX.Element {
  const src = PORTRAITS[`../../assets/portraits/${id}.png`]
  if (!src) return <IconTile icon={AGENT_ICONS[id]} tone={AGENT_TONES[id]} size={size} shape="rounded" />
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      style={{ flex: 'none', borderRadius: size > 40 ? 12 : 8, objectFit: 'cover' }}
    />
  )
}
