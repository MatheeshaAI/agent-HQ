// Stand-in for the 3D office while it is being built: shows the office region of the reference
// image at its exact position so screenshots compare the UI chrome only.
import type { AgentId, AgentStatus, GraphData } from '@shared/types'
import reference from '../../docs/reference.png'

export interface OfficeSceneProps {
  agents: AgentStatus[]
  graph: GraphData
  onOpenGraph: () => void
  onAgentClick?: (id: AgentId) => void
}

export default function OfficeScene({ onOpenGraph, onAgentClick }: OfficeSceneProps): JSX.Element {
  return (
    <div
      data-testid="office-placeholder"
      style={{
        position: 'absolute',
        inset: 0,
        background: `#000 url(${reference}) -171px -80px / 1536px 1024px no-repeat`
      }}
    >
      {/* Hit areas roughly over the wall screen and Muse's card in the reference */}
      <button aria-label="wall screen" onClick={onOpenGraph} style={{ position: 'absolute', left: 765, top: 150, width: 230, height: 160, opacity: 0 }} />
      <button aria-label="Muse" onClick={() => onAgentClick?.('muse')} style={{ position: 'absolute', left: 760, top: 425, width: 200, height: 70, opacity: 0 }} />
      <button aria-label="Sage" onClick={() => onAgentClick?.('sage')} style={{ position: 'absolute', left: 400, top: 125, width: 220, height: 70, opacity: 0 }} />
    </div>
  )
}
