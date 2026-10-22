// World layout of the office, in metres.
// The back corner of the room is the origin. The left wall stands on the plane x = 0 and runs along +z
// (towards the lower-left of the screen); the right wall stands on z = 0 and runs along +x (lower-right).
// The camera looks at the back corner from the +x/+z diagonal, like the reference image.
import type { AgentId } from '@shared/types'

export type Vec2 = readonly [x: number, z: number]
export type Vec3 = readonly [x: number, y: number, z: number]

export const ROOM = {
  width: 19.0, // along x (right wall)
  depth: 17.7, // along z (left wall)
  /** Both back walls; the lower 3.1-3.4 m carries the fittings, the rest is a dark upper band. */
  wallHeight: 4.6,
  slabThickness: 0.45
} as const

/** Fitted to the reference with scripts/office-preview/fit_camera.py. */
export const CAMERA = {
  fov: 22,
  target: [9.07, 0.12, 7.2] as Vec3,
  /** Degrees around +y, measured from +z towards +x. */
  yaw: 41.4,
  /** Degrees above the horizon. */
  elevation: 27,
  distance: 35.7
} as const

/** Direction a seated agent faces; everyone looks towards the left wall (-x), like the reference. */
export const FACING = -Math.PI / 2

export interface DeskSpot {
  /** Floor position of the desk centre. */
  at: Vec2
  /** Rotation around y; 0 means the user sits on +x and faces -x. */
  rotation: number
  agent?: AgentId
  monitors: 1 | 2 | 3
}

export const DESKS: DeskSpot[] = [
  { at: [4.8, 8.8], rotation: 0, agent: 'pip', monitors: 2 },
  { at: [4.8, 7.2], rotation: 0, monitors: 1 },
  { at: [4.7, 2.6], rotation: 0, agent: 'sage', monitors: 2 },
  { at: [7.0, 5.75], rotation: 0, agent: 'rex', monitors: 2 },
  { at: [7.0, 4.15], rotation: 0, monitors: 1 },
  { at: [12.45, 5.2], rotation: 0, agent: 'nova', monitors: 2 },
  { at: [12.45, 3.6], rotation: 0, monitors: 2 },
  { at: [11.6, 10.4], rotation: 0, agent: 'axel', monitors: 2 },
  { at: [11.6, 12.0], rotation: 0, monitors: 1 },
  { at: [16.0, 7.95], rotation: 0, agent: 'muse', monitors: 1 }
]

/** Seat offset from the desk centre, in the desk's local frame. */
export const SEAT_OFFSET = 0.78

export const PLANTS: { at: Vec2; scale: number }[] = [
  { at: [1.0, 12.4], scale: 1.3 },
  { at: [3.3, 9.9], scale: 0.8 },
  { at: [6.3, 10.0], scale: 0.9 },
  { at: [8.4, 8.6], scale: 1.0 },
  { at: [8.7, 6.6], scale: 0.9 },
  { at: [9.0, 1.0], scale: 1.4 },
  { at: [5.8, 1.0], scale: 0.9 },
  { at: [10.5, 3.0], scale: 1.1 },
  { at: [11.0, 7.0], scale: 0.9 },
  { at: [14.4, 9.8], scale: 1.4 },
  { at: [14.2, 6.4], scale: 1.1 },
  { at: [17.6, 9.6], scale: 1.1 },
  { at: [18.3, 3.0], scale: 0.9 },
  { at: [13.0, 0.8], scale: 1.0 },
  { at: [17.0, 1.0], scale: 1.0 },
  { at: [12.4, 14.0], scale: 0.8 },
  { at: [2.9, 15.0], scale: 1.2 },
  { at: [2.8, 17.0], scale: 1.1 },
  { at: [0.7, 13.4], scale: 1.0 },
  { at: [7.8, 1.2], scale: 0.8 },
  { at: [9.6, 5.6], scale: 0.75 },
  { at: [14.6, 2.0], scale: 1.2 },
  { at: [18.4, 7.4], scale: 1.0 },
  { at: [17.9, 12.2], scale: 0.9 },
  { at: [10.2, 12.6], scale: 0.9 }
]

export const MEETING_ROOM = {
  min: [2.2, 14.4] as Vec2,
  max: [11.4, 17.7] as Vec2,
  height: 2.5
} as const

export const LOUNGE = {
  rug: { at: [15.3, 12.4] as Vec2, size: [4.0, 4.4] as Vec2 },
  sofa: { at: [14.2, 12.3] as Vec2 },
  table: { at: [15.45, 12.2] as Vec2 },
  lamps: [
    [16.7, 10.9],
    [15.85, 2.4]
  ] as Vec2[]
} as const

/** Wall screens on the right wall (z = 0): x range, bottom and top heights. */
export const WALL_SCREENS = {
  graph: { x: [9.6, 14.2] as Vec2, y: [0.9, 2.9] as Vec2 },
  panels: [
    { x: [5.0, 5.9] as Vec2, y: [1.3, 3.0] as Vec2, kind: 'code' as const },
    { x: [7.3, 8.1] as Vec2, y: [1.0, 2.5] as Vec2, kind: 'media' as const },
    { x: [8.3, 8.7] as Vec2, y: [0.8, 1.4] as Vec2, kind: 'media' as const },
    { x: [15.5, 16.3] as Vec2, y: [0.9, 2.8] as Vec2, kind: 'log' as const },
    { x: [2.4, 3.1] as Vec2, y: [1.3, 2.8] as Vec2, kind: 'log' as const },
    { x: [6.3, 6.9] as Vec2, y: [1.2, 2.6] as Vec2, kind: 'code' as const },
    { x: [16.8, 17.4] as Vec2, y: [1.4, 2.2] as Vec2, kind: 'media' as const }
  ]
} as const

export const BOOKSHELVES: { at: Vec2; rotation: number; width: number; height: number }[] = [
  { at: [1.0, 0.02], rotation: 0, width: 1.6, height: 2.7 },
  { at: [17.9, 4.9], rotation: 0, width: 1.4, height: 2.0 }
]

/** Ceiling downlights (not modelled; the room is a cutaway) that pool warm light on the floor. */
export const DOWNLIGHTS: Vec2[] = [
  [5.6, 8.8],
  [7.8, 5.7],
  [5.5, 2.6],
  [13.2, 5.0],
  [12.4, 10.4],
  [16.8, 8.0],
  [15.3, 12.4],
  [9.8, 8.0],
  [10.5, 2.5],
  [16.5, 3.0],
  [3.4, 16.1],
  [8.2, 16.1]
]

/** Dark rugs under the desk clusters: centre and size (x, z). */
export const RUGS: { at: Vec2; size: Vec2 }[] = [
  { at: [7.4, 4.95], size: [2.6, 3.9] },
  { at: [12.85, 4.4], size: [2.6, 3.9] },
  { at: [12.0, 11.2], size: [2.6, 3.9] }
]
