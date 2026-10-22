// Draws the live knowledge graph onto the big wall screen.
// Layout is a small deterministic force simulation, so the same graph always lands in the same shape. The screen
// is seen small and at an angle, so everything is drawn bold: thick luminous edges, large haloed nodes.
import * as THREE from 'three'
import type { GraphData } from '@shared/types'
import { seededRandom } from './random'

export const GRAPH_CANVAS = { width: 2048, height: 960 } as const

/** Share of the canvas width taken by the page-list sidebar on the left. */
const SIDEBAR = 0.25
/** Graph area inset from the canvas edges, in canvas pixels. */
const MARGIN = { x: 90, y: 80 }
const FONT = 'Inter, system-ui, sans-serif'

interface Point {
  x: number
  y: number
  dx: number
  dy: number
}

function hash(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
  return ((h >>> 0) % 2147483646) + 1
}

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/**
 * Fruchterman–Reingold layout of one connected component in a box of the given aspect ratio.
 * Returns positions in the unit square [0,1]^2, stretched to fill it.
 */
function forceLayout(ids: string[], edges: GraphData['edges'], aspect: number): Map<string, { x: number; y: number }> {
  const out = new Map<string, { x: number; y: number }>()
  if (ids.length === 1) {
    out.set(ids[0], { x: 0.5, y: 0.5 })
    return out
  }
  const points = new Map<string, Point>()
  for (const id of ids) {
    const r = seededRandom(hash(id))
    // Burn one value: Park–Miller's first output is nearly linear in the seed.
    r()
    points.set(id, { x: (r() - 0.5) * aspect, y: r() - 0.5, dx: 0, dy: 0 })
  }
  const list = [...points.values()]
  const springs = edges
    .map((e) => [points.get(e.source), points.get(e.target)] as const)
    .filter((e): e is readonly [Point, Point] => Boolean(e[0] && e[1]) && e[0] !== e[1])

  const k = Math.sqrt(aspect / ids.length)
  const steps = 300
  for (let step = 0; step < steps; step++) {
    const temperature = 0.12 * aspect * (1 - step / steps) + 0.002
    for (const p of list) {
      // Gentle pull to the centre, stronger vertically so the shape spreads across a wide box.
      p.dx = -p.x * k
      p.dy = -p.y * k * aspect
    }
    for (let i = 0; i < list.length; i++) {
      const a = list[i]
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j]
        const dx = a.x - b.x
        const dy = a.y - b.y
        const f = (k * k) / Math.max(dx * dx + dy * dy, 1e-6)
        a.dx += dx * f
        a.dy += dy * f
        b.dx -= dx * f
        b.dy -= dy * f
      }
    }
    for (const [a, b] of springs) {
      const dx = a.x - b.x
      const dy = a.y - b.y
      const f = Math.sqrt(dx * dx + dy * dy) / k
      a.dx -= dx * f
      a.dy -= dy * f
      b.dx += dx * f
      b.dy += dy * f
    }
    for (const p of list) {
      const d = Math.sqrt(p.dx * p.dx + p.dy * p.dy) || 1
      const m = Math.min(d, temperature)
      p.x += (p.dx / d) * m
      p.y += (p.dy / d) * m
    }
  }

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
  for (const [id, p] of points)
    out.set(id, { x: sx < 1e-3 ? 0.5 : (p.x - minX) / sx, y: sy < 1e-3 ? 0.5 : (p.y - minY) / sy })
  return out
}

/** Connected components, largest first; all unlinked pages are gathered into one group at the end. */
function components(graph: GraphData): string[][] {
  const parent = new Map(graph.nodes.map((n) => [n.id, n.id]))
  const find = (id: string): string => {
    let root = id
    while (parent.get(root) !== root) root = parent.get(root) as string
    parent.set(id, root)
    return root
  }
  for (const e of graph.edges) {
    if (parent.has(e.source) && parent.has(e.target)) parent.set(find(e.source), find(e.target))
  }
  const groups = new Map<string, string[]>()
  for (const n of graph.nodes) {
    const root = find(n.id)
    groups.set(root, [...(groups.get(root) ?? []), n.id])
  }
  const linked = [...groups.values()].filter((g) => g.length > 1).sort((a, b) => b.length - a.length)
  const single = [...groups.values()].filter((g) => g.length === 1).flat()
  return single.length ? [...linked, single] : linked
}

/** Splits a rectangle among groups in proportion to their weights, cutting across its longer side each time. */
function partition(rect: Rect, weights: number[]): Rect[] {
  if (weights.length === 1) return [rect]
  const total = weights.reduce((a, b) => a + b, 0)
  const share = weights[0] / total
  const rest = weights.slice(1)
  if (rect.w >= rect.h) {
    const w = rect.w * share
    return [{ ...rect, w }, ...partition({ ...rect, x: rect.x + w, w: rect.w - w }, rest)]
  }
  const h = rect.h * share
  return [{ ...rect, h }, ...partition({ ...rect, y: rect.y + h, h: rect.h - h }, rest)]
}

/**
 * Positions in the unit square [0,1]^2 for a graph area of the given aspect ratio (width / height).
 * Each topic cluster gets its own share of the area, so unrelated clusters sit side by side and fill the screen.
 */
export function layoutGraph(graph: GraphData, aspect = 1): Map<string, { x: number; y: number }> {
  const out = new Map<string, { x: number; y: number }>()
  const groups = components(graph)
  if (groups.length === 0) return out
  const cells = partition(
    { x: 0, y: 0, w: aspect, h: 1 },
    groups.map((g) => g.length)
  )
  groups.forEach((ids, i) => {
    const cell = cells[i]
    // Inset each cell so neighbouring clusters keep a clear gap.
    const pad = groups.length > 1 ? 0.07 : 0
    const inner = {
      x: cell.x + pad,
      y: cell.y + pad,
      w: Math.max(cell.w - 2 * pad, 0.01),
      h: Math.max(cell.h - 2 * pad, 0.01)
    }
    const members = new Set(ids)
    const local = forceLayout(
      ids,
      graph.edges.filter((e) => members.has(e.source)),
      inner.w / inner.h
    )
    for (const [id, p] of local) out.set(id, { x: (inner.x + p.x * inner.w) / aspect, y: inner.y + p.y * inner.h })
  })
  return out
}

function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const bg = ctx.createLinearGradient(0, 0, w, h)
  bg.addColorStop(0, '#041427')
  bg.addColorStop(1, '#07213d')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)
  // Soft blue bloom in the middle of the graph area, like a lit display.
  const glow = ctx.createRadialGradient(w * 0.62, h * 0.5, 0, w * 0.62, h * 0.5, w * 0.5)
  glow.addColorStop(0, 'rgba(40,140,220,0.22)')
  glow.addColorStop(1, 'rgba(40,140,220,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, w, h)

  const cell = 80
  for (let x = 0; x <= w; x += cell) {
    ctx.fillStyle = x % (cell * 4) === 0 ? 'rgba(80,190,255,0.22)' : 'rgba(80,190,255,0.12)'
    ctx.fillRect(x - 1.5, 0, 3, h)
  }
  for (let y = 0; y <= h; y += cell) {
    ctx.fillStyle = y % (cell * 4) === 0 ? 'rgba(80,190,255,0.22)' : 'rgba(80,190,255,0.12)'
    ctx.fillRect(0, y - 1.5, w, 3)
  }
}

function ellipsize(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text
  let s = text
  while (s.length > 1 && ctx.measureText(`${s}…`).width > max) s = s.slice(0, -1)
  return `${s.trimEnd()}…`
}

function drawSidebar(ctx: CanvasRenderingContext2D, graph: GraphData, w: number, h: number): void {
  ctx.fillStyle = 'rgba(6,20,40,0.88)'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = 'rgba(56,189,248,0.7)'
  ctx.fillRect(w - 4, 0, 4, h)
  ctx.font = `700 40px ${FONT}`
  ctx.fillStyle = '#c9eeff'
  ctx.fillText('Knowledge graph', 36, 76)
  ctx.font = `500 30px ${FONT}`
  ctx.fillStyle = '#6fcff8'
  ctx.fillText(`${graph.nodes.length} pages · ${graph.edges.length} links`, 36, 124)
  ctx.fillStyle = 'rgba(56,189,248,0.35)'
  ctx.fillRect(36, 150, w - 72, 3)

  const top = [...graph.nodes].sort((a, b) => b.degree - a.degree).slice(0, 15)
  ctx.font = `500 30px ${FONT}`
  top.forEach((node, i) => {
    const y = 210 + i * 50
    ctx.fillStyle = 'rgba(56,189,248,0.9)'
    ctx.fillRect(36, y - 20, 14, 14)
    ctx.fillStyle = 'rgba(200,232,255,0.88)'
    ctx.fillText(ellipsize(ctx, node.title, w - 120), 66, y)
  })
}

export function drawGraph(canvas: HTMLCanvasElement, graph: GraphData): void {
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
  const { width: w, height: h } = canvas
  ctx.save()
  drawBackground(ctx, w, h)
  const side = Math.round(w * SIDEBAR)
  drawSidebar(ctx, graph, side, h)

  const gx = side + MARGIN.x
  const gw = w - gx - MARGIN.x
  const gy = MARGIN.y
  const gh = h - 2 * MARGIN.y

  if (graph.nodes.length === 0) {
    ctx.font = `600 58px ${FONT}`
    ctx.fillStyle = 'rgba(125,211,252,0.7)'
    ctx.textAlign = 'center'
    ctx.fillText('No wiki pages yet', gx + gw / 2, h / 2 - 20)
    ctx.font = `500 40px ${FONT}`
    ctx.fillStyle = 'rgba(125,211,252,0.5)'
    ctx.fillText('Drop a source to start', gx + gw / 2, h / 2 + 46)
    ctx.restore()
    return
  }

  const pos = layoutGraph(graph, gw / gh)
  const at = (id: string): { x: number; y: number } | undefined => {
    const p = pos.get(id)
    return p && { x: gx + p.x * gw, y: gy + p.y * gh }
  }
  // Dense graphs get smaller marks so the network stays readable.
  const density = Math.min(1, Math.sqrt(24 / graph.nodes.length))

  // Edges: a wide soft glow under a bright core.
  ctx.lineCap = 'round'
  const segments: [{ x: number; y: number }, { x: number; y: number }][] = []
  for (const e of graph.edges) {
    const a = at(e.source)
    const b = at(e.target)
    if (a && b) segments.push([a, b])
  }
  const strokeAll = (width: number, style: string): void => {
    ctx.lineWidth = width
    ctx.strokeStyle = style
    ctx.beginPath()
    for (const [a, b] of segments) {
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
    }
    ctx.stroke()
  }
  strokeAll(26 * density, 'rgba(34,180,240,0.16)')
  strokeAll(12 * density, 'rgba(56,200,250,0.35)')
  strokeAll(4 * density + 2, 'rgba(110,226,255,0.95)')

  const maxDegree = Math.max(1, ...graph.nodes.map((n) => n.degree))
  const radius = (degree: number): number => (14 + 26 * Math.sqrt(degree / maxDegree)) * (0.55 + 0.45 * density)
  for (const node of graph.nodes) {
    const p = at(node.id)
    if (!p) continue
    const r = radius(node.degree)
    const halo = ctx.createRadialGradient(p.x, p.y, r * 0.4, p.x, p.y, r * 3.4)
    halo.addColorStop(0, 'rgba(60,220,255,0.75)')
    halo.addColorStop(0.35, 'rgba(34,190,245,0.28)')
    halo.addColorStop(1, 'rgba(34,190,245,0)')
    ctx.fillStyle = halo
    ctx.beginPath()
    ctx.arc(p.x, p.y, r * 3.4, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#36d3f7'
    ctx.beginPath()
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#f0feff'
    ctx.beginPath()
    ctx.arc(p.x, p.y, r * 0.55, 0, Math.PI * 2)
    ctx.fill()
  }

  // Labels for the best-connected pages, above-right of their nodes (above-left near the right edge),
  // skipping any that would collide with a label already placed.
  const placed: Rect[] = []
  const labelSize = Math.round(30 + 8 * density)
  ctx.font = `600 ${labelSize}px ${FONT}`
  ctx.textBaseline = 'middle'
  const ranked = [...graph.nodes].sort((a, b) => b.degree - a.degree)
  for (const node of ranked.slice(0, Math.min(10, Math.ceil(graph.nodes.length / 3)))) {
    const p = at(node.id)
    if (!p) continue
    const r = radius(node.degree)
    const text = ellipsize(ctx, node.title, 360)
    const tw = ctx.measureText(text).width
    const right = p.x + r + 16 + tw < w - 20
    const box = { x: right ? p.x + r + 12 : p.x - r - 12 - tw, y: p.y - r - 8 - labelSize / 2, w: tw, h: labelSize }
    const hits = (b: Rect): boolean =>
      box.x < b.x + b.w && b.x < box.x + box.w && box.y < b.y + b.h && b.y < box.y + box.h
    const coversNode = graph.nodes.some((other) => {
      const q = other !== node && at(other.id)
      return q && q.x > box.x - 10 && q.x < box.x + box.w + 10 && q.y > box.y - 10 && q.y < box.y + box.h + 10
    })
    if (coversNode || placed.some(hits)) continue
    placed.push(box)
    ctx.fillStyle = 'rgba(205,240,255,0.92)'
    ctx.fillText(text, box.x, box.y + labelSize / 2)
  }
  ctx.restore()
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
