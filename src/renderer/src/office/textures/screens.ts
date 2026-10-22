// Canvas-drawn screen content for desk monitors and wall panels. Purely decorative UI chrome
// (code, dashboards, logs); the live data screen is the knowledge graph in graphTexture.ts.
import * as THREE from 'three'
import { seededRandom } from './random'

export type ScreenKind = 'code' | 'dashboard' | 'docs' | 'media' | 'log'

const CODE_COLORS = ['#7dd3fc', '#93c5fd', '#e2e8f0', '#86efac', '#c4b5fd', '#fda4af', '#94a3b8']

function codeLines(
  ctx: CanvasRenderingContext2D,
  rand: () => number,
  x: number,
  y: number,
  w: number,
  h: number,
  lh: number
): void {
  let indent = 0
  for (let ly = y; ly < y + h - lh / 2; ly += lh) {
    if (rand() < 0.12) {
      indent = Math.max(0, indent + (rand() < 0.5 ? -1 : 1))
      continue
    }
    let lx = x + indent * lh * 1.4
    const tokens = 1 + Math.floor(rand() * 5)
    for (let t = 0; t < tokens && lx < x + w; t++) {
      const tw = Math.min(lh * (1 + rand() * 5), x + w - lx)
      ctx.fillStyle = CODE_COLORS[Math.floor(rand() * CODE_COLORS.length)]
      ctx.globalAlpha = 0.55 + rand() * 0.45
      ctx.fillRect(lx, ly, tw, lh * 0.42)
      lx += tw + lh * 0.45
    }
  }
  ctx.globalAlpha = 1
}

function panel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke = 'rgba(125,211,252,0.35)'
): void {
  ctx.fillStyle = fill
  ctx.fillRect(x, y, w, h)
  ctx.strokeStyle = stroke
  ctx.lineWidth = 2
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2)
}

function drawCode(ctx: CanvasRenderingContext2D, w: number, h: number, rand: () => number): void {
  const bg = ctx.createLinearGradient(0, 0, 0, h)
  bg.addColorStop(0, '#0b1424')
  bg.addColorStop(1, '#0a1020')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#111c30'
  ctx.fillRect(0, 0, w * 0.18, h)
  codeLines(ctx, rand, w * 0.03, 12, w * 0.12, h, 14)
  codeLines(ctx, rand, w * 0.22, 12, w * 0.74, h, 14)
}

function drawDashboard(ctx: CanvasRenderingContext2D, w: number, h: number, rand: () => number): void {
  ctx.fillStyle = '#0c1a2e'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#1d4f86'
  ctx.fillRect(0, 0, w, h * 0.06)
  const cols = 2
  const rows = Math.max(2, Math.round(h / (w * 0.42)))
  const gw = (w - 30) / cols
  const gh = (h - h * 0.06 - 10 * (rows + 1)) / rows
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = 10 + c * (gw + 10)
      const y = h * 0.06 + 10 + r * (gh + 10)
      panel(ctx, x, y, gw, gh, '#10243d')
      const kind = rand()
      ctx.strokeStyle = rand() < 0.5 ? '#38bdf8' : '#a5b4fc'
      ctx.lineWidth = 3
      if (kind < 0.4) {
        ctx.beginPath()
        for (let i = 0; i <= 12; i++) {
          const px = x + 8 + ((gw - 16) * i) / 12
          const py = y + gh * 0.8 - rand() * gh * 0.6
          if (i === 0) ctx.moveTo(px, py)
          else ctx.lineTo(px, py)
        }
        ctx.stroke()
      } else if (kind < 0.7) {
        for (let i = 0; i < 7; i++) {
          const bh = rand() * gh * 0.7
          ctx.fillStyle = i % 2 ? '#38bdf8' : '#60a5fa'
          ctx.fillRect(x + 10 + i * ((gw - 20) / 7), y + gh - 8 - bh, (gw - 20) / 7 - 5, bh)
        }
      } else {
        ctx.fillStyle = '#9ecbff'
        ctx.globalAlpha = 0.85
        ctx.fillRect(x + 8, y + 8, gw - 16, gh - 16)
        ctx.globalAlpha = 1
        ctx.fillStyle = '#244b78'
        ctx.beginPath()
        ctx.arc(x + gw / 2, y + gh / 2, Math.min(gw, gh) * 0.22, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }
}

function drawDocs(ctx: CanvasRenderingContext2D, w: number, h: number, rand: () => number): void {
  ctx.fillStyle = '#dbe7f5'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#2d5d95'
  ctx.fillRect(0, 0, w, h * 0.07)
  ctx.fillStyle = '#c3d4e8'
  ctx.fillRect(0, h * 0.07, w * 0.22, h)
  for (let y = h * 0.12; y < h - 10; y += 16) {
    ctx.fillStyle = rand() < 0.15 ? '#2563eb' : '#64748b'
    ctx.fillRect(w * 0.27, y, w * (0.25 + rand() * 0.6), 6)
  }
  for (let y = h * 0.12; y < h - 10; y += 22) {
    ctx.fillStyle = '#7b93b3'
    ctx.fillRect(w * 0.03, y, w * 0.15, 6)
  }
}

function drawMedia(ctx: CanvasRenderingContext2D, w: number, h: number, rand: () => number): void {
  ctx.fillStyle = '#0b1830'
  ctx.fillRect(0, 0, w, h)
  codeLines(ctx, rand, 10, 10, w - 20, h * 0.3, 12)
  const y = h * 0.38
  const g = ctx.createLinearGradient(0, y, 0, y + h * 0.35)
  g.addColorStop(0, '#6fb6ff')
  g.addColorStop(1, '#3b82f6')
  ctx.fillStyle = g
  ctx.fillRect(10, y, w - 20, h * 0.35)
  ctx.fillStyle = 'rgba(15,40,80,0.8)'
  ctx.fillRect(w * 0.3, y + h * 0.08, w * 0.4, h * 0.2)
  codeLines(ctx, rand, 10, h * 0.78, w - 20, h * 0.2, 12)
}

function drawLog(ctx: CanvasRenderingContext2D, w: number, h: number, rand: () => number): void {
  ctx.fillStyle = '#070d18'
  ctx.fillRect(0, 0, w, h)
  for (let y = 12; y < h - 8; y += 13) {
    ctx.fillStyle = '#cbd5e1'
    ctx.globalAlpha = 0.5 + rand() * 0.5
    ctx.fillRect(10, y, 8, 5)
    ctx.fillRect(24, y, (w - 34) * (0.3 + rand() * 0.7), 5)
  }
  ctx.globalAlpha = 1
}

const DRAW: Record<ScreenKind, typeof drawCode> = {
  code: drawCode,
  dashboard: drawDashboard,
  docs: drawDocs,
  media: drawMedia,
  log: drawLog
}

/**
 * A screen texture. `tall` draws twice the visible height so the content can scroll by animating offset.y
 * (used for monitors whose agent is busy).
 */
export function makeScreenTexture(kind: ScreenKind, seed: number, width = 256, height = 160, tall = false): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = tall ? height * 2 : height
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
  DRAW[kind](ctx, canvas.width, canvas.height, seededRandom(seed))
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  if (tall) {
    tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(1, 0.5)
  }
  return tex
}
