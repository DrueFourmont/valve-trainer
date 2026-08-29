import * as THREE from 'three'
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js'
import { type Interactable, pickInteractable } from './interactables'

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
  items: readonly Interactable[]
  onInteract: (name: string) => void
}): { update: () => Interactable | null } {
  const { renderer, rig, items, onInteract } = opts

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

    const hand = { controller, ray, hit: null as Interactable | null }

    controller.addEventListener('selectstart', () => {
      if (hand.hit) onInteract(hand.hit.name)
    })

    return hand
  })

  return {
    /** Raycast both hands. Returns whichever one is pointing at something. */
    update(): Interactable | null {
      let hovered: Interactable | null = null

      for (const hand of hands) {
        rotation.identity().extractRotation(hand.controller.matrixWorld)
        raycaster.ray.origin.setFromMatrixPosition(hand.controller.matrixWorld)
        raycaster.ray.direction.set(0, 0, -1).applyMatrix4(rotation)

        const found = pickInteractable(raycaster, items)
        hand.hit = found?.item ?? null

        const material = hand.ray.material as THREE.LineBasicMaterial
        hand.ray.scale.z = found ? found.distance : RAY_LENGTH
        material.color.setHex(found ? RAY_COLOR_HIT : RAY_COLOR)

        if (found) hovered = found.item
      }

      return hovered
    },
  }
}
