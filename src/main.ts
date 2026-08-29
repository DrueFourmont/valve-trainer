import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { VRButton } from 'three/addons/webxr/VRButton.js'
import './style.css'
import { playBuzzer, playClick, playSuccess } from './audio/sfx'
import { Hover, collectInteractables } from './input/interactables'
import { setupLocomotion } from './input/locomotion'
import { setupPointerInput } from './input/pointer'
import { setupXrInput } from './input/xr'
import { ALLOWED_TARGETS, ProcedureMachine, type Procedure, parseProcedure } from './procedure/machine'
import { scoreAttempt } from './procedure/score'
import { Effects, Steam } from './scene/effects'
import { createWristHud, type WristHud } from './scene/hud-wrist'
import { loadSkid } from './scene/load-skid'
import { createWorldPanel } from './scene/world-panel'
import { debugLog, debugStatus } from './ui/debug-overlay'
import type { StepView } from './ui/hud'
import { createHud2d } from './ui/hud-2d'
import { createLoadingScreen } from './ui/loading-screen'
import { showScorePanel } from './ui/score-panel'
import { showToast } from './ui/toast'
import { reportXrSupport } from './ui/xr-support'

const mode = new URLSearchParams(location.search).get('mode') === 'vr' ? 'vr' : '2d'

/**
 * Handles turn a quarter turn about their own local Y, which is the axis the
 * model puts the stem on. The tag hangs rather than turning, because a plate
 * rotated 90 degrees would go edge on and look like it vanished.
 */
const ROTATING_TARGETS = new Set(['valve_inlet', 'valve_outlet', 'bleed'])
const CLOSE_ROTATION = -Math.PI / 2
const ROTATE_MS = 400
const PULSE_MS = 500
const STEAM_MS = 1000
const TAG_DROP_M = 0.06

/** Longest frame step any animation will see, about 10 fps. */
const MAX_FRAME_DELTA = 0.1

async function loadProcedure(): Promise<Procedure> {
  const response = await fetch('procedures/valve-isolation.json')
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return parseProcedure(await response.json())
}

async function boot(): Promise<void> {
  const app = document.querySelector<HTMLDivElement>('#app')!
  const loading = createLoadingScreen()

  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(window.innerWidth, window.innerHeight)
  app.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x0e1216)
  scene.fog = new THREE.Fog(0x0e1216, 9, 26)

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.05, 100)
  camera.position.set(2.4, 1.75, 2.6)

  // In an XR session the headset pose replaces camera.position outright; the
  // only thing that still offsets it is the camera's parent. So the rig is how
  // the player gets placed, and it is what controllers hang off.
  const rig = new THREE.Group()
  rig.name = 'player_rig'
  rig.add(camera)
  scene.add(rig)

  const grid = new THREE.GridHelper(24, 24, 0x51606d, 0x262d34)
  grid.name = 'floor_grid'
  scene.add(grid)

  scene.add(new THREE.HemisphereLight(0xa8c0d6, 0x24282d, 1.1))

  const keyLight = new THREE.DirectionalLight(0xffffff, 2)
  keyLight.position.set(3.5, 6, 4)
  scene.add(keyLight)

  const fillLight = new THREE.DirectionalLight(0xbcd2e8, 0.5)
  fillLight.position.set(-4, 3, -3)
  scene.add(fillLight)

  let skid: THREE.Object3D
  try {
    skid = await loadSkid((fraction) => loading.setProgress(fraction))
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    loading.fail(`Could not load the equipment. ${message}`)
    return
  }
  scene.add(skid)

  const { items, missing } = collectInteractables(skid, ALLOWED_TARGETS)
  if (missing.length > 0) {
    showToast(`Model is missing these nodes: ${missing.join(', ')}`, 'error', 0)
  }
  const itemsByName = new Map(items.map((item) => [item.name, item]))

  // Handles turn about their own local Y, so the model has to put local Y along
  // the stem. That is easy to get wrong in an export and invisible until a
  // wheel tumbles instead of spinning, so report the real axis rather than
  // letting it be discovered by eye.
  {
    const spin = new THREE.Vector3()
    const orientation = new THREE.Quaternion()
    for (const name of ROTATING_TARGETS) {
      const item = itemsByName.get(name)
      if (!item) continue
      item.object.getWorldQuaternion(orientation)
      spin.set(0, 1, 0).applyQuaternion(orientation).normalize()
      const vertical = Math.abs(spin.y) > 0.98 ? 'vertical' : 'NOT vertical'
      debugLog(
        `${name} spin axis ${spin.x.toFixed(2)}, ${spin.y.toFixed(2)}, ${spin.z.toFixed(2)} (${vertical})`,
      )
    }
  }

  const effects = new Effects()
  const steam = new Steam()
  scene.add(steam.points)

  // House rule: read positions from the model, never hardcode them.
  const steamOrigin = new THREE.Vector3(0, 1, 0)
  const ventNode = skid.getObjectByName('bleed') ?? skid.getObjectByName('pipe_run') ?? skid
  ventNode.getWorldPosition(steamOrigin)

  // The work area is centred on the equipment, measured rather than assumed.
  const skidBounds = new THREE.Box3().setFromObject(skid)
  const workAreaCenter = new THREE.Vector3()
  skidBounds.getCenter(workAreaCenter)
  workAreaCenter.y = 0

  const hover = new Hover()
  let machine: ProcedureMachine | null = null

  const hud2d = createHud2d()
  let wristHud: WristHud | null = null

  /** Null once the procedure is finished, which hides both HUDs. */
  function currentView(): StepView | null {
    if (!machine || machine.isComplete) return null
    const step = machine.currentStep
    if (!step) return null
    return {
      number: machine.stepNumber,
      total: machine.totalSteps,
      label: step.label,
      hint: step.hint,
    }
  }

  function refreshHud(): void {
    const view = currentView()
    hud2d.update(view)
    wristHud?.update(view)
    if (view) debugLog(`step ${view.number} of ${view.total}: ${view.label}`)
  }

  function showCompletion(finished: ProcedureMachine): void {
    const durationSeconds = (finished.durationMs() ?? 0) / 1000
    const errorCount = finished.snapshot().errors.length
    const summary = {
      title: finished.procedure.title,
      score: scoreAttempt({
        errorCount,
        durationSeconds,
        targetSeconds: finished.procedure.targetSeconds,
      }),
      durationSeconds,
      errorCount,
    }

    // Let the last handle finish turning before the result lands.
    window.setTimeout(() => {
      playSuccess()
      if (renderer.xr.isPresenting) {
        const panel = createWorldPanel(summary)
        panel.position.set(0, 1.45, -1.5)
        rig.add(panel)
      } else {
        showScorePanel(summary)
      }
    }, ROTATE_MS + 120)
  }

  // The one interact function. Both input adapters call this and nothing else.
  function interact(name: string): void {
    if (!machine) return

    const result = machine.interact(name)
    debugLog(`interact ${name} -> ${result}`)

    const item = itemsByName.get(name)
    if (!item) return

    if (result === 'advanced' || result === 'complete') {
      playClick()
      if (ROTATING_TARGETS.has(name)) effects.rotate(item.object, CLOSE_ROTATION, ROTATE_MS)
      else effects.drop(item.object, TAG_DROP_M, ROTATE_MS)
    }

    if (result === 'wrong') {
      playBuzzer()
      effects.pulse(item, 0xd8322a, PULSE_MS, () => hover.refresh(item))
      steam.burst(steamOrigin, STEAM_MS)
    }

    if (result === 'complete') {
      hover.clear()
      showCompletion(machine)
    }

    refreshHud()
  }

  const controls = new OrbitControls(camera, renderer.domElement)
  controls.target.set(0, 0.85, 0)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.minDistance = 1
  controls.maxDistance = 12
  controls.maxPolarAngle = Math.PI * 0.495 // stay above the floor plane
  controls.update()

  /** Completion freezes interaction, and XR owns highlighting in a session. */
  const inputSuspended = () => renderer.xr.isPresenting || (machine?.isComplete ?? false)

  setupPointerInput({
    domElement: renderer.domElement,
    camera,
    hover,
    items,
    onInteract: interact,
    isSuspended: inputSuspended,
  })

  let xrInput: ReturnType<typeof setupXrInput> | null = null
  let locomotion: ReturnType<typeof setupLocomotion> | null = null

  if (mode === 'vr') {
    renderer.xr.enabled = true
    renderer.xr.setReferenceSpaceType('local-floor')
    document.body.appendChild(VRButton.createButton(renderer))
    void reportXrSupport()

    wristHud = createWristHud()
    xrInput = setupXrInput({
      renderer,
      rig,
      hover,
      items,
      onInteract: interact,
      wristMount: wristHud.mesh,
    })
    locomotion = setupLocomotion({
      renderer,
      scene,
      rig,
      camera,
      effects,
      workAreaCenter,
      obstacle: skidBounds,
    })

    // Three writes the live headset pose straight into camera.position and
    // camera.quaternion on every frame of a session, and takes over the
    // projection matrix too. None of it is undone on exit, so the desktop pose
    // has to be saved going in and put back coming out.
    const savedPosition = new THREE.Vector3()
    const savedQuaternion = new THREE.Quaternion()
    const savedScale = new THREE.Vector3()

    renderer.xr.addEventListener('sessionstart', () => {
      savedPosition.copy(camera.position)
      savedQuaternion.copy(camera.quaternion)
      savedScale.copy(camera.scale)
      controls.enabled = false
      rig.position.set(0, 0, 2.4) // stand off the skid, floor at y = 0
    })

    renderer.xr.addEventListener('sessionend', () => {
      rig.position.set(0, 0, 0)
      rig.rotation.set(0, 0, 0)
      camera.position.copy(savedPosition)
      camera.quaternion.copy(savedQuaternion)
      camera.scale.copy(savedScale)
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
      hover.clear()
      controls.enabled = true
      controls.update()
    })
  }

  window.addEventListener('resize', () => {
    if (renderer.xr.isPresenting) return
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
  })

  // THREE.Clock is deprecated since r183 and warns on construction, which is
  // console noise in production. Timer replaces it but does not clamp: its
  // first update reports the whole page lifetime and any stall reports the
  // whole stall, either of which would jump every running tween to its end.
  const timer = new THREE.Timer()
  const headPosition = new THREE.Vector3()
  let lastLoopError = ''

  renderer.setAnimationLoop((timestamp: number) => {
    timer.update(timestamp)
    const delta = Math.min(timer.getDelta(), MAX_FRAME_DELTA)

    // A throw in here used to take the whole render with it, so the headset
    // went black with no way to see why. Keep drawing and surface the reason.
    try {
      if (renderer.xr.isPresenting) {
        locomotion?.update()
        camera.getWorldPosition(headPosition)
        wristHud?.faceCamera(headPosition)
        if (machine?.isComplete) hover.clear()
        else xrInput?.update()
      } else {
        controls.update()
      }

      effects.update(delta)
      steam.update(delta)
    } catch (error: unknown) {
      const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
      if (message !== lastLoopError) {
        lastLoopError = message
        debugLog(`loop error: ${message}`)
        showToast(`Frame error: ${message}`, 'error', 0)
      }
    }

    renderer.render(scene, camera)
  })

  try {
    const procedure = await loadProcedure()
    machine = new ProcedureMachine(procedure)
    machine.start()
    refreshHud()
  } catch (error: unknown) {
    showToast(`Could not load the procedure: ${String(error)}`, 'error', 0)
  }

  // Shows immediately, in either mode, so a stale page is obvious at a glance.
  debugStatus(`mode ${mode} | build ${__BUILD_ID__}`)
  loading.dismiss()
}

void boot()
