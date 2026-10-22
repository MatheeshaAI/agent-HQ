// A dark-wood office desk with drawer pedestal, monitors, keyboard, mouse and chair.
// Local frame: the sitter is on +x facing -x; the desk runs along z.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Box, Cylinder } from '../primitives'
import { useMat } from '../materials'
import { makeScreenTexture, type ScreenKind } from '../textures/screens'
import { chairGeometry } from './chairGeometry'
import type { Vec2 } from '../layout'

export const DESK = { height: 0.74, depth: 0.78, length: 1.55, top: 0.04 } as const

const SCREEN_KINDS: ScreenKind[] = ['code', 'dashboard', 'docs', 'code', 'dashboard']

interface MonitorProps {
  at: [number, number, number]
  yaw: number
  kind: ScreenKind
  seed: number
  busy: boolean
}

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
    if (busy) {
      scroll.current += dt * 0.035
      map.offset.y = scroll.current % 1
    }
    screen.color.setScalar(busy ? 1.25 : 0.55)
  })

  const w = 0.56
  const h = 0.33
  return (
    <group position={at} rotation={[0, yaw, 0]}>
      <Box size={[0.2, 0.012, 0.16]} at={[0, 0.006, 0]} material={mat.blackMetal} />
      <Box size={[0.025, 0.2, 0.05]} at={[-0.03, 0.1, 0]} material={mat.blackMetal} />
      <Box size={[0.022, h + 0.02, w + 0.02]} at={[-0.02, 0.2 + h / 2, 0]} material={mat.bezel} />
      <mesh position={[-0.0085, 0.2 + h / 2, 0]} rotation={[0, Math.PI / 2, 0]} material={screen}>
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

interface DeskProps {
  at: Vec2
  rotation: number
  monitors: 1 | 2 | 3
  busy: boolean
  seed: number
  /** Whether the desk has a task lamp (occupied desks do). */
  lamp: boolean
}

export default function Desk({ at, rotation, monitors, busy, seed, lamp }: DeskProps): JSX.Element {
  const mat = useMat()
  const chair = useMemo(() => chairGeometry(), [])
  const { height: H, depth: D, length: L, top: T } = DESK

  const monitorSlots: [number, number][] =
    monitors === 1
      ? [[0, 0]]
      : monitors === 2
        ? [
            [-0.3, 0.12],
            [0.3, -0.12]
          ]
        : [
            [-0.6, 0.35],
            [0, 0],
            [0.6, -0.35]
          ]

  return (
    <group position={[at[0], 0, at[1]]} rotation={[0, rotation, 0]}>
      {/* Top, pedestal with drawers, side panel and modesty panel. */}
      <Box size={[D, T, L]} at={[0, H - T / 2, 0]} material={mat.walnut} />
      <Box size={[D - 0.08, H - T, 0.42]} at={[0, (H - T) / 2, L / 2 - 0.23]} material={mat.walnut} />
      {[0, 1, 2].map((i) => (
        <group key={i}>
          <Box size={[0.012, 0.2, 0.38]} at={[D / 2 - 0.035, 0.13 + i * 0.22, L / 2 - 0.23]} material={mat.drawerWood} />
          <Box
            size={[0.015, 0.012, 0.12]}
            at={[D / 2 - 0.025, 0.2 + i * 0.22, L / 2 - 0.23]}
            material={mat.brushedMetal}
            shadows={false}
          />
        </group>
      ))}
      <Box size={[D - 0.04, H - T, 0.04]} at={[0, (H - T) / 2, -L / 2 + 0.03]} material={mat.walnut} />
      <Box size={[0.03, 0.42, L - 0.5]} at={[-D / 2 + 0.06, H - T - 0.26, -0.2]} material={mat.plastic} />

      {monitorSlots.slice(0, monitors).map(([z, yaw], i) => (
        <Monitor
          key={i}
          at={[-0.2, H, z]}
          yaw={yaw}
          kind={SCREEN_KINDS[(seed + i) % SCREEN_KINDS.length]}
          seed={seed * 10 + i}
          busy={busy}
        />
      ))}

      {/* Keyboard, mouse, mug and a few papers. */}
      <Box size={[0.15, 0.018, 0.44]} at={[0.12, H + 0.009, -0.02]} material={mat.plastic} />
      <Box size={[0.1, 0.02, 0.06]} at={[0.13, H + 0.01, 0.33]} material={mat.plastic} />
      <Cylinder radius={0.04} height={0.1} at={[0.05, H + 0.05, 0.6]} material={mat.cabinetGrey} />
      <Box size={[0.21, 0.004, 0.28]} at={[0.08, H + 0.002, -0.45]} material={mat.paper} rotation={[0, 0.25, 0]} />
      {lamp && <DeskLamp at={[-0.22, H, -0.66]} />}

      <mesh
        geometry={chair}
        material={[mat.fabric, mat.blackMetal]}
        position={[D / 2 + 0.38, 0, 0]}
        rotation={[0, (seed % 3) * 0.08 - 0.08, 0]}
        castShadow
        receiveShadow
      />
    </group>
  )
}
