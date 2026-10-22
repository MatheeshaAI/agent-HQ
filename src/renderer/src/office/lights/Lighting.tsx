// Cinematic night lighting: a dim environment for reflections, a soft key light for shadows and
// warm practical spots pooling light on the desk clusters and lounge.
import { useEffect, useLayoutEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { DOWNLIGHTS, ROOM } from '../layout'
import Spot from './Spot'

function useRoomEnvironment(intensity: number): void {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl)
    const room = new RoomEnvironment()
    const env = pmrem.fromScene(room, 0.04).texture
    scene.environment = env
    scene.environmentIntensity = intensity
    room.dispose()
    pmrem.dispose()
    return () => {
      scene.environment = null
      env.dispose()
    }
  }, [gl, scene, intensity])
}

/** Soft warm key light from the front-right that gives the furniture its shadows. */
function KeyLight(): JSX.Element {
  const { width: W, depth: D } = ROOM
  const light = useRef<THREE.DirectionalLight>(null)
  const target = useRef<THREE.Object3D>(null)
  useLayoutEffect(() => {
    if (light.current && target.current) light.current.target = target.current
  }, [])
  return (
    <>
      <directionalLight
        ref={light}
        position={[W + 4, 12, D * 0.6]}
        intensity={0.9}
        color="#ffe2c4"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0003}
        shadow-normalBias={0.02}
        shadow-camera-left={-9}
        shadow-camera-right={9}
        shadow-camera-top={9}
        shadow-camera-bottom={-9}
        shadow-camera-near={1}
        shadow-camera-far={40}
        shadow-radius={4}
      />
      <object3D ref={target} position={[W / 2, 0, D / 2]} />
    </>
  )
}

export default function Lighting(): JSX.Element {
  useRoomEnvironment(0.55)

  return (
    <>
      <hemisphereLight args={['#8fa6d6', '#1b130c', 0.35]} />
      <KeyLight />
      {DOWNLIGHTS.map(([x, z]) => (
        <Spot key={`${x},${z}`} from={[x, 4.6, z]} to={[x, 0, z]} intensity={170} angle={0.6} />
      ))}
    </>
  )
}
