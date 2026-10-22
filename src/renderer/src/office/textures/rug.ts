// Charcoal low-pile rug with a fine woven stripe, drawn on a canvas. One repeat covers RUG_PERIOD metres;
// rugs scale their UVs by that, so the weave keeps the same size on every rug.
import * as THREE from 'three'
import { seededRandom } from './random'

export const RUG_PERIOD = 0.9

export function makeRugTexture(): THREE.CanvasTexture {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
  const rand = seededRandom(5)
  ctx.fillStyle = '#2b2c2f'
  ctx.fillRect(0, 0, size, size)
  for (let y = 0; y < size; y += 3) {
    const accent = y % 12 === 0
    const v = 26 + rand() * 46
    ctx.fillStyle = accent ? 'rgba(90,90,92,0.6)' : `rgba(${v},${v},${v + 2},0.9)`
    // Slightly wavy rows read as a hand-loomed texture once mipmapped.
    for (let x = 0; x < size; x += 16) ctx.fillRect(x, y + Math.sin((x + y * 3) * 0.05) * 0.8, 16, 1.4)
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.anisotropy = 8
  return tex
}
