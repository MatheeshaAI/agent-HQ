// Straight-grain walnut veneer for furniture. A plain grain (no planks) survives being stretched
// over boxes of any proportion, unlike the parquet photo texture.
import * as THREE from 'three'
import { seededRandom } from './random'

export function makeWoodGrainTexture(): THREE.CanvasTexture {
  const w = 1024
  const h = 512
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
  const rand = seededRandom(23)
  ctx.fillStyle = '#5a4434'
  ctx.fillRect(0, 0, w, h)
  for (let i = 0; i < 260; i++) {
    const y0 = rand() * h
    const amp = 2 + rand() * 6
    const freq = 0.002 + rand() * 0.006
    const phase = rand() * Math.PI * 2
    const dark = rand() < 0.6
    ctx.strokeStyle = dark ? `rgba(30,18,10,${0.08 + rand() * 0.22})` : `rgba(170,120,80,${0.05 + rand() * 0.1})`
    ctx.lineWidth = 0.6 + rand() * 2.4
    ctx.beginPath()
    for (let x = 0; x <= w; x += 16) {
      const y = y0 + Math.sin(x * freq + phase) * amp
      if (x === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}
