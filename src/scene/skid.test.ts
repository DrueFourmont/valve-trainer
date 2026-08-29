import { describe, expect, it } from 'vitest'
import { HANDLE_NAMES, createSkid } from './skid'

// Guards the naming contract from CLAUDE.md. The placeholder gets deleted when
// the real GLB lands, but these node names have to survive that swap, so this
// test moves over to the loader rather than being thrown away with the skid.
describe('placeholder skid', () => {
  it('exposes every handle as a node found by name', () => {
    const skid = createSkid()
    for (const name of HANDLE_NAMES) {
      expect(skid.getObjectByName(name), `missing node: ${name}`).toBeDefined()
    }
  })
})
