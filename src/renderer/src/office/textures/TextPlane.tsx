// Flat glowing text (signage) drawn on a canvas and shown on a plane. Avoids troika's worker,
// which the app's CSP blocks, and lets the glow be painted into the texture itself.
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { loadInter } from '../fonts'

export interface TextLine {
  text: string
  /** Font size as a fraction of the plane height. */
  size: number
  /** Vertical centre as a fraction of the plane height, from the top. */
  y: number
  weight?: 500 | 600 | 700
  /** Extra spacing between letters, in em. */
  tracking?: number
  color: string
  glow?: string
}

interface TextPlaneProps {
  lines: TextLine[]
  width: number
  height: number
  /** Brightness multiplier; values above 1 feed the bloom pass. */
  intensity?: number
  pixelsPerMetre?: number
  position?: [number, number, number]
  rotation?: [number, number, number]
}

function draw(canvas: HTMLCanvasElement, lines: TextLine[]): void {
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const line of lines) {
    const px = line.size * canvas.height
    ctx.font = `${line.weight ?? 600} ${px}px Inter, system-ui, sans-serif`
    ctx.letterSpacing = `${(line.tracking ?? 0) * px}px`
    const y = line.y * canvas.height
    if (line.glow) {
      ctx.shadowColor = line.glow
      ctx.shadowBlur = px * 0.2
    }
    ctx.fillStyle = line.color
    ctx.fillText(line.text, canvas.width / 2, y)
    ctx.shadowBlur = 0
  }
}

export default function TextPlane({
  lines,
  width,
  height,
  intensity = 1,
  pixelsPerMetre = 512,
  position,
  rotation
}: TextPlaneProps): JSX.Element {
  const { canvas, material } = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(width * pixelsPerMetre)
    canvas.height = Math.round(height * pixelsPerMetre)
    const map = new THREE.CanvasTexture(canvas)
    map.colorSpace = THREE.SRGBColorSpace
    map.anisotropy = 8
    const material = new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, toneMapped: false })
    material.color.setScalar(intensity)
    return { canvas, material }
  }, [width, height, pixelsPerMetre, intensity])

  useEffect(() => {
    let live = true
    draw(canvas, lines)
    ;(material.map as THREE.Texture).needsUpdate = true
    loadInter().then(() => {
      if (!live) return
      draw(canvas, lines)
      ;(material.map as THREE.Texture).needsUpdate = true
    })
    return () => {
      live = false
    }
  }, [canvas, material, lines])

  useEffect(
    () => () => {
      material.map?.dispose()
      material.dispose()
    },
    [material]
  )

  return (
    <mesh position={position} rotation={rotation} material={material}>
      <planeGeometry args={[width, height]} />
    </mesh>
  )
}
