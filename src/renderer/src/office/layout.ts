// World layout of the office, in metres.
// The back corner of the room is the origin. The left wall stands on the plane x = 0 and runs along +z
// (towards the lower-left of the screen); the right wall stands on z = 0 and runs along +x (lower-right).
// The camera looks at the back corner from the +x/+z diagonal, like the reference image.
import type { AgentId } from '@shared/types'

export type Vec2 = readonly [x: number, z: number]
export type Vec3 = readonly [x: number, y: number, z: number]

export const ROOM = {
  width: 16.5, // along x (right wall)
  depth: 15.4, // along z (left wall)
  /** Both back walls; the fittings stay below the black-metal cap at CAP_HEIGHT, a dark band runs above it into the dark. */
  wallHeight: 5.0,
  slabThickness: 0.45
} as const

/** Height of the black-metal cap line on both walls. */
export const CAP_HEIGHT = 3.4

/** The left wall is only built (and seen) up to here; past it the room opens into the dark. */
export const LEFT_WALL_END = 8.1

/**
 * Near-orthographic view fitted to the reference's structural lines (back corner, front corner, slab edge,
 * left-wall base) and the seated heads with scripts/office-preview/fit_camera.py.
 */
export const CAMERA = {
  fov: 10,
  target: [9.06, 1.11, 7.37] as Vec3,
  /** Degrees around +y, measured from +z towards +x. */
  yaw: 42.6,
  /** Degrees above the horizon. */
  elevation: 19.6,
  distance: 63.7
} as const

/** Direction a seated person faces; everyone looks towards the left wall (-x), like the reference. */
export const FACING = -Math.PI / 2

export interface DeskSpot {
  /** Floor position of the desk centre. */
  at: Vec2
  /** Rotation around y; 0 means the user sits on +x and faces -x. */
  rotation: number
  /** The agent working here, or `staff` for a non-interactive colleague. */
  agent?: AgentId
  staff?: true
  monitors: 1 | 2 | 3
  /** Desk length along its local z (default DESK.length). */
  length?: number
  /** Where the workplace (seat, monitors, keyboard) sits along the desk, local z from the centre. */
  seat?: number
  /** Which end (+1 / -1 local z) carries a small potted plant. */
  plant?: 1 | -1
}

// Pairs of desks abut into one long bench, with their two people sitting towards the middle, like the reference.
export const DESKS: DeskSpot[] = [
  { at: [3.65, 8.7], rotation: 0, agent: 'pip', monitors: 2, length: 2.4, seat: -0.5, plant: 1 },
  { at: [3.0, 2.0], rotation: 0, agent: 'sage', monitors: 2, plant: 1 },
  { at: [6.55, 5.9], rotation: 0, agent: 'rex', monitors: 3, length: 2.4, seat: -0.45, plant: 1 },
  { at: [10.5, 4.85], rotation: 0, agent: 'nova', monitors: 2, seat: -0.4, plant: 1 },
  { at: [10.5, 3.05], rotation: 0, agent: 'chief', monitors: 2, seat: 0.4, plant: -1 },
  { at: [10.85, 11.2], rotation: 0, agent: 'axel', monitors: 2, seat: -0.3, plant: 1 },
  { at: [10.85, 9.4], rotation: 0, staff: true, monitors: 1, seat: 0.35, plant: -1 },
  { at: [14.85, 8.35], rotation: 0, agent: 'muse', monitors: 1, plant: 1 }
]

/** Seat offset from the desk centre (local +x), in the desk's local frame. */
export const SEAT_OFFSET = 0.85

/** Desk-top height (shared by the desks and the plants standing on them). */
export const DESK_TOP = 0.76

export interface PlantSpot {
  at: Vec2
  scale: number
  /** Height of the pot's base above the floor (on a desk or a table). */
  y?: number
  /**
   * 'palm' (default): tall arching palm in a tapered floor planter.
   * 'rubber': broad-leaved accent plant. 'small': little leafy plant in a ceramic pot, for furniture tops.
   */
  kind?: 'palm' | 'rubber' | 'small'
}

const FLOOR_PLANTS: PlantSpot[] = [
  { at: [0.8, 8.9], scale: 1.3 }, // at the left wall's lit end pilaster
  { at: [2.0, 0.8], scale: 1.2 }, // between the kitchen and Sage
  { at: [4.8, 0.6], scale: 1.1 },
  { at: [9.0, 1.0], scale: 1.0 },
  { at: [12.1, 13.1], scale: 0.9 }, // by the meeting room's back-right corner
  { at: [13.4, 7.3], scale: 1.2 }, // in front of Muse's desk
  { at: [16.0, 2.6], scale: 1.0 },
  { at: [16.0, 9.6], scale: 1.0 },
  { at: [5.2, 7.2], scale: 1.15 }, // between Pip and Rex
  { at: [12.9, 1.2], scale: 1.1 }, // beside Nova along the right wall
  { at: [11.8, 7.75], scale: 1.25 }, // tall palm between Axel and Muse
  { at: [16.1, 5.3], scale: 0.85 }, // beside the low bookcase
  { at: [8.3, 9.9], scale: 0.9 },
  { at: [7.1, 15.8], scale: 1.1 }, // inside the meeting room, by the front glass
  { at: [6.6, 14.6], scale: 1.0 },
  { at: [5.3, 5.0], kind: 'rubber', scale: 0.9 },
  { at: [8.9, 6.9], kind: 'rubber', scale: 0.8 },
  { at: [6.9, 0.7], kind: 'rubber', scale: 0.9 },
  { at: [0.75, 1.45], scale: 1.25 }, // between the tall bookcase and the kitchenette, under the sign's end
  { at: [8.6, 2.6], scale: 0.95 }, // at the near end of Nova's desks
  { at: [14.3, 5.0], scale: 0.85 }, // beside the low bookcase
  { at: [12.7, 14.3], kind: 'rubber', scale: 0.7 } // outside the meeting room's front corner
]

/** A small plant on the far end of each desk that asks for one (room-local coordinates). */
function deskPlants(desks: DeskSpot[]): PlantSpot[] {
  return desks.flatMap((d) => {
    if (!d.plant) return []
    const half = (d.length ?? 1.8) / 2
    return [
      { at: [d.at[0] - 0.2, d.at[1] + d.plant * (half - 0.2)] as Vec2, y: DESK_TOP, kind: 'small' as const, scale: 0.42 }
    ]
  })
}

const DESK_PLANTS: PlantSpot[] = deskPlants(DESKS)

export const MEETING_ROOM = {
  // The room stands on a slab extension that juts 1 m past the main floor's front edge, like the reference.
  min: [1.4, 13.0] as Vec2,
  max: [11.6, 16.4] as Vec2,
  height: 1.95,
  /** The room stands on a low plinth. */
  plinth: 0.12,
  /** Centre of the meeting table, which runs along z. */
  table: [8.8, 14.6] as Vec2
} as const

export const LOUNGE = {
  rug: { at: [15.0, 12.1] as Vec2, size: [3.2, 3.4] as Vec2 },
  sofa: { at: [14.0, 11.6] as Vec2 },
  table: { at: [15.25, 12.2] as Vec2 },
  lamps: [
    [15.6, 10.6],
    [12.9, 1.9]
  ] as Vec2[]
} as const

const TABLE_PLANTS: PlantSpot[] = [
  { at: [LOUNGE.table.at[0], LOUNGE.table.at[1] - 0.3], y: 0.42, kind: 'small', scale: 0.32 },
  { at: [MEETING_ROOM.table[0], MEETING_ROOM.table[1]], y: MEETING_ROOM.plinth + 0.77, kind: 'small', scale: 0.3 }
]

export const PLANTS: PlantSpot[] = [...FLOOR_PLANTS, ...DESK_PLANTS, ...TABLE_PLANTS]

/** Wall screens on the right wall (z = 0): x range, bottom and top heights. */
export const WALL_SCREENS = {
  graph: { x: [7.0, 11.4] as Vec2, y: [0.55, 2.8] as Vec2 },
  panels: [
    { x: [4.15, 5.15] as Vec2, y: [1.25, 2.9] as Vec2, kind: 'code' as const },
    { x: [5.8, 6.7] as Vec2, y: [1.05, 2.55] as Vec2, kind: 'media' as const },
    { x: [11.7, 12.55] as Vec2, y: [0.45, 1.65] as Vec2, kind: 'log' as const },
    { x: [1.7, 2.4] as Vec2, y: [1.4, 2.95] as Vec2, kind: 'log' as const },
    { x: [2.5, 3.2] as Vec2, y: [1.3, 2.8] as Vec2, kind: 'code' as const }
  ]
} as const

export interface BookshelfSpot {
  /** Floor position of the bookcase's back centre. */
  at: Vec2
  /** Rotation around y; at 0 the books face +z. */
  rotation: number
  width: number
  height: number
  /** Number of vertical bays (default 1). */
  bays?: number
  /** A warm table lamp on top. */
  lamp?: boolean
}

export const BOOKSHELVES: BookshelfSpot[] = [
  { at: [0.85, 0.02], rotation: 0, width: 1.6, height: CAP_HEIGHT - 0.05 },
  { at: [15.7, 5.4], rotation: 0, width: 1.6, height: 1.5, bays: 2, lamp: true }
]

/** Ceiling downlights (not modelled; the room is a cutaway) that pool warm light on the floor. */
export const DOWNLIGHTS: { at: Vec2; shadow?: true; dim?: true }[] = [
  { at: [4.3, 8.3], shadow: true }, // Pip
  { at: [7.2, 5.6], shadow: true }, // Rex
  { at: [11.2, 3.9], shadow: true }, // Nova pair
  { at: [11.5, 10.3], shadow: true }, // Axel pair
  { at: [15.4, 8.35], shadow: true }, // Muse
  { at: [14.8, 12.0], shadow: true }, // lounge
  { at: [3.6, 2.0] }, // Sage
  { at: [8.6, 7.8] },
  { at: [9.0, 2.2] },
  { at: [14.2, 3.0] },
  { at: [7.4, 14.6], dim: true }, // meeting room: softer, so the table runner doesn't blow out
  { at: [10.0, 14.6], dim: true }
]

/** Dark rugs under the desk clusters: centre and size (x, z). */
export const RUGS: { at: Vec2; size: Vec2 }[] = [
  { at: [4.3, 8.5], size: [2.6, 3.0] },
  { at: [7.2, 5.7], size: [2.6, 3.0] },
  { at: [11.0, 3.95], size: [2.8, 4.2] },
  { at: [11.35, 10.2], size: [2.8, 3.8] },
  { at: [15.2, 8.35], size: [2.3, 2.6] }
]

// ---------------------------------------------------------------------------------------------------------------
// Three rooms side by side. The brain room (offset 0) keeps the exports above; the others are built from the same
// pieces and stand along +x with a dividing wall and doorway between each pair. Room-local coordinates use the
// brain room's conventions (origin at the back corner, right wall on z = 0).
// ---------------------------------------------------------------------------------------------------------------

export type RoomId = 'brain' | 'office' | 'personal'

/** Corridor between neighbouring rooms; the dividing wall stands in its middle. */
export const ROOM_GAP = 2
/** Doorway in each dividing wall, along z (room-local). */
export const DOOR = { z0: 5.2, z1: 7.2, top: 2.6 } as const
const ROOM_STEP = ROOM.width + ROOM_GAP

export interface RoomSpec {
  id: RoomId
  name: string
  /** World x of the room's back corner. */
  offset: number
  /** Desks in room-local coordinates. */
  desks: DeskSpot[]
  /** Plants in room-local coordinates, desk plants included. */
  plants: PlantSpot[]
  /** Sign on the back wall, and its glow colour. */
  sign?: { text: string; color: string; x: number; width: number }
  /** Cool or warm tint for the room's light pools and LED cove. */
  tint: string
  /** Room-local tables, shelves and other fittings the room adds (the brain room's own fittings are the exports above). */
  table?: { at: Vec2; length: number; width: number; rug: Vec2 }
  whiteboard?: { x0: number; x1: number }
  bookshelves: BookshelfSpot[]
  /** Pools of light over the desks (room-local). */
  pools: Vec2[]
}

const OFFICE_DESKS: DeskSpot[] = [
  { at: [3.6, 4.2], rotation: 0, agent: 'scribe', monitors: 2, plant: 1 },
  { at: [3.6, 8.6], rotation: 0, agent: 'triager', monitors: 2, plant: 1 }
]

const PERSONAL_DESKS: DeskSpot[] = [
  { at: [3.6, 4.2], rotation: 0, agent: 'journal', monitors: 1, plant: 1 },
  { at: [3.6, 8.6], rotation: 0, agent: 'curator', monitors: 2, plant: 1 }
]

const OFFICE_PLANTS: PlantSpot[] = [
  { at: [1.2, 13.6], scale: 1.0 },
  { at: [15.2, 13.6], scale: 0.9 },
  { at: [14.9, 6.2], kind: 'rubber', scale: 0.9 },
  { at: [0.8, 6.4], scale: 1.1 }
]

const PERSONAL_PLANTS: PlantSpot[] = [
  { at: [1.0, 13.6], scale: 1.1 },
  { at: [6.2, 13.4], kind: 'rubber', scale: 0.9 },
  { at: [12.6, 1.1], scale: 0.95 },
  { at: [10.2, 13.6], scale: 1.0 }
]

/** Brain room's own fittings keep their existing lists, so its plants and bookcases are unchanged. */
export const ROOMS: RoomSpec[] = [
  {
    id: 'brain',
    name: 'Brain',
    offset: 0,
    desks: DESKS,
    plants: PLANTS,
    tint: '#ffc890',
    bookshelves: BOOKSHELVES,
    pools: []
  },
  {
    id: 'office',
    name: 'Office',
    offset: ROOM_STEP,
    desks: OFFICE_DESKS,
    plants: [...OFFICE_PLANTS, ...deskPlants(OFFICE_DESKS)],
    sign: { text: 'Office work', color: '#8fb4e8', x: 6.6, width: 4.6 },
    tint: '#b9d2f2',
    // Well clear of the dividing wall (local x -1) and its doorway: the table sits in the open front-right floor.
    table: { at: [10.8, 10.4], length: 4.2, width: 1.5, rug: [10.8, 10.4] },
    whiteboard: { x0: 11.2, x1: 15.4 },
    bookshelves: [],
    pools: [
      [4.4, 4.2],
      [4.4, 8.6],
      [9.6, 3.4],
      [13.8, 3.6],
      [10.8, 10.4],
      [14.2, 9.6]
    ]
  },
  {
    id: 'personal',
    name: 'Personal',
    offset: 2 * ROOM_STEP,
    desks: PERSONAL_DESKS,
    plants: [...PERSONAL_PLANTS, ...deskPlants(PERSONAL_DESKS)],
    sign: { text: 'Personal work', color: '#e8926a', x: 6.6, width: 5.2 },
    tint: '#ffb27a',
    bookshelves: [{ at: [14.6, 0.02], rotation: 0, width: 1.6, height: 2.2, bays: 2, lamp: true }],
    pools: [
      [4.4, 4.2],
      [4.4, 8.6],
      [9.4, 3.4],
      [13.4, 3.8],
      [9.6, 10.6],
      [14.8, 9.2]
    ]
  }
]

/** Offsets a room-local point into the world. */
export function inRoom(room: Pick<RoomSpec, 'offset'>, at: Vec2): Vec2 {
  return [at[0] + room.offset, at[1]]
}

/** A room's desks in world coordinates. */
export function worldDesks(room: RoomSpec): DeskSpot[] {
  return room.desks.map((d) => ({ ...d, at: inRoom(room, d.at) }))
}

/** A room's plants in world coordinates. */
export function worldPlants(room: RoomSpec): PlantSpot[] {
  return room.plants.map((p) => ({ ...p, at: inRoom(room, p.at) }))
}

/** Every desk in every room, in world coordinates. The brain room's desks come first, so its indices are unchanged. */
export const ALL_DESKS: DeskSpot[] = ROOMS.flatMap(worldDesks)

/** Furthest x of the office: the boundary for panning and the all-rooms view. */
export const WORLD_WIDTH = ROOMS[ROOMS.length - 1].offset + ROOM.width

/** Height of the centre of a room sign on the back wall (below the black cap at CAP_HEIGHT). */
export const ROOM_SIGN_Y = 2.92

