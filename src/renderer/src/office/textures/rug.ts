// Dark low-pile rug with a fine woven stripe, drawn on a canvas.
import * as THREE from 'three'
import { seededRandom } from './random'

export function makeRugTexture(): THREE.CanvasTexture {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
  const rand = seededRandom(5)
  ctx.fillStyle = '#2b2c2f'
  ctx.fillRect(0, 0, size, size)
  for (let y = 0; y < size; y += 3) {
    const v = 30 + rand() * 30
    ctx.fillStyle = `rgba(${v},${v},${v + 2},0.9)`
    // Slightly wavy rows read as a hand-loomed texture once mipmapped.
    for (let x = 0; x < size; x += 16) ctx.fillRect(x, y + Math.sin((x + y * 3) * 0.05) * 0.8, 16, 1.4)
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(3, 3)
  tex.anisotropy = 8
  return tex
}
