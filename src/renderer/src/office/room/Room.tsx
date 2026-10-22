// Floor slab, polished tile floor, the two back walls and the low front planter.
import { MeshReflectorMaterial } from '@react-three/drei'
import { useMemo } from 'react'
import { Box } from '../primitives'
import { useMat } from '../materials'
import { ROOM, MEETING_ROOM, RUGS } from '../layout'

const WALL_T = 0.25
const WALL_H = ROOM.wallHeight

function Floor(): JSX.Element {
  const mat = useMat()
  const { width: W, depth: D } = ROOM
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[W / 2, 0, D / 2]} receiveShadow>
      <planeGeometry args={[W, D]} />
      <MeshReflectorMaterial
        map={mat.floor.map}
        roughnessMap={mat.floor.roughnessMap}
        color="#d4d2cf"
        roughness={1}
        metalness={0.2}
        envMapIntensity={0.6}
        mirror={0.5}
        resolution={512}
        blur={[400, 120]}
        mixBlur={1}
        mixStrength={1.6}
        mixContrast={1.1}
        depthScale={0.6}
        minDepthThreshold={0.6}
        maxDepthThreshold={1.3}
      />
    </mesh>
  )
}

function Walls(): JSX.Element {
  const mat = useMat()
  const { width: W, slabThickness: S } = ROOM
  const leftLength = MEETING_ROOM.min[1]
  const seams = useMemo(() => Array.from({ length: Math.floor(W / 1.2) }, (_, i) => (i + 1) * 1.2), [W])

  return (
    <group>
      {/* Left wall (plane x = 0), ends where the meeting room starts. */}
      <Box
        size={[WALL_T, WALL_H + S, leftLength + WALL_T]}
        at={[-WALL_T / 2, (WALL_H - S) / 2, (leftLength - WALL_T) / 2]}
        material={mat.wallPanel}
      />
      <Box
        size={[0.02, WALL_H - 3.1, leftLength]}
        at={[0.01, 3.1 + (WALL_H - 3.1) / 2, leftLength / 2]}
        material={mat.darkWood}
      />
      <Box size={[0.06, 0.04, leftLength]} at={[0.03, 3.1, leftLength / 2]} material={mat.blackMetal} />

      {/* Right wall (plane z = 0). Lower band of dark panels, upper band of darker glazing. */}
      <Box
        size={[W + WALL_T, WALL_H + S, WALL_T]}
        at={[(W - WALL_T) / 2, (WALL_H - S) / 2, -WALL_T / 2]}
        material={mat.wallPanel}
      />
      <Box size={[W, WALL_H - 3.4, 0.02]} at={[W / 2, 3.4 + (WALL_H - 3.4) / 2, 0.01]} material={mat.wallPanel} />
      <Box size={[W, 0.05, 0.08]} at={[W / 2, 3.4, 0.04]} material={mat.blackMetal} />
      {seams.map((x) => (
        <Box key={x} size={[0.012, WALL_H, 0.03]} at={[x, WALL_H / 2, 0.012]} material={mat.wallDark} shadows={false} />
      ))}
      <Box size={[W, 0.08, 0.03]} at={[W / 2, 0.04, 0.015]} material={mat.blackMetal} shadows={false} />
    </group>
  )
}

function Slab(): JSX.Element {
  const mat = useMat()
  const { width: W, depth: D, slabThickness: S } = ROOM
  return (
    <group>
      <Box size={[W, S, D]} at={[W / 2, -S / 2 - 0.002, D / 2]} material={mat.slabEdge} />
      {/* Thin bright lip along the two visible slab edges catches the light like the reference. */}
      <Box size={[W, 0.012, 0.012]} at={[W / 2, -0.006, D]} material={mat.brushedMetal} shadows={false} />
      <Box size={[0.012, 0.012, D]} at={[W, -0.006, D / 2]} material={mat.brushedMetal} shadows={false} />
    </group>
  )
}

/** Low planter wall with a warm under-glow at the front edge, between the meeting room and the lounge. */
function FrontPlanter(): JSX.Element {
  const mat = useMat()
  const { depth: D } = ROOM
  const x0 = MEETING_ROOM.max[0] + 0.3
  const x1 = x0 + 4
  const len = x1 - x0
  return (
    <group>
      <Box size={[len, 0.42, 0.5]} at={[x0 + len / 2, 0.25, D - 0.35]} material={mat.slabEdge} />
      <Box size={[len, 0.02, 0.02]} at={[x0 + len / 2, 0.03, D - 0.62]} material={mat.warmLight} shadows={false} />
      <Box size={[0.9, 0.95, 0.6]} at={[x1 + 0.5, 0.475, D - 0.4]} material={mat.wallPanel} />
      <Box size={[0.012, 0.85, 0.5]} at={[x1 + 0.955, 0.47, D - 0.4]} material={mat.wallDark} shadows={false} />
    </group>
  )
}

export default function Room(): JSX.Element {
  const mat = useMat()
  return (
    <group>
      <Floor />
      <Slab />
      <Walls />
      <FrontPlanter />
      {RUGS.map((r) => (
        <Box
          key={`${r.at[0]},${r.at[1]}`}
          size={[r.size[0], 0.01, r.size[1]]}
          at={[r.at[0], 0.005, r.at[1]]}
          material={mat.rug}
        />
      ))}
    </group>
  )
}
