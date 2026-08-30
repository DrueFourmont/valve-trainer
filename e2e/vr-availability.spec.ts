import { expect, test } from '@playwright/test'
import { openTrainer, shot, waitForReady } from './harness'

test('with an emulated headset present, the Enter VR button appears', async ({ page }) => {
  await openTrainer(page, { mode: 'vr', xr: true })
  await expect(page.locator('.vr-button')).toBeVisible()
  await expect(page.locator('.vr-button')).toHaveText('Enter VR')
  await shot(page, 'vr-button-present')
})

test('with no headset, vr mode falls back to 2D and says why', async ({ page }) => {
  // Plain Chrome exposes a navigator.xr that reports no device, which is the
  // same situation as a browser without the emulator extension injecting.
  await page.goto('/?mode=vr&test=1')
  await waitForReady(page)

  await expect(page.locator('.vr-button')).toHaveCount(0)

  const toast = page.locator('.toast')
  await expect(toast).toBeVisible()
  await expect(toast).toContainText('2D')

  // The message explains a control that is not on screen, so it has to stay.
  // It used to clear after twelve seconds, leaving no reason for the absence.
  await page.waitForTimeout(13_000)
  await expect(toast).toBeVisible()

  await shot(page, 'vr-button-absent-with-reason')
})
