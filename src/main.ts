import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { VRButton } from 'three/addons/webxr/VRButton.js'
import './style.css'
import { playBuzzer, playClick, playSuccess } from './audio/sfx'
import { Hover, collectInteractables } from './input/interactables'
import { setupPointerInput } from './input/pointer'
import { setupLocomotion } from './input/locomotion'
import { setupXrInput } from './input/xr'
import { ALLOWED_TARGETS, ProcedureMachine, type Procedure, parseProcedure } from './procedure/machine'
import { scoreAttempt } from './procedure/score'
import { Effects, Steam } from './scene/effects'
import { createWristHud, type WristHud } from './scene/hud-wrist'
import { createSkid } from './scene/skid'
import { createWorldPanel } from './scene/world-panel'
import { debugLog, debugStatus } from './ui/debug-overlay'
import { createHud2d } from './ui/hud-2d'
import type { StepView } from './ui/hud'
import { showScorePanel } from './ui/score-panel'
import { showToast } from './ui/toast'
import { reportXrSupport } from './ui/xr-support'

const mode = new URLSearchParams(location.search).get('mode') === 'vr' ? 'vr' : '2d'

/** Handles turn clockwise seen from above, which is closing. The tag hangs. */
const ROTATING_TARGETS = new Set(['valve_inlet', 'valve_outlet', 'bleed'])
const CLOSE_ROTATION = -Math.PI / 2
const ROTATE_MS = 400
const PULSE_MS = 500
const STEAM_MS = 1000

const app = document.querySelector<HTMLDivElement>('#app')!

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(window.innerWidth, window.innerHeight)
app.appendChild(renderer.domElement)

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x0e1216)
scene.fog = new THREE.Fog(0x0e1216, 9, 26)

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.05, 100)
camera.position.set(2.4, 1.75, 2.6)

// In an XR session the headset pose replaces camera.position outright; the only
// thing that still offsets it is the camera's parent. So the rig is how the
// player gets placed, and it is also what controllers have to hang off.
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

const skid = createSkid()
scene.add(skid)

const { items, missing } = collectInteractables(skid, ALLOWED_TARGETS)
if (missing.length > 0) {
  showToast(`Missing interactable nodes: ${missing.join(', ')}`, 'error', 0)
}
const itemsByName = new Map(items.map((item) => [item.name, item]))

const effects = new Effects()
const steam = new Steam()
scene.add(steam.points)

// House rule: read positions from the model, never hardcode them. Venting from
// the bleed valve is where a real drain would let go, and it lines up with the
// phase 7 consequence for bleeding a line that is still pressurised. Falls back
// to the pipe run so a GLB missing the bleed node still vents somewhere sane.
const steamOrigin = new THREE.Vector3(0, 1, 0)
const ventNode = skid.getObjectByName('bleed') ?? skid.getObjectByName('pipe_run')
ventNode?.getWorldPosition(steamOrigin)

// Work area is centred on the equipment, measured rather than assumed, so it
// still lands correctly when the placeholder is swapped for the real GLB.
const workAreaCenter = new THREE.Vector3()
new THREE.Box3().setFromObject(skid).getCenter(workAreaCenter)
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
    else effects.drop(item.object, 0.06, ROTATE_MS)
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

/** Completion freezes interaction, and XR owns highlighting during a session. */
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
  locomotion = setupLocomotion({ renderer, scene, rig, camera, effects, workAreaCenter, onDebug: debugStatus })

  // Three writes the live headset pose straight into camera.position and
  // camera.quaternion on every frame of a session (setProjectionFromUnion in
  // WebXRManager), and it takes over the projection matrix too. None of that is
  // undone on exit, so the desktop pose has to be saved going in and put back
  // coming out, or you land wherever your head happened to be.
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

const clock = new THREE.Clock()

let lastLoopError = ''

renderer.setAnimationLoop(() => {
  const delta = clock.getDelta()

  // A throw in here used to take the whole render with it, so the headset went
  // black with no way to see why. Keep drawing and surface the reason instead.
  try {
    if (renderer.xr.isPresenting) {
      locomotion?.update()
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

async function loadProcedure(): Promise<Procedure> {
  const response = await fetch('procedures/valve-isolation.json')
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return parseProcedure(await response.json())
}

// Shows immediately, in either mode, so a stale page is obvious at a glance.
debugStatus(`mode ${mode} | build ${__BUILD_ID__}`)

loadProcedure()
  .then((procedure) => {
    machine = new ProcedureMachine(procedure)
    machine.start()
    refreshHud()
  })
  .catch((error: unknown) => {
    showToast(`Could not load the procedure: ${String(error)}`, 'error', 0)
  })
