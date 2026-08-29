import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { Hover, collectInteractables } from './interactables'

/**
 * A stand in for the loaded model. The shared material matters: a real GLB
 * reuses one material across parts, so highlighting one valve must not light
 * its twin.
 */
function makeScene(names: string[]): THREE.Object3D {
  const shared = new THREE.MeshStandardMaterial({ color: 0xc0442b })
  const root = new THREE.Object3D()

  for (const name of names) {
    const node = new THREE.Group()
    node.name = name
    node.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), shared))
    node.add(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.1), shared))
    root.add(node)
  }

  return root
}

const lit = (item: { materials: THREE.MeshStandardMaterial[] }) =>
  item.materials[0].emissive.getHex() !== 0x000000

describe('collectInteractables', () => {
  it('finds nodes by name', () => {
    const { items, missing } = collectInteractables(makeScene(['valve_inlet', 'bleed']), [
      'valve_inlet',
      'bleed',
    ])
    expect(items.map((i) => i.name)).toEqual(['valve_inlet', 'bleed'])
    expect(missing).toEqual([])
  })

  it('reports names it could not find instead of throwing', () => {
    const { items, missing } = collectInteractables(makeScene(['valve_inlet']), [
      'valve_inlet',
      'valve_bypass',
    ])
    expect(items.map((i) => i.name)).toEqual(['valve_inlet'])
    expect(missing).toEqual(['valve_bypass'])
  })

  it('gives each interactable its own materials', () => {
    const { items } = collectInteractables(makeScene(['valve_inlet', 'valve_outlet']), [
      'valve_inlet',
      'valve_outlet',
    ])
    const [inlet, outlet] = items
    expect(inlet.materials.length).toBeGreaterThan(0)
    for (const material of inlet.materials) {
      expect(outlet.materials).not.toContain(material)
    }
  })
})

describe('Hover', () => {
  const twoItems = () =>
    collectInteractables(makeScene(['valve_inlet', 'valve_outlet']), [
      'valve_inlet',
      'valve_outlet',
    ]).items

  it('lights only the hovered item and clears the previous one', () => {
    const [inlet, outlet] = twoItems()
    const hover = new Hover()

    expect(lit(inlet)).toBe(false)

    hover.set('pointer', inlet)
    expect(hover.itemFor('pointer')).toBe(inlet)
    expect(lit(inlet)).toBe(true)
    expect(lit(outlet)).toBe(false)

    hover.set('pointer', outlet)
    expect(lit(inlet)).toBe(false)
    expect(lit(outlet)).toBe(true)

    hover.set('pointer', null)
    expect(hover.itemFor('pointer')).toBeNull()
    expect(lit(outlet)).toBe(false)
  })

  it('lets two controllers light different targets at once', () => {
    // Regression: one shared hover slot meant the right hand always won and
    // the left hand's target never lit until the right ray moved away.
    const [inlet, outlet] = twoItems()
    const hover = new Hover()

    hover.set('xr-0', inlet)
    hover.set('xr-1', outlet)
    expect(lit(inlet)).toBe(true)
    expect(lit(outlet)).toBe(true)

    hover.set('xr-1', null)
    expect(lit(inlet)).toBe(true)
    expect(lit(outlet)).toBe(false)
  })

  it('keeps an item lit while any source is still on it', () => {
    const [inlet] = twoItems()
    const hover = new Hover()

    hover.set('xr-0', inlet)
    hover.set('xr-1', inlet)
    hover.set('xr-0', null)
    expect(lit(inlet)).toBe(true)

    hover.clear()
    expect(lit(inlet)).toBe(false)
  })
})
