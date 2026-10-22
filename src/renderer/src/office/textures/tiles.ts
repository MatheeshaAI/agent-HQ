// Procedural large-format stone tiles for the floor: colour and roughness maps drawn on canvases.
import * as THREE from 'three'
import { seededRandom } from './random'

/** Tiles per texture side; one texture repeat covers TILES_PER_TEXTURE * TILE_SIZE metres. */
export const TILES_PER_TEXTURE = 4
export const TILE_SIZE = 1.2
export const TILE_PERIOD = TILES_PER_TEXTURE * TILE_SIZE

const SIZE = 1024
const GROUT = 2

/** Tile textures repeated to cover a floor of `width` x `depth` metres. */
export function makeTileTextures(width: number, depth: number): { map: THREE.Texture; roughnessMap: THREE.Texture } {
  const rand = seededRandom(11)
  const color = document.createElement('canvas')
  const rough = document.createElement('canvas')
  color.width = color.height = rough.width = rough.height = SIZE
  const c = color.getContext('2d') as CanvasRenderingContext2D
  const r = rough.getContext('2d') as CanvasRenderingContext2D
  const cell = SIZE / TILES_PER_TEXTURE

  c.fillStyle = '#34373a' // thin, light seams
  c.fillRect(0, 0, SIZE, SIZE)
  r.fillStyle = '#d0d0d0'
  r.fillRect(0, 0, SIZE, SIZE)

  for (let ty = 0; ty < TILES_PER_TEXTURE; ty++) {
    for (let tx = 0; tx < TILES_PER_TEXTURE; tx++) {
      const x = tx * cell + GROUT / 2
      const y = ty * cell + GROUT / 2
      const w = cell - GROUT
      // Cool slate grey; the warm lights bring it back to neutral.
      const tone = 68 + rand() * 12
      const grad = c.createLinearGradient(x, y, x + w, y + w)
      grad.addColorStop(0, `rgb(${tone + 1},${tone + 5},${tone + 9})`)
      grad.addColorStop(1, `rgb(${tone - 5},${tone - 1},${tone + 3})`)
      c.fillStyle = grad
      c.fillRect(x, y, w, w)
      // Faint mottling only: the polished stone's variation comes from the reflections.
      for (let i = 0; i < 90; i++) {
        const px = x + rand() * w
        const py = y + rand() * w
        const rad = 4 + rand() * 26
        const shade = rand() < 0.5 ? 0 : 255
        c.fillStyle = `rgba(${shade},${shade},${shade},${0.006 + rand() * 0.01})`
        c.beginPath()
        c.arc(px, py, rad, 0, Math.PI * 2)
        c.fill()
      }
      // Roughness about 0.26-0.39: broad soft sheens rather than pinpoint highlights.
      const gloss = 66 + rand() * 34
      r.fillStyle = `rgb(${gloss},${gloss},${gloss})`
      r.fillRect(x, y, w, w)
      for (let i = 0; i < 60; i++) {
        const v = gloss + (rand() - 0.5) * 50
        r.fillStyle = `rgba(${v},${v},${v},0.25)`
        r.beginPath()
        r.arc(x + rand() * w, y + rand() * w, 10 + rand() * 40, 0, Math.PI * 2)
        r.fill()
      }
    }
  }

  const map = new THREE.CanvasTexture(color)
  map.colorSpace = THREE.SRGBColorSpace
  const roughnessMap = new THREE.CanvasTexture(rough)
  for (const t of [map, roughnessMap]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(width / TILE_PERIOD, depth / TILE_PERIOD)
    t.anisotropy = 8
  }
  return { map, roughnessMap }
}
