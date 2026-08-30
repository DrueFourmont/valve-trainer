import * as THREE from 'three'
import { type Hud, type StepView, trackerText } from '../ui/hud'

/**
 * The VR HUD. DOM does not exist inside an immersive session, so this is a
 * canvas on a plane parented to the left controller grip.
 *
 * Sizing, since VR text is judged in degrees of arc and nothing else. At 0.22 m
 * the panel measured 30.5 degrees of the view, which is a phone held to your
 * face rather than a watch on your wrist. At 0.12 m it is near 20, which is the
 * size a glanceable readout wants to be.
 *
 * Shrinking the plane shrinks the type with it, so the type grew to compensate.
 * The canvas is 640 px wide on a 0.12 m plane, so 1 px is 0.1875 mm. The 68 px
 * label is 12.8 mm, about 1.8 degrees at the third of a metre you hold a hand
 * at, and the 46 px hint lands near 1.2. Both clear the roughly 1 degree floor
 * where text starts to strain, with the hint deliberately quieter.
 */

const CANVAS_WIDTH = 640
const CANVAS_HEIGHT = 400
const PANEL_WIDTH_M = 0.12

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
    // Depth tested against nothing, for the same reason as the other panels: a
    // step tracker you cannot read because your hand is behind a valve body is
    // worse than one that ignores the world.
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthTest: false }),
  )
  mesh.name = 'wrist_hud'
  mesh.renderOrder = 20
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
    ctx.font = '600 40px system-ui, sans-serif'
    ctx.fillText(trackerText(view).toUpperCase(), 30, 62)

    ctx.fillStyle = '#e6edf3'
    ctx.font = '600 68px system-ui, sans-serif'
    let y = 138
    for (const line of wrapText(ctx, view.label, CANVAS_WIDTH - 60)) {
      ctx.fillText(line, 30, y)
      y += 74
    }

    ctx.fillStyle = '#9fb6cc'
    ctx.font = '400 46px system-ui, sans-serif'
    y += 14
    for (const line of wrapText(ctx, view.hint, CANVAS_WIDTH - 60)) {
      ctx.fillText(line, 30, y)
      y += 52
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
