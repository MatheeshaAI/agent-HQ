// Glass-walled meeting room at the front left, on a low plinth with a warm under-glow: tinted glass between
// slim black posts, a blue LED cap on the back wall, a door pair on the front, a long dark table with black
// leather chairs and a tinted glass panel reading "Collaboration Builds Better Agents".
import { useEffect, useMemo } from 'react'
import { Box, Cylinder, tiledBoxGeometry } from '../primitives'
import { TILE_PERIOD } from '../textures/tiles'
import { useMat } from '../materials'
import { MEETING_ROOM } from '../layout'
import TextPlane, { type TextLine } from '../textures/TextPlane'
import NoReflection from '../NoReflection'
import { chairGeometry } from './chairGeometry'

const POST = 0.045
const { min, max, height, plinth: P, table } = MEETING_ROOM

const PANEL_LINES: TextLine[] = [
  { text: 'Collaboration', size: 0.1, y: 0.42, weight: 500, color: '#e3f1ff', glow: '#60a5fa' },
  { text: 'Builds Better Agents', size: 0.1, y: 0.58, weight: 500, color: '#e3f1ff', glow: '#60a5fa' }
]

interface GlassWallProps {
  /** 'x': the wall runs along x at z = fixed; 'z': it runs along z at x = fixed. */
  axis: 'x' | 'z'
  fixed: number
  from: number
  to: number
  glow?: boolean
  /** Position along the wall of a door pair's centre. */
  door?: number
}

/** A glass wall with slim black posts every ~1.9 m, a kerb, a top rail and an optional blue LED cap. */
function GlassWall({ axis, fixed, from, to, glow, door }: GlassWallProps): JSX.Element {
  const mat = useMat()
  const len = to - from
  const posts = Math.max(1, Math.round(len / 1.9))
  const along = (
    t: number,
    y: number,
    size: [number, number, number]
  ): { at: [number, number, number]; size: [number, number, number] } =>
    axis === 'x' ? { at: [t, P + y, fixed], size } : { at: [fixed, P + y, t], size: [size[2], size[1], size[0]] }

  const pane = along(from + len / 2, height / 2 + 0.03, [len, height - 0.06, 0.012])
  const kerb = along(from + len / 2, 0.03, [len, 0.06, 0.08])
  const top = along(from + len / 2, height + 0.02, [len, 0.04, 0.07])
  const led = along(from + len / 2, height + 0.05, [len, 0.016, 0.022])
  const postAt = Array.from({ length: posts + 1 }, (_, i) => from + (i * len) / posts)
  const doorFrames = door === undefined ? [] : [door - 0.9, door, door + 0.9]

  return (
    <group>
      <Box {...pane} material={mat.glass} shadows={false} renderOrder={2} />
      <Box {...kerb} material={mat.blackMetal} />
      <Box {...top} material={mat.blackMetal} />
      {glow && <Box {...led} material={mat.blueLight} shadows={false} />}
      {[...postAt, ...doorFrames].map((t) => (
        <Box key={t} {...along(t, height / 2, [POST, height, POST])} material={mat.blackMetal} />
      ))}
      {/* Vertical bar handles either side of the door pair's meeting stile. */}
      {door !== undefined &&
        [-0.09, 0.09].map((d) => (
          <Box key={d} {...along(door + d, 1.05, [0.02, 0.45, 0.06])} material={mat.brushedMetal} />
        ))}
    </group>
  )
}

/** The etched panel fills the lower part of the right (x = max) glass face. */
function CollaborationPanel(): JSX.Element {
  const mat = useMat()
  const z0 = min[1] + 0.4
  const z1 = max[1] - 0.4
  const w = z1 - z0
  const h = 1.5
  return (
    <group position={[max[0] + 0.03, P + 0.15 + h / 2, (z0 + z1) / 2]} rotation={[0, Math.PI / 2, 0]}>
      <NoReflection>
        <mesh material={mat.tintedGlass}>
          <planeGeometry args={[w, h]} />
        </mesh>
        {/* Glowing cyan-blue frame. */}
        <Box size={[w, 0.02, 0.01]} at={[0, h / 2, 0.005]} material={mat.blueLight} shadows={false} />
        <Box size={[w, 0.02, 0.01]} at={[0, -h / 2, 0.005]} material={mat.blueLight} shadows={false} />
        <Box size={[0.02, h, 0.01]} at={[-w / 2, 0, 0.005]} material={mat.cyanLight} shadows={false} />
        <Box size={[0.02, h, 0.01]} at={[w / 2, 0, 0.005]} material={mat.blueLight} shadows={false} />
        <TextPlane lines={PANEL_LINES} width={w} height={h} intensity={1.3} position={[0, 0, 0.012]} />
      </NoReflection>
      <pointLight position={[0, -0.3, 0.6]} color="#2f7dff" intensity={1.5} distance={2.5} decay={2} />
    </group>
  )
}

function Table(): JSX.Element {
  const mat = useMat()
  const chair = useMemo(() => chairGeometry(), [])
  const len = 2.6
  const seats = [-0.96, -0.32, 0.32, 0.96]
  const top = P + 0.74
  return (
    <group position={[table[0], 0, table[1]]}>
      <Box size={[1.1, 0.05, len]} at={[0, top, 0]} material={mat.tableGlass} />
      <Box size={[0.5, 0.7, 0.08]} at={[0, P + 0.36, -len / 2 + 0.4]} material={mat.blackMetal} />
      <Box size={[0.5, 0.7, 0.08]} at={[0, P + 0.36, len / 2 - 0.4]} material={mat.blackMetal} />
      {seats.flatMap((z) =>
        [-1, 1].map((s) => (
          <mesh
            key={`${z},${s}`}
            geometry={chair}
            material={[mat.leather, mat.blackMetal]}
            position={[s * 0.85, P, z]}
            rotation={[0, (s < 0 ? Math.PI : 0) + z * 0.08, 0]}
            castShadow
          />
        ))
      )}
      {/* White runner with papers and cups; the centrepiece plant is placed by Plants. */}
      <Box size={[0.35, 0.005, len - 0.4]} at={[0, top + 0.028, 0]} material={mat.paper} shadows={false} />
      {[-0.9, 0.35, 0.95].map((z, i) => (
        <Cylinder
          key={z}
          radius={0.04}
          height={0.09}
          at={[i % 2 ? 0.32 : -0.32, top + 0.07, z]}
          material={mat.ceramic}
        />
      ))}
    </group>
  )
}

export default function MeetingRoom(): JSX.Element {
  const mat = useMat()
  const w = max[0] - min[0]
  const d = max[1] - min[1]
  const floor = useMemo(() => tiledBoxGeometry([w, 0.01, d], TILE_PERIOD), [w, d])
  useEffect(() => () => floor.dispose(), [floor])
  return (
    <group>
      {/* Stone-floored plinth with a warm under-glow along its visible faces. */}
      <Box size={[w, P, d]} at={[min[0] + w / 2, P / 2, min[1] + d / 2]} material={mat.slabEdge} />
      <mesh
        geometry={floor}
        material={mat.stoneFloor}
        position={[min[0] + w / 2, P + 0.005, min[1] + d / 2]}
        receiveShadow
      />
      <Box
        size={[0.015, 0.015, d]}
        at={[max[0] + 0.01, 0.02, min[1] + d / 2]}
        material={mat.warmLight}
        shadows={false}
      />
      <Box
        size={[w, 0.015, 0.015]}
        at={[min[0] + w / 2, 0.02, max[1] + 0.01]}
        material={mat.warmLight}
        shadows={false}
      />
      <Table />
      <GlassWall axis="x" fixed={min[1]} from={min[0]} to={max[0]} glow />
      <GlassWall axis="z" fixed={max[0]} from={min[1]} to={max[1]} glow />
      <GlassWall axis="z" fixed={min[0]} from={min[1]} to={max[1]} />
      <GlassWall axis="x" fixed={max[1]} from={min[0]} to={max[0]} door={max[0] - 2.2} />
      <CollaborationPanel />
    </group>
  )
}
