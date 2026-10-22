// A compact force-directed layout: Barnes-Hut many-body repulsion, spring links and a weak pull
// towards the origin, integrated with velocity Verlet-style damping (the same model as d3-force).

import type { GraphData } from '@shared/types'

export interface SimNode {
  id: string
  title: string
  degree: number
  sources: number
  x: number
  y: number
  vx: number
  vy: number
  /** When set, the node is pinned (e.g. while being dragged) */
  fixed: boolean
}

export interface SimLink {
  source: SimNode
  target: SimNode
}

const THETA2 = 0.81 // Barnes-Hut accuracy (theta = 0.9)
const CHARGE = -120
const LINK_DISTANCE = 46
const CENTER_STRENGTH = 0.012
const VELOCITY_DECAY = 0.42
const ALPHA_DECAY = 0.0228
const ALPHA_MIN = 0.003
const DISTANCE_MIN2 = 1

interface Quad {
  x0: number
  y0: number
  size: number
  mass: number
  cx: number
  cy: number
  node: SimNode | null
  children: (Quad | null)[] | null
}

export class ForceSimulation {
  nodes: SimNode[] = []
  links: SimLink[] = []
  alpha = 1
  private neighbours = new Map<string, Set<string>>()

  constructor(graph: GraphData) {
    this.setGraph(graph)
  }

  /** Replaces the graph, keeping the position of nodes that already existed. */
  setGraph(graph: GraphData): void {
    const previous = new Map(this.nodes.map((n) => [n.id, n]))
    this.nodes = graph.nodes.map((node, index) => {
      const old = previous.get(node.id)
      if (old) return { ...old, title: node.title, degree: node.degree, sources: node.sources }
      // Phyllotaxis seeding gives a deterministic, evenly spread starting layout.
      const radius = 10 * Math.sqrt(0.5 + index + previous.size)
      const angle = (index + previous.size) * Math.PI * (3 - Math.sqrt(5))
      return { ...node, x: radius * Math.cos(angle), y: radius * Math.sin(angle), vx: 0, vy: 0, fixed: false }
    })
    const byId = new Map(this.nodes.map((n) => [n.id, n]))
    this.links = []
    this.neighbours = new Map(this.nodes.map((n) => [n.id, new Set<string>()]))
    for (const edge of graph.edges) {
      const source = byId.get(edge.source)
      const target = byId.get(edge.target)
      if (!source || !target || source === target) continue
      this.links.push({ source, target })
      this.neighbours.get(source.id)!.add(target.id)
      this.neighbours.get(target.id)!.add(source.id)
    }
    this.alpha = previous.size === 0 ? 1 : Math.max(this.alpha, 0.5)
  }

  neighboursOf(id: string): Set<string> {
    return this.neighbours.get(id) ?? new Set()
  }

  get settled(): boolean {
    return this.alpha < ALPHA_MIN
  }

  reheat(alpha = 0.3): void {
    this.alpha = Math.max(this.alpha, alpha)
  }

  tick(): void {
    if (this.settled) return
    this.alpha += (0 - this.alpha) * ALPHA_DECAY
    this.applyLinks()
    this.applyCharge()
    for (const node of this.nodes) {
      if (node.fixed) {
        node.vx = node.vy = 0
        continue
      }
      node.vx -= node.x * CENTER_STRENGTH * this.alpha
      node.vy -= node.y * CENTER_STRENGTH * this.alpha
      node.vx *= 1 - VELOCITY_DECAY
      node.vy *= 1 - VELOCITY_DECAY
      node.x += node.vx
      node.y += node.vy
    }
  }

  private applyLinks(): void {
    for (const { source, target } of this.links) {
      let dx = target.x + target.vx - source.x - source.vx
      let dy = target.y + target.vy - source.y - source.vy
      const length = Math.hypot(dx, dy) || 1e-6
      const strength = 1 / Math.min(source.degree || 1, target.degree || 1)
      const k = ((length - LINK_DISTANCE) / length) * this.alpha * strength
      dx *= k
      dy *= k
      const total = (source.degree || 1) + (target.degree || 1)
      const bias = (source.degree || 1) / total
      target.vx -= dx * bias
      target.vy -= dy * bias
      source.vx += dx * (1 - bias)
      source.vy += dy * (1 - bias)
    }
  }

  private applyCharge(): void {
    if (this.nodes.length < 2) return
    const root = this.buildTree()
    for (const node of this.nodes) this.repel(node, root)
  }

  private buildTree(): Quad {
    let x0 = Infinity
    let y0 = Infinity
    let x1 = -Infinity
    let y1 = -Infinity
    for (const n of this.nodes) {
      x0 = Math.min(x0, n.x)
      y0 = Math.min(y0, n.y)
      x1 = Math.max(x1, n.x)
      y1 = Math.max(y1, n.y)
    }
    const size = Math.max(x1 - x0, y1 - y0, 1) + 1
    const root = makeQuad(x0, y0, size)
    for (const node of this.nodes) insert(root, node, 0)
    accumulate(root)
    return root
  }

  private repel(node: SimNode, quad: Quad): void {
    if (quad.mass === 0 || quad.node === node) return
    const dx = quad.cx - node.x
    const dy = quad.cy - node.y
    let d2 = dx * dx + dy * dy
    if (quad.children && (quad.size * quad.size) / THETA2 >= d2) {
      for (const child of quad.children) if (child) this.repel(node, child)
      return
    }
    if (d2 < DISTANCE_MIN2) d2 = DISTANCE_MIN2
    const force = (CHARGE * quad.mass * this.alpha) / d2
    node.vx += dx * force
    node.vy += dy * force
  }
}

function makeQuad(x0: number, y0: number, size: number): Quad {
  return { x0, y0, size, mass: 0, cx: 0, cy: 0, node: null, children: null }
}

const MAX_DEPTH = 24

function insert(quad: Quad, node: SimNode, depth: number): void {
  if (!quad.children && !quad.node) {
    quad.node = node
    return
  }
  if (!quad.children) {
    if (depth >= MAX_DEPTH) return // coincident point: it still feels forces but exerts none this tick
    const existing = quad.node!
    quad.node = null
    quad.children = [null, null, null, null]
    insertChild(quad, existing, depth)
  }
  insertChild(quad, node, depth)
}

function insertChild(quad: Quad, node: SimNode, depth: number): void {
  const half = quad.size / 2
  const right = node.x >= quad.x0 + half ? 1 : 0
  const bottom = node.y >= quad.y0 + half ? 1 : 0
  const index = bottom * 2 + right
  const children = quad.children!
  if (!children[index]) children[index] = makeQuad(quad.x0 + right * half, quad.y0 + bottom * half, half)
  insert(children[index]!, node, depth + 1)
}

function accumulate(quad: Quad): void {
  if (quad.node && !quad.children) {
    quad.mass = 1
    quad.cx = quad.node.x
    quad.cy = quad.node.y
    return
  }
  let mass = 0
  let cx = 0
  let cy = 0
  for (const child of quad.children ?? []) {
    if (!child) continue
    accumulate(child)
    mass += child.mass
    cx += child.cx * child.mass
    cy += child.cy * child.mass
  }
  quad.mass = mass
  quad.cx = mass ? cx / mass : 0
  quad.cy = mass ? cy / mass : 0
}
