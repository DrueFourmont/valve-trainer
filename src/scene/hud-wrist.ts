import * as THREE from 'three'
import { type Hud, type StepView, trackerText } from '../ui/hud'

/**
 * The VR HUD. DOM does not exist inside an immersive session, so this is a
 * canvas on a plane parented to the left controller grip.
 *
 * Sizing, since VR text is judged in degrees of arc and not pixels. The canvas
 * is 640 px wide drawn onto a 0.17 m plane, so 1 px is about 0.27 mm. The step
 * label at 46 px is therefore about 12.2 mm tall. Read at roughly 0.35 m, the
 * distance to your own raised wrist, that is about 2.0 degrees of arc. Text
 * starts to strain below about 1 degree, and the Quest 3S panel is softer than
 * a monitor, so this still leaves headroom. The 30 px hint works out near 1.3
 * degrees, readable and deliberately quieter than the label.
 */

const CANVAS_WIDTH = 640
const CANVAS_HEIGHT = 360
const PANEL_WIDTH_M = 0.17

/**
 * Where the panel sits relative to the grip. Position comes from the grip so it
 * rides the wrist, but orientation does not: the panel turns to face the head
 * every frame instead.
 *
 * Grip space orientation differs between controller models and I got it wrong
 * twice guessing, once hanging the panel out in front like a sign and once
 * pointing it away from the reader. Facing the head is not a workaround for
 * that, it is the better behaviour anyway, because a rigidly mounted panel
 * becomes unreadable the moment the student rotates their wrist, which is
 * constantly.
 */
const MOUNT_POSITION = new THREE.Vector3(0, 0.05, 0.06)

/**
 * Aim an object's face at a point.
 *
 * Three's lookAt swaps eye and target for anything that is not a camera or a
 * light, so a mesh's +Z, which is the side a PlaneGeometry shows, ends up
 * pointing at the target already. Adding a half turn on top of it, which looks
 * like the obvious correction, points the panel away from the reader instead.
 * There is a test for this.
 */
export function faceTowards(object: THREE.Object3D, target: THREE.Vector3): void {
  object.lookAt(target)
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(' ')) {
    const candidate = line ? `${line} ${word}` : word
    if (ctx.measureText(candidate).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else {
      line = candidate
    }
  }
  if (line) lines.push(line)
  return lines
}

export interface WristHud extends Hud {
  readonly mesh: THREE.Mesh
  /** Call each frame with the head's world position. */
  faceCamera(headWorldPosition: THREE.Vector3): void
}

export function createWristHud(): WristHud {
  const canvas = document.createElement('canvas')
  canvas.width = CANVAS_WIDTH
  canvas.height = CANVAS_HEIGHT
  const ctx = canvas.getContext('2d')!

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4

  const height = (PANEL_WIDTH_M * CANVAS_HEIGHT) / CANVAS_WIDTH
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(PANEL_WIDTH_M, height),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true }),
  )
  mesh.name = 'wrist_hud'
  mesh.position.copy(MOUNT_POSITION)
  mesh.visible = false

  let lastKey = ''

  function draw(view: StepView): void {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    ctx.fillStyle = 'rgba(14, 18, 22, 0.94)'
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    ctx.strokeStyle = '#2f3a45'
    ctx.lineWidth = 5
    ctx.strokeRect(2.5, 2.5, CANVAS_WIDTH - 5, CANVAS_HEIGHT - 5)

    ctx.textAlign = 'left'

    ctx.fillStyle = '#9ad2ff'
    ctx.font = '600 34px system-ui, sans-serif'
    ctx.fillText(trackerText(view).toUpperCase(), 34, 66)

    ctx.fillStyle = '#e6edf3'
    ctx.font = '600 46px system-ui, sans-serif'
    let y = 140
    for (const line of wrapText(ctx, view.label, CANVAS_WIDTH - 68)) {
      ctx.fillText(line, 34, y)
      y += 54
    }

    ctx.fillStyle = '#9fb6cc'
    ctx.font = '400 30px system-ui, sans-serif'
    y += 12
    for (const line of wrapText(ctx, view.hint, CANVAS_WIDTH - 68)) {
      ctx.fillText(line, 34, y)
      y += 38
    }

    texture.needsUpdate = true
  }

  return {
    mesh,

    faceCamera(headWorldPosition: THREE.Vector3): void {
      if (!mesh.visible) return
      faceTowards(mesh, headWorldPosition)
    },

    update(view: StepView | null): void {
      if (!view) {
        mesh.visible = false
        return
      }
      const key = `${view.number}/${view.total}/${view.label}`
      if (key !== lastKey) {
        lastKey = key
        draw(view)
      }
      mesh.visible = true
    },
  }
}
