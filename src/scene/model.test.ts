import { readFileSync } from 'node:fs'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { ALLOWED_TARGETS } from '../procedure/machine'
import { NOTE_PANEL_OFFSET, SCORE_PANEL_OFFSET, STANDING_POSITION } from './layout'
import { NOTE_PANEL_SIZE, SCORE_PANEL_SIZE } from './world-panel'

/**
 * Checks the shipped skid.glb itself, not code.
 *
 * These are the things that are invisible in Blender, silent at export, and
 * only show up as a wheel that tumbles or a valve nobody can click. Reading the
 * glTF JSON chunk directly avoids needing a DOM to run GLTFLoader.
 */

interface GltfNode {
  name?: string
  mesh?: number
  children?: number[]
  matrix?: number[]
  translation?: number[]
  rotation?: number[]
  scale?: number[]
}

interface GltfPrimitive {
  attributes: Record<string, number>
  indices?: number
}

interface GltfMesh {
  primitives?: GltfPrimitive[]
}

interface GltfAccessor {
  min?: number[]
  max?: number[]
}

interface Gltf {
  nodes: GltfNode[]
  meshes: GltfMesh[]
  accessors: GltfAccessor[]
}

function readGlbJson(path: string): Gltf {
  const buffer = readFileSync(path)
  expect(buffer.toString('utf8', 0, 4), 'not a binary glTF').toBe('glTF')
  const jsonLength = buffer.readUInt32LE(12)
  return JSON.parse(buffer.toString('utf8', 20, 20 + jsonLength))
}

const gltf = readGlbJson(new URL('../../public/models/skid.glb', import.meta.url).pathname)

const parentOf = new Map<number, number>()
gltf.nodes.forEach((node, index) => {
  for (const child of node.children ?? []) parentOf.set(child, index)
})

function worldMatrix(index: number): THREE.Matrix4 {
  const chain: number[] = []
  for (let cursor: number | undefined = index; cursor !== undefined; cursor = parentOf.get(cursor)) {
    chain.unshift(cursor)
  }

  const world = new THREE.Matrix4()
  for (const step of chain) {
    const node = gltf.nodes[step]
    const local = node.matrix
      ? new THREE.Matrix4().fromArray(node.matrix)
      : new THREE.Matrix4().compose(
          new THREE.Vector3().fromArray(node.translation ?? [0, 0, 0]),
          new THREE.Quaternion().fromArray(node.rotation ?? [0, 0, 0, 1]),
          new THREE.Vector3().fromArray(node.scale ?? [1, 1, 1]),
        )
    world.multiply(local)
  }
  return world
}

function nodeIndex(name: string): number {
  return gltf.nodes.findIndex((node) => node.name === name)
}

describe('skid.glb', () => {
  it.each([...ALLOWED_TARGETS])('has a node named %s', (name) => {
    expect(nodeIndex(name), `no node named ${name}`).toBeGreaterThanOrEqual(0)
  })

  it.each(['valve_inlet', 'valve_outlet', 'bleed'])(
    '%s turns about a vertical axis',
    (name) => {
      // Handles rotate about their own local Y. If the export puts local Y
      // sideways the handle tumbles instead of turning, which is invisible
      // until someone looks at it in a headset.
      const orientation = new THREE.Quaternion()
      worldMatrix(nodeIndex(name)).decompose(
        new THREE.Vector3(),
        orientation,
        new THREE.Vector3(),
      )
      const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(orientation).normalize()
      expect(Math.abs(axis.y)).toBeGreaterThan(0.98)
    },
  )

  it.each([...ALLOWED_TARGETS])('%s is unscaled', (name) => {
    // Non uniform scale on an interactable skews its rotation.
    const scale = new THREE.Vector3()
    worldMatrix(nodeIndex(name)).decompose(new THREE.Vector3(), new THREE.Quaternion(), scale)
    expect(scale.x).toBeCloseTo(1, 3)
    expect(scale.y).toBeCloseTo(1, 3)
    expect(scale.z).toBeCloseTo(1, 3)
  })

  it('has no duplicate node names', () => {
    // Blender silently appends .001, which quietly breaks lookup by name.
    const names = gltf.nodes.map((node) => node.name).filter(Boolean)
    expect(new Set(names).size).toBe(names.length)
  })
})

describe('VR panels against the real equipment', () => {
  /** Everything the model draws, in world space. */
  function modelBounds(): THREE.Box3 {
    const box = new THREE.Box3()
    gltf.nodes.forEach((node, index) => {
      if (node.mesh === undefined) return
      const world = worldMatrix(index)
      for (const prim of gltf.meshes[node.mesh].primitives ?? []) {
        const accessor = gltf.accessors[prim.attributes.POSITION]
        if (!accessor?.min || !accessor?.max) continue
        box.union(
          new THREE.Box3(
            new THREE.Vector3().fromArray(accessor.min),
            new THREE.Vector3().fromArray(accessor.max),
          ).applyMatrix4(world),
        )
      }
    })
    return box
  }

  /** Panels face the student, so they are wide and tall and almost flat in Z. */
  function panelBounds(
    offset: THREE.Vector3,
    size: { width: number; height: number },
  ): THREE.Box3 {
    const centre = STANDING_POSITION.clone().add(offset)
    return new THREE.Box3().setFromCenterAndSize(
      centre,
      new THREE.Vector3(size.width, size.height, 0.04),
    )
  }

  const cases: [string, THREE.Vector3, { width: number; height: number }][] = [
    ['score panel', SCORE_PANEL_OFFSET, SCORE_PANEL_SIZE],
    ['onboarding panel', NOTE_PANEL_OFFSET, NOTE_PANEL_SIZE],
  ]

  it.each(cases)('the %s does not sit inside the equipment', (_name, offset, size) => {
    // Panels ignore depth so they always read, which means a panel overlapping
    // the skid would look like it is embedded in a pump rather than hidden.
    expect(modelBounds().intersectsBox(panelBounds(offset, size))).toBe(false)
  })

  it.each(cases)('the %s is in front of the student, not behind them', (_name, offset) => {
    // Rig forward is -Z at session start.
    expect(offset.z).toBeLessThan(0)
  })

  it.each(cases)('the %s sits at a readable distance', (_name, offset) => {
    // Closer than about a metre and a panel this size fills the view. Past two
    // and the text drops under the arc size the panel was designed for.
    const distance = Math.hypot(offset.x, offset.z)
    expect(distance).toBeGreaterThanOrEqual(1.0)
    expect(distance).toBeLessThanOrEqual(2.0)
  })
})
