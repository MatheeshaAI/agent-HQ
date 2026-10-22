// The cinematic 3D office at the centre of Agent HQ. Fills its parent; the scene floats on black.
import { Suspense, useLayoutEffect, useMemo, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { PerformanceMonitor } from '@react-three/drei'
import * as THREE from 'three'
import type { AgentId, AgentStatus, GraphData } from '@shared/types'
import { BOOKSHELVES, CAMERA, DESKS, FACING, PLANTS, SEAT_OFFSET } from './layout'
import { MaterialsContext, useOfficeMaterials } from './materials'
import Room from './room/Room'
import LeftWall from './room/LeftWall'
import RightWall from './room/RightWall'
import Desk from './furniture/Desk'
import Bookshelf from './furniture/Bookshelf'
import Plants from './furniture/Plants'
import MeetingRoom from './furniture/MeetingRoom'
import Lounge from './furniture/Lounge'
import Agent from './agents/Agent'
import Lighting from './lights/Lighting'
import Effects from './Effects'
import StaticBatch from './StaticBatch'

export interface OfficeSceneProps {
  agents: AgentStatus[]
  graph: GraphData
  onOpenGraph: () => void
  onAgentClick?: (id: AgentId) => void
}

/** Aspect ratio the framing was tuned for (the reference's office region). */
const DESIGN_ASPECT = 1060 / 800

function CameraRig(): null {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const size = useThree((s) => s.size)
  useLayoutEffect(() => {
    const yaw = THREE.MathUtils.degToRad(CAMERA.yaw)
    const elev = THREE.MathUtils.degToRad(CAMERA.elevation)
    const [tx, ty, tz] = CAMERA.target
    camera.position.set(
      tx + CAMERA.distance * Math.cos(elev) * Math.sin(yaw),
      ty + CAMERA.distance * Math.sin(elev),
      tz + CAMERA.distance * Math.cos(elev) * Math.cos(yaw)
    )
    camera.lookAt(tx, ty, tz)
    // Keep the whole office in view when the panel is narrower than the design aspect.
    const aspect = size.width / Math.max(1, size.height)
    const halfV = THREE.MathUtils.degToRad(CAMERA.fov / 2)
    const fitV = aspect < DESIGN_ASPECT ? Math.atan((Math.tan(halfV) * DESIGN_ASPECT) / aspect) : halfV
    camera.fov = THREE.MathUtils.radToDeg(fitV * 2)
    camera.updateProjectionMatrix()
  }, [camera, size])
  return null
}

function Office({ agents, graph, onOpenGraph, onAgentClick }: OfficeSceneProps): JSX.Element {
  const materials = useOfficeMaterials()
  const byId = useMemo(() => new Map(agents.map((a) => [a.id, a])), [agents])

  return (
    <MaterialsContext.Provider value={materials}>
      <StaticBatch>
        <Room />
        <LeftWall />
        <RightWall graph={graph} onOpenGraph={onOpenGraph} />
        {BOOKSHELVES.map((b, i) => (
          <Bookshelf key={i} at={b.at} rotation={b.rotation} width={b.width} height={b.height} seed={i + 3} />
        ))}
        <MeetingRoom />
        <Lounge />
        <Plants plants={PLANTS} />
        {DESKS.map((desk, i) => {
          const status = desk.agent ? byId.get(desk.agent) : undefined
          const busy = status?.state === 'working' || status?.state === 'thinking'
          return (
            <Desk
              key={i}
              at={desk.at}
              rotation={desk.rotation}
              monitors={desk.monitors}
              busy={busy}
              seed={i + 1}
              lamp={Boolean(desk.agent)}
            />
          )
        })}
      </StaticBatch>
      {DESKS.map((desk, i) => {
        const status = desk.agent ? byId.get(desk.agent) : undefined
        if (!status) return null
        const seat: [number, number] = [
          desk.at[0] + Math.cos(desk.rotation) * SEAT_OFFSET,
          desk.at[1] - Math.sin(desk.rotation) * SEAT_OFFSET
        ]
        return (
          <Agent
            key={status.id}
            status={status}
            seat={seat}
            facing={desk.rotation + FACING}
            phase={i * 1.37}
            onClick={onAgentClick}
          />
        )
      })}
    </MaterialsContext.Provider>
  )
}

/** Device pixel ratio bounds; PerformanceMonitor moves between them to hold the frame rate. */
const MAX_DPR = Math.min(2, window.devicePixelRatio || 1)

export default function OfficeScene(props: OfficeSceneProps): JSX.Element {
  const [dpr, setDpr] = useState(MAX_DPR)
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: '#000', overflow: 'hidden' }}>
      <Canvas
        shadows="soft"
        dpr={dpr}
        frameloop="always"
        camera={{ fov: CAMERA.fov, near: 1, far: 100 }}
        gl={{ antialias: false, powerPreference: 'high-performance', stencil: false }}
        style={{ background: '#000' }}
      >
        <PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr(MAX_DPR)} />
        <color attach="background" args={['#000']} />
        <CameraRig />
        <Lighting />
        <Suspense fallback={null}>
          <Office {...props} />
        </Suspense>
        <Effects />
      </Canvas>
    </div>
  )
}
