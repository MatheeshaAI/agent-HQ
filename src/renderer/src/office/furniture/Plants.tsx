// Potted plants from the Khronos DiffuseTransmissionPlant sample, re-potted in dark planters
// and stretched upwards into the tall office palms of the reference.
import { useEffect, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { useMat } from '../materials'
import type { Vec2 } from '../layout'

export const PLANT_URL = './models/plant.glb'

interface PlantSpec {
  at: Vec2
  scale: number
  /** Optional height above the floor (e.g. on a desk or counter). */
  y?: number
  /** Skip the floor planter (for small plants on furniture). */
  small?: boolean
}

function buildPlant(source: THREE.Object3D, pot: THREE.Material, leaves: THREE.Material, tall: boolean): THREE.Group {
  const group = new THREE.Group()
  for (const name of ['pot', 'leaves', 'dirt']) {
    const node = source.getObjectByName(name) as THREE.Mesh | undefined
    if (!node) continue
    const mesh = node.clone()
    mesh.castShadow = true
    mesh.receiveShadow = true
    if (name === 'pot') mesh.material = pot
    if (name === 'leaves') mesh.material = leaves
    if (name === 'leaves' && tall) {
      mesh.scale.set(0.95, 2.4, 0.95)
      mesh.position.y += 0.02
    }
    group.add(mesh)
  }
  return group
}

export default function Plants({ plants }: { plants: PlantSpec[] }): JSX.Element {
  const { scene } = useGLTF(PLANT_URL, false, false)
  const mat = useMat()
  const pots = useMemo(() => [mat.blackMetal, mat.potCharcoal, mat.potConcrete], [mat])

  // Deeper, cooler green than the sample's sunlit leaves, closer to the reference's office palms.
  const leaves = useMemo(() => {
    const source = (scene.getObjectByName('leaves') as THREE.Mesh).material as THREE.MeshStandardMaterial
    const m = source.clone()
    m.color.set('#6f9a62')
    return m
  }, [scene])
  useEffect(() => () => leaves.dispose(), [leaves])

  const groups = useMemo(
    () =>
      plants.map((p, i) => {
        const g = buildPlant(scene, pots[i % pots.length], leaves, !p.small)
        g.scale.setScalar(p.small ? p.scale : p.scale * 1.15)
        g.position.set(p.at[0], p.y ?? 0, p.at[1])
        g.rotation.y = i * 1.7
        return g
      }),
    [plants, scene, pots, leaves]
  )

  return (
    <group>
      {groups.map((g, i) => (
        <primitive key={i} object={g} />
      ))}
    </group>
  )
}

useGLTF.preload(PLANT_URL, false, false)
