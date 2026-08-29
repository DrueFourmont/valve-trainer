import { readFileSync } from 'node:fs'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { ALLOWED_TARGETS } from '../procedure/machine'

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

function readGlbJson(path: string): { nodes: GltfNode[] } {
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
