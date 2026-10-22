// Lounge at the front: cream modern sofa on a dark rug, a low coffee table and two glowing globe floor lamps.
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { Box, Cylinder, UNIT_SPHERE } from '../primitives'
import { useMat } from '../materials'
import { LOUNGE, type Vec2 } from '../layout'

const CUSHION = new RoundedBoxGeometry(1, 1, 1, 4, 0.12)

function Cushion({
  size,
  at,
  rotation = 0
}: {
  size: [number, number, number]
  at: [number, number, number]
  rotation?: number
}): JSX.Element {
  const mat = useMat()
  return (
    <mesh
      geometry={CUSHION}
      material={mat.sofa}
      scale={size}
      position={at}
      rotation={[0, 0, rotation]}
      castShadow
      receiveShadow
    />
  )
}

/** Sofa facing +x, long side along z. */
function Sofa({ at }: { at: Vec2 }): JSX.Element {
  const mat = useMat()
  const len = 2.3
  const seat = 0.42
  return (
    <group position={[at[0], 0, at[1]]}>
      <Cushion size={[0.92, 0.26, len]} at={[0, 0.25, 0]} />
      <Cushion size={[0.22, 0.42, len]} at={[-0.36, 0.58, 0]} rotation={-0.08} />
      <Cushion size={[0.92, 0.5, 0.2]} at={[0, 0.36, -len / 2 + 0.06]} />
      <Cushion size={[0.92, 0.5, 0.2]} at={[0, 0.36, len / 2 - 0.06]} />
      {[-0.52, 0.52].map((z) => (
        <Cushion key={z} size={[0.7, 0.14, 0.98]} at={[0.08, seat, z]} />
      ))}
      <Cushion size={[0.14, 0.36, 0.42]} at={[-0.18, 0.62, 0.62]} rotation={-0.3} />
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <Cylinder
            key={`${sx}${sz}`}
            radius={0.015}
            height={0.12}
            at={[sx * 0.38, 0.06, sz * (len / 2 - 0.1)]}
            material={mat.blackMetal}
          />
        ))
      )}
    </group>
  )
}

function CoffeeTable({ at }: { at: Vec2 }): JSX.Element {
  const mat = useMat()
  const w = 0.7
  const l = 1.3
  const h = 0.4
  return (
    <group position={[at[0], 0, at[1]]}>
      <Box size={[w, 0.035, l]} at={[0, h, 0]} material={mat.walnut} />
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <Box
            key={`${sx}${sz}`}
            size={[0.02, h, 0.02]}
            at={[(sx * (w - 0.04)) / 2, h / 2, (sz * (l - 0.04)) / 2]}
            material={mat.blackMetal}
          />
        ))
      )}
      <Box size={[w, 0.015, 0.02]} at={[0, 0.05, (l - 0.04) / 2]} material={mat.blackMetal} />
      <Box size={[w, 0.015, 0.02]} at={[0, 0.05, -(l - 0.04) / 2]} material={mat.blackMetal} />
      <Cylinder radius={0.13} height={0.02} at={[0.05, h + 0.03, -0.35]} material={mat.cabinetWhite} />
      <Box size={[0.18, 0.04, 0.24]} at={[-0.1, h + 0.04, 0.35]} material={mat.cabinetWhite} />
    </group>
  )
}

function GlobeLamp({ at }: { at: Vec2 }): JSX.Element {
  const mat = useMat()
  return (
    <group position={[at[0], 0, at[1]]}>
      <Cylinder radius={0.14} height={0.025} at={[0, 0.0125, 0]} material={mat.blackMetal} />
      <Cylinder radius={0.012} height={1.35} at={[0, 0.69, 0]} material={mat.blackMetal} />
      <mesh geometry={UNIT_SPHERE} material={mat.globeShade} scale={[0.26, 0.2, 0.26]} position={[0, 1.42, 0]} />
      <pointLight position={[0, 1.42, 0]} color="#ffc887" intensity={3.2} distance={5} decay={2} />
    </group>
  )
}

export default function Lounge(): JSX.Element {
  const mat = useMat()
  const { rug, sofa, table, lamps } = LOUNGE
  return (
    <group>
      <Box size={[rug.size[0], 0.012, rug.size[1]]} at={[rug.at[0], 0.006, rug.at[1]]} material={mat.rug} />
      <Sofa at={sofa.at} />
      <CoffeeTable at={table.at} />
      {lamps.map((l) => (
        <GlobeLamp key={`${l[0]},${l[1]}`} at={l} />
      ))}
    </group>
  )
}
