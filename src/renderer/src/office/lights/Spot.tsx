// A spot light whose target lives in the scene graph, so aiming it is declarative.
import { useLayoutEffect, useRef } from 'react'
import * as THREE from 'three'
import type { Vec3 } from '../layout'

interface SpotProps {
  from: Vec3
  to: Vec3
  color?: THREE.ColorRepresentation
  intensity: number
  angle?: number
  penumbra?: number
  distance?: number
  castShadow?: boolean
}

export default function Spot({
  from,
  to,
  color = '#ffc98f',
  intensity,
  angle = 0.6,
  penumbra = 0.85,
  distance = 0,
  castShadow = false
}: SpotProps): JSX.Element {
  const light = useRef<THREE.SpotLight>(null)
  const target = useRef<THREE.Object3D>(null)
  useLayoutEffect(() => {
    if (light.current && target.current) light.current.target = target.current
  }, [])
  return (
    <>
      <spotLight
        ref={light}
        position={from as [number, number, number]}
        color={color}
        intensity={intensity}
        angle={angle}
        penumbra={penumbra}
        distance={distance}
        decay={2}
        castShadow={castShadow}
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
      />
      <object3D ref={target} position={to as [number, number, number]} />
    </>
  )
}
