import * as THREE from 'three'
import type { Effects } from '../scene/effects'

/**
 * VR locomotion. Left thumbstick forward aims a teleport arc, releasing it
 * moves you. Right thumbstick snaps 30 degrees.
 *
 * Rule from CLAUDE.md: never move the camera the student did not cause. Both
 * of these are student initiated, there is no smooth locomotion anywhere, and
 * the teleport is masked by a short fade so the world never slides past.
 */

const TELEPORT_SPEED = 6
const GRAVITY = 9.8
const ARC_POINTS = 96

/**
 * How far from the skid a student may stand. A real training bay paints this
 * on the floor, and it stops a steeply aimed arc from dropping someone behind
 * the equipment facing the wrong way. The centre is read from the model.
 */
const WORK_AREA_RADIUS_M = 3.5

/** Push past ON to act, fall back under OFF before it can act again. */
const AIM_ON = 0.6
const AIM_OFF = 0.35
const TURN_ON = 0.7
const TURN_OFF = 0.3

const SNAP_ANGLE = Math.PI / 6 // 30 degrees
const FADE_OUT_MS = 110
const FADE_IN_MS = 180

const VALID_COLOR = 0x2ea8ff
const INVALID_COLOR = 0xd8322a

export function setupLocomotion(opts: {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  rig: THREE.Object3D
  camera: THREE.PerspectiveCamera
  effects: Effects
  /** Floor level centre of the work area, taken from the model bounds. */
  workAreaCenter: THREE.Vector3
  /** Temporary, for diagnosing controller input. Removed in phase 6. */
  onDebug?: (text: string) => void
}): { update: () => void } {
  const { renderer, scene, rig, camera, effects, workAreaCenter, onDebug } = opts

  let turnCount = 0

  // getController returns a cached object per index, so listening here does not
  // interfere with the selection adapter listening to the same objects.
  const hands = new Map<string, THREE.Object3D>()
  for (const index of [0, 1]) {
    const controller = renderer.xr.getController(index)
    controller.addEventListener('connected', (event) => {
      const handedness = (event as unknown as { data?: { handedness?: string } }).data?.handedness
      if (handedness) hands.set(handedness, controller)
    })
  }

  const arcPositions = new Float32Array(ARC_POINTS * 3)
  const arcGeometry = new THREE.BufferGeometry()
  arcGeometry.setAttribute('position', new THREE.BufferAttribute(arcPositions, 3))
  const arcMaterial = new THREE.LineBasicMaterial({ color: VALID_COLOR })
  const arc = new THREE.Line(arcGeometry, arcMaterial)
  arc.name = 'teleport_arc'
  arc.frustumCulled = false
  arc.visible = false
  scene.add(arc)

  const marker = new THREE.Mesh(
    new THREE.RingGeometry(0.17, 0.24, 32),
    new THREE.MeshBasicMaterial({ color: VALID_COLOR, transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
  )
  marker.name = 'teleport_marker'
  marker.rotation.x = -Math.PI / 2
  marker.visible = false
  scene.add(marker)

  // Shown only while aiming, so a red arc has a visible reason.
  const boundary = new THREE.Mesh(
    new THREE.RingGeometry(WORK_AREA_RADIUS_M - 0.04, WORK_AREA_RADIUS_M, 72),
    new THREE.MeshBasicMaterial({
      color: 0x4f6474,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
    }),
  )
  boundary.name = 'work_area'
  boundary.rotation.x = -Math.PI / 2
  boundary.position.set(workAreaCenter.x, 0.005, workAreaCenter.z)
  boundary.visible = false
  scene.add(boundary)

  // Fade sphere rides on the head so the teleport itself is never seen.
  const fade = new THREE.Mesh(
    new THREE.SphereGeometry(0.25, 16, 12),
    new THREE.MeshBasicMaterial({
      color: 0x000000,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
    }),
  )
  fade.name = 'teleport_fade'
  fade.renderOrder = 999
  fade.visible = false
  camera.add(fade)
  const fadeMaterial = fade.material as THREE.MeshBasicMaterial

  const origin = new THREE.Vector3()
  const direction = new THREE.Vector3()
  const rotation = new THREE.Matrix4()
  const cursor = new THREE.Vector3()
  const velocity = new THREE.Vector3()
  const landing = new THREE.Vector3()
  const headBefore = new THREE.Vector3()
  const headAfter = new THREE.Vector3()

  let aiming = false
  let turnArmed = true
  let moving = false
  let target: THREE.Vector3 | null = null

  // Whatever state a session ended in, the next one starts clear.
  for (const event of ['sessionstart', 'sessionend'] as const) {
    renderer.xr.addEventListener(event, () => {
      fadeMaterial.opacity = 0
      fade.visible = false
      moving = false
      aiming = false
      turnArmed = true
      hideAim()
    })
  }

  /**
   * Walks a projectile until it reaches the floor. Returns the number of arc
   * points drawn, and sets landing when it found one within range.
   */
  function traceArc(hand: THREE.Object3D): { count: number; hit: boolean } {
    origin.setFromMatrixPosition(hand.matrixWorld)
    rotation.identity().extractRotation(hand.matrixWorld)
    direction.set(0, 0, -1).applyMatrix4(rotation)

    velocity.copy(direction).multiplyScalar(TELEPORT_SPEED)
    cursor.copy(origin)

    const step = 1 / 60
    let count = 0
    let hit = false

    for (let i = 0; i < ARC_POINTS; i++) {
      arcPositions[i * 3] = cursor.x
      arcPositions[i * 3 + 1] = cursor.y
      arcPositions[i * 3 + 2] = cursor.z
      count = i + 1

      if (cursor.y <= 0) {
        landing.set(cursor.x, 0, cursor.z)
        // Only the work area matters. Checking distance from the student was
        // the original mistake: it said nothing about direction, so a steep
        // aim could legally drop them behind the skid facing away from it.
        const fromCentre = Math.hypot(
          landing.x - workAreaCenter.x,
          landing.z - workAreaCenter.z,
        )
        hit = fromCentre <= WORK_AREA_RADIUS_M
        break
      }

      velocity.y -= GRAVITY * step
      cursor.addScaledVector(velocity, step)
    }

    return { count, hit }
  }

  function hideAim(): void {
    arc.visible = false
    marker.visible = false
    boundary.visible = false
    target = null
  }

  /**
   * One tween, not two chained ones. The move happens at the crossover point
   * while the screen is fully black. Chaining a fade in off the fade out's
   * completion is how this got stuck on black once already, and a single
   * timeline cannot half finish.
   */
  function teleport(destination: THREE.Vector3): void {
    if (moving) return
    moving = true
    fade.visible = true

    const total = FADE_OUT_MS + FADE_IN_MS
    const crossover = FADE_OUT_MS / total
    let moved = false

    effects.tween(
      total,
      (t) => {
        if (t < crossover) {
          fadeMaterial.opacity = t / crossover
          return
        }

        if (!moved) {
          moved = true
          // Move the rig so the head lands on the target, not the rig origin.
          camera.getWorldPosition(headBefore)
          rig.position.x += destination.x - headBefore.x
          rig.position.z += destination.z - headBefore.z
        }

        fadeMaterial.opacity = 1 - (t - crossover) / (1 - crossover)
      },
      () => {
        fadeMaterial.opacity = 0
        fade.visible = false
        moving = false
      },
    )
  }

  function snapTurn(delta: number): void {
    camera.getWorldPosition(headBefore)
    rig.rotation.y += delta
    rig.updateMatrixWorld(true)
    camera.getWorldPosition(headAfter)
    // Rotate about the student's own head rather than the rig origin.
    rig.position.x += headBefore.x - headAfter.x
    rig.position.z += headBefore.z - headAfter.z
  }

  return {
    update(): void {
      const session = renderer.xr.getSession()
      if (!session) {
        hideAim()
        return
      }

      let aimAxis = 0
      let turnAxis = 0
      const seen: string[] = []

      for (const source of session.inputSources) {
        const pad = source.gamepad
        if (!pad) continue
        // xr-standard puts the thumbstick on axes 2 and 3. Fall back to 0 and 1
        // for devices that only report a touchpad.
        const x = pad.axes.length > 2 ? pad.axes[2] : (pad.axes[0] ?? 0)
        const y = pad.axes.length > 3 ? pad.axes[3] : (pad.axes[1] ?? 0)
        if (source.handedness === 'left') aimAxis = -y
        if (source.handedness === 'right') turnAxis = x

        const axes = Array.from(pad.axes, (value) => value.toFixed(2)).join(',')
        seen.push(`${source.handedness}[${axes}]`)
      }

      if (onDebug) {
        const yaw = ((rig.rotation.y * 180) / Math.PI).toFixed(0)
        onDebug(
          `${seen.join(' ') || 'no gamepads'}\naim ${aimAxis.toFixed(2)} turn ${turnAxis.toFixed(2)} yaw ${yaw} turns ${turnCount}`,
        )
      }

      if (Math.abs(turnAxis) > TURN_ON && turnArmed) {
        turnArmed = false
        turnCount += 1
        snapTurn(-Math.sign(turnAxis) * SNAP_ANGLE)
      } else if (Math.abs(turnAxis) < TURN_OFF) {
        turnArmed = true
      }

      const hand = hands.get('left')
      if (!hand) {
        hideAim()
        return
      }

      if (aimAxis > AIM_ON) aiming = true

      if (aiming) {
        const { count, hit } = traceArc(hand)
        arcGeometry.setDrawRange(0, count)
        arcGeometry.getAttribute('position').needsUpdate = true
        arcGeometry.computeBoundingSphere()

        arc.visible = true
        boundary.visible = true
        arcMaterial.color.setHex(hit ? VALID_COLOR : INVALID_COLOR)
        marker.visible = hit
        if (hit) marker.position.set(landing.x, 0.01, landing.z)

        target = hit ? landing.clone() : null
      }

      if (aiming && aimAxis < AIM_OFF) {
        aiming = false
        const destination = target
        hideAim()
        if (destination) teleport(destination)
      }
    },
  }
}
