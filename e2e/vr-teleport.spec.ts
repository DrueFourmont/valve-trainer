import { expect, test } from '@playwright/test'
import { frames, openTrainer, shot } from './harness'

test('the left thumbstick teleports the player', async ({ page }) => {
  await openTrainer(page, { mode: 'vr', xr: true })
  await page.locator('.vr-button').click()
  await page.waitForFunction(() => window.__trainer?.isPresenting() === true, undefined, {
    timeout: 20_000,
  })
  await frames(page, 5)

  const before = await page.evaluate(() => window.__trainer!.rigPosition())

  // Aim the left hand at a floor point inside the work area, in front of the
  // student, then push the stick forward to raise the arc.
  const aimed = await page.evaluate(() => window.__trainer!.xrAim('left', [0.6, 0, 0.9]))
  expect(aimed, 'could not aim the left controller').toBe(true)

  await page.evaluate(() => window.__trainer!.xrThumbstick('left', 0, -1))
  await frames(page, 10)
  await shot(page, 'vr-teleport-arc')

  // Releasing commits the teleport, which then fades out and back in.
  await page.evaluate(() => window.__trainer!.xrThumbstick('left', 0, 0))
  await frames(page, 45)

  const after = await page.evaluate(() => window.__trainer!.rigPosition())
  const moved = Math.hypot(after[0] - before[0], after[2] - before[2])

  expect(moved, `rig did not move: ${before.join(',')} -> ${after.join(',')}`).toBeGreaterThan(0.1)
  expect(after[1], 'teleport must never change height').toBeCloseTo(before[1], 5)

  // Still inside the work area, which is a 3.5 m disc centred on the skid.
  expect(Math.hypot(after[0], after[2])).toBeLessThanOrEqual(3.5)

  await shot(page, 'vr-teleport-landed')
})
