// Walking routes between the agents' desks. Everything is in world metres on the floor plane (x, z).
// A trip is: seat -> side step -> own aisle spot -> leg -> the target's aisle spot, and the same backwards to return.
// The leg waypoints were planned by `node scripts/routes.mjs --plan` around the obstacles below and are
// checked by `node scripts/routes.mjs` (run it after moving furniture).
import type { AgentId } from '@shared/types'
import { ALL_DESKS, BOOKSHELVES, LOUNGE, MEETING_ROOM, PLANTS, ROOM, SEAT_OFFSET, type DeskSpot, type Vec2 } from './layout'

/** Floor position of the seat at a desk (the desks all face -x, so the sitter's back is towards +x). */
export function seatOf(desk: DeskSpot): [number, number] {
  const s = Math.sin(desk.rotation)
  const c = Math.cos(desk.rotation)
  const shift = desk.seat ?? 0
  return [desk.at[0] + c * SEAT_OFFSET + s * shift, desk.at[1] - s * SEAT_OFFSET + c * shift]
}

/** Seat of every agent with a desk, in any room (world coordinates). */
export const SEATS = Object.fromEntries(ALL_DESKS.filter((d) => d.agent).map((d) => [d.agent, seatOf(d)])) as Record<AgentId, Vec2>

/** Where a visitor stands to talk to an agent: in the aisle behind its chair, about a metre from the seat. */
export const AISLES: Record<AgentId, Vec2> = {
  pip: [5.55, 8.2],
  sage: [4.9, 2.0],
  rex: [8.6, 5.2],
  nova: [12.4, 4.45],
  axel: [12.75, 10.9],
  muse: [15.6, 7.0]
}

/** Which way each agent steps out of its chair before heading for the aisle (+1 = towards +z). */
export const SIDE_STEP: Record<AgentId, 1 | -1> = { pip: 1, sage: 1, rex: -1, nova: 1, axel: 1, muse: -1 }

/** How far to the side the chair is cleared. */
export const SIDE_STEP_DISTANCE = 0.75

/** Work flows along this order; an agent that finishes walks over to the next one still working. */
export const PIPELINE: AgentId[] = ['pip', 'sage', 'rex', 'nova', 'muse', 'axel']

/** Planned waypoints from one aisle spot to the next, keyed `from>to` (the way back is the reverse). */
export const LEGS: Record<string, Vec2[]> = {
  'pip>sage': [
    [7.8, 7.2],
    [8.5, 4.3]
  ],
  'sage>rex': [],
  'rex>nova': [
    [10.6, 6.7],
    [12.6, 4.7]
  ],
  'nova>muse': [[15, 6.6]],
  'muse>axel': [
    [12.3, 6],
    [9.3, 8.9],
    [10, 12.5],
    [11.5, 12.5]
  ]
}

export type Obstacle =
  | { kind: 'rect'; x0: number; z0: number; x1: number; z1: number }
  | { kind: 'circle'; x: number; z: number; r: number }

/** Everything on the floor an agent must not walk into (before the body radius is added). */
export function obstacles(): Obstacle[] {
  const list: Obstacle[] = []
  for (const d of ALL_DESKS) {
    const half = (d.length ?? 1.8) / 2
    list.push({ kind: 'rect', x0: d.at[0] - 0.46, z0: d.at[1] - half, x1: d.at[0] + 0.46, z1: d.at[1] + half })
    const [sx, sz] = seatOf(d)
    list.push({ kind: 'circle', x: sx, z: sz, r: 0.4 })
  }
  for (const p of PLANTS) {
    if (p.y === undefined) list.push({ kind: 'circle', x: p.at[0], z: p.at[1], r: 0.3 * p.scale + 0.12 })
  }
  for (const b of BOOKSHELVES) {
    list.push({ kind: 'rect', x0: b.at[0] - b.width / 2, z0: b.at[1], x1: b.at[0] + b.width / 2, z1: b.at[1] + 0.45 })
  }
  const { sofa, table, lamps } = LOUNGE
  list.push({ kind: 'rect', x0: sofa.at[0] - 0.46, z0: sofa.at[1] - 1.35, x1: sofa.at[0] + 0.46, z1: sofa.at[1] + 1.35 })
  list.push({ kind: 'rect', x0: table.at[0] - 0.45, z0: table.at[1] - 0.3, x1: table.at[0] + 0.45, z1: table.at[1] + 0.3 })
  for (const l of lamps) list.push({ kind: 'circle', x: l[0], z: l[1], r: 0.2 })
  const { min, max } = MEETING_ROOM
  list.push({ kind: 'rect', x0: min[0], z0: min[1], x1: max[0], z1: max[1] })
  list.push({ kind: 'rect', x0: 1.4 - 0.3, z0: 3.3 - 0.1, x1: 1.9 + 0.3, z1: 3.7 + 0.3 }) // bench by the kitchenette (1.6, 3.5)
  list.push({ kind: 'rect', x0: 2.55, z0: 5.27, x1: 3.05, z1: 5.73 }) // printer
  list.push({ kind: 'rect', x0: 0, z0: 2.0, x1: 0.7, z1: 4.2 }) // kitchenette counters
  // The two walls and the front edge of the floor.
  list.push({ kind: 'rect', x0: -1, z0: -1, x1: 0, z1: ROOM.depth + 1 })
  list.push({ kind: 'rect', x0: -1, z0: -1, x1: ROOM.width + 1, z1: 0 })
  list.push({ kind: 'rect', x0: ROOM.width, z0: -1, x1: ROOM.width + 1, z1: ROOM.depth + 1 })
  list.push({ kind: 'rect', x0: -1, z0: ROOM.depth, x1: ROOM.width + 1, z1: ROOM.depth + 1 })
  return list
}

/** Radius of an agent's body plus a little room. */
export const BODY_CLEARANCE = 0.4

/** Distance from a floor point to the nearest obstacle's edge (negative inside one). */
export function clearanceAt(x: number, z: number, list: Obstacle[] = obstacles()): number {
  let best = Infinity
  for (const o of list) {
    let d: number
    if (o.kind === 'circle') d = Math.hypot(x - o.x, z - o.z) - o.r
    else {
      const dx = Math.max(o.x0 - x, 0, x - o.x1)
      const dz = Math.max(o.z0 - z, 0, z - o.z1)
      d = dx === 0 && dz === 0 ? -Math.min(x - o.x0, o.x1 - x, z - o.z0, o.z1 - z) : Math.hypot(dx, dz)
    }
    if (d < best) best = d
  }
  return best
}

/** The full walk from a seat to a target's aisle spot (the way back is the same list reversed). */
export function tripPath(from: AgentId, to: AgentId): Vec2[] {
  const seat = SEATS[from]
  const step: Vec2 = [seat[0], seat[1] + SIDE_STEP[from] * SIDE_STEP_DISTANCE]
  const leg = legBetween(from, to)
  return [seat, step, AISLES[from], ...leg, AISLES[to]]
}

function legBetween(from: AgentId, to: AgentId): Vec2[] {
  const forward = LEGS[`${from}>${to}`]
  if (forward) return forward
  const back = LEGS[`${to}>${from}`]
  return back ? [...back].reverse() : []
}

/** True when a trip between these two agents has a planned route. */
export function hasRoute(from: AgentId, to: AgentId): boolean {
  return from !== to && (`${from}>${to}` in LEGS || `${to}>${from}` in LEGS)
}
