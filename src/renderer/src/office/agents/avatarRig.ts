// Turns a cloned Ready Player Me avatar (A-pose, facing +z, 1.86 m tall) into a seated typist,
// and exposes per-frame motion (typing, head movement, breathing) on top of that pose.
import * as THREE from 'three'
import type { AgentState } from '@shared/types'

type BoneName =
  | 'Hips'
  | 'Spine'
  | 'Spine1'
  | 'Spine2'
  | 'Neck'
  | 'Head'
  | 'HeadTop_End'
  | 'LeftShoulder'
  | 'LeftArm'
  | 'LeftForeArm'
  | 'LeftHand'
  | 'LeftHandMiddle1'
  | 'RightShoulder'
  | 'RightArm'
  | 'RightForeArm'
  | 'RightHand'
  | 'RightHandMiddle1'
  | 'LeftUpLeg'
  | 'LeftLeg'
  | 'LeftFoot'
  | 'LeftToeBase'
  | 'RightUpLeg'
  | 'RightLeg'
  | 'RightFoot'
  | 'RightToeBase'

type Bones = Record<BoneName, THREE.Bone>

/** Model-space aim directions (model faces +z, its left is +x), applied parent-first. */
const SEATED_AIMS: [BoneName, BoneName, [number, number, number]][] = [
  ['Spine', 'Spine1', [0, 1, 0.1]],
  ['Spine1', 'Spine2', [0, 1, 0.16]],
  ['Spine2', 'Neck', [0, 1, 0.2]],
  ['Neck', 'Head', [0, 1, 0.22]],
  ['Head', 'HeadTop_End', [0, 1, 0.08]],
  ['LeftUpLeg', 'LeftLeg', [0.14, -0.04, 1]],
  ['RightUpLeg', 'RightLeg', [-0.14, -0.04, 1]],
  ['LeftLeg', 'LeftFoot', [0.03, -1, 0.12]],
  ['RightLeg', 'RightFoot', [-0.03, -1, 0.12]],
  ['LeftFoot', 'LeftToeBase', [0, -0.35, 1]],
  ['RightFoot', 'RightToeBase', [0, -0.35, 1]],
  ['LeftArm', 'LeftForeArm', [0.2, -0.82, 0.42]],
  ['RightArm', 'RightForeArm', [-0.2, -0.82, 0.42]],
  ['LeftForeArm', 'LeftHand', [-0.28, 0.06, 1]],
  ['RightForeArm', 'RightHand', [0.28, 0.06, 1]],
  ['LeftHand', 'LeftHandMiddle1', [-0.1, -0.3, 1]],
  ['RightHand', 'RightHandMiddle1', [0.1, -0.3, 1]]
]

const ANIMATED: BoneName[] = ['Spine1', 'Neck', 'Head', 'LeftForeArm', 'RightForeArm', 'LeftHand', 'RightHand']

const X = new THREE.Vector3(1, 0, 0)
const Y = new THREE.Vector3(0, 1, 0)

interface Animated {
  bone: THREE.Bone
  base: THREE.Quaternion
  /** Model-space X and Y axes expressed in the bone's local frame. */
  pitchAxis: THREE.Vector3
  yawAxis: THREE.Vector3
}

export interface SeatedRig {
  /** Model-space height of the hip joint. */
  hipsY: number
  /** Vertical distance from the hip joint down to the toes in the seated pose. */
  legReach: number
  update(state: AgentState, time: number, phase: number): void
}

function collectBones(root: THREE.Object3D): Bones {
  const bones: Partial<Bones> = {}
  root.traverse((o) => {
    if ((o as THREE.Bone).isBone) bones[o.name as BoneName] = o as THREE.Bone
  })
  for (const [a, b] of SEATED_AIMS) {
    if (!bones[a] || !bones[b]) throw new Error(`avatar is missing bone ${bones[a] ? b : a}`)
  }
  return bones as Bones
}

/** Rotate `bone` so the direction to `child` points along `dir` (model space; root must be identity). */
function aim(bone: THREE.Bone, child: THREE.Bone, dir: THREE.Vector3): void {
  bone.updateWorldMatrix(true, true)
  const from = child.getWorldPosition(new THREE.Vector3()).sub(bone.getWorldPosition(new THREE.Vector3())).normalize()
  const delta = new THREE.Quaternion().setFromUnitVectors(from, dir.clone().normalize())
  const world = bone.getWorldQuaternion(new THREE.Quaternion())
  const parentWorld = (bone.parent as THREE.Object3D).getWorldQuaternion(new THREE.Quaternion())
  bone.quaternion.copy(parentWorld.invert().multiply(delta).multiply(world))
}

export function rigSeated(root: THREE.Object3D): SeatedRig {
  root.position.set(0, 0, 0)
  root.rotation.set(0, 0, 0)
  root.updateMatrixWorld(true)
  const bones = collectBones(root)
  for (const [a, b, d] of SEATED_AIMS) aim(bones[a], bones[b], new THREE.Vector3(...d))
  root.updateMatrixWorld(true)

  const hipsY = bones.Hips.getWorldPosition(new THREE.Vector3()).y
  const toeY = Math.min(
    bones.LeftToeBase.getWorldPosition(new THREE.Vector3()).y,
    bones.RightToeBase.getWorldPosition(new THREE.Vector3()).y
  )
  const legReach = hipsY - toeY + 0.03

  const animated: Animated[] = ANIMATED.map((name) => {
    const bone = bones[name]
    const inv = bone.getWorldQuaternion(new THREE.Quaternion()).invert()
    return {
      bone,
      base: bone.quaternion.clone(),
      pitchAxis: X.clone().applyQuaternion(inv),
      yawAxis: Y.clone().applyQuaternion(inv)
    }
  })
  const byName = new Map(ANIMATED.map((n, i) => [n, animated[i]]))
  const q = new THREE.Quaternion()
  const pose = (name: BoneName, pitch: number, yaw: number): void => {
    const a = byName.get(name) as Animated
    a.bone.quaternion.copy(a.base)
    if (pitch) a.bone.quaternion.multiply(q.setFromAxisAngle(a.pitchAxis, pitch))
    if (yaw) a.bone.quaternion.multiply(q.setFromAxisAngle(a.yawAxis, yaw))
  }

  return {
    hipsY,
    legReach,
    update(state, t, phase) {
      const breathe = Math.sin(t * 1.6 + phase) * 0.012
      if (state === 'working') {
        const lt = Math.sin(t * 13 + phase) * 0.5 + Math.sin(t * 7.3 + phase) * 0.5
        const rt = Math.sin(t * 11.5 + phase * 2) * 0.5 + Math.sin(t * 8.1 + phase) * 0.5
        pose('Spine1', breathe, 0)
        pose('Neck', 0, Math.sin(t * 0.7 + phase) * 0.05)
        pose('Head', Math.sin(t * 0.9 + phase) * 0.04, Math.sin(t * 0.45 + phase) * 0.12)
        pose('LeftForeArm', lt * 0.05, 0)
        pose('RightForeArm', rt * 0.05, 0)
        pose('LeftHand', Math.max(0, lt) * 0.12, 0)
        pose('RightHand', Math.max(0, rt) * 0.12, 0)
      } else if (state === 'thinking') {
        pose('Spine1', breathe - 0.02, 0)
        pose('Neck', -0.04, Math.sin(t * 0.35 + phase) * 0.12)
        pose('Head', -0.1 + Math.sin(t * 0.5 + phase) * 0.05, Math.sin(t * 0.3 + phase) * 0.18)
        pose('LeftForeArm', 0, 0)
        pose('RightForeArm', 0, 0)
        pose('LeftHand', Math.sin(t * 2.2 + phase) * 0.05, 0)
        pose('RightHand', 0, 0)
      } else {
        // Idle and error: calm breathing, an occasional glance around.
        const glance = state === 'error' ? 0.25 * Math.sin(t * 0.8 + phase) : 0.2 * Math.sin(t * 0.25 + phase)
        pose('Spine1', breathe * 1.5 - 0.05, 0)
        pose('Neck', 0, glance * 0.4)
        pose('Head', -0.05, glance)
        pose('LeftForeArm', 0, 0)
        pose('RightForeArm', 0, 0)
        pose('LeftHand', 0, 0)
        pose('RightHand', 0, 0)
      }
    }
  }
}
