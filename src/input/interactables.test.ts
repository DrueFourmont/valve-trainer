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
  const lit = (item: { materials: { emissive: { getHex(): number } }[] }) =>
    item.materials[0].emissive.getHex() !== 0x000000

  it('lights only the hovered item and clears the previous one', () => {
    const { items } = collectInteractables(createSkid(), ['valve_inlet', 'valve_outlet'])
    const [inlet, outlet] = items
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
    // the left hand's target never lit until the right ray was moved away.
    const { items } = collectInteractables(createSkid(), ['valve_inlet', 'valve_outlet'])
    const [inlet, outlet] = items
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
    const { items } = collectInteractables(createSkid(), ['valve_inlet'])
    const [inlet] = items
    const hover = new Hover()

    hover.set('xr-0', inlet)
    hover.set('xr-1', inlet)
    hover.set('xr-0', null)
    expect(lit(inlet)).toBe(true)

    hover.clear()
    expect(lit(inlet)).toBe(false)
  })
})
