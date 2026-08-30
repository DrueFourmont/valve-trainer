import { expect, test } from '@playwright/test'
import { frames, openTrainer, state } from './harness'

const ORDER = ['valve_inlet', 'valve_outlet', 'bleed', 'tag_point'] as const

async function enterSession(page: import('@playwright/test').Page): Promise<void> {
  await page.locator('.vr-button').click()
  await page.waitForFunction(() => window.__trainer?.isPresenting() === true, undefined, {
    timeout: 20_000,
  })
  await frames(page, 5)
}

/**
 * The session view, not one eye.
 *
 * The first version of this cropped the left half on the assumption that the
 * canvas holds a side by side stereo pair. It does not: with IWER three mirrors
 * a single view to the canvas, so cropping half of it just cut the picture in
 * two, which the screenshots made obvious the moment anyone looked at them.
 */
async function sessionView(page: import('@playwright/test').Page, name: string): Promise<void> {
  const canvas = await page.locator('canvas').boundingBox()
  if (!canvas) throw new Error('no canvas to screenshot')
  await page.screenshot({ path: `test-results/shots/${name}.png`, clip: canvas })
}

test('a full run driven through an emulated headset', async ({ page }) => {
  await openTrainer(page, { mode: 'vr', xr: true })
  await enterSession(page)
  await sessionView(page, 'vr-00-session')

  expect(await page.evaluate(() => window.__trainer!.isPresenting())).toBe(true)

  for (const [index, name] of ORDER.entries()) {
    const aimed = await page.evaluate((n) => window.__trainer!.xrAimAt(n), name)
    expect(aimed, `could not aim a controller at ${name}`).toBe(true)
    await frames(page, 10)

    // Hover proves the ray is landing, which separates an aiming failure from
    // a trigger failure when this goes wrong.
    const lit = await page.evaluate((n) => window.__trainer!.emissive(n), name)
    expect(lit, `the controller ray is not hitting ${name}`).not.toBe(0)

    await page.evaluate(() => window.__trainer!.xrTrigger(true))
    await frames(page, 5)
    await page.evaluate(() => window.__trainer!.xrTrigger(false))
    await frames(page, 40)

    await sessionView(page, `vr-0${index + 1}-${name}`)

    const now = await state(page)
    expect(now.completed, `after the trigger on ${name}`).toHaveLength(index + 1)
    expect(now.errors).toHaveLength(0)
  }

  const finished = await state(page)
  expect(finished.isComplete).toBe(true)
  expect(finished.score).toBe(100)

  // The result is a world space panel in a session, not the DOM card.
  await frames(page, 40)
  await sessionView(page, 'vr-05-score-panel')
  await expect(page.locator('.score-panel')).toHaveCount(0)
})

test('a wrong action in the headset is recorded, not blocked', async ({ page }) => {
  await openTrainer(page, { mode: 'vr', xr: true })
  await enterSession(page)

  await page.evaluate(() => window.__trainer!.xrAimAt('bleed'))
  await frames(page, 5)
  await page.evaluate(() => window.__trainer!.xrTrigger(true))
  await frames(page, 5)
  await page.evaluate(() => window.__trainer!.xrTrigger(false))
  await frames(page, 10)

  const now = await state(page)
  expect(now.errors).toHaveLength(1)
  expect(now.errors[0].expected).toBe('valve_inlet')
  expect(now.step).toBe(1)

  await sessionView(page, 'vr-wrong-order')
})
