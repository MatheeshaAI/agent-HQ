// Procedural office chair: five-star base with casters, gas lift, seat, backrest and armrests.
// Built once and merged into a single geometry with two groups (0 = upholstery, 1 = metal frame),
// so every chair in the room is one mesh with two draw calls.
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

/** Seat surface height above the floor. */
export const CHAIR_SEAT_HEIGHT = 0.5

function part(geometry: THREE.BufferGeometry, matrix: THREE.Matrix4): THREE.BufferGeometry {
  const g = geometry.index ? geometry.toNonIndexed() : geometry.clone()
  g.applyMatrix4(matrix)
  for (const name of Object.keys(g.attributes)) {
    if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name)
  }
  return g
}

const m = (x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): THREE.Matrix4 =>
  new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(1, 1, 1)
  )

let cached: THREE.BufferGeometry | null = null

/** Chair in its local frame: the sitter faces -x, the backrest is on +x. */
export function chairGeometry(): THREE.BufferGeometry {
  if (cached) return cached
  const upholstery: THREE.BufferGeometry[] = []
  const frame: THREE.BufferGeometry[] = []
  const seatY = CHAIR_SEAT_HEIGHT

  upholstery.push(part(new RoundedBoxGeometry(0.5, 0.08, 0.5, 3, 0.03), m(0, seatY - 0.04, 0)))
  upholstery.push(part(new RoundedBoxGeometry(0.07, 0.58, 0.46, 3, 0.03), m(0.25, seatY + 0.36, 0, 0, 0, -0.12)))

  const leg = new THREE.BoxGeometry(0.3, 0.035, 0.045)
  const caster = new THREE.SphereGeometry(0.03, 10, 8)
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3
    const cx = Math.cos(a) * 0.15
    const cz = Math.sin(a) * 0.15
    frame.push(part(leg, m(cx, 0.075, cz, 0, -a, 0)))
    frame.push(part(caster, m(Math.cos(a) * 0.3, 0.03, Math.sin(a) * 0.3)))
  }
  frame.push(part(new THREE.CylinderGeometry(0.025, 0.03, seatY - 0.12, 12), m(0, (seatY - 0.12) / 2 + 0.08, 0)))
  frame.push(part(new THREE.BoxGeometry(0.22, 0.03, 0.22), m(0, seatY - 0.1, 0)))
  // Back support spine and armrests.
  frame.push(part(new THREE.BoxGeometry(0.04, 0.3, 0.06), m(0.25, seatY + 0.02, 0, 0, 0, -0.12)))
  for (const side of [-1, 1]) {
    frame.push(part(new THREE.BoxGeometry(0.03, 0.2, 0.03), m(0.06, seatY + 0.08, side * 0.24)))
    frame.push(part(new RoundedBoxGeometry(0.26, 0.03, 0.06, 2, 0.012), m(0.04, seatY + 0.19, side * 0.24)))
  }

  const merged = mergeGeometries([mergeGeometries(upholstery), mergeGeometries(frame)], true)
  if (!merged) throw new Error('chair geometry merge failed')
  cached = merged
  return merged
}
