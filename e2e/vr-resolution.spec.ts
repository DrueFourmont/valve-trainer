import { expect, test } from '@playwright/test'
import { frames, openTrainer } from './harness'

test('the headset is rendered at a sane resolution', async ({ page }) => {
  await openTrainer(page, { mode: 'vr', xr: true })
  await page.locator('.vr-button').click()
  await page.waitForFunction(() => window.__trainer?.isPresenting() === true, undefined, {
    timeout: 20_000,
  })
  await frames(page, 10)

  const res = await page.evaluate(() => window.__trainer!.xrResolution())
  expect(res, 'no XR camera viewport to measure').not.toBeNull()

  console.log(
    `per eye ${res!.eyeWidth}x${res!.eyeHeight}, ` +
      `canvas ${res!.canvasWidth}x${res!.canvasHeight}, dpr ${res!.devicePixelRatio}`,
  )

  // A per eye buffer narrower than the canvas it lands on means the compositor
  // is upscaling, which is exactly what reads as blurry. three forces
  // setPixelRatio(1) inside a session, so on a 2x display the buffer has to be
  // supersampled to hold the line against the 2D view it came from.
  expect(res!.eyeWidth).toBeGreaterThanOrEqual(res!.canvasWidth - 1)
  expect(res!.eyeHeight).toBeGreaterThanOrEqual(res!.canvasHeight - 1)
})

/**
 * Measured, not assumed: at a 2x device pixel ratio the per eye buffer stays at
 * the canvas size, because the emulator sizes its framebuffer to the canvas and
 * ignores framebufferScaleFactor. So the softness of an emulator session on a
 * Retina display is the emulator, not the app, and raising the scale factor
 * cannot fix it. On a real headset the factor does apply, which is the case
 * this cannot cover and a Quest would have to answer.
 */
