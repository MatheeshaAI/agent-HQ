// Floor slab, polished stone floor, the two back walls, rugs and the low front planter.
import { MeshReflectorMaterial } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { Box, tiledBoxGeometry } from '../primitives'
import { useMat } from '../materials'
import { CAP_HEIGHT, LEFT_WALL_END, ROOM, MEETING_ROOM, RUGS, type Vec2 } from '../layout'
import { RUG_PERIOD } from '../textures/rug'
import Spot from '../lights/Spot'

const WALL_T = 0.25
const WALL_H = ROOM.wallHeight

function Floor(): JSX.Element {
  const mat = useMat()
  const { width: W, depth: D } = ROOM
  // Soft, blurred reflections only: light pools and screen streaks, never a legible mirror image.
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[W / 2, 0, D / 2]} receiveShadow>
      <planeGeometry args={[W, D]} />
      <MeshReflectorMaterial
        map={mat.floor.map}
        roughnessMap={mat.floor.roughnessMap}
        color="#c4c8cc"
        roughness={1}
        metalness={0.2}
        envMapIntensity={0.6}
        mirror={0}
        resolution={512}
        blur={[900, 300]}
        mixBlur={1}
        mixStrength={2.5}
        mixContrast={1}
        depthScale={1.2}
        minDepthThreshold={0.4}
        maxDepthThreshold={1}
      />
    </mesh>
  )
}

function Walls(): JSX.Element {
  const mat = useMat()
  const { width: W, slabThickness: S } = ROOM
  const L = LEFT_WALL_END
  const band = WALL_H - CAP_HEIGHT
  const seams = useMemo(() => Array.from({ length: Math.floor(W / 1.2) }, (_, i) => (i + 1) * 1.2), [W])

  return (
    <group>
      {/* Left wall (plane x = 0): dark panels below a black cap, a dark walnut band above it. */}
      <Box
        size={[WALL_T, WALL_H + S, L + WALL_T]}
        at={[-WALL_T / 2, (WALL_H - S) / 2, (L - WALL_T) / 2]}
        material={mat.wallPanel}
      />
      <Box size={[0.02, band, L]} at={[0.01, CAP_HEIGHT + band / 2, L / 2]} material={mat.darkWood} />
      <Box size={[0.06, 0.04, L]} at={[0.03, CAP_HEIGHT, L / 2]} material={mat.blackMetal} />

      {/* Right wall (plane z = 0): panels with fine seams, the same cap line. */}
      <Box
        size={[W + WALL_T, WALL_H + S, WALL_T]}
        at={[(W - WALL_T) / 2, (WALL_H - S) / 2, -WALL_T / 2]}
        material={mat.wallPanel}
      />
      <Box size={[W, 0.05, 0.08]} at={[W / 2, CAP_HEIGHT, 0.04]} material={mat.blackMetal} />
      {seams.map((x) => (
        <Box
          key={x}
          size={[0.012, CAP_HEIGHT, 0.03]}
          at={[x, CAP_HEIGHT / 2, 0.012]}
          material={mat.wallDark}
          shadows={false}
        />
      ))}
      <Box size={[W, 0.08, 0.03]} at={[W / 2, 0.04, 0.015]} material={mat.blackMetal} shadows={false} />
    </group>
  )
}

function Slab(): JSX.Element {
  const mat = useMat()
  const { width: W, depth: D, slabThickness: S } = ROOM
  // Extension under the meeting room, past the main floor's front edge.
  const ex = MEETING_ROOM.max[0] + 0.15
  const ez = MEETING_ROOM.max[1] + 0.15 - D
  return (
    <group>
      <Box size={[W, S, D]} at={[W / 2, -S / 2 - 0.002, D / 2]} material={mat.slabEdge} />
      <Box size={[ex, S, ez]} at={[ex / 2, -S / 2 - 0.002, D + ez / 2]} material={mat.slabEdge} />
      {/* Brushed-metal lip along the visible slab edges catches the light like the reference. */}
      <Box size={[W - ex, 0.02, 0.02]} at={[(W + ex) / 2, -0.01, D]} material={mat.brushedMetal} shadows={false} />
      <Box size={[0.02, 0.02, D]} at={[W, -0.01, D / 2]} material={mat.brushedMetal} shadows={false} />
      <Box size={[ex, 0.02, 0.02]} at={[ex / 2, -0.01, D + ez]} material={mat.brushedMetal} shadows={false} />
      <Box size={[0.02, 0.02, ez]} at={[ex, -0.01, D + ez / 2]} material={mat.brushedMetal} shadows={false} />
    </group>
  )
}

/**
 * Low planter wall at the front edge, right of the meeting room, with a warm LED cove under its cap,
 * a dark counter block at its end and a warm strip along the slab's front lip.
 */
function FrontPlanter(): JSX.Element {
  const mat = useMat()
  const { depth: D } = ROOM
  const x0 = 12.6
  const x1 = 14.95
  const len = x1 - x0
  const h = 0.42
  const z = D - 0.75
  return (
    <group>
      <Box size={[len, h, 0.5]} at={[x0 + len / 2, h / 2, z]} material={mat.slabEdge} />
      <Box size={[len + 0.04, 0.03, 0.56]} at={[x0 + len / 2, h + 0.015, z]} material={mat.blackMetal} />
      <Box size={[len, 0.035, 0.03]} at={[x0 + len / 2, h - 0.03, z + 0.25]} material={mat.warmLight} shadows={false} />
      <Box size={[0.9, 0.95, 0.6]} at={[x1 + 0.5, 0.475, D - 0.6]} material={mat.wallPanel} />
      <Box size={[0.012, 0.85, 0.5]} at={[x1 + 0.955, 0.47, D - 0.6]} material={mat.wallDark} shadows={false} />
      <Box
        size={[x1 + 0.95 - x0, 0.015, 0.015]}
        at={[(x0 + x1 + 0.95) / 2, -0.03, D + 0.012]}
        material={mat.warmLight}
        shadows={false}
      />
      {[0.3, 0.75].map((t) => {
        const x = x0 + t * len
        return (
          <Spot key={t} from={[x, h - 0.05, z + 0.32]} to={[x, 0, D - 0.1]} intensity={4} angle={1.2} distance={1.6} />
        )
      })}
    </group>
  )
}

/** A striped charcoal rug with a slightly lighter bound edge. Every rug shares one material, so they batch. */
export function Rug({ at, size, material }: { at: Vec2; size: Vec2; material?: THREE.Material }): JSX.Element {
  const mat = useMat()
  const geometry = useMemo(() => tiledBoxGeometry([size[0], 0.012, size[1]], RUG_PERIOD), [size])
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <group position={[at[0], 0, at[1]]}>
      <Box size={[size[0] + 0.08, 0.01, size[1] + 0.08]} at={[0, 0.005, 0]} material={mat.rugEdge} />
      <mesh geometry={geometry} material={material ?? mat.rug} position={[0, 0.007, 0]} receiveShadow />
    </group>
  )
}

export default function Room(): JSX.Element {
  return (
    <group>
      <Floor />
      <Slab />
      <Walls />
      <FrontPlanter />
      {RUGS.map((r) => (
        <Rug key={`${r.at[0]},${r.at[1]}`} at={r.at} size={r.size} />
      ))}
    </group>
  )
}
