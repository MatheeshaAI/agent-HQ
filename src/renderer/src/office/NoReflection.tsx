// Moves the meshes below it to layer 1. The main camera renders layers 0 and 1 (see OfficeScene's CameraRig),
// but the floor's reflector camera only sees layer 0, so bright signage stays out of the floor's reflection.
import { useLayoutEffect, useRef, type ReactNode } from 'react'
import * as THREE from 'three'

export const NO_REFLECTION_LAYER = 1

export default function NoReflection({ children }: { children: ReactNode }): JSX.Element {
  const root = useRef<THREE.Group>(null)
  // Runs after the children mounted and before StaticBatch (an ancestor) merges them, which keeps the layer.
  useLayoutEffect(() => {
    root.current?.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.layers.set(NO_REFLECTION_LAYER)
    })
  }, [])
  return <group ref={root}>{children}</group>
}
