// Floating glass name card above an agent (drei Html), styled after the reference cards.
import type { ReactNode } from 'react'
import { Html } from '@react-three/drei'
import { BookOpen, Code2, Search } from 'lucide-react'
import type { AgentId, AgentState, AgentStatus } from '@shared/types'
import { useCardTier } from './cardTier'
import './agentCard.css'

const ICON_SIZE = 26

/** Bold, partly filled glyphs like the reference's card icons (24-unit grid, like lucide). */
function Glyph({ children }: { children: ReactNode }): JSX.Element {
  return (
    <svg
      width={ICON_SIZE}
      height={ICON_SIZE}
      viewBox="0 0 24 24"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  )
}

/** Solid cyan envelope with a dark flap. */
function MailIcon(): JSX.Element {
  return (
    <Glyph>
      <rect x="2.5" y="5" width="19" height="14" rx="2" fill="#4cc9ef" />
      <path d="M3.5 6.5 12 13l8.5-6.5" stroke="#0e2230" strokeWidth={2} />
    </Glyph>
  )
}

/** Robot head: filled face with dark eyes, antenna and ear studs. */
function BotIcon(): JSX.Element {
  return (
    <Glyph>
      <path d="M12 3.2v3.3" stroke="#e8eaf0" strokeWidth={2.3} />
      <circle cx="12" cy="3" r="1.4" fill="#e8eaf0" />
      <rect x="4.5" y="7" width="15" height="12" rx="3.2" fill="#e8eaf0" />
      <rect x="2" y="11" width="2" height="4" rx="1" fill="#e8eaf0" />
      <rect x="20" y="11" width="2" height="4" rx="1" fill="#e8eaf0" />
      <circle cx="9.2" cy="12.4" r="1.6" fill="#141a24" />
      <circle cx="14.8" cy="12.4" r="1.6" fill="#141a24" />
      <path d="M9.5 16.2h5" stroke="#141a24" strokeWidth={1.4} />
    </Glyph>
  )
}

/** Conical flask outline, its bottom 45% filled with lilac liquid. */
function FlaskIcon(): JSX.Element {
  const body = 'M9.5 3v6.2L4.3 18.4A1.8 1.8 0 0 0 5.9 21h12.2a1.8 1.8 0 0 0 1.6-2.6L14.5 9.2V3'
  return (
    <Glyph>
      <path d="M6.9 13.8h10.2l2.6 4.6a1.8 1.8 0 0 1-1.6 2.6H5.9a1.8 1.8 0 0 1-1.6-2.6z" fill="#b9a8f5" />
      <path d={body} stroke="#d9d6ff" strokeWidth={2.3} />
      <path d="M8 3h8" stroke="#d9d6ff" strokeWidth={2.3} />
    </Glyph>
  )
}

const ICONS: Record<AgentId, () => JSX.Element> = {
  pip: MailIcon,
  sage: BotIcon,
  nova: FlaskIcon,
  rex: () => <Code2 size={ICON_SIZE} strokeWidth={2.4} aria-hidden />,
  axel: () => <Search size={ICON_SIZE} strokeWidth={2.5} aria-hidden />,
  muse: () => <BookOpen size={ICON_SIZE} strokeWidth={2.4} aria-hidden />
}

const STATE_LABEL: Record<AgentState, string> = {
  idle: 'Idle',
  working: 'Working',
  thinking: 'Thinking',
  error: 'Error'
}

/** Height of the card's anchor (its pointer tip) above the floor. */
const CARD_ANCHOR_Y = 1.72

interface AgentCardProps {
  status: AgentStatus
  /** Shows a small voice indicator while the agent is producing a reply. */
  speaking?: boolean
  onClick?: (id: AgentId) => void
}

export default function AgentCard({ status, speaking = false, onClick }: AgentCardProps): JSX.Element {
  const Icon = ICONS[status.id] ?? BotIcon
  const detail = `${status.role} · ${status.activity}`
  const tier = useCardTier()
  // Stacking follows distance: drei maps the range linearly over the camera's near..far, so a wide range keeps
  // neighbouring distances apart and a nearer room's card always sits over a farther one.
  return (
    <Html position={[0, CARD_ANCHOR_Y, 0]} zIndexRange={[120, 20]} style={{ pointerEvents: 'none' }}>
      <button
        type="button"
        className={`hq-agent-card hq-agent-card--${status.state}${tier === 'full' ? '' : ` hq-agent-card--${tier}`}`}
        onClick={() => onClick?.(status.id)}
        aria-label={`${status.name}: ${STATE_LABEL[status.state]}, ${detail}`}
        title={detail}
      >
        <span className="hq-agent-card__icon">
          <Icon />
        </span>
        <span className="hq-agent-card__text">
          <span className="hq-agent-card__name">{status.name.toUpperCase()}</span>
          <span className="hq-agent-card__state">
            <span className="hq-agent-card__dot" />
            {STATE_LABEL[status.state]}
            {speaking && (
              <span className="hq-agent-card__voice" role="img" aria-label="Speaking">
                <i />
                <i />
                <i />
              </span>
            )}
          </span>
          <span className="hq-agent-card__role">
            {status.role} <span className="hq-agent-card__sep">·</span> {status.activity}
          </span>
        </span>
      </button>
    </Html>
  )
}
