// Merges the static meshes below it into one mesh per shared material, cutting draw calls for the
// hundreds of boxes, plants and fittings in the office (each is drawn in the main, shadow and floor
// reflection passes). Multi-material meshes are split by geometry group first. Meshes with a unique
// material (screens, signage, the clickable graph wall), instanced and skinned meshes are left as they are.
import { useLayoutEffect, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

const KEPT_ATTRIBUTES = ['position', 'normal', 'uv']

interface Part {
  mesh: THREE.Mesh
  /** Geometry group to take from a multi-material mesh, or null for the whole geometry. */
  group: { start: number; count: number } | null
}

interface Bucket {
  material: THREE.Material
  castShadow: boolean
  receiveShadow: boolean
  renderOrder: number
  layers: number
  parts: Part[]
}

function isBatchable(o: THREE.Object3D): o is THREE.Mesh {
  const mesh = o as THREE.Mesh
  return (
    mesh.isMesh === true &&
    !(mesh as THREE.SkinnedMesh).isSkinnedMesh &&
    !(mesh as THREE.InstancedMesh).isInstancedMesh &&
    mesh.visible
  )
}

function bakedGeometry({ mesh, group }: Part, toRoot: THREE.Matrix4): THREE.BufferGeometry {
  const source = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry
  const geometry = new THREE.BufferGeometry()
  for (const name of KEPT_ATTRIBUTES) {
    const attribute = source.getAttribute(name) as THREE.BufferAttribute | undefined
    if (!attribute) continue
    const { itemSize } = attribute
    const start = group ? group.start * itemSize : 0
    const end = group ? (group.start + group.count) * itemSize : attribute.array.length
    geometry.setAttribute(
      name,
      new THREE.BufferAttribute(attribute.array.slice(start, end), itemSize, attribute.normalized)
    )
  }
  geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(toRoot, mesh.matrixWorld))
  return geometry
}

/** Each (material, part) pair a mesh contributes: one for a plain mesh, one per group for a multi-material mesh. */
function partsOf(mesh: THREE.Mesh): [THREE.Material, Part][] {
  if (!Array.isArray(mesh.material)) return [[mesh.material, { mesh, group: null }]]
  const materials = mesh.material
  return mesh.geometry.groups.flatMap((g) => {
    const material = materials[g.materialIndex ?? 0]
    return material ? [[material, { mesh, group: { start: g.start, count: g.count } }] as [THREE.Material, Part]] : []
  })
}

export default function StaticBatch({ children }: { children: ReactNode }): JSX.Element {
  const root = useRef<THREE.Group>(null)

  useLayoutEffect(() => {
    const group = root.current
    if (!group) return
    group.updateMatrixWorld(true)
    const toRoot = group.matrixWorld.clone().invert()

    const buckets = new Map<string, Bucket>()
    const keysOf = new Map<THREE.Mesh, string[]>()
    group.traverse((o) => {
      if (!isBatchable(o)) return
      const attributes = KEPT_ATTRIBUTES.filter((a) => a in o.geometry.attributes).join(',')
      const keys: string[] = []
      for (const [material, part] of partsOf(o)) {
        const key = `${material.uuid}|${o.castShadow}|${o.receiveShadow}|${o.renderOrder}|${o.layers.mask}|${attributes}`
        let bucket = buckets.get(key)
        if (!bucket) {
          bucket = {
            material,
            castShadow: o.castShadow,
            receiveShadow: o.receiveShadow,
            renderOrder: o.renderOrder,
            layers: o.layers.mask,
            parts: []
          }
          buckets.set(key, bucket)
        }
        bucket.parts.push(part)
        keys.push(key)
      }
      keysOf.set(o, keys)
    })

    // Merge a mesh only if every part of it shares its material with something else; otherwise keep it whole.
    const shared = (key: string): boolean => (buckets.get(key)?.parts.length ?? 0) > 1
    const hidden = [...keysOf].filter(([, keys]) => keys.length > 0 && keys.every(shared)).map(([mesh]) => mesh)
    const batched = new Set(hidden)

    const merged: THREE.Mesh[] = []
    for (const bucket of buckets.values()) {
      const parts = bucket.parts.filter((p) => batched.has(p.mesh))
      if (parts.length === 0) continue
      const geometry = mergeGeometries(parts.map((p) => bakedGeometry(p, toRoot)))
      if (!geometry) throw new Error('StaticBatch: incompatible geometries in one material bucket')
      const mesh = new THREE.Mesh(geometry, bucket.material)
      mesh.castShadow = bucket.castShadow
      mesh.receiveShadow = bucket.receiveShadow
      mesh.renderOrder = bucket.renderOrder
      mesh.layers.mask = bucket.layers
      mesh.raycast = () => undefined // static decoration never takes pointer events
      group.add(mesh)
      merged.push(mesh)
    }
    for (const mesh of hidden) mesh.visible = false

    return () => {
      for (const mesh of merged) {
        group.remove(mesh)
        mesh.geometry.dispose()
      }
      for (const m of hidden) m.visible = true
    }
  }, [])

  return <group ref={root}>{children}</group>
}
