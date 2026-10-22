/**
 * Solid glyphs drawn to match the reference artwork, where an outline icon set reads too thin.
 * Each takes the lucide-style `size` and `className` props and paints in `currentColor`; the
 * dark details (ruled lines, cut-outs) use CUT so they read as holes on the dark chrome.
 */

import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

interface GlyphProps {
  size?: number
  className?: string
}

/** A lucide icon or one of the glyphs below; both take `size` and `className`. */
export type IconComponent = LucideIcon | ((props: GlyphProps) => JSX.Element)

const CUT = '#05080d'

function Svg({ size = 24, className, children }: GlyphProps & { children: ReactNode }): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      {children}
    </svg>
  )
}

/* Sidebar */

export function HouseGlyph(props: GlyphProps): JSX.Element {
  return (
    <Svg {...props}>
      <path
        d="M2.2 11.2 12 2.6l9.8 8.6-1.3 1.4-1.2-1V20a1.5 1.5 0 0 1-1.5 1.5h-3.6v-5.8a1 1 0 0 0-1-1h-2.4a1 1 0 0 0-1 1v5.8H6.2A1.5 1.5 0 0 1 4.7 20v-8.4l-1.2 1z"
        stroke="currentColor"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

export function UserGlyph(props: GlyphProps): JSX.Element {
  return (
    <Svg {...props}>
      <circle cx="12" cy="7.2" r="4.7" />
      <path d="M3.2 21.4c0-4.6 3.9-7.9 8.8-7.9s8.8 3.3 8.8 7.9z" />
    </Svg>
  )
}

export function BookGlyph(props: GlyphProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="M1.8 3.6c3.3-1.5 6.9-1.3 9.4.7v17.4c-2.6-1.7-6.1-1.9-9.4-.6z" />
      <path d="M22.2 3.6c-3.3-1.5-6.9-1.3-9.4.7v17.4c2.6-1.7 6.1-1.9 9.4-.6z" />
    </Svg>
  )
}

export function InboxGlyph(props: GlyphProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="M2.2 12.6 5 4.4A2.2 2.2 0 0 1 7.1 3h9.8a2.2 2.2 0 0 1 2.1 1.4l2.8 8.2v6.6a2.2 2.2 0 0 1-2.2 2.2H4.4a2.2 2.2 0 0 1-2.2-2.2z" />
      <path d="M3 12.6h4.8l1.6 2.8h5.2l1.6-2.8H21" fill="none" stroke={CUT} strokeWidth="1.9" strokeLinejoin="round" />
    </Svg>
  )
}

/** An 8-tooth gear outline with a round hole, built once from polar points. */
const GEAR_PATH = (() => {
  const teeth = 8
  const points: string[] = []
  for (let i = 0; i < teeth * 4; i++) {
    const outer = i % 4 === 1 || i % 4 === 2
    const radius = outer ? 10.6 : 8.2
    const angle = ((i - 0.5) / (teeth * 4)) * Math.PI * 2
    points.push(`${(12 + radius * Math.cos(angle)).toFixed(2)},${(12 + radius * Math.sin(angle)).toFixed(2)}`)
  }
  return `M${points.join('L')}Z M15.4 12a3.4 3.4 0 1 0-6.8 0a3.4 3.4 0 1 0 6.8 0Z`
})()

export function GearGlyph(props: GlyphProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d={GEAR_PATH} fillRule="evenodd" stroke="currentColor" strokeWidth="0.9" strokeLinejoin="round" />
    </Svg>
  )
}

/* Top-bar stat chips */

export function PageGlyph(props: GlyphProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="M4.8 1.8h10.2l5.6 5.4v13.3a1.8 1.8 0 0 1-1.8 1.8h-14a1.8 1.8 0 0 1-1.8-1.8V3.6a1.8 1.8 0 0 1 1.8-1.8z" />
      <path d="M14.8 1.8v4.4a1.2 1.2 0 0 0 1.2 1.2h4.6" fill="none" stroke={CUT} strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M7 11.2h10M7 14.6h10M7 18h6.5" stroke={CUT} strokeWidth="1.7" strokeLinecap="round" />
    </Svg>
  )
}

export function ChatGlyph(props: GlyphProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="M12 2.4c5.3 0 9.6 3.9 9.6 8.8S17.3 20 12 20c-1.4 0-2.7-.3-3.9-.8L3 21.4l1.6-4.4A8.5 8.5 0 0 1 2.4 11.2C2.4 6.3 6.7 2.4 12 2.4z" />
      <circle cx="7.9" cy="11.2" r="1.4" fill={CUT} />
      <circle cx="12" cy="11.2" r="1.4" fill={CUT} />
      <circle cx="16.1" cy="11.2" r="1.4" fill={CUT} />
    </Svg>
  )
}

export function ShareGlyph(props: GlyphProps): JSX.Element {
  return (
    <Svg {...props}>
      <g fill="none" stroke="currentColor" strokeWidth="2.4">
        <path d="M15.2 6.7 8.8 10.5M15.2 17.3l-6.4-3.8" />
        <circle cx="17.8" cy="5.2" r="2.9" />
        <circle cx="6.2" cy="12" r="2.9" />
        <circle cx="17.8" cy="18.8" r="2.9" />
      </g>
    </Svg>
  )
}

/* Janitor mascot */

/** Axel's glossy robot head for the bottom bar: light head, dot eyes and smile, cyan antenna, lilac ears. */
export function JanitorBot({ size = 34 }: { size?: number }): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 34 34" aria-hidden>
      <defs>
        <linearGradient id="hq-bot-head" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f2f4f8" />
          <stop offset="1" stopColor="#c9cfdb" />
        </linearGradient>
      </defs>
      <rect x="15.2" y="1" width="3.6" height="8" rx="1.8" fill="#5fd6ff" />
      <rect x="0.5" y="18" width="3.6" height="8" rx="1.6" fill="#c7b3e6" />
      <rect x="29.9" y="18" width="3.6" height="8" rx="1.6" fill="#c7b3e6" />
      <rect x="3.6" y="9" width="26.8" height="23" rx="7" fill="url(#hq-bot-head)" />
      <path d="M7 11.5h20" stroke="#ffffff" strokeOpacity="0.7" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="12.2" cy="19.2" r="2.2" fill="#1d2433" />
      <circle cx="21.8" cy="19.2" r="2.2" fill="#1d2433" />
      <path d="M14 24.4h6a3 3 0 0 1-6 0z" fill="#1d2433" />
    </svg>
  )
}
