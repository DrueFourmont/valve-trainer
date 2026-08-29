import { showToast } from './toast'

/**
 * Decides whether an immersive session is possible, and says so in plain
 * language when it is not.
 *
 * A refusal here is not fatal. The scene, the procedure, and the scoring all
 * work with mouse and touch, so an unsupported browser falls back to the 2D
 * experience rather than showing a dead end.
 */
export async function canEnterVr(): Promise<boolean> {
  if (!window.isSecureContext) {
    showToast('WebXR needs a secure connection. Open this page over https.', 'error', 0)
    return false
  }

  if (!navigator.xr) {
    showToast(
      'This browser does not support WebXR, so the trainer is running in 2D. Drag to look around and tap the handles. For VR, open this page in the Meta Quest browser.',
      'info',
      12000,
    )
    return false
  }

  try {
    if (await navigator.xr.isSessionSupported('immersive-vr')) return true
    showToast(
      'No VR headset is available, so the trainer is running in 2D. Drag to look around and tap the handles.',
      'info',
      12000,
    )
    return false
  } catch {
    showToast('Could not check for VR support, so the trainer is running in 2D.', 'info', 12000)
    return false
  }
}
