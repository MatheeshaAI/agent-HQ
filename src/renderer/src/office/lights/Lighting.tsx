// Cinematic night lighting: almost no fill, so the floor stays near-black between the warm downlight pools
// over the desk clusters and lounge; a dim environment for reflections and a weak key light for soft shadows.
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
        intensity={0.35}
        color="#ffd2a8"
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
  useRoomEnvironment(0.35)

  return (
    <>
      <hemisphereLight args={['#6a7c99', '#1a120b', 0.45]} />
      <KeyLight />
      {DOWNLIGHTS.map(({ at: [x, z], shadow, dim }) => (
        <Spot
          key={`${x},${z}`}
          from={[x, 6.5, z]}
          to={[x, 0, z]}
          color="#ffcf9e"
          intensity={dim ? 450 : 880}
          angle={0.45}
          penumbra={0.6}
          distance={12}
          castShadow={shadow}
        />
      ))}
    </>
  )
}
