// Back-right wall (plane z = 0, facing +z): the live knowledge-graph screen and decorative code/log panels.
import { useEffect, useMemo, useState } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { GraphData } from '@shared/types'
import { Box } from '../primitives'
import { useMat } from '../materials'
import { WALL_SCREENS } from '../layout'
import { drawGraph, makeGraphTexture } from '../textures/graphTexture'
import { makeScreenTexture } from '../textures/screens'

const MOUNT = 0.05

interface GraphScreenProps {
  graph: GraphData
  onOpen: () => void
}

function GraphScreen({ graph, onOpen }: GraphScreenProps): JSX.Element {
  const mat = useMat()
  const { x, y } = WALL_SCREENS.graph
  const w = x[1] - x[0]
  const h = y[1] - y[0]
  const cx = (x[0] + x[1]) / 2
  const cy = (y[0] + y[1]) / 2
  const [hovered, setHovered] = useState(false)

  const { canvas, texture, material } = useMemo(() => {
    const { canvas, texture } = makeGraphTexture()
    return { canvas, texture, material: new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }) }
  }, [])
  useEffect(
    () => () => {
      texture.dispose()
      material.dispose()
    },
    [texture, material]
  )

  useEffect(() => {
    drawGraph(canvas, graph)
    texture.needsUpdate = true
  }, [canvas, texture, graph])

  useEffect(() => {
    material.color.setScalar(hovered ? 1.45 : 1.15)
  }, [hovered, material])

  const over = (e: ThreeEvent<PointerEvent>): void => {
    e.stopPropagation()
    setHovered(true)
    document.body.style.cursor = 'pointer'
  }
  const out = (): void => {
    setHovered(false)
    document.body.style.cursor = ''
  }
  const click = (e: ThreeEvent<MouseEvent>): void => {
    e.stopPropagation()
    onOpen()
  }

  return (
    <group position={[cx, cy, MOUNT]}>
      <Box size={[w + 0.08, h + 0.08, 0.06]} at={[0, 0, -0.02]} material={mat.bezel} />
      {/* Cyan edge light around the panel, brightest on the left like the reference. */}
      <Box size={[0.025, h + 0.06, 0.02]} at={[-w / 2 - 0.04, 0, 0.01]} material={mat.cyanLight} shadows={false} />
      <Box size={[w + 0.06, 0.012, 0.02]} at={[0, h / 2 + 0.04, 0.01]} material={mat.blueLight} shadows={false} />
      <mesh position={[0, 0, 0.012]} material={material} onClick={click} onPointerOver={over} onPointerOut={out}>
        <planeGeometry args={[w, h]} />
      </mesh>
      {/* Cyan spill on the wall around the screen and on the floor in front of it. */}
      <pointLight position={[0, -0.6, 1.0]} color="#3fc8ff" intensity={5} distance={6} decay={2} />
    </group>
  )
}

function WallPanel({
  x,
  y,
  kind,
  seed
}: {
  x: readonly [number, number]
  y: readonly [number, number]
  kind: 'code' | 'media' | 'log'
  seed: number
}): JSX.Element {
  const mat = useMat()
  const w = x[1] - x[0]
  const h = y[1] - y[0]
  const material = useMemo(() => {
    const map = makeScreenTexture(kind, seed, 192, Math.round((192 * h) / w))
    return new THREE.MeshBasicMaterial({ map, toneMapped: false, color: new THREE.Color().setScalar(0.95) })
  }, [kind, seed, w, h])
  useEffect(
    () => () => {
      material.map?.dispose()
      material.dispose()
    },
    [material]
  )

  return (
    <group position={[(x[0] + x[1]) / 2, (y[0] + y[1]) / 2, MOUNT]}>
      <Box size={[w + 0.05, h + 0.05, 0.04]} at={[0, 0, -0.01]} material={mat.bezel} />
      <mesh position={[0, 0, 0.0105]} material={material}>
        <planeGeometry args={[w, h]} />
      </mesh>
    </group>
  )
}

interface RightWallProps {
  graph: GraphData
  onOpenGraph: () => void
}

export default function RightWall({ graph, onOpenGraph }: RightWallProps): JSX.Element {
  return (
    <group>
      <GraphScreen graph={graph} onOpen={onOpenGraph} />
      {WALL_SCREENS.panels.map((p, i) => (
        <WallPanel key={i} x={p.x} y={p.y} kind={p.kind} seed={31 + i} />
      ))}
    </group>
  )
}
