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
}

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
  reset: () => current?.reset()
}
