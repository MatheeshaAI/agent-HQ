// Tiny building blocks shared by the procedural furniture.
import type { ThreeElements } from '@react-three/fiber'
import * as THREE from 'three'
import type { Vec3 } from './layout'

export const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1)
export const UNIT_PLANE = new THREE.PlaneGeometry(1, 1)
export const UNIT_CYLINDER = new THREE.CylinderGeometry(0.5, 0.5, 1, 24)

type MeshProps = Omit<ThreeElements['mesh'], 'scale' | 'position'>

interface BoxProps extends MeshProps {
  /** Width (x), height (y), depth (z) in metres. */
  size: Vec3
  /** Centre of the box. */
  at: Vec3
  material: THREE.Material | THREE.Material[]
  shadows?: boolean
}

/** A scaled unit box. Cheap to create in bulk because every instance shares one geometry. */
export function Box({ size, at, material, shadows = true, ...rest }: BoxProps): JSX.Element {
  return (
    <mesh
      geometry={UNIT_BOX}
      material={material}
      scale={size as [number, number, number]}
      position={at as [number, number, number]}
      castShadow={shadows}
      receiveShadow={shadows}
      {...rest}
    />
  )
}

interface CylinderProps extends MeshProps {
  radius: number
  height: number
  at: Vec3
  material: THREE.Material
  shadows?: boolean
}

export function Cylinder({ radius, height, at, material, shadows = true, ...rest }: CylinderProps): JSX.Element {
  return (
    <mesh
      geometry={UNIT_CYLINDER}
      material={material}
      scale={[radius * 2, height, radius * 2]}
      position={at as [number, number, number]}
      castShadow={shadows}
      receiveShadow={shadows}
      {...rest}
    />
  )
}

/** A box whose top and bottom UVs repeat once per `period` metres, so a tiling texture keeps its scale. */
export function tiledBoxGeometry(size: Vec3, period: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(...size)
  const uv = g.getAttribute('uv') as THREE.BufferAttribute
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * size[0]) / period, (uv.getY(i) * size[2]) / period)
  return g
}
