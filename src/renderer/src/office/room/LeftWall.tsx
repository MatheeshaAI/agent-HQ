// Back-left wall: the glowing "AI AGENT OFFICE" sign, the kitchenette, warm-lit display shelving and the
// lit end pilaster. Everything here is laid out along z on the plane x = 0, facing +x.
import { useGLTF } from '@react-three/drei'
import { useMemo } from 'react'
import * as THREE from 'three'
import { Box, Cylinder } from '../primitives'
import { useMat } from '../materials'
import { CAP_HEIGHT, LEFT_WALL_END } from '../layout'
import TextPlane, { type TextLine } from '../textures/TextPlane'
import Spot from '../lights/Spot'
import NoReflection from '../NoReflection'

const VASE_URL = './models/vase-flowers.glb'

const SIGN = { z0: 0.5, z1: 7.7, y0: 2.35, y1: 3.3, depth: 0.16 }
const KITCHEN = { z0: 2.0, z1: 4.2 }
const SHELVES = { z0: 4.3, z1: 7.6 }
/** Top of the fittings below the sign. */
const FIT_TOP = SIGN.y0 - 0.05
const PILASTER_Z = LEFT_WALL_END - 0.25
const FAUCET_ARC = new THREE.TorusGeometry(0.07, 0.012, 8, 16, Math.PI)

const SIGN_LINES: TextLine[] = [
  { text: 'AI AGENT OFFICE', size: 0.44, y: 0.36, weight: 600, tracking: 0.04, color: '#c8f6ff', glow: '#1aa8ff' },
  {
    text: 'RESEARCH  ·  ANALYZE  ·  BUILD  ·  DELIVER',
    size: 0.17,
    y: 0.78,
    weight: 500,
    tracking: 0.14,
    color: '#dbe9f7',
    glow: '#4aa8ff'
  }
]

function NeonSign(): JSX.Element {
  const mat = useMat()
  const length = SIGN.z1 - SIGN.z0
  const height = SIGN.y1 - SIGN.y0
  const zc = (SIGN.z0 + SIGN.z1) / 2
  return (
    <group>
      <Box
        size={[SIGN.depth, height, length]}
        at={[SIGN.depth / 2, SIGN.y0 + height / 2, zc]}
        material={mat.signPanel}
      />
      <NoReflection>
        {/* Blue LED line along the top edge and a faint one along the bottom. */}
        <Box
          size={[0.03, 0.025, length]}
          at={[SIGN.depth, SIGN.y1 + 0.005, zc]}
          material={mat.blueLight}
          shadows={false}
        />
        <Box
          size={[0.02, 0.012, length]}
          at={[SIGN.depth, SIGN.y0 - 0.005, zc]}
          material={mat.cyanLight}
          shadows={false}
        />
        <TextPlane
          lines={SIGN_LINES}
          width={length - 0.2}
          height={height - 0.1}
          intensity={1.45}
          position={[SIGN.depth + 0.004, SIGN.y0 + height / 2, zc]}
          rotation={[0, Math.PI / 2, 0]}
        />
      </NoReflection>
      <pointLight position={[0.45, 2.8, zc]} color="#38c8ff" intensity={1.2} distance={2.5} decay={2} />
    </group>
  )
}

/** Amber scallops grazing the dark walnut above and beside the sign. */
function WallWash(): JSX.Element {
  return (
    <group>
      {[1.0, 3.2, 5.4, 7.6].map((z) => (
        <Spot
          key={z}
          from={[0.45, 4.55, z]}
          to={[0.02, 3.0, z]}
          color="#ffb878"
          intensity={22}
          angle={0.42}
          penumbra={0.9}
          distance={3}
        />
      ))}
    </group>
  )
}

function DisplayShelves(): JSX.Element {
  const mat = useMat()
  const { scene: vase } = useGLTF(VASE_URL, false, false)
  const len = SHELVES.z1 - SHELVES.z0
  const zc = (SHELVES.z0 + SHELVES.z1) / 2
  const shelfYs = [1.25, 1.65, 2.05]
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
  // Vases, bowls and sculptures alternate with small book stacks along each shelf.
  const decor = useMemo(
    () =>
      shelfYs.flatMap((y, row) =>
        Array.from({ length: 7 }, (_, i) => ({
          y: y + 0.015,
          z: SHELVES.z0 + 0.25 + i * ((len - 0.5) / 6) + (row % 2) * 0.12,
          kind: (i + row * 2) % 4,
          r: 0.05 + ((i * 5 + row * 3) % 4) * 0.01,
          h: 0.12 + ((i * 7 + row * 3) % 5) * 0.045
        }))
      ),
    [len]
  )
  const ornamentMats = [mat.ceramic, mat.brushedMetal, mat.drawerWood]

  return (
    <group>
      {/* Warm-glowing back panel, credenza and walnut shelves with LED strips. */}
      <Box size={[0.03, FIT_TOP - 0.88, len]} at={[0.015, (FIT_TOP + 0.88) / 2, zc]} material={mat.shelfGlow} />
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
        <Box key={z} size={[0.34, FIT_TOP - 0.88, 0.03]} at={[0.17, (FIT_TOP + 0.88) / 2, z]} material={mat.walnut} />
      ))}
      {decor.map((o, i) =>
        o.kind === 3 ? (
          <group key={i}>
            <Box size={[0.16, 0.035, 0.22]} at={[0.15, o.y + 0.018, o.z]} material={mat.bookBlue} />
            <Box size={[0.15, 0.03, 0.2]} at={[0.15, o.y + 0.051, o.z]} material={mat.bookTan} />
          </group>
        ) : (
          <Cylinder
            key={i}
            radius={o.kind === 1 ? o.r * 1.2 : o.r}
            height={o.kind === 1 ? o.h * 0.4 : o.h}
            at={[0.15, o.y + (o.kind === 1 ? o.h * 0.2 : o.h / 2), o.z]}
            material={ornamentMats[o.kind]}
          />
        )
      )}
      <primitive object={vases[0]} position={[0.2, 0.88, SHELVES.z0 + 0.5]} scale={1.6} />
      <primitive object={vases[1]} position={[0.2, 0.88, SHELVES.z0 + 1.6]} scale={1.4} rotation={[0, 1.2, 0]} />
      <pointLight position={[0.55, 1.65, zc]} color="#ffa860" intensity={14} distance={3} decay={2} />
      {/* Small glowing lamp at the credenza's far end. */}
      <group position={[0.22, 0.88, SHELVES.z1 - 0.3]}>
        <Cylinder radius={0.05} height={0.12} at={[0, 0.06, 0]} material={mat.ceramic} />
        <Cylinder radius={0.09} height={0.12} at={[0, 0.18, 0]} material={mat.globeShade} shadows={false} />
        <pointLight position={[0.05, 0.2, 0]} color="#ffb070" intensity={1.5} distance={2} decay={2} />
      </group>
    </group>
  )
}

function Faucet({ at }: { at: [number, number, number] }): JSX.Element {
  const mat = useMat()
  return (
    <group position={at}>
      <Cylinder radius={0.012} height={0.3} at={[0, 0.15, 0]} material={mat.brushedMetal} />
      <mesh geometry={FAUCET_ARC} material={mat.brushedMetal} position={[0.07, 0.3, 0]} castShadow />
    </group>
  )
}

function Kitchenette(): JSX.Element {
  const mat = useMat()
  const pantry = 0.6
  const z0 = KITCHEN.z0 + pantry
  const len = KITCHEN.z1 - z0
  const zc = (z0 + KITCHEN.z1) / 2
  const doors = 4
  const doorLines = (x: number, y: number, h: number): JSX.Element[] =>
    Array.from({ length: doors - 1 }, (_, i) => (
      <Box
        key={`${x},${i}`}
        size={[0.005, h, 0.006]}
        at={[x, y, z0 + ((i + 1) * len) / doors]}
        material={mat.wallDark}
        shadows={false}
      />
    ))
  return (
    <group>
      {/* Tall pantry at the corner end, dark backsplash, base cabinets with a light stone counter. */}
      <Box size={[0.6, FIT_TOP, pantry]} at={[0.3, FIT_TOP / 2, KITCHEN.z0 + pantry / 2]} material={mat.cabinetGrey} />
      <Box
        size={[0.005, FIT_TOP - 0.1, 0.006]}
        at={[0.603, FIT_TOP / 2, KITCHEN.z0 + pantry / 2]}
        material={mat.wallDark}
        shadows={false}
      />
      <Box size={[0.02, 0.8, len]} at={[0.01, 1.3, zc]} material={mat.wallDark} />
      <Box size={[0.6, 0.86, len]} at={[0.3, 0.43, zc]} material={mat.cabinetGrey} />
      {doorLines(0.603, 0.42, 0.8)}
      <Box size={[0.64, 0.04, len]} at={[0.32, 0.88, zc]} material={mat.stone} />
      {/* Upper cabinets sit wholly below the sign, with a warm LED strip underneath. */}
      <Box size={[0.34, 0.6, len]} at={[0.17, FIT_TOP - 0.3, zc]} material={mat.cabinetGrey} />
      {doorLines(0.343, FIT_TOP - 0.3, 0.56)}
      <Box size={[0.02, 0.01, len - 0.1]} at={[0.3, FIT_TOP - 0.605, zc]} material={mat.warmLight} shadows={false} />

      {/* Espresso machine, cups and a sink with a gooseneck faucet. */}
      <group position={[0.32, 0.9, z0 + 0.25]}>
        <Box size={[0.36, 0.42, 0.3]} at={[0, 0.21, 0]} material={mat.blackMetal} />
        <Box size={[0.2, 0.12, 0.22]} at={[0.09, 0.08, 0]} material={mat.plastic} />
        <Box size={[0.01, 0.06, 0.12]} at={[0.181, 0.33, 0]} material={mat.cyanLight} shadows={false} />
        <Cylinder radius={0.05} height={0.14} at={[0.02, 0.49, 0.08]} material={mat.brushedMetal} />
      </group>
      {[0, 1, 2].map((i) => (
        <Cylinder key={i} radius={0.035} height={0.08} at={[0.38, 0.94, z0 + 0.55 + i * 0.12]} material={mat.ceramic} />
      ))}
      <Box size={[0.4, 0.02, 0.5]} at={[0.32, 0.901, KITCHEN.z1 - 0.45]} material={mat.brushedMetal} shadows={false} />
      <Faucet at={[0.1, 0.9, KITCHEN.z1 - 0.45]} />

      {[z0 + 0.6, KITCHEN.z1 - 0.6].map((z) => (
        <Spot
          key={z}
          from={[0.35, FIT_TOP - 0.65, z]}
          to={[0.45, 0.88, z]}
          color="#ffb874"
          intensity={8}
          angle={1.1}
          penumbra={0.7}
          distance={1.8}
        />
      ))}
      <Spot
        from={[1.1, 3.2, zc - 0.3]}
        to={[0.2, 1.6, zc - 0.3]}
        color="#ffb874"
        intensity={30}
        angle={0.75}
        distance={3.5}
      />
    </group>
  )
}

/** Where the wall ends: a dark pilaster with a warm-white light strip on its face. */
function Pilaster(): JSX.Element {
  const mat = useMat()
  return (
    <group>
      <Box size={[0.3, CAP_HEIGHT, 0.3]} at={[0.15, CAP_HEIGHT / 2, PILASTER_Z]} material={mat.wallDark} />
      <Box size={[0.02, 3.0, 0.06]} at={[0.31, 1.6, PILASTER_Z]} material={mat.warmLight} shadows={false} />
    </group>
  )
}

export default function LeftWall(): JSX.Element {
  return (
    <group>
      <NeonSign />
      <WallWash />
      <DisplayShelves />
      <Kitchenette />
      <Pilaster />
    </group>
  )
}

useGLTF.preload(VASE_URL, false, false)
