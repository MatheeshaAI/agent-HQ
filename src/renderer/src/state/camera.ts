/** Commands the office's camera controls expose to the buttons and keys outside the canvas. */
export interface CameraCommands {
  zoomIn(): void
  zoomOut(): void
  rotate(direction: -1 | 1): void
  pan(dx: number, dy: number): void
  /** Frames the whole office again, keeping the current viewing angle. */
  fit(): void
  /** Restores the original view exactly. */
  reset(): void
  /** Flies to one room's home view, or to a view that takes in all three rooms. */
  focusRoom(room: FocusTarget): void
}

/** A room id (brain, office, personal), or 'all' for the three rooms side by side. */
export type FocusTarget = 'brain' | 'office' | 'personal' | 'all'

let current: CameraCommands | null = null

export function registerCamera(commands: CameraCommands | null): void {
  current = commands
}

export const sceneCamera: CameraCommands = {
  zoomIn: () => current?.zoomIn(),
  zoomOut: () => current?.zoomOut(),
  rotate: (direction) => current?.rotate(direction),
  pan: (dx, dy) => current?.pan(dx, dy),
  fit: () => current?.fit(),
  reset: () => current?.reset(),
  focusRoom: (room) => current?.focusRoom(room)
}

/** Flies the office camera to a room, or to all three rooms; does nothing while the office is not mounted. */
export function focusRoom(room: FocusTarget): void {
  sceneCamera.focusRoom(room)
}
