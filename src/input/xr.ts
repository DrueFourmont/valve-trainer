import * as THREE from 'three'
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js'
import { type Hover, type Interactable, pickInteractable } from './interactables'

/**
 * Controller adapter. Both hands get a rendered model and a ray. The ray is
 * trimmed to whatever it is touching, which is the VR equivalent of a hover
 * state and the reason trigger presses do not need a confirm step.
 *
 * Controllers live under the player rig, not the scene, because the rig is
 * what offsets XR space. Parent them to the scene and they detach from the
 * hands the moment the rig moves.
 */

const RAY_LENGTH = 5
const RAY_COLOR = 0x8fd0ff
const RAY_COLOR_HIT = 0x2ea8ff

function makeRay(): THREE.Line {
  const geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, -1),
  ])
  const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: RAY_COLOR }))
  line.name = 'controller_ray'
  line.scale.z = RAY_LENGTH
  return line
}

export function setupXrInput(opts: {
  renderer: THREE.WebGLRenderer
  rig: THREE.Object3D
  hover: Hover
  items: readonly Interactable[]
  onInteract: (name: string) => void
  /** Parented to whichever grip reports itself as the left hand. */
  wristMount?: THREE.Object3D
  /** Fires on any trigger press, whether or not it hit anything. */
  onSelect?: () => void
}): { update: () => void } {
  const { renderer, rig, hover, items, onInteract, wristMount, onSelect } = opts

  const raycaster = new THREE.Raycaster()
  const rotation = new THREE.Matrix4()
  const modelFactory = new XRControllerModelFactory()

  const hands = [0, 1].map((index) => {
    const controller = renderer.xr.getController(index)
    const ray = makeRay()
    controller.add(ray)
    rig.add(controller)

    const grip = renderer.xr.getControllerGrip(index)
    grip.add(modelFactory.createControllerModel(grip))
    rig.add(grip)

    const hand = { controller, ray, source: `xr-${index}`, hit: null as Interactable | null }

    controller.addEventListener('selectstart', () => {
      onSelect?.()
      if (hand.hit) onInteract(hand.hit.name)
    })

    controller.addEventListener('connected', (event) => {
      const handedness = (event as unknown as { data?: { handedness?: string } }).data?.handedness
      if (handedness === 'left' && wristMount) grip.add(wristMount)
    })

    return hand
  })

  return {
    /** Raycast both hands. Each hand lights its own target independently. */
    update(): void {
      for (const hand of hands) {
        rotation.identity().extractRotation(hand.controller.matrixWorld)
        raycaster.ray.origin.setFromMatrixPosition(hand.controller.matrixWorld)
        raycaster.ray.direction.set(0, 0, -1).applyMatrix4(rotation)

        const found = pickInteractable(raycaster, items)
        hand.hit = found?.item ?? null

        const material = hand.ray.material as THREE.LineBasicMaterial
        hand.ray.scale.z = found ? found.distance : RAY_LENGTH
        material.color.setHex(found ? RAY_COLOR_HIT : RAY_COLOR)

        hover.set(hand.source, hand.hit)
      }
    },
  }
}
