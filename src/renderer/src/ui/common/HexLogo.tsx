/** The Agent HQ mark: a glossy blue hexagon ring, drawn as SVG so it stays crisp at any scale. */
export function HexLogo({ size = 42 }: { size?: number }): JSX.Element {
  // Pointy-top hexagons; outer ring 36x42, inner cut-out at 52% scale.
  const outer = '18,0.6 35.4,10.6 35.4,31.4 18,41.4 0.6,31.4 0.6,10.6'
  const inner = '18,11.2 26.6,16.1 26.6,25.9 18,30.8 9.4,25.9 9.4,16.1'
  return (
    <svg width={(size * 36) / 42} height={size} viewBox="0 0 36 42" aria-hidden>
      <defs>
        <linearGradient id="hq-hex-face" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7fd3ff" />
          <stop offset="0.4" stopColor="#3a98f2" />
          <stop offset="1" stopColor="#1a5cc8" />
        </linearGradient>
        <linearGradient id="hq-hex-inner" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#01040f" />
          <stop offset="1" stopColor="#06193d" />
        </linearGradient>
      </defs>
      <polygon points={outer} fill="url(#hq-hex-face)" stroke="#8fd3ff" strokeOpacity="0.55" strokeWidth="0.8" strokeLinejoin="round" />
      <polygon points="18,0.6 35.4,10.6 18,21 0.6,10.6" fill="#ffffff" opacity="0.12" />
      <polygon points={inner} fill="url(#hq-hex-inner)" stroke="#0e3d82" strokeWidth="1" strokeLinejoin="round" />
    </svg>
  )
}
