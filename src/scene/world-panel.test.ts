import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'
import { disposePanel } from './world-panel'

/**
 * A stand in for a real panel. DataTexture rather than CanvasTexture so this
 * runs without a DOM, but it is the same disposal contract.
 */
function makePanel() {
  const geometry = new THREE.PlaneGeometry(0.9, 0.5)
  const map = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1)
  const material = new THREE.MeshBasicMaterial({ map, transparent: true })
  const mesh = new THREE.Mesh(geometry, material)

  const parent = new THREE.Object3D()
  parent.add(mesh)

  return {
    mesh,
    parent,
    spies: {
      geometry: vi.spyOn(geometry, 'dispose'),
      material: vi.spyOn(material, 'dispose'),
      texture: vi.spyOn(map, 'dispose'),
    },
  }
}

describe('disposePanel', () => {
  it('detaches the mesh and frees everything it holds on the GPU', () => {
    // Regression: removeFromParent alone detaches and frees nothing, so every
    // completed run and every session entry leaked a canvas texture.
    const { mesh, parent, spies } = makePanel()

    disposePanel(mesh)

    expect(parent.children).toHaveLength(0)
    expect(spies.geometry).toHaveBeenCalledTimes(1)
    expect(spies.material).toHaveBeenCalledTimes(1)
    expect(spies.texture).toHaveBeenCalledTimes(1)
  })

  it('does not throw on a panel that was never parented', () => {
    const geometry = new THREE.PlaneGeometry(1, 1)
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial())
    expect(() => disposePanel(mesh)).not.toThrow()
  })

  it('handles a material array', () => {
    const geometry = new THREE.PlaneGeometry(1, 1)
    const a = new THREE.MeshBasicMaterial()
    const b = new THREE.MeshBasicMaterial()
    const mesh = new THREE.Mesh(geometry, [a, b])

    const spyA = vi.spyOn(a, 'dispose')
    const spyB = vi.spyOn(b, 'dispose')

    disposePanel(mesh)

    expect(spyA).toHaveBeenCalledTimes(1)
    expect(spyB).toHaveBeenCalledTimes(1)
  })
})
