import * as THREE from 'three'
import type { Interactable } from '../input/interactables'

/**
 * Small time based effects, driven from the render loop. Deliberately not a
 * tween library: a tween is just a function that gets a delta and says whether
 * it wants to run again.
 */

type Tween = (deltaSeconds: number) => boolean

function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
}

export class Effects {
  private tweens: Tween[] = []

  update(deltaSeconds: number): void {
    if (this.tweens.length === 0) return
    this.tweens = this.tweens.filter((tween) => tween(deltaSeconds))
  }

  /** Turn a handle about its own Y axis, which is where the model puts it. */
  rotate(object: THREE.Object3D, deltaRadians: number, durationMs: number): void {
    const start = object.rotation.y
    let elapsed = 0
    this.tweens.push((dt) => {
      elapsed += dt * 1000
      const t = Math.min(1, elapsed / durationMs)
      object.rotation.y = start + deltaRadians * easeInOutQuad(t)
      return t < 1
    })
  }

  /** Used for the tag, which reads as hung rather than turned. */
  drop(object: THREE.Object3D, distance: number, durationMs: number): void {
    const start = object.position.y
    let elapsed = 0
    this.tweens.push((dt) => {
      elapsed += dt * 1000
      const t = Math.min(1, elapsed / durationMs)
      object.position.y = start - distance * easeInOutQuad(t)
      return t < 1
    })
  }

  /**
   * Flash an interactable. Takes a restore callback rather than caching the
   * old colour, because hover may have changed it while the flash was running.
   */
  pulse(item: Interactable, colorHex: number, durationMs: number, restore: () => void): void {
    const colour = new THREE.Color(colorHex)
    const scratch = new THREE.Color()
    let elapsed = 0

    this.tweens.push((dt) => {
      elapsed += dt * 1000
      const t = Math.min(1, elapsed / durationMs)
      // Two flashes across the burst, so it reads as an alarm not a fade.
      const strength = Math.abs(Math.sin(t * Math.PI * 2))
      for (const material of item.materials) {
        material.emissive.copy(scratch.copy(colour).multiplyScalar(strength))
      }
      if (t >= 1) {
        restore()
        return false
      }
      return true
    })
  }
}

const STEAM_COUNT = 90

/** One reusable particle burst. Vents from wherever the model puts the pipe. */
export class Steam {
  readonly points: THREE.Points
  private velocities: Float32Array
  private material: THREE.PointsMaterial
  private elapsed = 0
  private duration = 0

  constructor() {
    const positions = new Float32Array(STEAM_COUNT * 3)
    this.velocities = new Float32Array(STEAM_COUNT * 3)

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

    this.material = new THREE.PointsMaterial({
      color: 0xdce7f0,
      size: 0.07,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    })

    this.points = new THREE.Points(geometry, this.material)
    this.points.name = 'steam'
    this.points.frustumCulled = false
  }

  burst(origin: THREE.Vector3, durationMs: number): void {
    const positions = this.points.geometry.getAttribute('position') as THREE.BufferAttribute

    for (let i = 0; i < STEAM_COUNT; i++) {
      positions.setXYZ(
        i,
        origin.x + (Math.random() - 0.5) * 0.08,
        origin.y + (Math.random() - 0.5) * 0.08,
        origin.z + (Math.random() - 0.5) * 0.08,
      )
      // Mostly sideways and up, like a relief valve rather than a fountain.
      const angle = Math.random() * Math.PI * 2
      const spread = 0.5 + Math.random() * 0.9
      this.velocities[i * 3] = Math.cos(angle) * spread
      this.velocities[i * 3 + 1] = 0.7 + Math.random() * 1.1
      this.velocities[i * 3 + 2] = Math.sin(angle) * spread
    }

    positions.needsUpdate = true
    this.elapsed = 0
    this.duration = durationMs
    this.material.opacity = 0.85
  }

  update(deltaSeconds: number): void {
    if (this.duration === 0) return

    this.elapsed += deltaSeconds * 1000
    const t = Math.min(1, this.elapsed / this.duration)

    const positions = this.points.geometry.getAttribute('position') as THREE.BufferAttribute
    for (let i = 0; i < STEAM_COUNT; i++) {
      positions.setXYZ(
        i,
        positions.getX(i) + this.velocities[i * 3] * deltaSeconds,
        positions.getY(i) + this.velocities[i * 3 + 1] * deltaSeconds,
        positions.getZ(i) + this.velocities[i * 3 + 2] * deltaSeconds,
      )
      // Slow down as it disperses.
      this.velocities[i * 3] *= 0.97
      this.velocities[i * 3 + 1] *= 0.98
      this.velocities[i * 3 + 2] *= 0.97
    }
    positions.needsUpdate = true

    this.material.opacity = 0.85 * (1 - t)
    this.material.size = 0.07 + t * 0.09

    if (t >= 1) this.duration = 0
  }
}
