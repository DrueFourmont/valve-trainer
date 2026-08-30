import { expect, test } from '@playwright/test'
import { frames, openTrainer } from './harness'

async function enter(page: import('@playwright/test').Page): Promise<void> {
  await page.locator('.vr-button').click()
  await page.waitForFunction(() => window.__trainer?.isPresenting() === true, undefined, {
    timeout: 20_000,
  })
  await frames(page, 10)
}

test('vr panels are legible sizes and the aiming aids are drawn', async ({ page }) => {
  await openTrainer(page, { mode: 'vr', xr: true })
  await enter(page)

  // Image based lighting is the difference between machined metal and a
  // diagram, and it fails by silently not loading.
  expect(await page.evaluate(() => window.__trainer!.hasEnvironment())).toBe(true)

  const panels = await page.evaluate(() => ({
    wrist: {
      visible: window.__trainer!.visible('wrist_hud'),
      degrees: window.__trainer!.angularSize('wrist_hud'),
    },
    note: {
      visible: window.__trainer!.visible('onboarding_panel'),
      degrees: window.__trainer!.angularSize('onboarding_panel'),
    },
  }))
  console.log('PANELS', JSON.stringify(panels))

  // Apparent size is the only unit that means anything here. A wrist readout
  // over about 24 degrees is a phone held to your face, and one under about 12
  // cannot carry legible type.
  expect(panels.wrist.visible).toBe(true)
  expect(panels.wrist.degrees).toBeGreaterThan(12)
  expect(panels.wrist.degrees).toBeLessThan(24)

  expect(panels.note.visible).toBe(true)
  expect(panels.note.degrees).toBeGreaterThan(20)
  expect(panels.note.degrees).toBeLessThan(40)

  // Now the teleport arc, which never showed up in a screenshot.
  await page.evaluate(() => window.__trainer!.xrAim('left', [0.6, 0, 0.9]))
  await page.evaluate(() => window.__trainer!.xrThumbstick('left', 0, -1))
  await frames(page, 10)

  const aiming = await page.evaluate(() => ({
    arc: window.__trainer!.visible('teleport_arc'),
    marker: window.__trainer!.visible('teleport_marker'),
    boundary: window.__trainer!.visible('work_area'),
  }))
  console.log('AIMING', JSON.stringify(aiming))

  // All three were drawn all along. The arc simply never survived a downscaled
  // screenshot, which is why this asserts scene state rather than pixels.
  expect(aiming.arc).toBe(true)
  expect(aiming.marker).toBe(true)
  expect(aiming.boundary).toBe(true)

  await page.evaluate(() => window.__trainer!.xrThumbstick('left', 0, 0))
})
