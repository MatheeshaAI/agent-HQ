// Turns a cloned Ready Player Me avatar (A-pose, facing +z, 1.86 m tall) into a seated typist,
// and exposes per-frame motion (typing, head movement, breathing, blinking, speaking, walking) on top of that pose.
import * as THREE from 'three'
import type { AgentState } from '@shared/types'

/** The seated states come from the engine; speaking and walking are set by the office. */
export type RigState = AgentState | 'speaking' | 'walking'

type BoneName =
  | 'Hips'
  | 'Spine'
  | 'Spine1'
  | 'Spine2'
  | 'Neck'
  | 'Head'
  | 'HeadTop_End'
  | 'LeftEye'
  | 'RightEye'
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
  ['Spine', 'Spine1', [0, 1, 0.04]],
  ['Spine1', 'Spine2', [0, 1, 0.08]],
  ['Spine2', 'Neck', [0, 1, 0.1]],
  ['Neck', 'Head', [0, 1, 0.12]],
  ['Head', 'HeadTop_End', [0, 1, 0.04]],
  ['LeftUpLeg', 'LeftLeg', [0.14, -0.04, 1]],
  ['RightUpLeg', 'RightLeg', [-0.14, -0.04, 1]],
  ['LeftLeg', 'LeftFoot', [0.03, -1, 0.12]],
  ['RightLeg', 'RightFoot', [-0.03, -1, 0.12]],
  ['LeftFoot', 'LeftToeBase', [0, -0.35, 1]],
  ['RightFoot', 'RightToeBase', [0, -0.35, 1]],
  ['LeftArm', 'LeftForeArm', [0.12, -0.9, 0.3]],
  ['RightArm', 'RightForeArm', [-0.12, -0.9, 0.3]],
  ['LeftForeArm', 'LeftHand', [-0.35, 0.04, 1]],
  ['RightForeArm', 'RightHand', [0.35, 0.04, 1]],
  ['LeftHand', 'LeftHandMiddle1', [-0.1, -0.3, 1]],
  ['RightHand', 'RightHandMiddle1', [0.1, -0.3, 1]]
]

/** Standing pose: upright, arms hanging with a slight bend, legs straight. Same bones as the seated aims. */
const STANDING_AIMS: [BoneName, BoneName, [number, number, number]][] = [
  ['Spine', 'Spine1', [0, 1, 0]],
  ['Spine1', 'Spine2', [0, 1, 0.02]],
  ['Spine2', 'Neck', [0, 1, 0.04]],
  ['Neck', 'Head', [0, 1, 0.06]],
  ['Head', 'HeadTop_End', [0, 1, 0.02]],
  ['LeftUpLeg', 'LeftLeg', [0.03, -1, 0]],
  ['RightUpLeg', 'RightLeg', [-0.03, -1, 0]],
  ['LeftLeg', 'LeftFoot', [0, -1, 0.02]],
  ['RightLeg', 'RightFoot', [0, -1, 0.02]],
  ['LeftFoot', 'LeftToeBase', [0, -0.35, 1]],
  ['RightFoot', 'RightToeBase', [0, -0.35, 1]],
  ['LeftArm', 'LeftForeArm', [0.14, -1, 0.02]],
  ['RightArm', 'RightForeArm', [-0.14, -1, 0.02]],
  ['LeftForeArm', 'LeftHand', [0.02, -1, 0.25]],
  ['RightForeArm', 'RightHand', [-0.02, -1, 0.25]],
  ['LeftHand', 'LeftHandMiddle1', [0, -1, 0.3]],
  ['RightHand', 'RightHandMiddle1', [0, -1, 0.3]]
]

const ANIMATED: BoneName[] = [
  'Spine1',
  'Spine2',
  'Neck',
  'Head',
  'LeftForeArm',
  'RightForeArm',
  'LeftHand',
  'RightHand',
  'LeftArm',
  'RightArm',
  'LeftUpLeg',
  'RightUpLeg',
  'LeftLeg',
  'RightLeg'
]

/** Walking cadence in radians per second (a full cycle is two steps, about 1.3 m at 1.1 m/s). */
export const WALK_RATE = 5.3

const X = new THREE.Vector3(1, 0, 0)
const Y = new THREE.Vector3(0, 1, 0)

interface Animated {
  bone: THREE.Bone
  /** Resting rotation, blended between the seated and standing pose. */
  base: THREE.Quaternion
  seated: THREE.Quaternion
  standing: THREE.Quaternion
  /** Model-space X and Y axes expressed in the bone's local frame, for the seated pose. */
  pitchAxis: THREE.Vector3
  yawAxis: THREE.Vector3
}

export interface SeatedRig {
  /** Model-space height of the hip joint. */
  hipsY: number
  /** Vertical distance from the hip joint down to the toes in the seated pose. */
  legReach: number
  /** 0 = seated, 1 = standing; blend between them while sitting down or getting up. */
  stand: number
  /**
   * Poses the rig for this frame. `calm` (reduced motion or paused) holds every pose still: no breathing,
   * blinking or swinging, just the pose that belongs to the state.
   */
  update(state: RigState, time: number, phase: number, calm?: boolean): void
}

function collectBones(root: THREE.Object3D): Bones {
  const bones: Partial<Bones> = {}
  root.traverse((o) => {
    if ((o as THREE.Bone).isBone) bones[o.name as BoneName] = o as THREE.Bone
  })
  for (const [a, b] of [...SEATED_AIMS, ...STANDING_AIMS]) {
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

type Aims = typeof SEATED_AIMS

function applyAims(bones: Bones, aims: Aims, root: THREE.Object3D): Map<BoneName, THREE.Quaternion> {
  for (const [a, b, d] of aims) aim(bones[a], bones[b], new THREE.Vector3(...d))
  root.updateMatrixWorld(true)
  return new Map(aims.map(([a]) => [a, bones[a].quaternion.clone()]))
}

function localAxes(bone: THREE.Bone): { pitch: THREE.Vector3; yaw: THREE.Vector3 } {
  const inv = bone.getWorldQuaternion(new THREE.Quaternion()).invert()
  return { pitch: X.clone().applyQuaternion(inv), yaw: Y.clone().applyQuaternion(inv) }
}

export function rigSeated(root: THREE.Object3D): SeatedRig {
  root.position.set(0, 0, 0)
  root.rotation.set(0, 0, 0)
  root.updateMatrixWorld(true)
  const bones = collectBones(root)

  // Record the standing pose first, then settle into the seated one (each aim is absolute, so order is free).
  const standing = applyAims(bones, STANDING_AIMS, root)
  const standingAxes = new Map(ANIMATED.map((n) => [n, localAxes(bones[n])]))
  const seated = applyAims(bones, SEATED_AIMS, root)

  const hipsY = bones.Hips.getWorldPosition(new THREE.Vector3()).y
  const toeY = Math.min(
    bones.LeftToeBase.getWorldPosition(new THREE.Vector3()).y,
    bones.RightToeBase.getWorldPosition(new THREE.Vector3()).y
  )
  const legReach = hipsY - toeY + 0.03

  const animated = new Map<BoneName, Animated>(
    ANIMATED.map((name) => {
      const bone = bones[name]
      const axes = localAxes(bone)
      return [
        name,
        {
          bone,
          base: bone.quaternion.clone(),
          seated: seated.get(name) as THREE.Quaternion,
          standing: standing.get(name) as THREE.Quaternion,
          pitchAxis: axes.pitch,
          yawAxis: axes.yaw
        }
      ]
    })
  )
  const resting = [...seated.keys()].map((name) => ({
    bone: bones[name],
    seated: seated.get(name) as THREE.Quaternion,
    standing: standing.get(name) as THREE.Quaternion
  }))

  const eyes = [bones.LeftEye, bones.RightEye].filter(Boolean)
  const mouths: { mesh: THREE.Mesh; index: number }[] = []
  root.traverse((o) => {
    const mesh = o as THREE.Mesh
    const index = mesh.morphTargetDictionary?.mouthOpen
    if (mesh.isMesh && index !== undefined) mouths.push({ mesh, index })
  })

  const q = new THREE.Quaternion()
  const pose = (name: BoneName, pitch: number, yaw: number, stand: number): void => {
    const a = animated.get(name) as Animated
    const upright = stand > 0.5 ? (standingAxes.get(name) as { pitch: THREE.Vector3; yaw: THREE.Vector3 }) : null
    a.bone.quaternion.copy(a.base)
    if (pitch) a.bone.quaternion.multiply(q.setFromAxisAngle(upright ? upright.pitch : a.pitchAxis, pitch))
    if (yaw) a.bone.quaternion.multiply(q.setFromAxisAngle(upright ? upright.yaw : a.yawAxis, yaw))
  }

  let blended = 0
  let mouth = 0
  const setMouth = (value: number): void => {
    if (value === mouth) return
    mouth = value
    for (const { mesh, index } of mouths) (mesh.morphTargetInfluences as number[])[index] = value
  }

  const rig: SeatedRig = {
    hipsY,
    legReach,
    stand: 0,
    update(state, time, phase, calm = false) {
      const stand = rig.stand
      if (stand !== blended) {
        blended = stand
        for (const r of resting) r.bone.quaternion.slerpQuaternions(r.seated, r.standing, stand)
        for (const a of animated.values()) a.base.slerpQuaternions(a.seated, a.standing, stand)
      }
      const t = calm ? 0 : time
      const breathe = Math.sin(t * 1.6 + phase) * 0.012

      // Blink: the eyes squash shut for a moment every few seconds.
      const cycle = (t + phase * 1.9) % 4.6
      const lid = !calm && cycle < 0.14 ? 1 - 0.9 * Math.sin((Math.PI * cycle) / 0.14) : 1
      for (const eye of eyes) eye.scale.y = lid

      setMouth(state === 'speaking' ? (calm ? 0.15 : 0.1 + 0.3 * Math.abs(Math.sin(t * 10) * Math.sin(t * 4.1))) : 0)

      if (state === 'walking') {
        const w = (calm ? 0 : time) * WALK_RATE + phase
        const s = Math.sin(w)
        const c = Math.cos(w)
        pose('Spine1', breathe, 0, stand)
        pose('Spine2', 0, s * 0.06, stand)
        pose('Neck', 0, -s * 0.03, stand)
        pose('Head', 0, 0, stand)
        pose('LeftUpLeg', -0.5 * s, 0, stand)
        pose('RightUpLeg', 0.5 * s, 0, stand)
        pose('LeftLeg', 0.7 * Math.max(0, c), 0, stand)
        pose('RightLeg', 0.7 * Math.max(0, -c), 0, stand)
        pose('LeftArm', 0.4 * s, 0, stand)
        pose('RightArm', -0.4 * s, 0, stand)
        pose('LeftForeArm', -0.2, 0, stand)
        pose('RightForeArm', -0.2, 0, stand)
        pose('LeftHand', 0, 0, stand)
        pose('RightHand', 0, 0, stand)
        return
      }
      // Everything below keeps the legs and upper arms at rest.
      pose('Spine2', 0, 0, stand)
      pose('LeftArm', 0, 0, stand)
      pose('RightArm', 0, 0, stand)
      pose('LeftUpLeg', 0, 0, stand)
      pose('RightUpLeg', 0, 0, stand)
      pose('LeftLeg', 0, 0, stand)
      pose('RightLeg', 0, 0, stand)
      if (state === 'working') {
        const lt = Math.sin(t * 13 + phase) * 0.5 + Math.sin(t * 7.3 + phase) * 0.5
        const rt = Math.sin(t * 11.5 + phase * 2) * 0.5 + Math.sin(t * 8.1 + phase) * 0.5
        pose('Spine1', breathe, 0, stand)
        pose('Neck', 0, Math.sin(t * 0.7 + phase) * 0.05, stand)
        pose('Head', Math.sin(t * 0.9 + phase) * 0.04, Math.sin(t * 0.45 + phase) * 0.12, stand)
        pose('LeftForeArm', lt * 0.05, 0, stand)
        pose('RightForeArm', rt * 0.05, 0, stand)
        pose('LeftHand', Math.max(0, lt) * 0.12, 0, stand)
        pose('RightHand', Math.max(0, rt) * 0.12, 0, stand)
      } else if (state === 'thinking') {
        pose('Spine1', breathe - 0.02, 0, stand)
        pose('Neck', -0.04, Math.sin(t * 0.35 + phase) * 0.12, stand)
        pose('Head', -0.1 + Math.sin(t * 0.5 + phase) * 0.05, Math.sin(t * 0.3 + phase) * 0.18, stand)
        pose('LeftForeArm', 0, 0, stand)
        pose('RightForeArm', 0, 0, stand)
        pose('LeftHand', Math.sin(t * 2.2 + phase) * 0.05, 0, stand)
        pose('RightHand', 0, 0, stand)
      } else if (state === 'speaking') {
        // Facing the listener: steady gaze, small nods in time with the voice, hands resting.
        pose('Spine1', breathe, 0, stand)
        pose('Neck', 0, 0, stand)
        pose('Head', Math.sin(t * 3.1 + phase) * 0.04, Math.sin(t * 0.8 + phase) * 0.06, stand)
        pose('LeftForeArm', 0, 0, stand)
        pose('RightForeArm', Math.sin(t * 2.3 + phase) * 0.08, 0, stand)
        pose('LeftHand', 0, 0, stand)
        pose('RightHand', 0, 0, stand)
      } else {
        // Idle and error: upright, calm breathing, eyes on the screen with only a slight glance.
        const glance = 0.06 * Math.sin(t * (state === 'error' ? 0.8 : 0.25) + phase)
        pose('Spine1', breathe * 1.5, 0, stand)
        pose('Neck', 0, glance * 0.3, stand)
        pose('Head', 0, glance, stand)
        pose('LeftForeArm', 0, 0, stand)
        pose('RightForeArm', 0, 0, stand)
        pose('LeftHand', 0, 0, stand)
        pose('RightHand', 0, 0, stand)
      }
    }
  }
  return rig
}
