// Procedural kentia/areca-style palm: arching fronds of thin leaflets, merged into a single geometry.
// Origin at the base of the fronds (the top of the planter), y up, about 1.0-1.5 m tall and 1 m across.
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { seededRandom } from '../textures/random'

const UP = new THREE.Vector3(0, 1, 0)

/** One leaflet: a thin blade whose long axis is +y, starting at the origin. */
function leafletGeometry(): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(0.035, 1, 1, 2)
  g.translate(0, 0.5, 0)
  // Taper to a point at the tip and pinch the base, so blades don't read as rectangles.
  const pos = g.getAttribute('position') as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i)
    pos.setX(i, pos.getX(i) * (y > 0.99 ? 0.05 : y < 0.01 ? 0.4 : 1))
  }
  return g
}

const LEAFLET = leafletGeometry()

function frond(rand: () => number, heading: number, parts: THREE.BufferGeometry[]): void {
  const rise = 0.75 + rand() * 0.45
  const out = 0.25 + rand() * 0.2
  const dir = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading))
  const curve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(0, 0, 0),
    dir
      .clone()
      .multiplyScalar(out * 0.35)
      .add(new THREE.Vector3(0, rise * 1.15, 0)),
    dir
      .clone()
      .multiplyScalar(out)
      .add(new THREE.Vector3(0, rise * 0.72, 0))
  )
  parts.push(new THREE.TubeGeometry(curve, 10, 0.006, 4, false))

  const pairs = 11 + Math.floor(rand() * 5)
  const point = new THREE.Vector3()
  const tangent = new THREE.Vector3()
  const side = new THREE.Vector3()
  const blade = new THREE.Vector3()
  const across = new THREE.Vector3()
  const normal = new THREE.Vector3()
  const basis = new THREE.Matrix4()
  const scale = new THREE.Matrix4()
  for (let i = 0; i < pairs; i++) {
    const t = 0.3 + (i / pairs) * 0.68
    curve.getPoint(t, point)
    curve.getTangent(t, tangent)
    side.crossVectors(tangent, UP).normalize()
    // Longest in the middle of the frond, shortening towards the tip.
    const length = 0.32 * Math.sin(Math.PI * (0.2 + t * 0.75)) * (0.85 + rand() * 0.3)
    const droop = THREE.MathUtils.degToRad(22 + rand() * 15)
    for (const s of [-1, 1]) {
      blade
        .copy(side)
        .multiplyScalar(s * Math.cos(droop))
        .addScaledVector(UP, -Math.sin(droop))
        .addScaledVector(tangent, 0.9)
        .normalize()
      across.copy(tangent).addScaledVector(blade, -tangent.dot(blade)).normalize()
      normal.crossVectors(across, blade)
      basis.makeBasis(across, blade, normal).setPosition(point)
      scale.makeScale(1, length, 1)
      parts.push(LEAFLET.clone().applyMatrix4(basis.multiply(scale)))
    }
  }
}

/** A palm crown of 9-12 fronds. Different seeds give different plants. */
export function palmGeometry(seed: number): THREE.BufferGeometry {
  const rand = seededRandom(seed * 7919 + 13)
  const parts: THREE.BufferGeometry[] = []
  const fronds = 9 + Math.floor(rand() * 4)
  for (let i = 0; i < fronds; i++) frond(rand, (i / fronds) * Math.PI * 2 + rand() * 0.5, parts)
  const merged = mergeGeometries(parts)
  parts.forEach((p) => p.dispose())
  if (!merged) throw new Error('palm geometry merge failed')
  return merged
}
