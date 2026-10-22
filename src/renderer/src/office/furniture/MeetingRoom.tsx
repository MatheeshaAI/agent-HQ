// Glass-walled meeting room in the front-left corner: frameless glass with blue edge light,
// a long dark table with chairs and an etched glass panel reading "Collaboration Builds Better Agents".
import { useMemo } from 'react'
import { Box } from '../primitives'
import { useMat } from '../materials'
import { MEETING_ROOM } from '../layout'
import TextPlane, { type TextLine } from '../textures/TextPlane'
import { chairGeometry } from './chairGeometry'

const POST = 0.035

const PANEL_LINES: TextLine[] = [
  { text: 'Collaboration', size: 0.11, y: 0.42, weight: 500, color: '#e3f1ff', glow: '#60a5fa' },
  { text: 'Builds Better Agents', size: 0.11, y: 0.58, weight: 500, color: '#e3f1ff', glow: '#60a5fa' }
]

interface GlassWallProps {
  /** 'x': the wall runs along x at z = fixed; 'z': it runs along z at x = fixed. */
  axis: 'x' | 'z'
  fixed: number
  from: number
  to: number
  height: number
  glow?: boolean
}

/** A frameless glass wall with slim black posts every ~1.3 m, a kerb and an optional blue LED cap. */
function GlassWall({ axis, fixed, from, to, height, glow }: GlassWallProps): JSX.Element {
  const mat = useMat()
  const len = to - from
  const posts = Math.max(1, Math.round(len / 1.3))
  const along = (
    t: number,
    y: number,
    size: [number, number, number]
  ): { at: [number, number, number]; size: [number, number, number] } =>
    axis === 'x' ? { at: [t, y, fixed], size } : { at: [fixed, y, t], size: [size[2], size[1], size[0]] }

  const pane = along(from + len / 2, height / 2 + 0.06, [len, height - 0.06, 0.012])
  const kerb = along(from + len / 2, 0.03, [len, 0.06, 0.08])
  const top = along(from + len / 2, height + 0.015, [len, 0.03, 0.05])
  const led = along(from + len / 2, height + 0.04, [len, 0.014, 0.02])

  return (
    <group>
      <Box {...pane} material={mat.glass} shadows={false} renderOrder={2} />
      <Box {...kerb} material={mat.blackMetal} />
      <Box {...top} material={mat.blackMetal} />
      {glow && <Box {...led} material={mat.blueLight} shadows={false} />}
      {Array.from({ length: posts + 1 }, (_, i) => {
        const p = along(from + (i * len) / posts, height / 2, [POST, height, POST])
        return <Box key={i} {...p} material={mat.blackMetal} />
      })}
    </group>
  )
}

function CollaborationPanel(): JSX.Element {
  const mat = useMat()
  const { min, max } = MEETING_ROOM
  const zc = (min[1] + max[1]) / 2 + 0.2
  const w = 2.3
  const h = 1.35

  return (
    <group position={[max[0] + 0.03, 1.08, zc]} rotation={[0, Math.PI / 2, 0]}>
      <mesh material={mat.tintedGlass}>
        <planeGeometry args={[w, h]} />
      </mesh>
      {/* Glowing blue frame. */}
      <Box size={[w, 0.02, 0.01]} at={[0, h / 2, 0.005]} material={mat.blueLight} shadows={false} />
      <Box size={[w, 0.02, 0.01]} at={[0, -h / 2, 0.005]} material={mat.blueLight} shadows={false} />
      <Box size={[0.02, h, 0.01]} at={[-w / 2, 0, 0.005]} material={mat.blueLight} shadows={false} />
      <Box size={[0.02, h, 0.01]} at={[w / 2, 0, 0.005]} material={mat.blueLight} shadows={false} />
      <TextPlane lines={PANEL_LINES} width={w} height={h} intensity={1.3} position={[0, 0, 0.012]} />
      <pointLight position={[0.6, 0, 0]} color="#2f7dff" intensity={1.6} distance={3} decay={2} />
    </group>
  )
}

function Table(): JSX.Element {
  const mat = useMat()
  const chair = useMemo(() => chairGeometry(), [])
  const { min, max } = MEETING_ROOM
  const cx = (min[0] + max[0]) / 2 - 0.1
  const cz = (min[1] + max[1]) / 2 + 0.1
  const len = 2.6
  const seats = [-0.85, 0, 0.85]
  return (
    <group position={[cx, 0, cz]}>
      <Box size={[1.1, 0.05, len]} at={[0, 0.74, 0]} material={mat.tableGlass} />
      <Box size={[0.5, 0.7, 0.08]} at={[0, 0.36, -len / 2 + 0.4]} material={mat.blackMetal} />
      <Box size={[0.5, 0.7, 0.08]} at={[0, 0.36, len / 2 - 0.4]} material={mat.blackMetal} />
      {seats.map((z) => (
        <group key={z}>
          <mesh
            geometry={chair}
            material={[mat.fabric, mat.blackMetal]}
            position={[0.85, 0, z]}
            rotation={[0, 0.1, 0]}
            castShadow
          />
          <mesh
            geometry={chair}
            material={[mat.fabric, mat.blackMetal]}
            position={[-0.85, 0, z]}
            rotation={[0, Math.PI - 0.1, 0]}
            castShadow
          />
        </group>
      ))}
      <mesh
        geometry={chair}
        material={[mat.fabric, mat.blackMetal]}
        position={[0, 0, -len / 2 - 0.45]}
        rotation={[0, Math.PI / 2, 0]}
        castShadow
      />
      {/* Notebooks and cups on the table. */}
      {[-0.8, 0.1, 0.9].map((z, i) => (
        <Box key={z} size={[0.22, 0.01, 0.3]} at={[i % 2 ? 0.25 : -0.25, 0.77, z]} material={mat.cabinetWhite} />
      ))}
    </group>
  )
}

export default function MeetingRoom(): JSX.Element {
  const { min, max, height } = MEETING_ROOM
  return (
    <group>
      <Table />
      <GlassWall axis="x" fixed={min[1]} from={min[0]} to={max[0]} height={height} glow />
      <GlassWall axis="z" fixed={max[0]} from={min[1]} to={max[1]} height={height} />
      <GlassWall axis="z" fixed={min[0]} from={min[1]} to={max[1]} height={height} />
      <GlassWall axis="x" fixed={max[1]} from={min[0]} to={max[0]} height={height} />
      <CollaborationPanel />
    </group>
  )
}
