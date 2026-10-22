// Back-left wall: the glowing "AI AGENT OFFICE" sign, warm-lit display shelving and the kitchenette.
// Everything here is laid out along z on the plane x = 0, facing +x.
import { useGLTF } from '@react-three/drei'
import { useMemo } from 'react'
import * as THREE from 'three'
import { Box, Cylinder } from '../primitives'
import { useMat } from '../materials'
import TextPlane, { type TextLine } from '../textures/TextPlane'
import Spot from '../lights/Spot'

const VASE_URL = './models/vase-flowers.glb'

const SIGN = { z0: 3.0, z1: 10.8, y0: 1.95, y1: 3.65, depth: 0.16 }
const SHELVES = { z0: 6.5, z1: 10.7 }
const KITCHEN = { z0: 3.2, z1: 6.3 }

const SIGN_LINES: TextLine[] = [
  { text: 'AI AGENT OFFICE', size: 0.36, y: 0.36, weight: 600, tracking: 0.04, color: '#aef3ff', glow: '#22d3ee' },
  {
    text: 'RESEARCH  ·  ANALYZE  ·  BUILD  ·  DELIVER',
    size: 0.14,
    y: 0.76,
    weight: 500,
    tracking: 0.14,
    color: '#d4e6f5',
    glow: '#7dd3fc'
  }
]

function NeonSign(): JSX.Element {
  const mat = useMat()
  const length = SIGN.z1 - SIGN.z0
  const height = SIGN.y1 - SIGN.y0
  const zc = (SIGN.z0 + SIGN.z1) / 2
  return (
    <group>
      <Box size={[SIGN.depth, height, length]} at={[SIGN.depth / 2, SIGN.y0 + height / 2, zc]} material={mat.wallDark} />
      {/* Blue LED line along the top edge and a faint one along the bottom. */}
      <Box size={[0.03, 0.025, length]} at={[SIGN.depth, SIGN.y1 + 0.005, zc]} material={mat.blueLight} shadows={false} />
      <Box size={[0.02, 0.012, length]} at={[SIGN.depth, SIGN.y0 - 0.005, zc]} material={mat.cyanLight} shadows={false} />
      <TextPlane
        lines={SIGN_LINES}
        width={length - 0.2}
        height={height - 0.1}
        intensity={2.4}
        position={[SIGN.depth + 0.004, SIGN.y0 + height / 2, zc]}
        rotation={[0, Math.PI / 2, 0]}
      />
      <pointLight position={[0.7, 2.5, zc]} color="#38c8ff" intensity={2.2} distance={4.5} decay={2} />
    </group>
  )
}

function DisplayShelves(): JSX.Element {
  const mat = useMat()
  const { scene: vase } = useGLTF(VASE_URL, false, false)
  const len = SHELVES.z1 - SHELVES.z0
  const zc = (SHELVES.z0 + SHELVES.z1) / 2
  const shelfYs = [1.1, 1.45, 1.8]
  const vases = useMemo(
    () =>
      [0, 1].map(() => {
        const v = vase.clone()
        // The sample's transmission glass would add a full transmission pass; swap in the shared cheap glass.
        v.traverse((o) => {
          const mesh = o as THREE.Mesh
          if (mesh.isMesh && (mesh.material as THREE.MeshPhysicalMaterial).transmission > 0) mesh.material = mat.glass
        })
        return v
      }),
    [vase, mat.glass]
  )
  const ornaments = useMemo(
    () =>
      shelfYs.flatMap((y, row) =>
        Array.from({ length: 5 }, (_, i) => ({
          y,
          z: SHELVES.z0 + 0.25 + i * ((len - 0.5) / 4) + (row % 2) * 0.12,
          kind: (i + row) % 3,
          h: 0.08 + ((i * 7 + row * 3) % 5) * 0.03
        }))
      ),
    [len]
  )

  return (
    <group>
      {/* Back panel and frame in dark wood. */}
      <Box size={[0.03, 2.0, len]} at={[0.015, 1.0, zc]} material={mat.darkWood} />
      <Box size={[0.42, 0.85, len]} at={[0.21, 0.425, zc]} material={mat.darkWood} />
      <Box size={[0.44, 0.03, len + 0.02]} at={[0.22, 0.865, zc]} material={mat.walnut} />
      {[0, 1, 2, 3].map((i) => (
        <Box
          key={i}
          size={[0.01, 0.7, len / 4 - 0.04]}
          at={[0.425, 0.42, SHELVES.z0 + (i + 0.5) * (len / 4)]}
          material={mat.walnut}
        />
      ))}
      {shelfYs.map((y) => (
        <group key={y}>
          <Box size={[0.32, 0.03, len]} at={[0.16, y, zc]} material={mat.walnut} />
          <Box size={[0.02, 0.008, len - 0.1]} at={[0.26, y - 0.02, zc]} material={mat.warmLight} shadows={false} />
        </group>
      ))}
      {[SHELVES.z0, SHELVES.z1].map((z) => (
        <Box key={z} size={[0.34, 1.15, 0.03]} at={[0.17, 1.42, z]} material={mat.walnut} />
      ))}
      {ornaments.map((o, i) =>
        o.kind === 0 ? (
          <Cylinder key={i} radius={0.035} height={o.h} at={[0.15, o.y + 0.015 + o.h / 2, o.z]} material={mat.cabinetWhite} />
        ) : o.kind === 1 ? (
          <Box key={i} size={[0.12, o.h, 0.16]} at={[0.15, o.y + 0.015 + o.h / 2, o.z]} material={mat.drawerWood} />
        ) : (
          <Cylinder
            key={i}
            radius={0.05}
            height={o.h * 0.7}
            at={[0.15, o.y + 0.015 + o.h * 0.35, o.z]}
            material={mat.brushedMetal}
          />
        )
      )}
      <primitive object={vases[0]} position={[0.2, 0.88, SHELVES.z0 + 0.5]} scale={1.6} />
      <primitive object={vases[1]} position={[0.2, 0.88, SHELVES.z1 - 0.7]} scale={1.4} rotation={[0, 1.2, 0]} />
      <pointLight position={[0.7, 1.4, zc]} color="#ffb070" intensity={9} distance={6} decay={2} />
    </group>
  )
}

function Kitchenette(): JSX.Element {
  const mat = useMat()
  const len = KITCHEN.z1 - KITCHEN.z0
  const zc = (KITCHEN.z0 + KITCHEN.z1) / 2
  const doors = 4
  return (
    <group>
      <Box size={[0.03, 1.1, len]} at={[0.015, 1.4, zc]} material={mat.wallPanel} />
      {/* Base cabinets, counter, upper cabinets. */}
      <Box size={[0.6, 0.86, len]} at={[0.3, 0.43, zc]} material={mat.cabinetGrey} />
      {Array.from({ length: doors - 1 }, (_, i) => (
        <Box
          key={i}
          size={[0.005, 0.8, 0.006]}
          at={[0.603, 0.42, KITCHEN.z0 + ((i + 1) * len) / doors]}
          material={mat.wallDark}
          shadows={false}
        />
      ))}
      <Box size={[0.64, 0.04, len + 0.04]} at={[0.32, 0.88, zc]} material={mat.tableGlass} />
      <Box size={[0.36, 0.62, len]} at={[0.18, 1.62, zc]} material={mat.cabinetGrey} />
      {Array.from({ length: doors - 1 }, (_, i) => (
        <Box
          key={i}
          size={[0.005, 0.58, 0.006]}
          at={[0.363, 1.62, KITCHEN.z0 + ((i + 1) * len) / doors]}
          material={mat.wallDark}
          shadows={false}
        />
      ))}
      <Box size={[0.02, 0.01, len - 0.1]} at={[0.3, 1.305, zc]} material={mat.warmLight} shadows={false} />
      {/* Coffee machine, grinder, kettle and cups. */}
      <group position={[0.32, 0.9, KITCHEN.z0 + 0.45]}>
        <Box size={[0.36, 0.42, 0.3]} at={[0, 0.21, 0]} material={mat.plastic} />
        <Box size={[0.2, 0.12, 0.22]} at={[0.09, 0.08, 0]} material={mat.blackMetal} />
        <Box size={[0.01, 0.06, 0.12]} at={[0.181, 0.33, 0]} material={mat.cyanLight} shadows={false} />
        <Cylinder radius={0.05} height={0.14} at={[0.02, 0.49, 0.08]} material={mat.brushedMetal} />
      </group>
      <Cylinder radius={0.07} height={0.22} at={[0.3, 1.01, KITCHEN.z0 + 1.1]} material={mat.brushedMetal} />
      {[0, 1, 2].map((i) => (
        <Cylinder
          key={i}
          radius={0.035}
          height={0.08}
          at={[0.38, 0.94, KITCHEN.z0 + 1.45 + i * 0.12]}
          material={mat.cabinetWhite}
        />
      ))}
      <Spot from={[0.6, 2.2, zc]} to={[0.4, 0.9, zc]} color="#ffbf80" intensity={6} angle={0.9} distance={4} />
    </group>
  )
}

export default function LeftWall(): JSX.Element {
  return (
    <group>
      <NeonSign />
      <DisplayShelves />
      <Kitchenette />
    </group>
  )
}

useGLTF.preload(VASE_URL, false, false)
