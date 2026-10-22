// Office greenery: procedural arching palms in tall tapered planters (glossy black, charcoal, brushed silver),
// a few broad-leaved rubber-plant accents and small desk plants in ceramic pots. The broad leaves come from
// the Khronos DiffuseTransmissionPlant sample; its own pot and soil are not used.
import { useEffect, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { useMat } from '../materials'
import type { PlantSpot } from '../layout'
import { palmGeometry } from './palmGeometry'

export const PLANT_URL = './models/plant.glb'

const POT_HEIGHT = 0.5
const POT = new THREE.CylinderGeometry(0.2, 0.16, POT_HEIGHT, 32).translate(0, POT_HEIGHT / 2, 0)
/** Dark top dressing 2 cm below the rim, so no soil shows. */
const POT_TOP = new THREE.CylinderGeometry(0.19, 0.19, 0.01, 24).translate(0, POT_HEIGHT - 0.02, 0)
/** Height of the sample's pot rim; its leaves are lifted from there onto our planter. */
const SAMPLE_RIM = 0.336
const PALM_VARIANTS = 4

function mesh(geometry: THREE.BufferGeometry, material: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(geometry, material)
  m.castShadow = true
  m.receiveShadow = true
  return m
}

export default function Plants({ plants }: { plants: PlantSpot[] }): JSX.Element {
  const { scene } = useGLTF(PLANT_URL, false, false)
  const mat = useMat()

  const palms = useMemo(() => Array.from({ length: PALM_VARIANTS }, (_, i) => palmGeometry(i + 1)), [])
  useEffect(() => () => palms.forEach((g) => g.dispose()), [palms])

  // Deeper, cooler green than the sample's sunlit leaves, closer to the reference's office plants.
  const broadLeaves = useMemo(() => {
    const source = (scene.getObjectByName('leaves') as THREE.Mesh).material as THREE.MeshStandardMaterial
    const m = source.clone()
    m.color.set('#5f8a52')
    return m
  }, [scene])
  useEffect(() => () => broadLeaves.dispose(), [broadLeaves])

  const groups = useMemo(() => {
    const sampleLeaves = scene.getObjectByName('leaves') as THREE.Mesh
    const smallPots = [mat.ceramic, mat.cabinetGrey]
    return plants.map((p, i) => {
      const kind = p.kind ?? 'palm'
      const g = new THREE.Group()
      g.add(mesh(POT, kind === 'small' ? smallPots[i % 2] : mat.pots[i % mat.pots.length]))
      g.add(mesh(POT_TOP, mat.potTop))
      if (kind === 'palm') {
        const crown = mesh(palms[i % PALM_VARIANTS], mat.palmLeaf)
        crown.position.y = POT_HEIGHT - 0.04
        g.add(crown)
      } else {
        const leaves = sampleLeaves.clone()
        leaves.material = broadLeaves
        leaves.castShadow = leaves.receiveShadow = true
        leaves.position.y += POT_HEIGHT - SAMPLE_RIM
        if (kind === 'rubber') leaves.scale.set(1.1, 1.4, 1.1)
        g.add(leaves)
      }
      g.scale.setScalar(p.scale)
      g.position.set(p.at[0], p.y ?? 0, p.at[1])
      g.rotation.y = i * 1.7
      return g
    })
  }, [plants, scene, mat, palms, broadLeaves])

  return (
    <group>
      {groups.map((g, i) => (
        <primitive key={i} object={g} />
      ))}
    </group>
  )
}

useGLTF.preload(PLANT_URL, false, false)
