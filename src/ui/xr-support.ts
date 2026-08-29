import { showToast } from './toast'

/**
 * Temporary diagnostic for checkpoint 0. Three's VRButton only ever says
 * "VR NOT SUPPORTED", which does not distinguish "no WebXR in this browser"
 * from "WebXR present but no device". This says which. In phase 6 it becomes
 * the real unsupported message that falls back to 2D.
 */
export async function reportXrSupport(): Promise<void> {
  if (!window.isSecureContext) {
    showToast('Not a secure context, so WebXR is blocked. Use the https URL.', 'error', 0)
    return
  }

  if (!navigator.xr) {
    showToast(
      'navigator.xr is missing. This browser is not exposing WebXR at all, which means the Immersive Web Emulator is not injecting into this page. Check that the extension is enabled, then hard reload.',
      'error',
      0,
    )
    return
  }

  try {
    const supported = await navigator.xr.isSessionSupported('immersive-vr')
    if (supported) {
      showToast('WebXR ready. immersive-vr is supported, so ENTER VR should work.', 'info', 6000)
    } else {
      showToast(
        'navigator.xr exists but immersive-vr is not supported. The emulator is loaded but has no headset selected, or you are in plain Chrome with no headset. Pick a device in the WebXR panel and reload.',
        'error',
        0,
      )
    }
  } catch (err) {
    showToast(`WebXR support check failed: ${String(err)}`, 'error', 0)
  }
}
