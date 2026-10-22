import { useEffect, useRef, useState } from 'react'
import { Locate, ZoomIn, ZoomOut } from 'lucide-react'
import type { GraphData } from '@shared/types'
import { ForceSimulation, type SimNode } from './forceSimulation'
import styles from './GraphCanvas.module.css'

interface GraphCanvasProps {
  graph: GraphData
  onOpenNode: (id: string) => void
  /** Node ids to emphasise (e.g. search matches) */
  highlight?: Set<string>
}

interface View {
  x: number
  y: number
  k: number
}

const MIN_ZOOM = 0.15
const MAX_ZOOM = 5
const CLICK_SLOP = 4

const COLORS = {
  edge: 'rgba(96, 165, 250, 0.16)',
  edgeActive: 'rgba(125, 211, 252, 0.75)',
  node: '#3aa0e8',
  nodeHub: '#5ee0f0',
  nodeDim: 'rgba(58, 160, 232, 0.18)',
  label: 'rgba(226, 232, 240, 0.92)',
  labelDim: 'rgba(226, 232, 240, 0.25)',
  ring: '#ffffff'
}

function radius(node: SimNode): number {
  return 3 + Math.sqrt(node.degree) * 2.2
}

/** Interactive force-directed graph: drag to pan, wheel to zoom, drag nodes, hover for neighbours, click to open. */
export function GraphCanvas({ graph, onOpenNode, highlight }: GraphCanvasProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [sim] = useState(() => new ForceSimulation(graph))
  const viewRef = useRef<View>({ x: 0, y: 0, k: 1 })
  const hoverRef = useRef<SimNode | null>(null)
  const highlightRef = useRef(highlight)
  const dirtyRef = useRef(true)
  /** Auto-fit happens until the user pans, zooms or drags */
  const autoFitRef = useRef(true)
  const openRef = useRef(onOpenNode)
  const [hovered, setHovered] = useState<SimNode | null>(null)

  openRef.current = onOpenNode

  useEffect(() => {
    highlightRef.current = highlight
    dirtyRef.current = true
  }, [highlight])

  useEffect(() => {
    sim.setGraph(graph)
    dirtyRef.current = true
  }, [sim, graph])

  // Render loop: steps the simulation while it is moving and redraws only when something changed.
  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    let frame = 0

    const resize = (): void => {
      const dpr = window.devicePixelRatio || 1
      const { width, height } = canvas.getBoundingClientRect()
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      dirtyRef.current = true
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)

    const loop = (): void => {
      if (!sim.settled) {
        sim.tick()
        sim.tick()
        dirtyRef.current = true
        if (autoFitRef.current && (sim.alpha < 0.25 || sim.settled)) fitView(canvas, sim, viewRef.current)
      }
      if (dirtyRef.current) {
        draw(ctx, canvas, sim, viewRef.current, hoverRef.current, highlightRef.current)
        dirtyRef.current = false
      }
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [sim])

  // Pointer interaction: pan, zoom, drag nodes, hover and click.
  useEffect(() => {
    const canvas = canvasRef.current!
    const view = viewRef.current
    let drag: { node: SimNode | null; startX: number; startY: number; lastX: number; lastY: number; moved: boolean } | null = null

    const toWorld = (event: { clientX: number; clientY: number }): [number, number] => {
      const rect = canvas.getBoundingClientRect()
      return [(event.clientX - rect.left - rect.width / 2 - view.x) / view.k, (event.clientY - rect.top - rect.height / 2 - view.y) / view.k]
    }
    const nodeAt = (event: PointerEvent): SimNode | null => {
      const [wx, wy] = toWorld(event)
      let best: SimNode | null = null
      let bestDistance = Infinity
      for (const node of sim.nodes) {
        const d = Math.hypot(node.x - wx, node.y - wy)
        const reach = radius(node) + 4 / view.k
        if (d <= reach && d < bestDistance) {
          best = node
          bestDistance = d
        }
      }
      return best
    }
    const setHover = (node: SimNode | null): void => {
      if (hoverRef.current === node) return
      hoverRef.current = node
      setHovered(node)
      canvas.style.cursor = node ? 'pointer' : 'grab'
      dirtyRef.current = true
    }

    const onDown = (event: PointerEvent): void => {
      canvas.setPointerCapture(event.pointerId)
      const node = nodeAt(event)
      autoFitRef.current = false
      drag = { node, startX: event.clientX, startY: event.clientY, lastX: event.clientX, lastY: event.clientY, moved: false }
      if (node) node.fixed = true
      else canvas.style.cursor = 'grabbing'
    }
    const onMove = (event: PointerEvent): void => {
      if (!drag) {
        setHover(nodeAt(event))
        return
      }
      if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > CLICK_SLOP) drag.moved = true
      if (drag.node) {
        const [wx, wy] = toWorld(event)
        drag.node.x = wx
        drag.node.y = wy
        if (drag.moved) sim.reheat(0.25)
      } else {
        view.x += event.clientX - drag.lastX
        view.y += event.clientY - drag.lastY
      }
      drag.lastX = event.clientX
      drag.lastY = event.clientY
      dirtyRef.current = true
    }
    const onUp = (event: PointerEvent): void => {
      if (!drag) return
      if (drag.node) {
        drag.node.fixed = false
        if (!drag.moved) openRef.current(drag.node.id)
      }
      drag = null
      canvas.releasePointerCapture(event.pointerId)
      setHover(nodeAt(event))
    }
    const onLeave = (): void => {
      if (!drag) setHover(null)
    }
    const onWheel = (event: WheelEvent): void => {
      event.preventDefault()
      autoFitRef.current = false
      const rect = canvas.getBoundingClientRect()
      const factor = Math.exp(-event.deltaY * 0.0015)
      zoomAround(view, factor, event.clientX - rect.left - rect.width / 2, event.clientY - rect.top - rect.height / 2)
      dirtyRef.current = true
    }

    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointerleave', onLeave)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointerleave', onLeave)
      canvas.removeEventListener('wheel', onWheel)
    }
  }, [sim])

  const zoomBy = (factor: number): void => {
    autoFitRef.current = false
    zoomAround(viewRef.current, factor, 0, 0)
    dirtyRef.current = true
  }

  return (
    <div className={styles.wrap}>
      <canvas ref={canvasRef} className={styles.canvas} />
      {hovered && (
        <div className={styles.hoverCard}>
          <div className={styles.hoverTitle}>{hovered.title}</div>
          <div className={styles.hoverMeta}>
            {hovered.degree} link{hovered.degree === 1 ? '' : 's'} · {hovered.sources} source{hovered.sources === 1 ? '' : 's'} · click to open
          </div>
        </div>
      )}
      <div className={styles.controls}>
        <button onClick={() => zoomBy(1.25)} aria-label="Zoom in">
          <ZoomIn size={16} />
        </button>
        <button onClick={() => zoomBy(0.8)} aria-label="Zoom out">
          <ZoomOut size={16} />
        </button>
        <button
          onClick={() => {
            fitView(canvasRef.current!, sim, viewRef.current)
            dirtyRef.current = true
          }}
          aria-label="Fit graph to view"
        >
          <Locate size={16} />
        </button>
      </div>
    </div>
  )
}

function zoomAround(view: View, factor: number, cx: number, cy: number): void {
  const k = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.k * factor))
  const applied = k / view.k
  view.x = cx - (cx - view.x) * applied
  view.y = cy - (cy - view.y) * applied
  view.k = k
}

function fitView(canvas: HTMLCanvasElement, sim: ForceSimulation, view: View): void {
  if (sim.nodes.length === 0) return
  const { width, height } = canvas.getBoundingClientRect()
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const n of sim.nodes) {
    x0 = Math.min(x0, n.x)
    y0 = Math.min(y0, n.y)
    x1 = Math.max(x1, n.x)
    y1 = Math.max(y1, n.y)
  }
  const padding = 60
  const k = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min((width - padding * 2) / Math.max(x1 - x0, 1), (height - padding * 2) / Math.max(y1 - y0, 1))))
  view.k = Math.min(k, 2)
  view.x = (-(x0 + x1) / 2) * view.k
  view.y = (-(y0 + y1) / 2) * view.k
}

function draw(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  sim: ForceSimulation,
  view: View,
  hover: SimNode | null,
  highlight: Set<string> | undefined
): void {
  const dpr = window.devicePixelRatio || 1
  const width = canvas.width / dpr
  const height = canvas.height / dpr
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, width, height)
  ctx.translate(width / 2 + view.x, height / 2 + view.y)
  ctx.scale(view.k, view.k)

  const focus = hover ? sim.neighboursOf(hover.id) : null
  const searching = highlight && highlight.size > 0
  const isLit = (node: SimNode): boolean =>
    hover ? node === hover || focus!.has(node.id) : searching ? highlight!.has(node.id) : true

  ctx.lineWidth = 1 / view.k
  for (const { source, target } of sim.links) {
    const active = hover !== null && (source === hover || target === hover)
    ctx.strokeStyle = active ? COLORS.edgeActive : hover || searching ? 'rgba(96, 165, 250, 0.06)' : COLORS.edge
    ctx.lineWidth = (active ? 1.6 : 1) / view.k
    ctx.beginPath()
    ctx.moveTo(source.x, source.y)
    ctx.lineTo(target.x, target.y)
    ctx.stroke()
  }

  const maxDegree = sim.nodes.reduce((m, n) => Math.max(m, n.degree), 1)
  for (const node of sim.nodes) {
    const r = radius(node)
    const lit = isLit(node)
    const hub = node.degree >= Math.max(3, maxDegree * 0.5)
    if (lit) {
      ctx.shadowColor = hub ? 'rgba(94, 224, 240, 0.9)' : 'rgba(58, 160, 232, 0.8)'
      ctx.shadowBlur = (node === hover ? 18 : 10) * Math.min(view.k, 1.5)
    }
    ctx.fillStyle = lit ? (hub ? COLORS.nodeHub : COLORS.node) : COLORS.nodeDim
    ctx.beginPath()
    ctx.arc(node.x, node.y, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0
    if (node === hover) {
      ctx.strokeStyle = COLORS.ring
      ctx.lineWidth = 1.5 / view.k
      ctx.stroke()
    }
  }

  // Labels: hubs always, everything when zoomed in, and the hovered neighbourhood.
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  const fontSize = 11 / Math.sqrt(view.k)
  ctx.font = `500 ${fontSize}px Inter, system-ui, sans-serif`
  for (const node of sim.nodes) {
    const lit = isLit(node)
    const show = (hover && lit) || (searching && lit) || view.k > 1.3 || node.degree >= Math.max(3, maxDegree * 0.4)
    if (!show) continue
    ctx.fillStyle = lit ? COLORS.label : COLORS.labelDim
    ctx.fillText(node.title, node.x, node.y + radius(node) + 3 / view.k)
  }
}
