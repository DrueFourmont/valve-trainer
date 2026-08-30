import * as THREE from 'three'
import { type Interactable, pickInteractable } from '../input/interactables'
import type { ErrorRecord, ProcedureMachine } from '../procedure/machine'
import { scoreAttempt } from '../procedure/score'
import { wantsTestHooks } from './enabled'

/**
 * The surface automated tests drive the app through.
 *
 * Everything here reads or nudges state the app already has. Nothing implements
 * behaviour, so a passing test still proves the real code path rather than a
 * parallel one built for testing.
 */

export interface TrainerState {
  ready: boolean
  step: number
  total: number
  label: string | null
  completed: string[]
  errors: ErrorRecord[]
  isComplete: boolean
  score: number | null
}

export interface ScreenPoint {
  x: number
  y: number
}

export interface TrainerHooks {
  state(): TrainerState
  interact(name: string): void
  /** Viewport pixel coordinates, for a real click through the real raycaster. */
  screenPos(name: string): ScreenPoint | null
  worldPos(name: string): [number, number, number] | null
  /** Current emissive colour, which is how highlight and error pulse show up. */
  emissive(name: string): number | null
  names(): string[]
  fps(): number
  loadTime(): number
  rigPosition(): [number, number, number]
  isPresenting(): boolean
  /** Per eye render resolution against the canvas it is shown on. */
  xrResolution(): {
    eyeWidth: number
    eyeHeight: number
    canvasWidth: number
    canvasHeight: number
    devicePixelRatio: number
  } | null
  /** Point an emulated controller's ray at a world point. */
  xrAim(hand: 'left' | 'right', target: [number, number, number]): boolean
  /** Sugar: aim the right controller at a named node. */
  xrAimAt(name: string): boolean
  xrTrigger(pressed: boolean): void
  xrThumbstick(hand: 'left' | 'right', x: number, y: number): void
}

interface IwerController {
  position: { set(x: number, y: number, z: number): void }
  quaternion: { set(x: number, y: number, z: number, w: number): void }
  updateButtonValue(id: string, value: number): void
  updateAxes(id: string, x: number, y: number): void
}

interface IwerDevice {
  controllers: Record<string, IwerController | undefined>
}

declare global {
  interface Window {
    __trainer?: TrainerHooks
    __iwer?: IwerDevice
  }
}

/** Where the emulated hand is held, in rig local space: right of centre, chest height. */
const HAND_ORIGIN = new THREE.Vector3(0.2, 1.2, 0)

export function installTestHooks(deps: {
  renderer: THREE.WebGLRenderer
  camera: THREE.Camera
  rig: THREE.Object3D
  items: Map<string, Interactable>
  interact: (name: string) => void
  machine: () => ProcedureMachine | null
  fps: () => number
}): void {
  if (!wantsTestHooks()) return

  const { renderer, camera, rig, items, interact, machine, fps } = deps
  const readyAt = performance.now()

  /** The bounding box centre, not the origin: a lever's origin is at its pivot,
   *  which is not necessarily on the mesh a click has to land on. */
  function centreOf(name: string): THREE.Vector3 | null {
    const item = items.get(name)
    if (!item) return null
    const centre = new THREE.Vector3()
    new THREE.Box3().setFromObject(item.object).getCenter(centre)
    return centre
  }

  const hooks: TrainerHooks = {
    state(): TrainerState {
      const current = machine()
      if (!current) {
        return {
          ready: false,
          step: 0,
          total: 0,
          label: null,
          completed: [],
          errors: [],
          isComplete: false,
          score: null,
        }
      }

      const snapshot = current.snapshot()
      const duration = current.durationMs()

      return {
        ready: true,
        step: current.stepNumber,
        total: current.totalSteps,
        label: current.currentStep?.label ?? null,
        completed: snapshot.completed.map((step) => step.id),
        errors: snapshot.errors,
        isComplete: current.isComplete,
        score:
          current.isComplete && duration !== null
            ? scoreAttempt({
                errorCount: snapshot.errors.length,
                durationSeconds: duration / 1000,
                targetSeconds: current.procedure.targetSeconds,
              })
            : null,
      }
    },

    interact,

    /**
     * A point that provably hits this node, not merely one that projects near
     * it. The bleed lever is about 10 cm long and 1 cm thick, so its projected
     * centre is a few pixels wide and a click there lands on whatever is
     * behind it. Candidates are sampled across the projected bounding box and
     * each is run through the app's own raycaster until one resolves to the
     * node we asked for, so a returned point is guaranteed clickable.
     */
    screenPos(name: string): ScreenPoint | null {
      const item = items.get(name)
      if (!item) return null

      const box = new THREE.Box3().setFromObject(item.object)
      const rect = renderer.domElement.getBoundingClientRect()
      const all = [...items.values()]
      const raycaster = new THREE.Raycaster()
      const ndc = new THREE.Vector2()
      const corner = new THREE.Vector3()

      // Project the world bounding box into screen space to get a search area.
      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity

      for (let i = 0; i < 8; i++) {
        corner.set(
          i & 1 ? box.max.x : box.min.x,
          i & 2 ? box.max.y : box.min.y,
          i & 4 ? box.max.z : box.min.z,
        )
        corner.project(camera)
        minX = Math.min(minX, corner.x)
        maxX = Math.max(maxX, corner.x)
        minY = Math.min(minY, corner.y)
        maxY = Math.max(maxY, corner.y)
      }

      // Centre first, then outward, so the usual case costs one raycast.
      const steps = 9
      const candidates: [number, number][] = [[(minX + maxX) / 2, (minY + maxY) / 2]]
      for (let ix = 0; ix < steps; ix++) {
        for (let iy = 0; iy < steps; iy++) {
          candidates.push([
            minX + ((maxX - minX) * ix) / (steps - 1),
            minY + ((maxY - minY) * iy) / (steps - 1),
          ])
        }
      }

      for (const [x, y] of candidates) {
        ndc.set(x, y)
        raycaster.setFromCamera(ndc, camera)
        if (pickInteractable(raycaster, all)?.item !== item) continue

        return {
          x: rect.left + ((x + 1) / 2) * rect.width,
          y: rect.top + ((1 - y) / 2) * rect.height,
        }
      }

      return null
    },

    worldPos(name: string): [number, number, number] | null {
      const centre = centreOf(name)
      return centre ? [centre.x, centre.y, centre.z] : null
    },

    emissive(name: string): number | null {
      return items.get(name)?.materials[0]?.emissive.getHex() ?? null
    },

    names(): string[] {
      return [...items.keys()]
    },

    fps,

    loadTime(): number {
      return readyAt
    },

    rigPosition(): [number, number, number] {
      return [rig.position.x, rig.position.y, rig.position.z]
    },

    isPresenting(): boolean {
      return renderer.xr.isPresenting
    },

    /**
     * What the headset is actually being rendered at. Blurriness in VR is
     * almost always this number being lower than the display it lands on, and
     * it is a measurement rather than an opinion.
     */
    xrResolution() {
      if (!renderer.xr.isPresenting) return null
      const viewport = renderer.xr.getCamera().cameras[0]?.viewport
      if (!viewport) return null

      const rect = renderer.domElement.getBoundingClientRect()
      return {
        eyeWidth: viewport.z,
        eyeHeight: viewport.w,
        canvasWidth: rect.width,
        canvasHeight: rect.height,
        devicePixelRatio: window.devicePixelRatio,
      }
    },

    xrAim(hand: 'left' | 'right', target: [number, number, number]): boolean {
      const controller = window.__iwer?.controllers[hand]
      if (!controller) return false

      // IWER poses are in XR reference space, which three maps onto rig local
      // space, so a world target has to come back through the rig first.
      rig.updateMatrixWorld(true)
      const local = rig.worldToLocal(new THREE.Vector3(...target))

      const origin = HAND_ORIGIN.clone()
      if (hand === 'left') origin.x = -origin.x

      // Matrix4.lookAt aims -Z from eye to target, and -Z is exactly the axis
      // the controller ray is built on in input/xr.ts.
      const orientation = new THREE.Quaternion().setFromRotationMatrix(
        new THREE.Matrix4().lookAt(origin, local, new THREE.Vector3(0, 1, 0)),
      )

      controller.position.set(origin.x, origin.y, origin.z)
      controller.quaternion.set(orientation.x, orientation.y, orientation.z, orientation.w)
      return true
    },

    /**
     * Aims at a point that a ray provably reaches, not at the bounding box
     * centre. The bleed node is a stem plus a lever arm, and the centre of the
     * box around both sits in the empty space between them, so aiming there
     * hits nothing at all.
     */
    xrAimAt(name: string): boolean {
      const item = items.get(name)
      if (!item) return false

      rig.updateMatrixWorld(true)
      const origin = rig.localToWorld(HAND_ORIGIN.clone())
      const box = new THREE.Box3().setFromObject(item.object)
      const all = [...items.values()]

      const raycaster = new THREE.Raycaster()
      const direction = new THREE.Vector3()
      const candidate = new THREE.Vector3()
      const steps = 7

      for (let i = 0; i < steps ** 3; i++) {
        const ix = i % steps
        const iy = Math.floor(i / steps) % steps
        const iz = Math.floor(i / steps ** 2)

        candidate.set(
          THREE.MathUtils.lerp(box.min.x, box.max.x, ix / (steps - 1)),
          THREE.MathUtils.lerp(box.min.y, box.max.y, iy / (steps - 1)),
          THREE.MathUtils.lerp(box.min.z, box.max.z, iz / (steps - 1)),
        )

        direction.copy(candidate).sub(origin).normalize()
        raycaster.set(origin, direction)
        if (pickInteractable(raycaster, all)?.item !== item) continue

        return hooks.xrAim('right', [candidate.x, candidate.y, candidate.z])
      }

      return false
    },

    xrTrigger(pressed: boolean): void {
      window.__iwer?.controllers.right?.updateButtonValue('trigger', pressed ? 1 : 0)
    },

    xrThumbstick(hand: 'left' | 'right', x: number, y: number): void {
      window.__iwer?.controllers[hand]?.updateAxes('thumbstick', x, y)
    },
  }

  window.__trainer = hooks
}
