// A chunky executive desk: warm oak top on a black carcass, a drawer pedestal, a black lower cabinet,
// large monitors, a PC tower with RGB glow on some desks, desk clutter and a chair.
// Local frame: the sitter is on +x facing -x; the desk runs along z.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { motion } from '../../state/motion'
import * as THREE from 'three'
import { Box, Cylinder } from '../primitives'
import { useMat } from '../materials'
import { makeScreenTexture, type ScreenKind } from '../textures/screens'
import { chairGeometry } from './chairGeometry'
import { DESK_TOP, type Vec2 } from '../layout'

const DESK = { height: DESK_TOP, depth: 0.92, length: 1.8, top: 0.05 } as const

const SCREEN_KINDS: ScreenKind[] = ['code', 'dashboard', 'docs', 'code', 'dashboard']

interface MonitorProps {
  at: [number, number, number]
  yaw: number
  kind: ScreenKind
  seed: number
  busy: boolean
}

/** A 27-32" monitor with thin bezels. Screens glow even when idle, like the reference. */
function Monitor({ at, yaw, kind, seed, busy }: MonitorProps): JSX.Element {
  const mat = useMat()
  const screen = useMemo(() => {
    const map = makeScreenTexture(kind, seed, 320, 192, true)
    return new THREE.MeshBasicMaterial({ map, toneMapped: false })
  }, [kind, seed])
  useEffect(
    () => () => {
      screen.map?.dispose()
      screen.dispose()
    },
    [screen]
  )

  const scroll = useRef(seed * 0.137)
  useFrame((_, dt) => {
    const map = screen.map as THREE.Texture
    if (busy && !motion.isCalm()) {
      scroll.current += dt * 0.035
      map.offset.y = scroll.current % 1
    }
    screen.color.setScalar(busy ? 1.4 : 1.12)
  })

  const w = 0.7
  const h = 0.42
  const stand = 0.16
  const bezel = 0.012
  return (
    <group position={at} rotation={[0, yaw, 0]}>
      <Box size={[0.2, 0.012, 0.18]} at={[0, 0.006, 0]} material={mat.blackMetal} />
      <Box size={[0.025, stand, 0.05]} at={[-0.03, stand / 2, 0]} material={mat.blackMetal} />
      <Box size={[0.022, h + 2 * bezel, w + 2 * bezel]} at={[-0.02, stand + h / 2, 0]} material={mat.bezel} />
      <mesh position={[-0.0085, stand + h / 2, 0]} rotation={[0, Math.PI / 2, 0]} material={screen}>
        <planeGeometry args={[w, h]} />
      </mesh>
    </group>
  )
}

/** Small black task lamp with a warm, glowing shade. */
function DeskLamp({ at }: { at: [number, number, number] }): JSX.Element {
  const mat = useMat()
  return (
    <group position={at}>
      <Cylinder radius={0.07} height={0.02} at={[0, 0.01, 0]} material={mat.blackMetal} />
      <Cylinder radius={0.01} height={0.4} at={[0, 0.2, 0]} material={mat.blackMetal} />
      <Cylinder radius={0.075} height={0.1} at={[0.04, 0.42, 0]} material={mat.blackMetal} rotation={[0, 0, 0.5]} />
      <Cylinder
        radius={0.06}
        height={0.012}
        at={[0.065, 0.375, 0]}
        material={mat.warmLight}
        rotation={[0, 0, 0.5]}
        shadows={false}
      />
    </group>
  )
}

/** Black PC tower under the desk with a green RGB strip on its side. */
function PcTower({ at }: { at: [number, number, number] }): JSX.Element {
  const mat = useMat()
  return (
    <group position={at}>
      <Box size={[0.45, 0.45, 0.2]} at={[0, 0.225, 0]} material={mat.deskBody} />
      <Box size={[0.005, 0.35, 0.01]} at={[0.228, 0.225, 0.07]} material={mat.greenLight} shadows={false} />
    </group>
  )
}

interface DeskProps {
  at: Vec2
  rotation: number
  monitors: 1 | 2 | 3
  busy: boolean
  seed: number
  /** Desk length along local z. */
  length?: number
  /** Local z of the workplace (seat, monitors, keyboard). */
  seat?: number
  /** End (local z sign) that carries a potted plant (placed by Plants), so the lamp goes to the other one. */
  plant?: 1 | -1
}

export default function Desk({
  at,
  rotation,
  monitors,
  busy,
  seed,
  length = DESK.length,
  seat = 0,
  plant
}: DeskProps): JSX.Element {
  const mat = useMat()
  const chair = useMemo(() => chairGeometry(), [])
  const { height: H, depth: D, top: T } = DESK
  const L = length
  const body = H - T
  // The drawer pedestal stands at the end away from the sitter; a black cabinet fills the other end if there is room.
  const side = seat > 0 ? -1 : 1
  const pedestalZ = side * (L / 2 - 0.23)
  const cabinet = L / 2 - Math.abs(seat) >= 0.75
  const fronts = seed % 3 === 0 ? mat.deskBody : mat.drawerWood
  const ends = plant ?? side

  const slots: [number, number][] =
    monitors === 1
      ? [[0, 0]]
      : [[-0.37, -0.12], [0.37, 0.12], ...(monitors === 3 ? [[-side * 1.08, -side * 0.35] as [number, number]] : [])]

  return (
    <group position={[at[0], 0, at[1]]} rotation={[0, rotation, 0]}>
      <Box size={[D, T, L]} at={[0, H - T / 2, 0]} material={mat.deskTop} />
      <Box size={[D - 0.08, body, 0.42]} at={[0, body / 2, pedestalZ]} material={mat.deskBody} />
      {[0, 1, 2].map((i) => (
        <group key={i}>
          <Box size={[0.012, 0.21, 0.38]} at={[D / 2 - 0.035, 0.13 + i * 0.23, pedestalZ]} material={fronts} />
          <Box
            size={[0.015, 0.012, 0.14]}
            at={[D / 2 - 0.025, 0.2 + i * 0.23, pedestalZ]}
            material={mat.blackMetal}
            shadows={false}
          />
        </group>
      ))}
      {cabinet ? (
        <Box size={[D - 0.08, body, 0.45]} at={[0, body / 2, -side * (L / 2 - 0.25)]} material={mat.deskBody} />
      ) : (
        <Box size={[D - 0.04, body, 0.04]} at={[0, body / 2, -side * (L / 2 - 0.03)]} material={mat.deskBody} />
      )}
      <Box size={[0.03, 0.42, L - 0.1]} at={[-D / 2 + 0.06, body - 0.26, 0]} material={mat.deskBody} />
      {seed % 2 === 0 && <PcTower at={[-0.05, 0, side * (L / 2 - 0.61)]} />}

      {slots.map(([z, yaw], i) => (
        <Monitor
          key={i}
          at={[-0.24, H, seat + z]}
          yaw={yaw}
          kind={SCREEN_KINDS[(seed + i) % SCREEN_KINDS.length]}
          seed={seed * 10 + i}
          busy={busy}
        />
      ))}

      {/* Keyboard, mouse, mug, papers, notebook, phone, pen cup and the task lamp. */}
      <Box size={[0.15, 0.018, 0.44]} at={[0.14, H + 0.009, seat - 0.02]} material={mat.plastic} />
      <Box size={[0.1, 0.02, 0.06]} at={[0.15, H + 0.01, seat + 0.33]} material={mat.plastic} />
      <Cylinder radius={0.04} height={0.1} at={[0.08, H + 0.05, seat + 0.55]} material={mat.ceramic} />
      <Box size={[0.21, 0.004, 0.28]} at={[0.1, H + 0.002, seat - 0.5]} material={mat.paper} rotation={[0, 0.25, 0]} />
      <Box
        size={[0.2, 0.012, 0.28]}
        at={[0.22, H + 0.006, seat + 0.62]}
        material={mat.paper}
        rotation={[0, -0.15, 0]}
      />
      <Box
        size={[0.18, 0.03, 0.12]}
        at={[0.0, H + 0.015, -ends * (L / 2 - 0.42)]}
        material={mat.plastic}
        rotation={[0, 0.3, 0]}
      />
      <Cylinder radius={0.03} height={0.1} at={[-0.12, H + 0.05, seat - 0.6]} material={mat.blackMetal} />
      <DeskLamp at={[-0.28, H, -ends * (L / 2 - 0.15)]} />

      <mesh
        geometry={chair}
        material={[mat.fabric, mat.blackMetal]}
        position={[D / 2 + 0.38, 0, seat]}
        rotation={[0, (seed % 3) * 0.08 - 0.08, 0]}
        castShadow
        receiveShadow
      />
    </group>
  )
}
