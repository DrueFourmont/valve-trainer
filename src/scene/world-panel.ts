import * as THREE from 'three'
import { ONBOARDING } from '../ui/onboarding'
import { type AttemptSummary, summaryLines } from '../ui/score-panel'

/**
 * The VR score panel. DOM does not exist inside an immersive session, so this
 * is a canvas drawn onto a plane.
 *
 * Sizing: the canvas is 1024 px wide and drawn onto a 0.9 m plane, so the 76 px
 * heading is about 6.7 cm tall. Parked 1.5 m away that is roughly 2.5 degrees
 * of arc, comfortably above the 1 degree or so where text starts to strain,
 * with headroom for the Quest 3S panel not being as sharp as a monitor.
 */

const CANVAS_WIDTH = 1024
const CANVAS_HEIGHT = 640
const PANEL_WIDTH_M = 0.9

/**
 * Panels draw over the scene rather than being depth tested against it. They
 * are UI: a result card the student cannot read because a pump is between them
 * and it is worse than a card that ignores the world.
 */
const PANEL_RENDER_ORDER = 30

/** Exported so a test can prove the panel clears the equipment. */
export const SCORE_PANEL_SIZE = {
  width: PANEL_WIDTH_M,
  height: (PANEL_WIDTH_M * CANVAS_HEIGHT) / CANVAS_WIDTH,
}

export function createWorldPanel(summary: AttemptSummary): THREE.Mesh {
  const canvas = document.createElement('canvas')
  canvas.width = CANVAS_WIDTH
  canvas.height = CANVAS_HEIGHT

  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#161c23'
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
  ctx.strokeStyle = '#2f3a45'
  ctx.lineWidth = 6
  ctx.strokeRect(3, 3, CANVAS_WIDTH - 6, CANVAS_HEIGHT - 6)

  ctx.textAlign = 'center'

  ctx.fillStyle = '#9fb6cc'
  ctx.font = '600 56px system-ui, sans-serif'
  ctx.fillText(summary.title, CANVAS_WIDTH / 2, 120)

  ctx.fillStyle = '#e6edf3'
  ctx.font = '700 200px system-ui, sans-serif'
  ctx.fillText(String(summary.score), CANVAS_WIDTH / 2, 350)

  ctx.fillStyle = '#9fb6cc'
  ctx.font = '500 76px system-ui, sans-serif'
  const [, time, errors] = summaryLines(summary)
  ctx.fillText(time, CANVAS_WIDTH / 2, 470)
  ctx.fillText(errors, CANVAS_WIDTH / 2, 560)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4

  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(SCORE_PANEL_SIZE.width, SCORE_PANEL_SIZE.height),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthTest: false }),
  )
  mesh.name = 'score_panel'
  mesh.renderOrder = PANEL_RENDER_ORDER
  return mesh
}

/**
 * Frees what a panel holds on the GPU.
 *
 * removeFromParent detaches the mesh and frees nothing. These panels are rebuilt
 * on every completed run and every session entry, each carrying a canvas texture
 * of a megabyte or more, so without this a student who runs the procedure a few
 * times accumulates every previous panel on a headset with far less memory
 * headroom than a desktop.
 */
export function disposePanel(mesh: THREE.Mesh): void {
  mesh.removeFromParent()
  mesh.geometry.dispose()

  for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
    const textured = material as THREE.MeshBasicMaterial
    textured.map?.dispose()
    material.dispose()
  }
}

const NOTE_CANVAS = { width: 1024, height: 300 }

/** Exported so a test can prove the panel clears the equipment. */
export const NOTE_PANEL_SIZE = {
  width: 0.62,
  height: (0.62 * NOTE_CANVAS.height) / NOTE_CANVAS.width,
}

/**
 * The VR onboarding card. Same reason as the score panel: there is no DOM
 * inside a session, so guidance has to be geometry.
 *
 * Sized wider and shorter than the score panel because it holds two sentences
 * rather than one number. At 0.62 m wide and parked 1.6 m away, the 38 px body
 * text works out around 1.3 degrees of arc, which is readable without being so
 * large that it covers the equipment it is describing.
 */
export function createNotePanel(): THREE.Mesh {
  const width = NOTE_CANVAS.width
  const height = NOTE_CANVAS.height

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = 'rgba(14, 18, 22, 0.92)'
  ctx.fillRect(0, 0, width, height)
  ctx.strokeStyle = '#2f3a45'
  ctx.lineWidth = 5
  ctx.strokeRect(2.5, 2.5, width - 5, height - 5)

  ctx.textAlign = 'center'

  ctx.fillStyle = '#9ad2ff'
  ctx.font = '600 34px system-ui, sans-serif'
  ctx.fillText('GETTING STARTED', width / 2, 74)

  ctx.fillStyle = '#e6edf3'
  ctx.font = '400 38px system-ui, sans-serif'
  let y = 152
  for (const line of ONBOARDING.vr) {
    ctx.fillText(line, width / 2, y)
    y += 62
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4

  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(NOTE_PANEL_SIZE.width, NOTE_PANEL_SIZE.height),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthTest: false }),
  )
  mesh.name = 'onboarding_panel'
  mesh.renderOrder = PANEL_RENDER_ORDER
  return mesh
}
