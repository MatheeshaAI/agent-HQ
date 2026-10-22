// Dark-wood bookcase filled with books. All books of one case are a single InstancedMesh.
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Box } from '../primitives'
import { useMat } from '../materials'
import { seededRandom } from '../textures/random'
import type { Vec2 } from '../layout'

const BOOK_COLORS = ['#e9e4d8', '#2b4a6f', '#3c6e9a', '#8a5a3b', '#1d2b3a', '#b9b2a2', '#5d7f99', '#6b4a33', '#d6cfbf', '#24364f']
const BOOK_GEOMETRY = new THREE.BoxGeometry(1, 1, 1)
const BOOK_MATERIAL = new THREE.MeshStandardMaterial({ roughness: 0.75 })

interface BookshelfProps {
  /** Floor position of the bookcase's back centre. */
  at: Vec2
  /** Rotation around y; at 0 the books face +z. */
  rotation: number
  width: number
  height: number
  seed: number
}

interface Book {
  matrix: THREE.Matrix4
  color: THREE.Color
}

function fillShelves(width: number, shelfYs: number[], shelfGap: number, depth: number, seed: number): Book[] {
  const rand = seededRandom(seed)
  const books: Book[] = []
  const q = new THREE.Quaternion()
  for (const y of shelfYs) {
    let x = -width / 2 + 0.03
    while (x < width / 2 - 0.06) {
      if (rand() < 0.08) {
        x += 0.08 + rand() * 0.15 // a gap or a leaning end
        continue
      }
      const t = 0.025 + rand() * 0.03
      const h = shelfGap * (0.62 + rand() * 0.28)
      const d = depth * (0.7 + rand() * 0.2)
      const lean = rand() < 0.06 ? 0.18 : 0
      q.setFromEuler(new THREE.Euler(0, 0, lean))
      books.push({
        matrix: new THREE.Matrix4().compose(new THREE.Vector3(x + t / 2, y + h / 2, d / 2 + 0.02), q, new THREE.Vector3(t, h, d)),
        color: new THREE.Color(BOOK_COLORS[Math.floor(rand() * BOOK_COLORS.length)])
      })
      x += t + 0.003
    }
  }
  return books
}

export default function Bookshelf({ at, rotation, width, height, seed }: BookshelfProps): JSX.Element {
  const mat = useMat()
  const depth = 0.34
  const rows = Math.max(3, Math.round(height / 0.36))
  const gap = (height - 0.1) / rows
  const shelfYs = useMemo(() => Array.from({ length: rows }, (_, i) => 0.07 + i * gap), [rows, gap])
  const books = useMemo(() => fillShelves(width, shelfYs, gap - 0.03, depth - 0.04, seed), [width, shelfYs, gap, seed])
  const instanced = useRef<THREE.InstancedMesh>(null)

  useLayoutEffect(() => {
    const mesh = instanced.current
    if (!mesh) return
    books.forEach((b, i) => {
      mesh.setMatrixAt(i, b.matrix)
      mesh.setColorAt(i, b.color)
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [books])

  return (
    <group position={[at[0], 0, at[1]]} rotation={[0, rotation, 0]}>
      <Box size={[width, height, 0.02]} at={[0, height / 2, 0.01]} material={mat.darkWood} />
      {[-1, 1].map((s) => (
        <Box
          key={s}
          size={[0.035, height, depth]}
          at={[(s * (width - 0.035)) / 2, height / 2, depth / 2]}
          material={mat.darkWood}
        />
      ))}
      {[...shelfYs, height - 0.02].map((y) => (
        <Box key={y} size={[width, 0.03, depth]} at={[0, y - 0.015, depth / 2]} material={mat.darkWood} />
      ))}
      <instancedMesh ref={instanced} args={[BOOK_GEOMETRY, BOOK_MATERIAL, books.length]} castShadow receiveShadow />
    </group>
  )
}
