import * as THREE from 'three'

/**
 * The bridge between named nodes in the scene and the things a student can
 * touch. Everything downstream works in names, never in positions or indices,
 * so swapping the placeholder skid for the real GLB changes nothing here.
 */
export interface Interactable {
  name: string
  object: THREE.Object3D
  /** Cloned per interactable so highlighting one does not light up its twin. */
  materials: THREE.MeshStandardMaterial[]
}

const HOVER_COLOR = 0x2ea8ff
const HOVER_INTENSITY = 0.6

/**
 * Looks up each name in the scene graph. Returns what it found and what it did
 * not, so the caller can surface missing nodes instead of failing silently.
 */
export function collectInteractables(
  root: THREE.Object3D,
  names: readonly string[],
): { items: Interactable[]; missing: string[] } {
  const items: Interactable[] = []
  const missing: string[] = []

  for (const name of names) {
    const object = root.getObjectByName(name)
    if (!object) {
      missing.push(name)
      continue
    }

    // The placeholder skid shares one material across both valves, so without
    // cloning, hovering the inlet would also light the outlet.
    const materials: THREE.MeshStandardMaterial[] = []
    object.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return
      if (Array.isArray(child.material)) return
      if (!(child.material instanceof THREE.MeshStandardMaterial)) return
      child.material = child.material.clone()
      // Intensity is fixed here so hovering only ever changes the colour.
      // Emissive black means no glow, which is the natural resting state.
      child.material.emissiveIntensity = HOVER_INTENSITY
      materials.push(child.material)
    })

    items.push({ name, object, materials })
  }

  return { items, missing }
}

/** Walks up from a hit mesh to whichever interactable owns it. */
function ownerOf(hit: THREE.Object3D, items: readonly Interactable[]): Interactable | null {
  let node: THREE.Object3D | null = hit
  while (node) {
    const found = items.find((item) => item.object === node)
    if (found) return found
    node = node.parent
  }
  return null
}

export function pickInteractable(
  raycaster: THREE.Raycaster,
  items: readonly Interactable[],
): { item: Interactable; distance: number } | null {
  const hits = raycaster.intersectObjects(
    items.map((item) => item.object),
    true,
  )
  for (const hit of hits) {
    const item = ownerOf(hit.object, items)
    if (item) return { item, distance: hit.distance }
  }
  return null
}

/**
 * Tracks what each input source is pointing at. Sources are independent, so
 * the left and right controller can each light their own target, and an item
 * stays lit while any source is still on it.
 */
export class Hover {
  private bySource = new Map<string, Interactable>()

  itemFor(source: string): Interactable | null {
    return this.bySource.get(source) ?? null
  }

  set(source: string, next: Interactable | null): void {
    const previous = this.bySource.get(source) ?? null
    if (previous === next) return

    if (next) this.bySource.set(source, next)
    else this.bySource.delete(source)

    if (previous) this.repaint(previous)
    if (next) this.repaint(next)
  }

  clear(): void {
    const lit = [...this.bySource.values()]
    this.bySource.clear()
    for (const item of lit) this.repaint(item)
  }

  /** Re-apply the correct colour after something else borrowed the material. */
  refresh(item: Interactable): void {
    this.repaint(item)
  }

  private repaint(item: Interactable): void {
    let lit = false
    for (const value of this.bySource.values()) {
      if (value === item) {
        lit = true
        break
      }
    }
    paint(item, lit)
  }
}

function paint(item: Interactable, on: boolean): void {
  for (const material of item.materials) {
    material.emissive.setHex(on ? HOVER_COLOR : 0x000000)
  }
}
