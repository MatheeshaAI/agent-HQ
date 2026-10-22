// Secondary furniture that fills out the office: an upholstered bench in front of the kitchenette and a printer.
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { Box, Cylinder } from '../primitives'
import { useMat } from '../materials'
import type { Vec2 } from '../layout'

const BENCH = new RoundedBoxGeometry(1, 1, 1, 3, 0.04)

/** Dark-grey upholstered bench, long side along z, on four black legs. */
function Bench({ at }: { at: Vec2 }): JSX.Element {
  const mat = useMat()
  const [w, h, l] = [0.55, 0.42, 1.3]
  const legs = 0.1
  return (
    <group position={[at[0], 0, at[1]]}>
      <mesh
        geometry={BENCH}
        material={mat.upholstery}
        scale={[w, h - legs, l]}
        position={[0, legs + (h - legs) / 2, 0]}
        castShadow
        receiveShadow
      />
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <Cylinder
            key={`${sx}${sz}`}
            radius={0.015}
            height={legs}
            at={[sx * (w / 2 - 0.06), legs / 2, sz * (l / 2 - 0.08)]}
            material={mat.blackMetal}
          />
        ))
      )}
    </group>
  )
}

/** Grey office printer with a dark paper slot and a cyan status light. */
function Printer({ at }: { at: Vec2 }): JSX.Element {
  const mat = useMat()
  return (
    <group position={[at[0], 0, at[1]]}>
      <Box size={[0.5, 0.45, 0.45]} at={[0, 0.225, 0]} material={mat.cabinetGrey} />
      <Box size={[0.3, 0.012, 0.32]} at={[0, 0.451, 0]} material={mat.plastic} shadows={false} />
      <Box size={[0.01, 0.02, 0.03]} at={[0.251, 0.4, 0.15]} material={mat.cyanLight} shadows={false} />
    </group>
  )
}

export default function Extras(): JSX.Element {
  return (
    <group>
      <Bench at={[1.6, 3.5]} />
      <Printer at={[2.8, 5.5]} />
    </group>
  )
}
