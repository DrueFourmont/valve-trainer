import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { VRButton } from 'three/addons/webxr/VRButton.js'
import './style.css'
import { playBuzzer, playClick, playSuccess } from './audio/sfx'
import { Hover, collectInteractables } from './input/interactables'
import { setupPointerInput } from './input/pointer'
import { setupXrInput } from './input/xr'
import { ALLOWED_TARGETS, ProcedureMachine, type Procedure, parseProcedure } from './procedure/machine'
import { scoreAttempt } from './procedure/score'
import { Effects, Steam } from './scene/effects'
import { createSkid } from './scene/skid'
import { createWorldPanel } from './scene/world-panel'
import { debugLog } from './ui/debug-overlay'
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

// House rule: read positions from the model. The vent comes off the pipe run,
// wherever the model happens to put it.
const steamOrigin = new THREE.Vector3(0, 1, 0)
skid.getObjectByName('pipe_run')?.getWorldPosition(steamOrigin)

const hover = new Hover()
let machine: ProcedureMachine | null = null

function announceStep(): void {
  if (!machine) return
  const step = machine.currentStep
  if (step) debugLog(`step ${machine.stepNumber} of ${machine.totalSteps}: ${step.label}`)
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
  } else {
    announceStep()
  }
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

if (mode === 'vr') {
  renderer.xr.enabled = true
  renderer.xr.setReferenceSpaceType('local-floor')
  document.body.appendChild(VRButton.createButton(renderer))
  void reportXrSupport()

  xrInput = setupXrInput({ renderer, rig, hover, items, onInteract: interact })

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

renderer.setAnimationLoop(() => {
  const delta = clock.getDelta()

  if (renderer.xr.isPresenting) {
    if (machine?.isComplete) hover.clear()
    else xrInput?.update()
  } else {
    controls.update()
  }

  effects.update(delta)
  steam.update(delta)
  renderer.render(scene, camera)
})

async function loadProcedure(): Promise<Procedure> {
  const response = await fetch('procedures/valve-isolation.json')
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return parseProcedure(await response.json())
}

loadProcedure()
  .then((procedure) => {
    machine = new ProcedureMachine(procedure)
    machine.start()
    announceStep()
  })
  .catch((error: unknown) => {
    showToast(`Could not load the procedure: ${String(error)}`, 'error', 0)
  })
