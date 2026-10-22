// Lounge at the front: a long greige linen three-seater on a striped charcoal rug, a dark walnut coffee table
// with a few objects and drum-shade floor lamps.
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import * as THREE from 'three'
import { Box, Cylinder } from '../primitives'
import { useMat } from '../materials'
import { LOUNGE, type Vec2 } from '../layout'
import { Rug } from '../room/Room'

const CUSHION = new RoundedBoxGeometry(1, 1, 1, 4, 0.06)
/** Crisper edges for the arms and base. */
const CUSHION_CRISP = new RoundedBoxGeometry(1, 1, 1, 2, 0.03)
const DRUM = new THREE.CylinderGeometry(0.13, 0.13, 0.28, 32, 1, true)

function Cushion({
  size,
  at,
  rotation = 0,
  crisp = false
}: {
  size: [number, number, number]
  at: [number, number, number]
  rotation?: number
  crisp?: boolean
}): JSX.Element {
  const mat = useMat()
  return (
    <mesh
      geometry={crisp ? CUSHION_CRISP : CUSHION}
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
  const len = 2.7
  const seat = 0.42
  return (
    <group position={[at[0], 0, at[1]]}>
      <Cushion size={[0.92, 0.24, len]} at={[0, 0.22, 0]} crisp />
      <Cushion size={[0.2, 0.36, len - 0.3]} at={[-0.36, 0.5, 0]} crisp />
      {[-1, 1].map((s) => (
        <Cushion key={s} size={[0.92, 0.55, 0.16]} at={[0, 0.375, s * (len / 2 - 0.08)]} crisp />
      ))}
      {[-0.79, 0, 0.79].map((z) => (
        <group key={z}>
          <Cushion size={[0.7, 0.14, 0.78]} at={[0.08, seat, z]} />
          <Cushion size={[0.2, 0.4, 0.78]} at={[-0.3, 0.66, z]} rotation={-0.1} />
        </group>
      ))}
      {[-1, 1].map((s) => (
        <Cushion key={s} size={[0.12, 0.32, 0.32]} at={[-0.15, 0.62, s * 0.98]} rotation={-0.3} />
      ))}
      {/* Low base on thin black legs. */}
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <Cylinder
            key={`${sx}${sz}`}
            radius={0.015}
            height={0.1}
            at={[sx * 0.38, 0.05, sz * (len / 2 - 0.1)]}
            material={mat.blackMetal}
          />
        ))
      )}
    </group>
  )
}

/** Dark walnut top and lower shelf on a thin black frame, with books, a bowl and a plant (placed by Plants). */
function CoffeeTable({ at }: { at: Vec2 }): JSX.Element {
  const mat = useMat()
  const w = 0.75
  const l = 1.4
  const h = 0.4
  return (
    <group position={[at[0], 0, at[1]]}>
      <Box size={[w, 0.04, l]} at={[0, h, 0]} material={mat.darkWood} />
      <Box size={[w - 0.05, 0.02, l - 0.05]} at={[0, 0.12, 0]} material={mat.darkWood} />
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
      <Cylinder radius={0.12} height={0.05} at={[0.08, h + 0.045, 0.3]} material={mat.ceramic} />
      <Box size={[0.22, 0.03, 0.3]} at={[-0.12, h + 0.035, 0.05]} material={mat.bookBlue} rotation={[0, 0.15, 0]} />
      <Box size={[0.2, 0.03, 0.27]} at={[-0.12, h + 0.065, 0.05]} material={mat.bookTan} rotation={[0, -0.1, 0]} />
    </group>
  )
}

/** Floor lamp: a white drum shade glowing softly on a thin black pole with a disc base. */
function DrumLamp({ at }: { at: Vec2 }): JSX.Element {
  const mat = useMat()
  return (
    <group position={[at[0], 0, at[1]]}>
      <Cylinder radius={0.14} height={0.025} at={[0, 0.0125, 0]} material={mat.blackMetal} />
      <Cylinder radius={0.012} height={1.3} at={[0, 0.65, 0]} material={mat.blackMetal} />
      <mesh geometry={DRUM} material={mat.globeShade} position={[0, 1.38, 0]} />
      <Cylinder radius={0.125} height={0.005} at={[0, 1.245, 0]} material={mat.globeShade} shadows={false} />
      <pointLight position={[0, 1.4, 0]} color="#ffbe78" intensity={2.4} distance={3} decay={2} />
    </group>
  )
}

export default function Lounge(): JSX.Element {
  const { rug, sofa, table, lamps } = LOUNGE
  return (
    <group>
      <Rug at={rug.at} size={rug.size} />
      <Sofa at={sofa.at} />
      <CoffeeTable at={table.at} />
      {lamps.map((l) => (
        <DrumLamp key={`${l[0]},${l[1]}`} at={l} />
      ))}
    </group>
  )
}
