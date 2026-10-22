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
  walnut: THREE.MeshStandardMaterial
  darkWood: THREE.MeshStandardMaterial
  drawerWood: THREE.MeshStandardMaterial
  wallPanel: THREE.MeshStandardMaterial
  wallDark: THREE.MeshStandardMaterial
  slabEdge: THREE.MeshStandardMaterial
  blackMetal: THREE.MeshStandardMaterial
  brushedMetal: THREE.MeshStandardMaterial
  plastic: THREE.MeshStandardMaterial
  fabric: THREE.MeshStandardMaterial
  sofa: THREE.MeshStandardMaterial
  rug: THREE.MeshStandardMaterial
  cabinetWhite: THREE.MeshStandardMaterial
  cabinetGrey: THREE.MeshStandardMaterial
  paper: THREE.MeshStandardMaterial
  glass: THREE.MeshPhysicalMaterial
  tableGlass: THREE.MeshPhysicalMaterial
  warmLight: THREE.MeshBasicMaterial
  cyanLight: THREE.MeshBasicMaterial
  blueLight: THREE.MeshBasicMaterial
  bezel: THREE.MeshStandardMaterial
  potConcrete: THREE.MeshStandardMaterial
  potCharcoal: THREE.MeshStandardMaterial
  tintedGlass: THREE.MeshBasicMaterial
  globeShade: THREE.MeshStandardMaterial
}

function woodTextures(base: Record<keyof typeof WOOD_TEXTURES, THREE.Texture>, repeat: number, rotate: boolean): typeof base {
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

export function useOfficeMaterials(): OfficeMaterials {
  const wood = useTexture(WOOD_TEXTURES)

  const materials = useMemo((): OfficeMaterials => {
    const grain = makeWoodGrainTexture()
    const panel = woodTextures(wood, 2, true)
    const floor = makeTileTextures(ROOM.width, ROOM.depth)

    const std = (p: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial => new THREE.MeshStandardMaterial(p)

    return {
      floor,
      walnut: std({ map: grain, color: '#8c7d72', roughness: 0.42 }),
      darkWood: std({ ...panel, color: '#2c2420', roughness: 0.7, bumpScale: 0.6 }),
      drawerWood: std({ map: grain, color: '#c49a78', roughness: 0.4 }),
      wallPanel: std({ color: '#17181b', roughness: 0.62, metalness: 0.1 }),
      wallDark: std({ color: '#0b0c0e', roughness: 0.8 }),
      slabEdge: std({ color: '#0d0e10', roughness: 0.35, metalness: 0.4 }),
      blackMetal: std({ color: '#111214', roughness: 0.32, metalness: 0.85 }),
      brushedMetal: std({ color: '#8d8f93', roughness: 0.3, metalness: 1 }),
      plastic: std({ color: '#1a1b1e', roughness: 0.45 }),
      fabric: std({ color: '#141518', roughness: 0.85 }),
      sofa: std({ color: '#a39a8c', roughness: 0.92 }),
      rug: std({ map: makeRugTexture(), color: '#77777a', roughness: 1 }),
      cabinetWhite: std({ color: '#cfccc6', roughness: 0.35 }),
      cabinetGrey: std({ color: '#7d7872', roughness: 0.45 }),
      paper: std({ color: '#9d9a94', roughness: 0.9 }),
      glass: new THREE.MeshPhysicalMaterial({
        color: '#6f8aa6',
        roughness: 0.05,
        metalness: 0,
        transparent: true,
        opacity: 0.07,
        depthWrite: false,
        envMapIntensity: 0.15,
        side: THREE.DoubleSide
      }),
      tableGlass: new THREE.MeshPhysicalMaterial({ color: '#121417', roughness: 0.08, metalness: 0.2, clearcoat: 1 }),
      warmLight: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc58a').multiplyScalar(4), toneMapped: false }),
      cyanLight: new THREE.MeshBasicMaterial({ color: new THREE.Color('#38d4ff').multiplyScalar(5), toneMapped: false }),
      blueLight: new THREE.MeshBasicMaterial({ color: new THREE.Color('#2f7dff').multiplyScalar(5), toneMapped: false }),
      bezel: std({ color: '#08090a', roughness: 0.3, metalness: 0.5 }),
      potConcrete: std({ color: '#6c6b68', roughness: 0.7 }),
      potCharcoal: std({ color: '#2a2b2e', roughness: 0.4, metalness: 0.1 }),
      tintedGlass: new THREE.MeshBasicMaterial({
        color: '#0d3a6e',
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        side: THREE.DoubleSide
      }),
      globeShade: std({ color: '#fff3e0', emissive: new THREE.Color('#ffd7a0'), emissiveIntensity: 3.2, roughness: 0.6 })
    }
  }, [wood])

  useEffect(() => () => disposeAll(materials), [materials])
  return materials
}

/** Disposes every material and the textures created for it (the loader's cached source textures stay). */
function disposeAll(materials: OfficeMaterials): void {
  const textures = new Set<THREE.Texture>([materials.floor.map, materials.floor.roughnessMap])
  for (const value of Object.values(materials)) {
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
