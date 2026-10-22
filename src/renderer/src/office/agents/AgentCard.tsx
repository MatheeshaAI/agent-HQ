// Floating glass name card above an agent (drei Html), styled after the reference cards.
import { Html } from '@react-three/drei'
import { Bot, BookOpen, Code2, FlaskConical, Mail, Search, type LucideIcon } from 'lucide-react'
import type { AgentId, AgentState, AgentStatus } from '@shared/types'
import './agentCard.css'

const ICONS: Record<AgentId, { icon: LucideIcon; tone: 'cyan' | 'lilac' }> = {
  pip: { icon: Mail, tone: 'cyan' },
  sage: { icon: Bot, tone: 'lilac' },
  rex: { icon: Code2, tone: 'cyan' },
  nova: { icon: FlaskConical, tone: 'lilac' },
  axel: { icon: Search, tone: 'cyan' },
  muse: { icon: BookOpen, tone: 'cyan' }
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
  onClick?: (id: AgentId) => void
}

export default function AgentCard({ status, onClick }: AgentCardProps): JSX.Element {
  const { icon: Icon, tone } = ICONS[status.id]
  return (
    <Html position={[0, CARD_ANCHOR_Y, 0]} zIndexRange={[20, 10]} style={{ pointerEvents: 'none' }}>
      <button
        type="button"
        className={`hq-agent-card hq-agent-card--${status.state}`}
        onClick={() => onClick?.(status.id)}
        aria-label={`${status.name}: ${STATE_LABEL[status.state]}, ${status.activity}`}
      >
        <span className={`hq-agent-card__icon hq-agent-card__icon--${tone}`}>
          <Icon size={22} strokeWidth={1.9} />
        </span>
        <span className="hq-agent-card__text">
          <span className="hq-agent-card__name">{status.name.toUpperCase()}</span>
          <span className="hq-agent-card__state">
            <span className="hq-agent-card__dot" />
            {STATE_LABEL[status.state]}
          </span>
          <span className="hq-agent-card__role">
            {status.role} <span className="hq-agent-card__sep">·</span> {status.activity}
          </span>
        </span>
      </button>
    </Html>
  )
}
