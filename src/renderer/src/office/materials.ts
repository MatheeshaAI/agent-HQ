// Shared materials for the office. Created once per scene so geometry across the room batches cleanly
// (see StaticBatch), and disposed with the scene.
import { createContext, useContext, useEffect, useMemo } from 'react'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { makeTileTextures } from './textures/tiles'
import { makeRugTexture } from './textures/rug'
import { makeWoodGrainTexture } from './textures/woodGrain'
import { ROOM } from './layout'

const WOOD_TEXTURES = {
  map: './textures/hardwood2_diffuse.jpg',
  bumpMap: './textures/hardwood2_bump.jpg',
  roughnessMap: './textures/hardwood2_roughness.jpg'
}

export interface OfficeMaterials {
  floor: { map: THREE.Texture; roughnessMap: THREE.Texture }
  /** The floor's stone tiles as a plain material (one texture repeat per TILE_PERIOD), for raised floors. */
  stoneFloor: THREE.MeshStandardMaterial
  walnut: THREE.MeshStandardMaterial
  darkWood: THREE.MeshStandardMaterial
  /** Dark walnut with a warm glow, for the back of the lit display shelving. */
  shelfGlow: THREE.MeshStandardMaterial
  deskTop: THREE.MeshStandardMaterial
  /** Black/charcoal desk carcass, modesty panel and dark drawer fronts. */
  deskBody: THREE.MeshStandardMaterial
  drawerWood: THREE.MeshStandardMaterial
  wallPanel: THREE.MeshStandardMaterial
  wallDark: THREE.MeshStandardMaterial
  /** Dark navy face of the neon sign. */
  signPanel: THREE.MeshStandardMaterial
  slabEdge: THREE.MeshStandardMaterial
  blackMetal: THREE.MeshStandardMaterial
  brushedMetal: THREE.MeshStandardMaterial
  plastic: THREE.MeshStandardMaterial
  fabric: THREE.MeshStandardMaterial
  leather: THREE.MeshStandardMaterial
  upholstery: THREE.MeshStandardMaterial
  sofa: THREE.MeshStandardMaterial
  rug: THREE.MeshStandardMaterial
  rugEdge: THREE.MeshStandardMaterial
  cabinetGrey: THREE.MeshStandardMaterial
  ceramic: THREE.MeshStandardMaterial
  stone: THREE.MeshStandardMaterial
  paper: THREE.MeshStandardMaterial
  bookBlue: THREE.MeshStandardMaterial
  bookTan: THREE.MeshStandardMaterial
  glass: THREE.MeshPhysicalMaterial
  tableGlass: THREE.MeshPhysicalMaterial
  warmLight: THREE.MeshBasicMaterial
  cyanLight: THREE.MeshBasicMaterial
  blueLight: THREE.MeshBasicMaterial
  greenLight: THREE.MeshBasicMaterial
  bezel: THREE.MeshStandardMaterial
  /** Tapered planter finishes: glossy black, charcoal, brushed silver. */
  pots: [THREE.MeshStandardMaterial, THREE.MeshStandardMaterial, THREE.MeshStandardMaterial]
  /** Dark top dressing inside the planters. */
  potTop: THREE.MeshStandardMaterial
  palmLeaf: THREE.MeshStandardMaterial
  tintedGlass: THREE.MeshBasicMaterial
  globeShade: THREE.MeshStandardMaterial
}

function woodTextures(
  base: Record<keyof typeof WOOD_TEXTURES, THREE.Texture>,
  repeat: number,
  rotate: boolean
): typeof base {
  const out = {} as typeof base
  for (const key of Object.keys(base) as (keyof typeof base)[]) {
    const t = base[key].clone()
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(repeat, repeat)
    if (rotate) t.rotation = Math.PI / 2
    t.anisotropy = 8
    t.needsUpdate = true
    out[key] = t
  }
  out.map.colorSpace = THREE.SRGBColorSpace
  return out
}

function tileOnce(texture: THREE.Texture): THREE.Texture {
  const t = texture.clone()
  t.repeat.set(1, 1)
  t.needsUpdate = true
  return t
}

export function useOfficeMaterials(): OfficeMaterials {
  const wood = useTexture(WOOD_TEXTURES)

  const materials = useMemo((): OfficeMaterials => {
    const grain = makeWoodGrainTexture()
    const panel = woodTextures(wood, 2, true)
    const floor = makeTileTextures(ROOM.width, ROOM.depth)
    const rug = makeRugTexture()
    // The rug's weave doubles as a subtle linen bump for the sofa.
    const linen = rug.clone()
    linen.repeat.set(3, 3)

    const std = (p: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial =>
      new THREE.MeshStandardMaterial(p)

    return {
      floor,
      stoneFloor: std({
        map: tileOnce(floor.map),
        roughnessMap: tileOnce(floor.roughnessMap),
        color: '#c4c8cc',
        metalness: 0.2
      }),
      walnut: std({ map: grain, color: '#8c7d72', roughness: 0.42 }),
      darkWood: std({ ...panel, color: '#3a2c22', roughness: 0.5, bumpScale: 0.15 }),
      shelfGlow: std({ color: '#3a2414', emissive: '#ff9a4a', emissiveIntensity: 0.35, roughness: 0.6 }),
      deskTop: std({ map: grain, color: '#e6d6c6', roughness: 0.38 }),
      deskBody: std({ color: '#151517', roughness: 0.5, metalness: 0.15 }),
      drawerWood: std({ map: grain, color: '#c8b098', roughness: 0.4 }),
      wallPanel: std({ color: '#222327', roughness: 0.62, metalness: 0.1 }),
      wallDark: std({ color: '#0b0c0e', roughness: 0.8 }),
      signPanel: std({ color: '#13213a', roughness: 0.45 }),
      slabEdge: std({ color: '#0d0e10', roughness: 0.35, metalness: 0.4 }),
      blackMetal: std({ color: '#111214', roughness: 0.32, metalness: 0.85 }),
      brushedMetal: std({ color: '#8d8f93', roughness: 0.3, metalness: 1 }),
      plastic: std({ color: '#1a1b1e', roughness: 0.45 }),
      fabric: std({ color: '#141518', roughness: 0.85 }),
      leather: std({ color: '#0e0f11', roughness: 0.4 }),
      upholstery: std({ color: '#3a3b3e', roughness: 0.95 }),
      sofa: std({ color: '#7d6b5a', roughness: 0.95, bumpMap: linen, bumpScale: 0.3 }),
      rug: std({ map: rug, color: '#5f6e86', roughness: 1 }),
      rugEdge: std({ color: '#3c3d40', roughness: 1 }),
      cabinetGrey: std({ color: '#8a7f74', roughness: 0.5 }),
      ceramic: std({ color: '#a9a59f', roughness: 0.25 }),
      stone: std({ color: '#b9b2a8', roughness: 0.3 }),
      paper: std({ color: '#8f8b84', roughness: 0.9 }),
      bookBlue: std({ color: '#2b4a6f', roughness: 0.7 }),
      bookTan: std({ color: '#b9b2a2', roughness: 0.7 }),
      glass: new THREE.MeshPhysicalMaterial({
        color: '#7f9fb8',
        roughness: 0.03,
        metalness: 0,
        transparent: true,
        opacity: 0.1,
        depthWrite: false,
        envMapIntensity: 0.5,
        clearcoat: 1,
        specularIntensity: 1,
        side: THREE.DoubleSide
      }),
      tableGlass: new THREE.MeshPhysicalMaterial({ color: '#121417', roughness: 0.08, metalness: 0.2, clearcoat: 1 }),
      warmLight: new THREE.MeshBasicMaterial({
        color: new THREE.Color('#ffc58a').multiplyScalar(3),
        toneMapped: false
      }),
      cyanLight: new THREE.MeshBasicMaterial({
        color: new THREE.Color('#38d4ff').multiplyScalar(5),
        toneMapped: false
      }),
      blueLight: new THREE.MeshBasicMaterial({
        color: new THREE.Color('#2f7dff').multiplyScalar(5),
        toneMapped: false
      }),
      greenLight: new THREE.MeshBasicMaterial({
        color: new THREE.Color('#2bff9a').multiplyScalar(3),
        toneMapped: false
      }),
      bezel: std({ color: '#08090a', roughness: 0.3, metalness: 0.5 }),
      pots: [
        std({ color: '#141518', roughness: 0.22, metalness: 0.3 }),
        std({ color: '#2a2b2e', roughness: 0.35 }),
        std({ color: '#8d8f93', roughness: 0.35, metalness: 0.9 })
      ],
      potTop: std({ color: '#121110', roughness: 0.95 }),
      palmLeaf: std({ color: '#2f5a24', emissive: '#0a1406', roughness: 0.55, side: THREE.DoubleSide }),
      tintedGlass: new THREE.MeshBasicMaterial({
        color: '#0f4a8a',
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
        side: THREE.DoubleSide
      }),
      globeShade: std({
        // Dark base colour: the shade glows by itself and barely reflects the bulb right next to it.
        color: '#2a2622',
        emissive: new THREE.Color('#ffd7a0'),
        emissiveIntensity: 0.9,
        roughness: 0.6,
        side: THREE.DoubleSide
      })
    }
  }, [wood])

  useEffect(() => () => disposeAll(materials), [materials])
  return materials
}

/** Disposes every material and the textures created for it (the loader's cached source textures stay). */
function disposeAll(materials: OfficeMaterials): void {
  const textures = new Set<THREE.Texture>([materials.floor.map, materials.floor.roughnessMap])
  for (const value of Object.values(materials).flat()) {
    if (!(value instanceof THREE.Material)) continue
    for (const prop of Object.values(value)) if (prop instanceof THREE.Texture) textures.add(prop)
    value.dispose()
  }
  textures.forEach((t) => t.dispose())
}

export const MaterialsContext = createContext<OfficeMaterials | null>(null)

/** Materials of the surrounding OfficeScene. */
export function useMat(): OfficeMaterials {
  const value = useContext(MaterialsContext)
  if (!value) throw new Error('useMat() must be used inside <MaterialsContext.Provider>')
  return value
}
