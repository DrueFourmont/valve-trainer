import { expect, test } from '@playwright/test'
import { clickTarget, frames, openTrainer, shot, state } from './harness'

const ORDER = ['valve_inlet', 'valve_outlet', 'bleed', 'tag_point'] as const

test('four steps in order scores 100 and shows the card', async ({ page }) => {
  await openTrainer(page)
  await shot(page, '2d-00-start')

  const start = await state(page)
  expect(start.step).toBe(1)
  expect(start.total).toBe(4)
  expect(start.label).toBe('Close the inlet valve')

  for (const [index, name] of ORDER.entries()) {
    await clickTarget(page, name)
    // The handle turns over 400 ms and the card lands after that.
    await frames(page, 40)
    await shot(page, `2d-0${index + 1}-${name}`)

    const now = await state(page)
    expect(now.completed, `after clicking ${name}`).toHaveLength(index + 1)
    expect(now.errors, `${name} should not have been an error`).toHaveLength(0)
  }

  const finished = await state(page)
  expect(finished.isComplete).toBe(true)
  expect(finished.score).toBe(100)

  const card = page.locator('.score-panel')
  await expect(card).toBeVisible()
  await expect(card.locator('.score-value')).toHaveText('100')

  // Found by looking at a screenshot, not by an assertion: the step bar stayed
  // on screen behind the result because an author display rule beat [hidden].
  await expect(page.locator('.hud-bar')).toBeHidden()

  await shot(page, '2d-05-score-card')
})

test('re-touching a finished step does nothing', async ({ page }) => {
  await openTrainer(page)

  await clickTarget(page, 'valve_inlet')
  await frames(page, 40)
  await clickTarget(page, 'valve_inlet')
  await frames(page, 5)

  const now = await state(page)
  expect(now.completed).toHaveLength(1)
  expect(now.errors).toHaveLength(0)
  expect(now.step).toBe(2)
})

/**
 * The step tracker sitting off the left edge is a real bug that shipped, and it
 * was found by eye rather than by anything that could fail. These sizes are the
 * ones the trainer actually gets opened at.
 */
const VIEWPORTS = [
  { name: 'laptop', width: 1440, height: 900 },
  { name: 'half-screen', width: 900, height: 800 },
  { name: 'narrow', width: 620, height: 700 },
  { name: 'tablet-portrait', width: 820, height: 1180 },
]

for (const viewport of VIEWPORTS) {
  test(`the whole HUD bar stays on screen at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await openTrainer(page)

    for (const selector of ['.hud-tracker', '.hud-label', '.hud-hint']) {
      const box = await page.locator(selector).boundingBox()
      expect(box, `${selector} is not rendered`).not.toBeNull()

      expect(box!.x, `${selector} runs off the left edge`).toBeGreaterThanOrEqual(0)
      expect(
        box!.x + box!.width,
        `${selector} runs off the right edge`,
      ).toBeLessThanOrEqual(viewport.width + 1)
    }

    await shot(page, `2d-hud-${viewport.name}`)
  })
}

test('the HUD bar reflows when the window is resized after load', async ({ page }) => {
  // The reported symptom was specifically that it does not change to fit when
  // the window is made smaller, which is a different case from loading small.
  await page.setViewportSize({ width: 1440, height: 900 })
  await openTrainer(page)

  for (const size of [
    { width: 900, height: 800 },
    { width: 620, height: 700 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(size)
    await frames(page, 5)

    for (const selector of ['.hud-tracker', '.hud-label', '.hud-hint']) {
      const box = await page.locator(selector).boundingBox()
      expect(box, `${selector} disappeared at ${size.width}px`).not.toBeNull()
      expect(box!.x, `${selector} off the left edge at ${size.width}px`).toBeGreaterThanOrEqual(0)
      expect(box!.x + box!.width, `${selector} off the right edge at ${size.width}px`).toBeLessThanOrEqual(size.width + 1)
    }
  }

  await shot(page, '2d-hud-after-resize')
})

test('the HUD and the Enter VR button share the bottom without overlapping', async ({ page }) => {
  // The reported screenshot was ?mode=vr, where the VR button also sits at the
  // bottom centre, which the 2D bar knows nothing about.
  await page.setViewportSize({ width: 1440, height: 900 })
  await openTrainer(page, { mode: 'vr', xr: true })

  const bar = await page.locator('.hud-bar').boundingBox()
  const button = await page.locator('.vr-button').boundingBox()
  expect(bar).not.toBeNull()
  expect(button).not.toBeNull()

  const tracker = await page.locator('.hud-tracker').boundingBox()
  expect(tracker!.x).toBeGreaterThanOrEqual(0)

  const overlaps =
    button!.x < bar!.x + bar!.width &&
    button!.x + button!.width > bar!.x &&
    button!.y < bar!.y + bar!.height &&
    button!.y + button!.height > bar!.y
  expect(overlaps, 'the Enter VR button sits on top of the step instructions').toBe(false)

  await shot(page, 'vr-mode-bottom-layout')
})
