import { expect, test } from '@playwright/test'
import { TEST_STUDENT, clickTarget, frames, openTrainer, shot, state } from './harness'

const STUDENT = TEST_STUDENT
const configured = Boolean(process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_ANON_KEY)

test.describe('instructor view', () => {
  test.skip(!configured, 'no Supabase credentials in the environment')

  test('a completed run shows up as a row attributed to the student', async ({ page }) => {
    await openTrainer(page, { student: STUDENT })

    for (const name of ['valve_inlet', 'valve_outlet', 'bleed', 'tag_point']) {
      await clickTarget(page, name)
      await frames(page, 40)
    }

    const finished = await state(page)
    expect(finished.isComplete).toBe(true)

    // The attempt posts in the background, so give the round trip a moment.
    await page.waitForTimeout(3_000)

    await page.goto('/instructor.html')
    const row = page.locator('.attempt', { hasText: STUDENT }).first()
    await expect(row).toBeVisible({ timeout: 15_000 })

    // Opening a row is the whole point of the page, so prove the timeline too.
    await row.locator('.attempt-summary').click()
    await expect(row.locator('.timeline-item').first()).toBeVisible()

    await shot(page, 'instructor-row-expanded')
  })
})
