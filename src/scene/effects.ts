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

  /** Generic timed tween. Used by the teleport fade. */
  tween(durationMs: number, onProgress: (t: number) => void, onDone?: () => void): void {
    let elapsed = 0
    this.tweens.push((dt) => {
      elapsed += dt * 1000
      const t = Math.min(1, elapsed / durationMs)
      onProgress(t)
      if (t >= 1) {
        onDone?.()
        return false
      }
      return true
    })
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

const STEAM_COUNT = 160

/**
 * A soft round sprite. Without this, Points renders hard squares, which read
 * as confetti rather than vapour no matter how the motion is tuned.
 */
function softDotTexture(): THREE.CanvasTexture {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size

  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  gradient.addColorStop(0, 'rgba(255, 255, 255, 0.95)')
  gradient.addColorStop(0.35, 'rgba(255, 255, 255, 0.4)')
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/**
 * One reusable vent burst. Vents from wherever the model puts the pipe.
 *
 * Steam is a jet, not an explosion: particles go mostly up in a narrow cone,
 * they are seeded at staggered points along their own path so the burst reads
 * as continuous rather than as a single popped puff, and each one grows and
 * thins as it rises.
 */
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
      map: softDotTexture(),
      color: 0xe8f0f7,
      size: 0.09,
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
      const angle = Math.random() * Math.PI * 2
      // Narrow cone. Sideways speed is a fraction of the upward speed.
      const spread = Math.random() * 0.34
      const rise = 1.1 + Math.random() * 0.9

      this.velocities[i * 3] = Math.cos(angle) * spread
      this.velocities[i * 3 + 1] = rise
      this.velocities[i * 3 + 2] = Math.sin(angle) * spread

      // Seed each particle partway along its own path so the jet looks like it
      // has been running, instead of every particle appearing at the nozzle.
      const head = Math.random() * 0.4
      positions.setXYZ(
        i,
        origin.x + this.velocities[i * 3] * head + (Math.random() - 0.5) * 0.05,
        origin.y + this.velocities[i * 3 + 1] * head + (Math.random() - 0.5) * 0.05,
        origin.z + this.velocities[i * 3 + 2] * head + (Math.random() - 0.5) * 0.05,
      )
    }

    positions.needsUpdate = true
    this.elapsed = 0
    this.duration = durationMs
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
      // Loses speed sideways faster than it loses lift, so the plume narrows
      // at the base and keeps drifting up as it thins out.
      this.velocities[i * 3] *= 0.94
      this.velocities[i * 3 + 1] *= 0.985
      this.velocities[i * 3 + 2] *= 0.94
    }
    positions.needsUpdate = true

    // Quick to appear, slow to clear, like something actually venting.
    const fadeIn = Math.min(1, t / 0.12)
    this.material.opacity = 0.5 * fadeIn * (1 - t) ** 1.4
    this.material.size = 0.09 + t * 0.22

    if (t >= 1) this.duration = 0
  }
}
