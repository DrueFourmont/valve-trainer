import { describe, expect, it } from 'vitest'
import { createSkid } from '../scene/skid'
import { Hover, collectInteractables } from './interactables'

describe('collectInteractables', () => {
  it('finds every named node on the skid', () => {
    const { items, missing } = collectInteractables(createSkid(), ['valve_inlet', 'valve_outlet'])
    expect(items.map((i) => i.name)).toEqual(['valve_inlet', 'valve_outlet'])
    expect(missing).toEqual([])
  })

  it('reports names it could not find instead of throwing', () => {
    const { items, missing } = collectInteractables(createSkid(), ['valve_inlet', 'bleed'])
    expect(items.map((i) => i.name)).toEqual(['valve_inlet'])
    expect(missing).toEqual(['bleed'])
  })

  it('gives each interactable its own materials', () => {
    // The placeholder skid shares one handle material between both valves, so
    // without cloning, highlighting the inlet would light the outlet too.
    const { items } = collectInteractables(createSkid(), ['valve_inlet', 'valve_outlet'])
    const [inlet, outlet] = items
    expect(inlet.materials.length).toBeGreaterThan(0)
    for (const material of inlet.materials) {
      expect(outlet.materials).not.toContain(material)
    }
  })
})

describe('Hover', () => {
  it('lights only the hovered item and clears the previous one', () => {
    const { items } = collectInteractables(createSkid(), ['valve_inlet', 'valve_outlet'])
    const [inlet, outlet] = items
    const hover = new Hover()

    expect(inlet.materials[0].emissive.getHex()).toBe(0x000000)

    hover.set(inlet)
    expect(hover.name).toBe('valve_inlet')
    expect(inlet.materials[0].emissive.getHex()).not.toBe(0x000000)
    expect(outlet.materials[0].emissive.getHex()).toBe(0x000000)

    hover.set(outlet)
    expect(inlet.materials[0].emissive.getHex()).toBe(0x000000)
    expect(outlet.materials[0].emissive.getHex()).not.toBe(0x000000)

    hover.set(null)
    expect(hover.name).toBeNull()
    expect(outlet.materials[0].emissive.getHex()).toBe(0x000000)
  })
})
