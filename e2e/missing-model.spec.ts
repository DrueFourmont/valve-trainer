import { expect, test } from '@playwright/test'
import { shot } from './harness'

test('a missing model explains itself instead of showing a blank page', async ({ page }) => {
  await page.route('**/models/skid.glb', (route) =>
    route.fulfill({ status: 404, contentType: 'text/plain', body: 'not found' }),
  )

  await page.goto('/?mode=2d&test=1')

  const failure = page.locator('.loading-failed')
  await expect(failure).toBeVisible({ timeout: 20_000 })
  await expect(failure).toContainText('Could not load the equipment')

  await shot(page, 'missing-model')
})

test('a host answering with html instead of the model is caught', async ({ page }) => {
  // Vite and most static hosts answer an unknown path with index.html and a
  // 200, which would otherwise surface as a confusing GLTF parse error.
  await page.route('**/models/skid.glb', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html></html>' }),
  )

  await page.goto('/?mode=2d&test=1')

  const failure = page.locator('.loading-failed')
  await expect(failure).toBeVisible({ timeout: 20_000 })
  await expect(failure).toContainText('not being served')

  await shot(page, 'missing-model-html-fallback')
})

test('the test hooks do not exist without ?test=1', async ({ page }) => {
  await page.goto('/?mode=2d')
  await page.waitForTimeout(2_000)
  expect(await page.evaluate(() => typeof window.__trainer)).toBe('undefined')
})
