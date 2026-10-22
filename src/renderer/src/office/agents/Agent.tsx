// One seated agent: a cloned, re-dressed Ready Player Me avatar posed at its desk, plus its floating card.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import type { AgentId, AgentStatus } from '@shared/types'
import { rigSeated } from './avatarRig'
import AgentCard from './AgentCard'
import { CHAIR_SEAT_HEIGHT } from '../furniture/chairGeometry'
import { UNIT_BOX } from '../primitives'

export const AVATAR_URL = './models/avatar.glb'

/** Dark business clothing with a little variation per agent, like the people in the reference. */
const OUTFITS: Record<AgentId, { top: string; bottom: string; hair: string }> = {
  pip: { top: '#161a24', bottom: '#15171c', hair: '#1a1410' },
  sage: { top: '#111214', bottom: '#121316', hair: '#2a1d14' },
  rex: { top: '#1b1d22', bottom: '#17181b', hair: '#0f0d0c' },
  nova: { top: '#141a28', bottom: '#14161b', hair: '#3a2a1e' },
  axel: { top: '#121315', bottom: '#101113', hair: '#16110d' },
  muse: { top: '#17191e', bottom: '#14151a', hair: '#24180f' }
}

const CLOTHING = new Set(['Wolf3D_Outfit_Top', 'Wolf3D_Outfit_Bottom', 'Wolf3D_Outfit_Footwear'])

type Disposable = { dispose(): void }

/** Re-dresses the clone; returns the materials it created so the caller can dispose them. */
function dress(root: THREE.Object3D, id: AgentId): Disposable[] {
  const owned: Disposable[] = []
  const outfit = OUTFITS[id]
  const remove: THREE.Object3D[] = []
  root.traverse((o) => {
    const mesh = o as THREE.SkinnedMesh
    if (!mesh.isMesh) return
    const material = mesh.material as THREE.MeshStandardMaterial
    if (material.name === 'Wolf3D_Headwear') {
      remove.push(mesh)
      return
    }
    mesh.castShadow = true
    mesh.receiveShadow = true
    if (!CLOTHING.has(material.name)) return
    const dressed = material.clone()
    dressed.map = null
    dressed.metalnessMap = null
    dressed.roughnessMap = null
    dressed.metalness = 0
    dressed.roughness = material.name === 'Wolf3D_Outfit_Footwear' ? 0.35 : 0.78
    dressed.color.set(
      material.name === 'Wolf3D_Outfit_Top' ? outfit.top : material.name === 'Wolf3D_Outfit_Bottom' ? outfit.bottom : '#0b0b0c'
    )
    mesh.material = dressed
    owned.push(dressed)
  })
  for (const o of remove) o.removeFromParent()
  return owned
}

/** Short, neat hair: an ellipsoid shell on the head bone (the bundled avatar is bald under its hat). */
function addHair(root: THREE.Object3D, color: string): Disposable[] {
  const head = root.getObjectByName('Head') as THREE.Bone
  root.updateMatrixWorld(true)
  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.56),
    new THREE.MeshStandardMaterial({ color, roughness: 0.85 })
  )
  hair.castShadow = true
  hair.scale.set(0.185, 0.2, 0.21)
  const inv = head.getWorldQuaternion(new THREE.Quaternion()).invert()
  hair.quaternion.copy(inv).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.25, 0, 0)))
  hair.position.copy(head.worldToLocal(new THREE.Vector3(0, 1.745, -0.012)))
  head.add(hair)
  return [hair.geometry, hair.material as THREE.Material]
}

interface AgentProps {
  status: AgentStatus
  /** Floor position of the seat centre. */
  seat: [number, number]
  /** Rotation around y; the avatar faces +z at 0. */
  facing: number
  phase: number
  onClick?: (id: AgentId) => void
}

export default function Agent({ status, seat, facing, phase, onClick }: AgentProps): JSX.Element {
  const { scene } = useGLTF(AVATAR_URL, false, false)
  const { avatar, rig, owned } = useMemo(() => {
    const avatar = cloneSkinned(scene)
    const owned = [...dress(avatar, status.id), ...addHair(avatar, OUTFITS[status.id].hair)]
    const rig = rigSeated(avatar)
    avatar.position.y = Math.max(CHAIR_SEAT_HEIGHT + 0.07, rig.legReach) - rig.hipsY
    return { avatar, rig, owned }
  }, [scene, status.id])
  // Textures and the remaining materials belong to the GLTF cache and are shared by every clone.
  useEffect(() => () => owned.forEach((o) => o.dispose()), [owned])

  const state = useRef(status.state)
  state.current = status.state
  useFrame(({ clock }) => rig.update(state.current, clock.elapsedTime, phase))

  const handleClick = (e: ThreeEvent<MouseEvent>): void => {
    e.stopPropagation()
    onClick?.(status.id)
  }
  const setCursor = (cursor: string) => (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    document.body.style.cursor = cursor
  }

  return (
    <group position={[seat[0], 0, seat[1]]}>
      <group rotation={[0, facing, 0]}>
        <primitive object={avatar} />
      </group>
      {/* Invisible hit volume: raycasting a box is far cheaper than a skinned mesh on every pointer move. */}
      <mesh
        geometry={UNIT_BOX}
        scale={[0.75, 1.45, 0.75]}
        position={[0, 0.72, 0]}
        visible={false}
        onClick={handleClick}
        onPointerOver={setCursor('pointer')}
        onPointerOut={setCursor('')}
      />
      <AgentCard status={status} onClick={onClick} />
    </group>
  )
}

useGLTF.preload(AVATAR_URL, false, false)
