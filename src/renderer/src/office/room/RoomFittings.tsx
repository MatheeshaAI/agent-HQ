// The Office and Personal rooms: a shell (floor, back wall, dividing wall with a doorway, cap line, sign and light
// pools) and the room's own fittings. Everything is built in room-local coordinates inside one group that carries the
// room's offset, so it reuses the brain room's materials and furniture without its reflective floor.
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { Box, tiledBoxGeometry } from '../primitives'
import { useMat } from '../materials'
import { TILE_PERIOD } from '../textures/tiles'
import TextPlane from '../textures/TextPlane'
import Spot from '../lights/Spot'
import Bookshelf from '../furniture/Bookshelf'
import Lounge from '../furniture/Lounge'
import { Rug } from './Room'
import { CAP_HEIGHT, DOOR, ROOM, ROOM_GAP, ROOM_SIGN_Y, type RoomSpec, type Vec2 } from '../layout'

const WALL_T = 0.25
const WALL_H = ROOM.wallHeight
const SLAB = ROOM.slabThickness

/** Dividing wall on the room's near side, with a doorway at DOOR.z0..z1 (room-local x = -ROOM_GAP / 2). */
function DividingWall(): JSX.Element {
  const mat = useMat()
  const { depth: D } = ROOM
  const x = -ROOM_GAP / 2
  const doorW = DOOR.z1 - DOOR.z0
  return (
    <group>
      <Box size={[WALL_T, WALL_H + SLAB, DOOR.z0]} at={[x, (WALL_H - SLAB) / 2, DOOR.z0 / 2]} material={mat.wallPanel} />
      <Box
        size={[WALL_T, WALL_H + SLAB, D - DOOR.z1]}
        at={[x, (WALL_H - SLAB) / 2, (DOOR.z1 + D) / 2]}
        material={mat.wallPanel}
      />
      <Box
        size={[WALL_T, WALL_H - DOOR.top, doorW]}
        at={[x, (WALL_H + DOOR.top) / 2, (DOOR.z0 + DOOR.z1) / 2]}
        material={mat.wallPanel}
      />
      <Box size={[0.06, 0.04, D]} at={[x, CAP_HEIGHT, D / 2]} material={mat.blackMetal} />
    </group>
  )
}

/** Back wall (z = 0), its cap line and skirting, the LED cove in the room's tint, and the room sign. */
function BackWall({ room }: { room: RoomSpec }): JSX.Element {
  const mat = useMat()
  const { width: W } = ROOM
  const cove = useMemo(() => new THREE.MeshBasicMaterial({ color: room.tint }), [room.tint])
  useEffect(() => () => cove.dispose(), [cove])
  const sign = room.sign
  return (
    <group>
      <Box size={[W + WALL_T, WALL_H + SLAB, WALL_T]} at={[(W - WALL_T) / 2, (WALL_H - SLAB) / 2, -WALL_T / 2]} material={mat.wallPanel} />
      <Box size={[W, 0.05, 0.08]} at={[W / 2, CAP_HEIGHT, 0.04]} material={mat.blackMetal} />
      <Box size={[W - 0.3, 0.03, 0.03]} at={[W / 2, CAP_HEIGHT - 0.07, 0.02]} material={cove} shadows={false} />
      <Box size={[W, 0.08, 0.03]} at={[W / 2, 0.04, 0.015]} material={mat.blackMetal} shadows={false} />
      {sign && (
        <group>
          <Box size={[sign.width + 0.3, 0.8, 0.04]} at={[sign.x, ROOM_SIGN_Y, 0.02]} material={mat.signPanel} shadows={false} />
          <TextPlane
            lines={[{ text: sign.text, size: 0.46, y: 0.5, weight: 600, tracking: 0.06, color: sign.color, glow: sign.color }]}
            width={sign.width}
            height={0.7}
            intensity={1.2}
            position={[sign.x, ROOM_SIGN_Y, 0.06]}
          />
        </group>
      )}
    </group>
  )
}

/** The room floor, a plain tiled slab (the brain's mirror floor is too costly to repeat per room). */
function Floor({ material }: { material: THREE.Material }): JSX.Element {
  const mat = useMat()
  const { width: W, depth: D } = ROOM
  const geometry = useMemo(() => tiledBoxGeometry([W, 0.02, D], TILE_PERIOD), [W, D])
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <group>
      <Box size={[W, SLAB, D]} at={[W / 2, -SLAB / 2 - 0.002, D / 2]} material={mat.slabEdge} />
      <mesh geometry={geometry} material={material} position={[W / 2, -0.01, D / 2]} receiveShadow />
    </group>
  )
}

/** Three warm or cool pools of downlight over the desks, so the room is not dark between them. */
function Pools({ room }: { room: RoomSpec }): JSX.Element {
  return (
    <>
      {room.pools.map(([x, z]: Vec2) => (
        <Spot key={`${x},${z}`} from={[x, 6.5, z]} to={[x, 0, z]} color={room.tint} intensity={1150} angle={0.5} penumbra={0.6} distance={12} />
      ))}
    </>
  )
}

/** Office: a long meeting table with chairs, a rug under it and a whiteboard on the back wall. */
function OfficeFittings({ room }: { room: RoomSpec }): JSX.Element {
  const mat = useMat()
  const table = room.table
  const board = room.whiteboard
  const face = useMemo(() => new THREE.MeshStandardMaterial({ color: '#dfe5ec', roughness: 0.35 }), [])
  useEffect(() => () => face.dispose(), [face])
  if (!table) return <group />
  const [x, z] = table.at
  const half = table.length / 2
  const seats = [z - half * 0.6, z, z + half * 0.6]
  return (
    <group>
      <Rug at={table.rug} size={[table.width + 3.2, table.length + 2.6]} material={mat.officeRug} />
      <Box size={[table.width, 0.05, table.length]} at={[x, 0.74, z]} material={mat.deskTop} />
      {[-half * 0.55, half * 0.55].map((dz) => (
        <Box key={dz} size={[table.width * 0.6, 0.7, 0.1]} at={[x, 0.37, z + dz]} material={mat.blackMetal} />
      ))}
      {[-1, 1].flatMap((side) =>
        seats.map((sz) => {
          const cx = x + side * (table.width / 2 + 0.42)
          return (
            <group key={`${side}-${sz}`}>
              <Box size={[0.5, 0.07, 0.5]} at={[cx, 0.46, sz]} material={mat.leather} />
              <Box size={[0.06, 0.5, 0.5]} at={[cx + side * 0.22, 0.73, sz]} material={mat.leather} />
            </group>
          )
        })
      )}
      {board && <WhiteBoard x0={board.x0} x1={board.x1} face={face} />}
    </group>
  )
}

function WhiteBoard({ x0, x1, face }: { x0: number; x1: number; face: THREE.Material }): JSX.Element {
  const mat = useMat()
  const cx = (x0 + x1) / 2
  const w = x1 - x0
  return (
    <group>
      <Box size={[w + 0.12, 1.66, 0.05]} at={[cx, 1.72, 0.03]} material={mat.blackMetal} />
      <Box size={[w, 1.5, 0.03]} at={[cx, 1.72, 0.07]} material={face} shadows={false} />
      <Box size={[w, 0.04, 0.08]} at={[cx, 0.9, 0.1]} material={mat.blackMetal} />
    </group>
  )
}

/**
 * One of the new rooms: shell, dividing wall, back wall with sign, pools of light, and its fittings.
 * Desks and agents are placed in world coordinates by the scene (they use `worldDesks`).
 */
export default function RoomFittings({ room }: { room: RoomSpec }): JSX.Element {
  const mat = useMat()
  const isOffice = room.id === 'office'
  return (
    <group position={[room.offset, 0, 0]}>
      <Floor material={isOffice ? mat.officeFloor : mat.personalFloor} />
      <DividingWall />
      <BackWall room={room} />
      <Pools room={room} />
      {isOffice ? <OfficeFittings room={room} /> : <PersonalFittings room={room} />}
    </group>
  )
}

/** Personal: the lounge (sofa, coffee table, rug, lamps) and a bookcase, all room-local. */
function PersonalFittings({ room }: { room: RoomSpec }): JSX.Element {
  return (
    <group>
      <Lounge />
      {room.bookshelves.map((b, i) => (
        <Bookshelf key={i} {...b} seed={11 + i} />
      ))}
    </group>
  )
}
