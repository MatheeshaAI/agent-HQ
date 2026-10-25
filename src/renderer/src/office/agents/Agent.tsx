// Seated people: a cloned, re-dressed Ready Player Me avatar posed at a desk. Agents add a hit volume and a
// floating card; staff are non-interactive colleagues.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import type { AgentId, AgentStatus } from '@shared/types'
import { rigSeated, type RigState } from './avatarRig'
import { identityOf } from './identities'
import type { Pose } from './choreography'
import { motion } from '../../state/motion'
import { useSpeaking } from '../../state/voice'
import AgentCard from './AgentCard'
import { CHAIR_SEAT_HEIGHT } from '../furniture/chairGeometry'
import { UNIT_BOX } from '../primitives'

export const AVATAR_URL = './models/avatar.glb'

interface Outfit {
  top: string
  bottom: string
  hair: string
}

/** Each agent's jacket and hair colour (see identities.ts); trousers and shoes stay near-black for everyone. */
/** Cached per agent: AvatarBody rebuilds its clone whenever the outfit object changes. */
const outfits = new Map<AgentId, Outfit>()
function outfitOf(id: AgentId): Outfit {
  let outfit = outfits.get(id)
  if (!outfit) {
    const { jacket, hair } = identityOf(id)
    outfit = { top: jacket, bottom: '#070708', hair }
    outfits.set(id, outfit)
  }
  return outfit
}

/** Outfit for the non-interactive colleagues at the shared benches. */
const STAFF_OUTFIT: Outfit = { top: '#0a0c12', bottom: '#070708', hair: '#0b0a09' }

const CLOTHING = new Set(['Wolf3D_Outfit_Top', 'Wolf3D_Outfit_Bottom', 'Wolf3D_Outfit_Footwear'])
const SKIN = new Set(['Wolf3D_Skin', 'Wolf3D_Body'])

type Disposable = { dispose(): void }

/** Re-dresses the clone; returns the materials it created so the caller can dispose them. */
function dress(root: THREE.Object3D, outfit: Outfit): Disposable[] {
  const owned: Disposable[] = []
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
    if (SKIN.has(material.name)) {
      // Skin stays in shadow in the reference: darker, and not lifted by the environment.
      const skin = material.clone()
      skin.color.multiplyScalar(0.75)
      skin.roughness = 0.7
      skin.envMapIntensity = 0.5
      mesh.material = skin
      owned.push(skin)
      return
    }
    if (!CLOTHING.has(material.name)) return
    // Near-black cloth whose faint highlights read cool navy under the warm downlights, like the reference's
    // suits lit by their screens; the normal map keeps the folds.
    const dressed = new THREE.MeshPhysicalMaterial({
      name: material.name,
      normalMap: material.normalMap,
      roughness: material.name === 'Wolf3D_Outfit_Top' ? 0.6 : material.name === 'Wolf3D_Outfit_Footwear' ? 0.35 : 0.78,
      specularColor: '#7d93c4',
      envMapIntensity: 0.4,
      color:
        material.name === 'Wolf3D_Outfit_Top'
          ? outfit.top
          : material.name === 'Wolf3D_Outfit_Bottom'
            ? outfit.bottom
            : '#0b0b0c'
    })
    mesh.material = dressed
    owned.push(dressed)
  })
  for (const o of remove) o.removeFromParent()
  return owned
}

/**
 * Short, neat hair: an ellipsoid cap on the head bone (the bundled avatar is bald under its hat), sized to
 * cover the whole scalp and reach the upper forehead.
 */
function addHair(root: THREE.Object3D, color: string): Disposable[] {
  const head = root.getObjectByName('Head') as THREE.Bone
  root.updateMatrixWorld(true)
  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.6),
    new THREE.MeshPhysicalMaterial({
      color,
      roughness: 0.75,
      sheen: 0.15,
      sheenColor: '#2a2c30',
      specularColor: '#9aa6bd'
    })
  )
  hair.castShadow = true
  hair.scale.set(0.208, 0.208, 0.256)
  const inv = head.getWorldQuaternion(new THREE.Quaternion()).invert()
  hair.quaternion.copy(inv).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.3, 0, 0)))
  hair.position.copy(head.worldToLocal(new THREE.Vector3(0, 1.738, 0.012)))
  head.add(hair)
  return [hair.geometry, hair.material as THREE.Material]
}

interface AvatarBodyProps {
  outfit: Outfit
  state: RigState
  /** Rotation around y; the avatar faces +z at 0. */
  facing: number
  phase: number
  /** Present for agents that can leave their desk; while `pose.active` it overrides the seated pose. */
  pose?: Pose
}

/** A cloned, re-dressed Ready Player Me avatar posed in its chair and animated by state. */
function AvatarBody({ outfit, state, facing, phase, pose }: AvatarBodyProps): JSX.Element {
  const { scene } = useGLTF(AVATAR_URL, false, false)
  const { avatar, rig, owned, seatedY } = useMemo(() => {
    const avatar = cloneSkinned(scene)
    const owned = [...dress(avatar, outfit), ...addHair(avatar, outfit.hair)]
    const rig = rigSeated(avatar)
    const seatedY = Math.max(CHAIR_SEAT_HEIGHT + 0.07, rig.legReach) - rig.hipsY
    avatar.position.y = seatedY
    return { avatar, rig, owned, seatedY }
  }, [scene, outfit])
  // Textures and the remaining materials belong to the GLTF cache and are shared by every clone.
  useEffect(() => () => owned.forEach((o) => o.dispose()), [owned])

  const current = useRef(state)
  current.current = state
  const turn = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const calm = motion.isCalm()
    if (pose?.active) {
      // Away from the desk: standing height, the walk or talk pose and the choreography's heading.
      rig.stand = pose.stand
      avatar.position.y = seatedY * (1 - pose.stand) + (pose.mode === 'walk' && !calm ? 0.015 * Math.abs(Math.sin(clock.elapsedTime * 5.3 + phase)) * pose.stand : 0)
      if (turn.current) turn.current.rotation.y = pose.yaw
      rig.update(pose.mode === 'walk' ? 'walking' : 'speaking', clock.elapsedTime, phase, calm)
      return
    }
    if (rig.stand !== 0) {
      rig.stand = 0
      avatar.position.y = seatedY
      if (turn.current) turn.current.rotation.y = facing
    }
    rig.update(current.current, clock.elapsedTime, phase, calm)
  })

  return (
    <group ref={turn} rotation={[0, facing, 0]}>
      <primitive object={avatar} />
    </group>
  )
}

interface StaffProps {
  seat: [number, number]
  facing: number
  phase: number
}

/** A colleague working at a shared bench: same rig, always typing, no card and no pointer events. */
export function Staff({ seat, facing, phase }: StaffProps): JSX.Element {
  return (
    <group position={[seat[0], 0, seat[1]]}>
      <AvatarBody outfit={STAFF_OUTFIT} state="working" facing={facing} phase={phase} />
    </group>
  )
}

interface AgentProps {
  status: AgentStatus
  /** Floor position of the seat centre. */
  seat: [number, number]
  /** Rotation around y; the avatar faces +z at 0. */
  facing: number
  phase: number
  /** The agent's walking pose from the office choreography. */
  pose?: Pose
  onClick?: (id: AgentId) => void
}

/** One agent at its desk: the avatar, an invisible hit volume and its floating card. */
export default function Agent({ status, seat, facing, phase, pose, onClick }: AgentProps): JSX.Element {
  const speaking = useSpeaking(status.id)
  const handleClick = (e: ThreeEvent<MouseEvent>): void => {
    e.stopPropagation()
    onClick?.(status.id)
  }
  const setCursor = (cursor: string) => (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    document.body.style.cursor = cursor
  }

  const group = useRef<THREE.Group>(null)
  // The group (avatar, hit volume and card) follows the walker; at the desk it sits on the seat.
  useFrame(() => {
    if (!group.current) return
    if (pose?.active) group.current.position.set(pose.x, 0, pose.z)
    else group.current.position.set(seat[0], 0, seat[1])
  })

  return (
    <group ref={group} position={[seat[0], 0, seat[1]]}>
      <AvatarBody outfit={outfitOf(status.id)} state={speaking ? 'speaking' : status.state} facing={facing} phase={phase} pose={pose} />
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
      <AgentCard status={status} speaking={speaking} onClick={onClick} />
    </group>
  )
}

useGLTF.preload(AVATAR_URL, false, false)
