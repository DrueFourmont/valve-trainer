import { wantsEmulatedHeadset } from './enabled'

/** Inlined rather than imported so Rollup folds it and drops the import below. */
const DEV_TOOLS = import.meta.env.DEV || import.meta.env.MODE === 'test'

/**
 * Installs IWER, the emulated headset runtime, so automated tests can drive a
 * headset that does not exist.
 *
 * This has to run before anything reads navigator.xr, because installRuntime
 * replaces it wholesale. boot() awaits it as its first statement, ahead of the
 * renderer and ahead of the support check.
 */
export async function installEmulatedHeadset(): Promise<void> {
  if (!DEV_TOOLS) return
  if (!wantsEmulatedHeadset()) return

  const { XRDevice, metaQuest3 } = await import('iwer')
  const device = new XRDevice(metaQuest3)

  // forceInstall, because desktop Chrome already exposes a navigator.xr that
  // reports no headset, and IWER refuses to clobber a native runtime without
  // being told to. Without this the emulated device installs on a machine with
  // no WebXR and silently does nothing on a machine with it, which is the worst
  // possible split.
  device.installRuntime({ forceInstall: true })

  window.__iwer = device
}
