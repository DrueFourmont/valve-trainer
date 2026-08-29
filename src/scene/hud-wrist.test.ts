import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { faceTowards } from './hud-wrist'

/** The +Z axis is the side a PlaneGeometry actually shows. */
function faceDirection(object: THREE.Object3D): THREE.Vector3 {
  return new THREE.Vector3(0, 0, 1).applyQuaternion(object.quaternion)
}

describe('faceTowards', () => {
  it('points the visible side of a plane at the target', () => {
    // Regression: adding a half turn after lookAt looks like the obvious
    // correction and turns the panel away from the reader instead.
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(1, 1))
    const target = new THREE.Vector3(0, 0, 5)

    faceTowards(panel, target)

    const toTarget = target.clone().sub(panel.position).normalize()
    expect(faceDirection(panel).dot(toTarget)).toBeCloseTo(1, 5)
  })

  it('works from an offset position and an awkward angle', () => {
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(1, 1))
    panel.position.set(-0.4, 1.1, 0.3)
    const target = new THREE.Vector3(0.2, 1.6, 2.1)

    faceTowards(panel, target)

    const toTarget = target.clone().sub(panel.position).normalize()
    expect(faceDirection(panel).dot(toTarget)).toBeCloseTo(1, 5)
  })
})
