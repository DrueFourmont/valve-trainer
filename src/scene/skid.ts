import * as THREE from 'three'

/**
 * Day-1 placeholder skid built from primitives.
 *
 * CLAUDE.md says interactables are named GLB nodes and positions are read from
 * the model, not hardcoded. That holds once the authored skid.glb exists; until
 * then every dimension lives in LAYOUT below and nowhere else, so swapping this
 * module for a GLTFLoader is a delete, not a refactor. The node names are the
 * contract that survives the swap.
 */
export const HANDLE_NAMES = ['valve_inlet', 'valve_outlet'] as const
export type HandleName = (typeof HANDLE_NAMES)[number]

const LAYOUT = {
  deck: { size: [2.8, 0.12, 1.1] as const, y: 0.06 },
  pipe: { radius: 0.085, length: 2.6, y: 0.8 },
  pedestalX: 1.15,
  /** Drain valve hanging under the pipe run, lever turns about its own Y. */
  bleed: { stub: { radius: 0.035, height: 0.18 }, body: 0.12, lever: { length: 0.2, thickness: 0.03 } },
  /** Post and plate where the lockout tag gets hung. */
  tag: { x: -1.3, plateY: 1.05, post: 0.05, plate: [0.17, 0.21, 0.02] as const },
  /** Valve centre positions along the pipe run; inlet upstream at -X. */
  valves: {
    valve_inlet: -0.6,
    valve_outlet: 0.6,
  } satisfies Record<HandleName, number>,
  valve: {
    body: 0.26,
    bonnet: { radius: 0.08, height: 0.2 },
    stem: { radius: 0.022, height: 0.16 },
    wheel: { radius: 0.15, tube: 0.022 },
  },
} as const

const materials = {
  frame: new THREE.MeshStandardMaterial({ color: 0x394049, roughness: 0.8, metalness: 0.1 }),
  pipe: new THREE.MeshStandardMaterial({ color: 0x8d949c, roughness: 0.45, metalness: 0.35 }),
  valveBody: new THREE.MeshStandardMaterial({ color: 0x4a5a68, roughness: 0.6, metalness: 0.25 }),
  handle: new THREE.MeshStandardMaterial({ color: 0xc0442b, roughness: 0.5, metalness: 0.1 }),
  tag: new THREE.MeshStandardMaterial({ color: 0xd7a92b, roughness: 0.7, metalness: 0.05 }),
}

function box(w: number, h: number, d: number, material: THREE.Material, name: string) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material)
  mesh.name = name
  return mesh
}

/**
 * One valve: fixed body + bonnet, plus a handle group whose origin sits on the
 * stem axis so a future turn interaction is a rotation about the group's Y.
 */
function createValve(name: HandleName, x: number): THREE.Group {
  const { body, bonnet, stem, wheel } = LAYOUT.valve
  const pipeY = LAYOUT.pipe.y

  const valve = new THREE.Group()
  valve.name = `${name}_assembly`
  valve.position.set(x, 0, 0)

  const bodyMesh = box(body, body, body, materials.valveBody, `${name}_body`)
  bodyMesh.position.y = pipeY
  valve.add(bodyMesh)

  const bonnetMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(bonnet.radius, bonnet.radius, bonnet.height),
    materials.valveBody,
  )
  bonnetMesh.name = `${name}_bonnet`
  bonnetMesh.position.y = pipeY + body / 2 + bonnet.height / 2
  valve.add(bonnetMesh)

  const handle = new THREE.Group()
  handle.name = name
  handle.position.y = pipeY + body / 2 + bonnet.height

  const stemMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(stem.radius, stem.radius, stem.height),
    materials.handle,
  )
  stemMesh.name = `${name}_stem`
  stemMesh.position.y = stem.height / 2
  handle.add(stemMesh)

  const wheelMesh = new THREE.Mesh(
    new THREE.TorusGeometry(wheel.radius, wheel.tube, 12, 32),
    materials.handle,
  )
  wheelMesh.name = `${name}_wheel`
  wheelMesh.rotation.x = -Math.PI / 2
  wheelMesh.position.y = stem.height
  handle.add(wheelMesh)

  for (let i = 0; i < 2; i++) {
    const spoke = box(wheel.radius * 2, wheel.tube, wheel.tube, materials.handle, `${name}_spoke_${i}`)
    spoke.rotation.y = (i * Math.PI) / 2
    spoke.position.y = stem.height
    handle.add(spoke)
  }

  valve.add(handle)
  return valve
}

/** Drain valve under the pipe. The lever group turns about its own Y axis. */
function createBleed(): THREE.Group {
  const { stub, body, lever } = LAYOUT.bleed
  const pipeY = LAYOUT.pipe.y

  const group = new THREE.Group()
  group.name = 'bleed_assembly'

  const stubMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(stub.radius, stub.radius, stub.height),
    materials.pipe,
  )
  stubMesh.name = 'bleed_stub'
  stubMesh.position.y = pipeY - LAYOUT.pipe.radius - stub.height / 2
  group.add(stubMesh)

  const bodyY = pipeY - LAYOUT.pipe.radius - stub.height - body / 2

  const bodyMesh = box(body, body, body, materials.valveBody, 'bleed_body')
  bodyMesh.position.y = bodyY
  group.add(bodyMesh)

  const handle = new THREE.Group()
  handle.name = 'bleed'
  handle.position.y = bodyY

  const leverMesh = box(lever.length, lever.thickness, lever.thickness, materials.handle, 'bleed_lever')
  leverMesh.position.x = lever.length / 2
  handle.add(leverMesh)

  group.add(handle)
  return group
}

/** Post and hanging plate. The plate is the interactable, the post is not. */
function createTagPoint(): THREE.Group {
  const { x, plateY, post, plate } = LAYOUT.tag

  const group = new THREE.Group()
  group.name = 'tag_assembly'
  group.position.x = x

  const deckTop = LAYOUT.deck.y + LAYOUT.deck.size[1] / 2
  const postHeight = plateY - deckTop

  const postMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(post / 2, post / 2, postHeight),
    materials.frame,
  )
  postMesh.name = 'tag_post'
  postMesh.position.y = deckTop + postHeight / 2
  group.add(postMesh)

  const plateGroup = new THREE.Group()
  plateGroup.name = 'tag_point'
  plateGroup.position.y = plateY

  const plateMesh = box(...plate, materials.tag, 'tag_plate')
  plateGroup.add(plateMesh)

  group.add(plateGroup)
  return group
}

export function createSkid(): THREE.Group {
  const skid = new THREE.Group()
  skid.name = 'skid'

  const deck = box(...LAYOUT.deck.size, materials.frame, 'skid_deck')
  deck.position.y = LAYOUT.deck.y
  skid.add(deck)

  const pipe = new THREE.Mesh(
    new THREE.CylinderGeometry(LAYOUT.pipe.radius, LAYOUT.pipe.radius, LAYOUT.pipe.length, 24),
    materials.pipe,
  )
  pipe.name = 'pipe_run'
  pipe.rotation.z = Math.PI / 2
  pipe.position.y = LAYOUT.pipe.y
  skid.add(pipe)

  const deckTop = LAYOUT.deck.y + LAYOUT.deck.size[1] / 2
  const pedestalHeight = LAYOUT.pipe.y - LAYOUT.pipe.radius - deckTop
  for (const side of [-1, 1]) {
    const pedestal = box(0.12, pedestalHeight, 0.12, materials.frame, `pipe_support_${side < 0 ? 'a' : 'b'}`)
    pedestal.position.set(side * LAYOUT.pedestalX, deckTop + pedestalHeight / 2, 0)
    skid.add(pedestal)
  }

  for (const name of HANDLE_NAMES) {
    skid.add(createValve(name, LAYOUT.valves[name]))
  }

  skid.add(createBleed())
  skid.add(createTagPoint())

  return skid
}
