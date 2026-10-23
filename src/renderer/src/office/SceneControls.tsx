// Bounded camera controls for the office (zoom, pan, rotate) and the button bar that drives them.
import { useEffect, useLayoutEffect, useRef, type KeyboardEvent } from 'react'
import { CameraControls } from '@react-three/drei'
import { Maximize, Pause, Play, RotateCcw, RotateCw, Undo2, ZoomIn, ZoomOut } from 'lucide-react'
import * as THREE from 'three'
import { CAMERA, ROOM } from './layout'
import { registerCamera, sceneCamera } from '../state/camera'
import { motion, usePaused } from '../state/motion'
import { trips } from '../state/trips'
import styles from './SceneControls.module.css'

const rad = THREE.MathUtils.degToRad

/** Where the camera sits at the original view. */
function homePose(): { position: THREE.Vector3; target: THREE.Vector3 } {
  const yaw = rad(CAMERA.yaw)
  const elev = rad(CAMERA.elevation)
  const [tx, ty, tz] = CAMERA.target
  return {
    position: new THREE.Vector3(
      tx + CAMERA.distance * Math.cos(elev) * Math.sin(yaw),
      ty + CAMERA.distance * Math.sin(elev),
      tz + CAMERA.distance * Math.cos(elev) * Math.cos(yaw)
    ),
    target: new THREE.Vector3(tx, ty, tz)
  }
}

/** Limits that keep the office in view: how close and far, how far round and up, and where the focus may go. */
const LIMITS = {
  minDistance: CAMERA.distance * 0.4,
  maxDistance: CAMERA.distance * 1.5,
  /** Rotation either side of the original yaw. */
  yawRange: 40,
  /** Elevation above the horizon (the polar angle is measured from straight up). */
  minElevation: 8,
  maxElevation: 55
}

const ZOOM_STEP = 0.8
const ROTATE_STEP = rad(12)
const PAN_STEP = 0.12

export function SceneCameraControls(): JSX.Element {
  const ref = useRef<CameraControls>(null)

  useLayoutEffect(() => {
    const controls = ref.current
    if (!controls) return
    const home = homePose()
    const animate = (): boolean => !motion.prefersReduced()
    const { ACTION } = controls.constructor as unknown as { ACTION: Record<string, never> }

    controls.minDistance = LIMITS.minDistance
    controls.maxDistance = LIMITS.maxDistance
    controls.minAzimuthAngle = rad(CAMERA.yaw - LIMITS.yawRange)
    controls.maxAzimuthAngle = rad(CAMERA.yaw + LIMITS.yawRange)
    controls.minPolarAngle = rad(90 - LIMITS.maxElevation)
    controls.maxPolarAngle = rad(90 - LIMITS.minElevation)
    controls.boundaryEnclosesCamera = false
    controls.setBoundary(new THREE.Box3(new THREE.Vector3(-1, 0, -1), new THREE.Vector3(ROOM.width + 1, 3, ROOM.depth + 1)))
    controls.dollyToCursor = true
    controls.mouseButtons.left = ACTION.TRUCK
    controls.mouseButtons.right = ACTION.ROTATE
    controls.mouseButtons.middle = ACTION.DOLLY
    controls.mouseButtons.wheel = ACTION.DOLLY
    controls.touches.one = ACTION.TOUCH_TRUCK
    controls.touches.two = ACTION.TOUCH_DOLLY_TRUCK
    controls.touches.three = ACTION.TOUCH_TRUCK
    void controls.setLookAt(home.position.x, home.position.y, home.position.z, home.target.x, home.target.y, home.target.z, false)

    const dollyBy = (factor: number): void => {
      void controls.dollyTo(THREE.MathUtils.clamp(controls.distance * factor, LIMITS.minDistance, LIMITS.maxDistance), animate())
    }
    registerCamera({
      zoomIn: () => dollyBy(ZOOM_STEP),
      zoomOut: () => dollyBy(1 / ZOOM_STEP),
      rotate: (direction) => void controls.rotate(direction * ROTATE_STEP, 0, animate()),
      pan: (dx, dy) => void controls.truck(dx * PAN_STEP * controls.distance, dy * PAN_STEP * controls.distance, animate()),
      fit: () => {
        void controls.setTarget(home.target.x, home.target.y, home.target.z, animate())
        void controls.dollyTo(CAMERA.distance, animate())
        void controls.setFocalOffset(0, 0, 0, animate())
      },
      reset: () => {
        trips.reset()
        void controls.setLookAt(home.position.x, home.position.y, home.position.z, home.target.x, home.target.y, home.target.z, animate())
        void controls.setFocalOffset(0, 0, 0, animate())
      }
    })
    return () => registerCamera(null)
  }, [])

  return <CameraControls ref={ref} makeDefault />
}

/** Arrow keys pan, +/- zoom, Q/E rotate, F fits and 0 resets, while the office has focus. */
export function onSceneKeyDown(e: KeyboardEvent): void {
  if (e.target !== e.currentTarget || e.ctrlKey || e.metaKey || e.altKey) return
  const handlers: Record<string, () => void> = {
    '+': sceneCamera.zoomIn,
    '=': sceneCamera.zoomIn,
    '-': sceneCamera.zoomOut,
    ArrowLeft: () => sceneCamera.pan(-1, 0),
    ArrowRight: () => sceneCamera.pan(1, 0),
    ArrowUp: () => sceneCamera.pan(0, 1),
    ArrowDown: () => sceneCamera.pan(0, -1),
    q: () => sceneCamera.rotate(-1),
    e: () => sceneCamera.rotate(1),
    f: sceneCamera.fit,
    '0': sceneCamera.reset
  }
  const handler = handlers[e.key]
  if (!handler) return
  e.preventDefault()
  handler()
}

interface ButtonProps {
  label: string
  onClick: () => void
  pressed?: boolean
  children: JSX.Element
}

function ControlButton({ label, onClick, pressed, children }: ButtonProps): JSX.Element {
  return (
    <button type="button" className={styles.button} onClick={onClick} aria-label={label} title={label} aria-pressed={pressed}>
      {children}
    </button>
  )
}

export function SceneControlBar(): JSX.Element {
  const paused = usePaused()
  // Pause is only a switch for the scene's own motion; a reduced-motion setting already holds it still.
  useEffect(() => () => motion.setPaused(false), [])
  return (
    <div className={styles.bar} role="toolbar" aria-label="Office view controls">
      <ControlButton label="Zoom in" onClick={sceneCamera.zoomIn}>
        <ZoomIn size={16} />
      </ControlButton>
      <ControlButton label="Zoom out" onClick={sceneCamera.zoomOut}>
        <ZoomOut size={16} />
      </ControlButton>
      <span className={styles.divider} aria-hidden />
      <ControlButton label="Rotate left" onClick={() => sceneCamera.rotate(-1)}>
        <RotateCcw size={16} />
      </ControlButton>
      <ControlButton label="Rotate right" onClick={() => sceneCamera.rotate(1)}>
        <RotateCw size={16} />
      </ControlButton>
      <span className={styles.divider} aria-hidden />
      <ControlButton label="Fit the whole office" onClick={sceneCamera.fit}>
        <Maximize size={16} />
      </ControlButton>
      <ControlButton label="Reset the view" onClick={sceneCamera.reset}>
        <Undo2 size={16} />
      </ControlButton>
      <span className={styles.divider} aria-hidden />
      <ControlButton label={paused ? 'Resume motion' : 'Pause motion'} onClick={() => motion.setPaused(!paused)} pressed={paused}>
        {paused ? <Play size={16} /> : <Pause size={16} />}
      </ControlButton>
    </div>
  )
}
