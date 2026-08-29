import * as THREE from 'three'
import { type Hover, type Interactable, pickInteractable } from './interactables'

/**
 * Mouse and touch adapter. The gesture rule is press to preview, lift to
 * commit: pressing a target highlights it, and the action only fires if the
 * finger lifts without having wandered past the drag threshold. That way an
 * orbit drag that happens to start on a handwheel never scores an error.
 */

/** CSS pixels of travel that turn a tap into an orbit drag. */
const DRAG_THRESHOLD_PX = 10

const SOURCE = 'pointer'

export function setupPointerInput(opts: {
  domElement: HTMLElement
  camera: THREE.Camera
  hover: Hover
  items: readonly Interactable[]
  onInteract: (name: string) => void
  /** XR owns highlighting while a session is running, so stand down. */
  isSuspended: () => boolean
}): void {
  const { domElement, camera, hover, items, onInteract, isSuspended } = opts

  const raycaster = new THREE.Raycaster()
  const ndc = new THREE.Vector2()

  let pressedOn: Interactable | null = null
  let startX = 0
  let startY = 0
  let dragged = false

  function pick(event: PointerEvent): Interactable | null {
    const rect = domElement.getBoundingClientRect()
    ndc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    ndc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    raycaster.setFromCamera(ndc, camera)
    return pickInteractable(raycaster, items)?.item ?? null
  }

  domElement.addEventListener('pointerdown', (event) => {
    if (isSuspended()) return
    startX = event.clientX
    startY = event.clientY
    dragged = false
    pressedOn = pick(event)
    hover.set(SOURCE, pressedOn)
  })

  domElement.addEventListener('pointermove', (event) => {
    if (isSuspended()) return

    if (pressedOn) {
      const moved = Math.hypot(event.clientX - startX, event.clientY - startY)
      if (!dragged && moved > DRAG_THRESHOLD_PX) {
        // Became an orbit drag. Drop the preview so nothing looks armed.
        dragged = true
        pressedOn = null
        hover.set(SOURCE, null)
      }
      return
    }

    // A mouse can hover without pressing. A finger cannot, which is exactly
    // why press to preview exists.
    if (event.pointerType === 'mouse') hover.set(SOURCE, pick(event))
  })

  domElement.addEventListener('pointerup', (event) => {
    if (isSuspended()) return

    if (pressedOn && !dragged && pick(event) === pressedOn) {
      onInteract(pressedOn.name)
    }
    pressedOn = null

    // Leave the highlight up under a mouse cursor, clear it after a finger.
    if (event.pointerType !== 'mouse') hover.set(SOURCE, null)
  })

  const cancel = () => {
    pressedOn = null
    dragged = false
    hover.set(SOURCE, null)
  }
  domElement.addEventListener('pointercancel', cancel)
  domElement.addEventListener('pointerleave', cancel)
}
