// Cinematic night lighting: almost no fill, so the floor stays near-black between the warm downlight pools
// over the desk clusters and lounge; a dim environment for reflections and a weak key light for soft shadows.
import { useEffect, useLayoutEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { DOWNLIGHTS, ROOM, WORLD_WIDTH } from '../layout'
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

/**
 * Soft warm key light from the front-right that gives the furniture its shadows. One shadow map covers all three
 * rooms: the light keeps the brain room's direction, but sits far out along it and its shadow frustum spans the
 * whole office, so the Office and Personal rooms get soft shadows too without a second shadow-casting light.
 */
function KeyLight(): JSX.Element {
  const { depth: D } = ROOM
  const light = useRef<THREE.DirectionalLight>(null)
  const target = useRef<THREE.Object3D>(null)
  useLayoutEffect(() => {
    if (light.current && target.current) light.current.target = target.current
  }, [])
  // Same direction as the original key light (from the brain room's centre towards (W + 4, 12, 0.6 D)).
  const aim = new THREE.Vector3(ROOM.width / 2 + 4, 12, D * 0.1).normalize()
  const centre = new THREE.Vector3(WORLD_WIDTH / 2, 0, D / 2)
  const from = centre.clone().addScaledVector(aim, 40)
  return (
    <>
      <directionalLight
        ref={light}
        position={from.toArray() as [number, number, number]}
        intensity={0.35}
        color="#ffd2a8"
        castShadow
        shadow-mapSize={[4096, 4096]}
        shadow-bias={-0.0003}
        shadow-normalBias={0.02}
        shadow-camera-left={-24}
        shadow-camera-right={24}
        shadow-camera-top={24}
        shadow-camera-bottom={-24}
        shadow-camera-near={1}
        shadow-camera-far={90}
        shadow-radius={4}
      />
      <object3D ref={target} position={centre.toArray() as [number, number, number]} />
    </>
  )
}

export default function Lighting(): JSX.Element {
  useRoomEnvironment(0.42)

  return (
    <>
      <hemisphereLight args={['#968a78', '#2a1a0e', 0.56]} />
      <KeyLight />
      {DOWNLIGHTS.map(({ at: [x, z], shadow, dim }) => (
        <Spot
          key={`${x},${z}`}
          from={[x, 6.5, z]}
          to={[x, 0, z]}
          color="#ffc890"
          intensity={dim ? 650 : 1020}
          angle={0.45}
          penumbra={0.6}
          distance={12}
          castShadow={shadow}
        />
      ))}
    </>
  )
}
