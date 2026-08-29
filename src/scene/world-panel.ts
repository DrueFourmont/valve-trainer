import * as THREE from 'three'
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

  const height = (PANEL_WIDTH_M * CANVAS_HEIGHT) / CANVAS_WIDTH
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(PANEL_WIDTH_M, height),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true }),
  )
  mesh.name = 'score_panel'
  return mesh
}
