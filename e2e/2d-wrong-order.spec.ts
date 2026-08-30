import { expect, test } from '@playwright/test'
import { clickTarget, frames, openTrainer, shot, state } from './harness'

test('bleeding before isolating records an error and does not advance', async ({ page }) => {
  await openTrainer(page)

  await clickTarget(page, 'bleed')
  await frames(page, 3)

  const now = await state(page)
  expect(now.errors).toHaveLength(1)
  expect(now.errors[0].target).toBe('bleed')
  expect(now.errors[0].expected).toBe('valve_inlet')
  expect(now.step, 'a wrong action must not advance the procedure').toBe(1)
  expect(now.completed).toHaveLength(0)

  // The error pulse is a red emissive, and hover is a blue one, so the check is
  // that red dominates rather than merely that something is lit.
  const emissive = await page.evaluate(() => window.__trainer!.emissive('bleed'))
  expect(emissive).not.toBeNull()
  const red = (emissive! >> 16) & 0xff
  const green = (emissive! >> 8) & 0xff
  const blue = emissive! & 0xff
  expect(red, `expected a red pulse, got #${emissive!.toString(16)}`).toBeGreaterThan(green)
  expect(red).toBeGreaterThan(blue)

  await shot(page, '2d-wrong-order-pulse')
})

test('two wrong actions cost thirty points', async ({ page }) => {
  await openTrainer(page)

  await clickTarget(page, 'bleed')
  await frames(page, 3)
  await clickTarget(page, 'bleed')
  await frames(page, 3)

  for (const name of ['valve_inlet', 'valve_outlet', 'bleed', 'tag_point']) {
    await clickTarget(page, name)
    await frames(page, 40)
  }

  const finished = await state(page)
  expect(finished.errors).toHaveLength(2)
  expect(finished.isComplete).toBe(true)
  expect(finished.score).toBe(70)

  await shot(page, '2d-wrong-order-score')
})
