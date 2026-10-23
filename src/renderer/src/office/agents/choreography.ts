// Walks an agent from its desk to another agent and back along a planned route (routes.ts): rise, walk, stop
// beside the other agent, speak for a moment, return and sit down. One trip at a time keeps the aisles clear.
import type { AgentId } from '@shared/types'
import { FACING, type Vec2 } from '../layout'
import { SEATS, tripPath } from '../routes'

export interface Pose {
  /** False while the agent sits at its desk and the normal seated animation applies. */
  active: boolean
  x: number
  z: number
  /** Rotation around y; the avatar faces +z at 0. */
  yaw: number
  /** 0 = seated, 1 = standing. */
  stand: number
  mode: 'walk' | 'talk'
}

const WALK_SPEED = 1.1
/** Distance over which the agent rises from, or settles into, its chair. */
const RISE_DISTANCE = 0.6
const TALK_SECONDS = 2.4
const TURN_RATE = 8

/** The yaw an agent has when seated (desks face -x). */
const SEATED_YAW = FACING

interface Trip {
  from: AgentId
  to: AgentId
  path: Vec2[]
  /** Cumulative length at each path point. */
  at: number[]
  length: number
  /** Distance travelled from the seat. */
  s: number
  phase: 'out' | 'talk' | 'back'
  talk: number
  yaw: number
}

function angleDelta(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from))
}

export class Choreographer {
  readonly poses: Record<AgentId, Pose>
  private trip: Trip | null = null

  /** `onSpeaking` lets the scene show the speaking cue (voice bars) while the visitor talks. */
  constructor(private onSpeaking: (agent: AgentId, speaking: boolean) => void) {
    const pose = (id: AgentId): Pose => ({ active: false, x: SEATS[id][0], z: SEATS[id][1], yaw: SEATED_YAW, stand: 0, mode: 'walk' })
    this.poses = { pip: pose('pip'), sage: pose('sage'), rex: pose('rex'), nova: pose('nova'), axel: pose('axel'), muse: pose('muse') }
  }

  get busy(): boolean {
    return this.trip !== null
  }

  /** The agent currently away from its desk, if any. */
  get walker(): AgentId | null {
    return this.trip?.from ?? null
  }

  start(from: AgentId, to: AgentId): boolean {
    if (this.trip) return false
    const path = tripPath(from, to)
    if (path.length < 3) return false
    const at = [0]
    for (let i = 1; i < path.length; i++) at.push(at[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]))
    this.trip = { from, to, path, at, length: at[at.length - 1], s: 0, phase: 'out', talk: 0, yaw: SEATED_YAW }
    this.poses[from].active = true
    return true
  }

  /** The walker has work again: skip the rest of the visit and head back to the desk. */
  recall(from: AgentId): void {
    const trip = this.trip
    if (!trip || trip.from !== from || trip.phase === 'back') return
    if (trip.phase === 'talk') this.onSpeaking(trip.from, false)
    trip.phase = 'back'
  }

  /** Puts everyone back at their desks at once. */
  reset(): void {
    if (this.trip) {
      this.onSpeaking(this.trip.from, false)
      this.sit(this.trip.from)
    }
    this.trip = null
  }

  update(dt: number): void {
    const trip = this.trip
    if (!trip) return
    const step = Math.min(dt, 0.1)

    if (trip.phase === 'out') {
      trip.s = Math.min(trip.length, trip.s + WALK_SPEED * step)
      if (trip.s >= trip.length) {
        trip.phase = 'talk'
        trip.talk = TALK_SECONDS
        this.onSpeaking(trip.from, true)
      }
    } else if (trip.phase === 'talk') {
      trip.talk -= step
      if (trip.talk <= 0) {
        this.onSpeaking(trip.from, false)
        trip.phase = 'back'
      }
    } else {
      trip.s = Math.max(0, trip.s - WALK_SPEED * step)
      if (trip.s <= 0) {
        this.sit(trip.from)
        this.trip = null
        return
      }
    }
    this.place(trip, step)
  }

  private sit(id: AgentId): void {
    const pose = this.poses[id]
    pose.active = false
    pose.x = SEATS[id][0]
    pose.z = SEATS[id][1]
    pose.yaw = SEATED_YAW
    pose.stand = 0
  }

  private place(trip: Trip, dt: number): void {
    const { path, at } = trip
    let i = 1
    while (i < at.length - 1 && at[i] < trip.s) i++
    const [ax, az] = path[i - 1]
    const [bx, bz] = path[i]
    const span = Math.max(1e-6, at[i] - at[i - 1])
    const t = (trip.s - at[i - 1]) / span
    const pose = this.poses[trip.from]
    pose.x = ax + (bx - ax) * t
    pose.z = az + (bz - az) * t

    let target: number
    if (trip.phase === 'talk') {
      const [tx, tz] = SEATS[trip.to]
      target = Math.atan2(tx - pose.x, tz - pose.z)
    } else {
      const sign = trip.phase === 'back' ? -1 : 1
      target = Math.atan2(sign * (bx - ax), sign * (bz - az))
    }
    trip.yaw += angleDelta(trip.yaw, target) * Math.min(1, dt * TURN_RATE)
    pose.stand = Math.min(1, trip.s / RISE_DISTANCE)
    // Close to the chair the agent turns back towards its desk.
    pose.yaw = trip.yaw + angleDelta(trip.yaw, SEATED_YAW) * (1 - pose.stand)
    pose.mode = trip.phase === 'talk' ? 'talk' : 'walk'
  }
}
