// The cinematic 3D office at the centre of Agent HQ. Fills its parent; the scene floats on black.
import { Suspense, useLayoutEffect, useMemo, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { PerformanceMonitor } from '@react-three/drei'
import * as THREE from 'three'
import type { AgentId, AgentStatus, GraphData } from '@shared/types'
import { BOOKSHELVES, CAMERA, DESKS, FACING, PLANTS, SEAT_OFFSET, type DeskSpot } from './layout'
import { MaterialsContext, useOfficeMaterials } from './materials'
import Room from './room/Room'
import LeftWall from './room/LeftWall'
import RightWall from './room/RightWall'
import Desk from './furniture/Desk'
import Bookshelf from './furniture/Bookshelf'
import Plants from './furniture/Plants'
import MeetingRoom from './furniture/MeetingRoom'
import Lounge from './furniture/Lounge'
import Extras from './furniture/Extras'
import Agent, { Staff } from './agents/Agent'
import Lighting from './lights/Lighting'
import Effects from './Effects'
import StaticBatch from './StaticBatch'
import { NO_REFLECTION_LAYER } from './NoReflection'

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
    camera.layers.enable(NO_REFLECTION_LAYER)
    // Keep the whole office in view when the panel is narrower than the design aspect.
    const aspect = size.width / Math.max(1, size.height)
    const halfV = THREE.MathUtils.degToRad(CAMERA.fov / 2)
    const fitV = aspect < DESIGN_ASPECT ? Math.atan((Math.tan(halfV) * DESIGN_ASPECT) / aspect) : halfV
    camera.fov = THREE.MathUtils.radToDeg(fitV * 2)
    camera.updateProjectionMatrix()
  }, [camera, size])
  return null
}

/** Floor position of the seat at a desk. */
function seatOf(desk: DeskSpot): [number, number] {
  const s = Math.sin(desk.rotation)
  const c = Math.cos(desk.rotation)
  const shift = desk.seat ?? 0
  return [desk.at[0] + c * SEAT_OFFSET + s * shift, desk.at[1] - s * SEAT_OFFSET + c * shift]
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
          <Bookshelf key={i} {...b} seed={i + 3} />
        ))}
        <MeetingRoom />
        <Lounge />
        <Extras />
        <Plants plants={PLANTS} />
        {DESKS.map((desk, i) => {
          const status = desk.agent ? byId.get(desk.agent) : undefined
          // Staff are always busy; an agent's screens follow its state.
          const busy = desk.staff === true || status?.state === 'working' || status?.state === 'thinking'
          return (
            <Desk
              key={i}
              at={desk.at}
              rotation={desk.rotation}
              monitors={desk.monitors}
              busy={busy}
              seed={i + 1}
              length={desk.length}
              seat={desk.seat}
              plant={desk.plant}
            />
          )
        })}
      </StaticBatch>
      {DESKS.map((desk, i) => {
        const facing = desk.rotation + FACING
        if (desk.staff) return <Staff key={i} seat={seatOf(desk)} facing={facing} phase={i * 1.37} />
        const status = desk.agent ? byId.get(desk.agent) : undefined
        if (!status) return null
        return (
          <Agent
            key={status.id}
            status={status}
            seat={seatOf(desk)}
            facing={facing}
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
        camera={{ fov: CAMERA.fov, near: 1, far: 160 }}
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
