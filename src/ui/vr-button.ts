import type * as THREE from 'three'
import { showToast } from './toast'

/**
 * Our own Enter VR button, rather than three's VRButton.
 *
 * The only reason to own the session request is the framebuffer scale. WebXR's
 * default of 1.0 is the "recommended" resolution, not the headset's native one,
 * and on a Quest that means rendering below panel resolution and letting the
 * compositor upscale. It is the usual reason a WebXR scene looks soft next to a
 * native app. Fixing it needs the native factor, which needs a live session,
 * and three reads its stored value while building the layer inside setSession.
 * So the order has to be: request session, measure, set factor, hand to three.
 *
 * 'layers' lets three use an XRProjectionLayer, which is both sharper and
 * cheaper on Quest than the base WebGL layer. Both paths honour the scale.
 */

const SESSION_FEATURES = ['local-floor', 'bounded-floor', 'layers']

/**
 * Clamped, because the native factor can be high enough that the extra fill
 * cost per eye outweighs the sharpness, and this scene already draws a
 * fullscreen background. 1.5 is a deliberate ceiling, not a measured optimum:
 * it needs checking on a real headset.
 */
export const MAX_FRAMEBUFFER_SCALE = 1.5

export function framebufferScale(native: number, max = MAX_FRAMEBUFFER_SCALE): number {
  // A device that reports nothing usable gets the WebXR default rather than NaN,
  // which would otherwise produce a zero sized framebuffer and a black headset.
  if (!Number.isFinite(native) || native <= 0) return 1
  return Math.min(native, max)
}

export function createVrButton(renderer: THREE.WebGLRenderer): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'vr-button'
  button.textContent = 'Enter VR'

  let active: XRSession | null = null

  function idle(): void {
    active = null
    button.textContent = 'Enter VR'
  }

  async function enter(): Promise<void> {
    if (!navigator.xr) return
    button.disabled = true

    try {
      const session = await navigator.xr.requestSession('immersive-vr', {
        optionalFeatures: SESSION_FEATURES,
      })

      // Before setSession, always. three reads this while building the layer,
      // and the setter warns and does nothing once a session is presenting.
      renderer.xr.setFramebufferScaleFactor(
        framebufferScale(XRWebGLLayer.getNativeFramebufferScaleFactor(session)),
      )

      await renderer.xr.setSession(session)
      session.addEventListener('end', idle, { once: true })

      active = session
      button.textContent = 'Exit VR'
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      showToast(`Could not start VR. ${message}`, 'error', 8000)
    } finally {
      button.disabled = false
    }
  }

  button.addEventListener('click', () => {
    if (active) void active.end()
    else void enter()
  })

  return button
}
