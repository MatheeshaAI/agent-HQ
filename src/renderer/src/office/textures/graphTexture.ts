// Draws the live knowledge graph onto the big wall screen.
// Layout is a small deterministic force simulation, so the same graph always lands in the same shape.
import * as THREE from 'three'
import type { GraphData } from '@shared/types'
import { seededRandom } from './random'

export const GRAPH_CANVAS = { width: 2048, height: 960 } as const

interface Point {
  x: number
  y: number
  vx: number
  vy: number
}

function hash(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
  return ((h >>> 0) % 2147483646) + 1
}

/** Positions in the unit square [0,1]^2. */
export function layoutGraph(graph: GraphData): Map<string, { x: number; y: number }> {
  const points = new Map<string, Point>()
  for (const node of graph.nodes) {
    const r = seededRandom(hash(node.id))
    points.set(node.id, { x: r(), y: r(), vx: 0, vy: 0 })
  }
  const list = [...points.values()]
  const edges = graph.edges
    .map((e) => [points.get(e.source), points.get(e.target)] as const)
    .filter((e): e is readonly [Point, Point] => Boolean(e[0] && e[1]))
  const k = Math.sqrt(1 / Math.max(1, list.length)) * 0.9

  for (let step = 0; step < 220; step++) {
    const cooling = 0.1 * (1 - step / 220) + 0.004
    for (let i = 0; i < list.length; i++) {
      const a = list[i]
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j]
        const dx = a.x - b.x
        const dy = a.y - b.y
        const d2 = Math.max(dx * dx + dy * dy, 1e-4)
        const f = (k * k) / d2
        a.vx += dx * f
        a.vy += dy * f
        b.vx -= dx * f
        b.vy -= dy * f
      }
    }
    for (const [a, b] of edges) {
      const dx = a.x - b.x
      const dy = a.y - b.y
      const d = Math.sqrt(dx * dx + dy * dy) || 1e-3
      const f = d / k
      a.vx -= dx * f
      a.vy -= dy * f
      b.vx += dx * f
      b.vy += dy * f
    }
    for (const p of list) {
      p.vx += (0.5 - p.x) * 0.05
      p.vy += (0.5 - p.y) * 0.05
      const v = Math.sqrt(p.vx * p.vx + p.vy * p.vy) || 1
      const m = Math.min(v, cooling)
      p.x += (p.vx / v) * m
      p.y += (p.vy / v) * m
      p.vx = p.vy = 0
    }
  }

  // Normalise into the unit square with a margin.
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity
  for (const p of list) {
    minX = Math.min(minX, p.x)
    maxX = Math.max(maxX, p.x)
    minY = Math.min(minY, p.y)
    maxY = Math.max(maxY, p.y)
  }
  const sx = maxX - minX || 1
  const sy = maxY - minY || 1
  const out = new Map<string, { x: number; y: number }>()
  for (const [id, p] of points) {
    out.set(id, {
      x: list.length === 1 ? 0.5 : 0.08 + ((p.x - minX) / sx) * 0.84,
      y: list.length === 1 ? 0.5 : 0.1 + ((p.y - minY) / sy) * 0.8
    })
  }
  return out
}

function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const bg = ctx.createLinearGradient(0, 0, w, h)
  bg.addColorStop(0, '#04101f')
  bg.addColorStop(1, '#061a33')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)
  ctx.strokeStyle = 'rgba(56,189,248,0.10)'
  ctx.lineWidth = 2
  for (let x = 0; x <= w; x += 64) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, h)
    ctx.stroke()
  }
  for (let y = 0; y <= h; y += 64) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(w, y)
    ctx.stroke()
  }
}

function drawSidebar(ctx: CanvasRenderingContext2D, graph: GraphData, w: number, h: number): void {
  ctx.fillStyle = 'rgba(8,24,46,0.85)'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = 'rgba(56,189,248,0.6)'
  ctx.fillRect(w - 3, 0, 3, h)
  ctx.font = '600 34px Inter, system-ui, sans-serif'
  ctx.fillStyle = '#bfe9ff'
  ctx.fillText('Knowledge graph', 32, 64)
  ctx.font = '500 26px Inter, system-ui, sans-serif'
  ctx.fillStyle = '#7dd3fc'
  ctx.fillText(`${graph.nodes.length} pages · ${graph.edges.length} links`, 32, 108)
  const top = [...graph.nodes].sort((a, b) => b.degree - a.degree).slice(0, 18)
  ctx.font = '400 24px Inter, system-ui, sans-serif'
  top.forEach((node, i) => {
    const y = 170 + i * 42
    ctx.fillStyle = 'rgba(56,189,248,0.8)'
    ctx.fillRect(32, y - 14, 10, 10)
    ctx.fillStyle = 'rgba(203,230,255,0.85)'
    const title = node.title.length > 26 ? `${node.title.slice(0, 25)}…` : node.title
    ctx.fillText(title, 56, y)
  })
}

export function drawGraph(canvas: HTMLCanvasElement, graph: GraphData): void {
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
  const { width: w, height: h } = canvas
  drawBackground(ctx, w, h)
  const side = Math.round(w * 0.27)
  drawSidebar(ctx, graph, side, h)

  const gx = side + 40
  const gw = w - gx - 40
  const pos = layoutGraph(graph)
  const at = (id: string): { x: number; y: number } | undefined => {
    const p = pos.get(id)
    return p && { x: gx + p.x * gw, y: p.y * h }
  }

  if (graph.nodes.length === 0) {
    ctx.font = '500 64px Inter, system-ui, sans-serif'
    ctx.fillStyle = 'rgba(125,211,252,0.55)'
    ctx.textAlign = 'center'
    ctx.fillText('No wiki pages yet — drop a source to start', gx + gw / 2, h / 2)
    ctx.textAlign = 'start'
    return
  }

  ctx.lineCap = 'round'
  ctx.shadowColor = '#38bdf8'
  ctx.shadowBlur = 14
  ctx.strokeStyle = 'rgba(56,189,248,0.55)'
  ctx.lineWidth = 3
  for (const e of graph.edges) {
    const a = at(e.source)
    const b = at(e.target)
    if (!a || !b) continue
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
  }
  const maxDegree = Math.max(1, ...graph.nodes.map((n) => n.degree))
  for (const node of graph.nodes) {
    const p = at(node.id)
    if (!p) continue
    const r = 7 + 15 * Math.sqrt(node.degree / maxDegree)
    ctx.shadowBlur = 30
    ctx.shadowColor = '#22d3ee'
    ctx.fillStyle = '#7ef0ff'
    ctx.beginPath()
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.fillStyle = '#e8fdff'
    ctx.beginPath()
    ctx.arc(p.x, p.y, r * 0.45, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.shadowBlur = 0
}

export function makeGraphTexture(): { canvas: HTMLCanvasElement; texture: THREE.CanvasTexture } {
  const canvas = document.createElement('canvas')
  canvas.width = GRAPH_CANVAS.width
  canvas.height = GRAPH_CANVAS.height
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  return { canvas, texture }
}
