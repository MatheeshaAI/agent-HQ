// Dark-wood bookcase filled with mostly blue, teal and tan books, warm LED strips under each shelf and an
// optional table lamp on top. All books of one case are a single InstancedMesh.
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Box, Cylinder } from '../primitives'
import { useMat } from '../materials'
import { seededRandom } from '../textures/random'
import type { BookshelfSpot } from '../layout'

const BOOK_COLORS = [
  '#2b4a6f',
  '#3c6e9a',
  '#8a5a3b',
  '#1d2b3a',
  '#b9b2a2',
  '#5d7f99',
  '#6b4a33',
  '#24364f',
  '#2f6f7a',
  '#4a7fa6',
  '#a07a52',
  '#1f3d5c'
]
const BOOK_GEOMETRY = new THREE.BoxGeometry(1, 1, 1)
const BOOK_MATERIAL = new THREE.MeshStandardMaterial({ roughness: 0.75 })

interface BookshelfProps extends BookshelfSpot {
  seed: number
}

interface Book {
  matrix: THREE.Matrix4
  color: THREE.Color
}

/** Fills each shelf of each bay with books; `dividers` are the x positions of the bay dividers. */
function fillShelves(
  width: number,
  dividers: number[],
  shelfYs: number[],
  shelfGap: number,
  depth: number,
  seed: number
): Book[] {
  const rand = seededRandom(seed)
  const books: Book[] = []
  const q = new THREE.Quaternion()
  const edges = [-width / 2 + 0.03, ...dividers.flatMap((d) => [d - 0.02, d + 0.02]), width / 2 - 0.03]
  for (const y of shelfYs) {
    for (let b = 0; b < edges.length; b += 2) {
      let x = edges[b]
      while (x < edges[b + 1] - 0.03) {
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
          matrix: new THREE.Matrix4().compose(
            new THREE.Vector3(x + t / 2, y + h / 2, d / 2 + 0.02),
            q,
            new THREE.Vector3(t, h, d)
          ),
          color: new THREE.Color(BOOK_COLORS[Math.floor(rand() * BOOK_COLORS.length)])
        })
        x += t + 0.003
      }
    }
  }
  return books
}

/** Black table lamp with a glowing drum shade. */
function TableLamp({ y }: { y: number }): JSX.Element {
  const mat = useMat()
  return (
    <group position={[0.3, y, 0.18]}>
      <Cylinder radius={0.06} height={0.02} at={[0, 0.01, 0]} material={mat.blackMetal} />
      <Cylinder radius={0.012} height={0.26} at={[0, 0.14, 0]} material={mat.blackMetal} />
      <Cylinder radius={0.1} height={0.14} at={[0, 0.3, 0]} material={mat.globeShade} shadows={false} />
      <pointLight position={[0, 0.3, 0.05]} color="#ffbe78" intensity={1.2} distance={2.5} decay={2} />
    </group>
  )
}

export default function Bookshelf({ at, rotation, width, height, bays = 1, lamp, seed }: BookshelfProps): JSX.Element {
  const mat = useMat()
  const depth = 0.34
  const rows = Math.max(3, Math.round(height / 0.36))
  const gap = (height - 0.1) / rows
  const shelfYs = useMemo(() => Array.from({ length: rows }, (_, i) => 0.07 + i * gap), [rows, gap])
  const dividers = useMemo(
    () => Array.from({ length: bays - 1 }, (_, i) => -width / 2 + ((i + 1) * width) / bays),
    [bays, width]
  )
  const books = useMemo(
    () => fillShelves(width, dividers, shelfYs, gap - 0.03, depth - 0.04, seed),
    [width, dividers, shelfYs, gap, seed]
  )
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
      {/* Warm back-lit back panel, plus a soft fill that lights the book spines like the reference's cases. */}
      <Box size={[width, height, 0.02]} at={[0, height / 2, 0.01]} material={mat.shelfGlow} />
      <pointLight
        position={[0, height * 0.55, depth + 0.45]}
        color="#ffb36b"
        intensity={2.2 * height}
        distance={2.6}
        decay={2}
      />
      {[-1, 1].map((s) => (
        <Box
          key={s}
          size={[0.035, height, depth]}
          at={[(s * (width - 0.035)) / 2, height / 2, depth / 2]}
          material={mat.darkWood}
        />
      ))}
      {dividers.map((x) => (
        <Box key={x} size={[0.03, height, depth]} at={[x, height / 2, depth / 2]} material={mat.darkWood} />
      ))}
      {[...shelfYs, height - 0.02].map((y, i) => (
        <group key={y}>
          <Box size={[width, 0.03, depth]} at={[0, y - 0.015, depth / 2]} material={mat.darkWood} />
          {/* Warm LED strip under the front edge of each shelf above a row of books. */}
          {i > 0 && (
            <Box
              size={[width - 0.1, 0.008, 0.02]}
              at={[0, y - 0.034, depth - 0.03]}
              material={mat.warmLight}
              shadows={false}
            />
          )}
        </group>
      ))}
      {lamp && <TableLamp y={height} />}
      <instancedMesh ref={instanced} args={[BOOK_GEOMETRY, BOOK_MATERIAL, books.length]} castShadow receiveShadow />
    </group>
  )
}
