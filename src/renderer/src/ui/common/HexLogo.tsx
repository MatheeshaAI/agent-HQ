type Point = [number, number]

/** Pointy-top hexagon corners around (18, 21), clockwise from the top. */
function hexagon(radius: number): Point[] {
  return [0, 1, 2, 3, 4, 5].map((i) => {
    const angle = ((i * 60 - 90) * Math.PI) / 180
    return [18 + radius * Math.cos(angle), 21 + radius * Math.sin(angle)]
  })
}

const points = (corners: Point[]): string => corners.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ')

const LIGHT_ANGLE = -125 // degrees: the key light sits to the upper left
const DARK: Point3 = [26, 79, 158]
const LIT: Point3 = [127, 203, 255]
type Point3 = [number, number, number]

/** Shade of a facet whose surface faces `normal` degrees, between DARK and LIT. */
function shade(normal: number): string {
  const t = (Math.cos(((normal - LIGHT_ANGLE) * Math.PI) / 180) + 1) / 2
  const rgb = DARK.map((d, i) => Math.round(d + (LIT[i] - d) * t))
  return `rgb(${rgb.join(',')})`
}

/** A band of six facets between two hexagons; edge i runs from corner i to corner i+1. */
function bevel(outer: Point[], inner: Point[], facing: 'out' | 'in'): { points: string; fill: string }[] {
  return outer.map((corner, i) => {
    const next = (i + 1) % 6
    const normal = -60 + i * 60 + (facing === 'in' ? 180 : 0)
    return { points: points([corner, outer[next], inner[next], inner[i]]), fill: shade(normal) }
  })
}

const OUTER = hexagon(20.4)
const HOLE = hexagon(8.2)
const FACETS = [...bevel(OUTER, hexagon(17.6), 'out'), ...bevel(hexagon(10.6), HOLE, 'in')]

/** The Agent HQ mark: a bevelled blue hexagon ring around a dark hole, drawn as SVG so it stays crisp at any scale. */
export function HexLogo({ size = 42 }: { size?: number }): JSX.Element {
  return (
    <svg width={(size * 36) / 42} height={size} viewBox="0 0 36 42" aria-hidden>
      <defs>
        <linearGradient id="hq-hex-face" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4aa3f0" />
          <stop offset="1" stopColor="#1d5fb8" />
        </linearGradient>
      </defs>
      <polygon points={points(OUTER)} fill="url(#hq-hex-face)" />
      {FACETS.map((facet) => (
        <polygon key={facet.points} points={facet.points} fill={facet.fill} stroke={facet.fill} strokeWidth="0.25" />
      ))}
      <polygon points={points(HOLE)} fill="#02060c" />
    </svg>
  )
}
