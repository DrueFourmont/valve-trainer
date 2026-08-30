import { expect, type Page } from '@playwright/test'

/**
 * Shared plumbing for the e2e suite.
 *
 * Screenshots are not decoration here. The rule in CLAUDE.md is that a run is
 * not trusted until someone has looked at them, because an assertion can pass
 * against a scene that renders as a black rectangle.
 */

export const SHOT_DIR = 'test-results/shots'

export interface TrainerState {
  ready: boolean
  step: number
  total: number
  label: string | null
  completed: string[]
  errors: { at: number; target: string; expected: string }[]
  isComplete: boolean
  score: number | null
}

export interface Options {
  mode?: 'vr' | '2d'
  xr?: boolean
  student?: string
}

/**
 * Every automated run posts a real attempt, so they are all labelled. Without
 * this they land in the instructor page as "demo" and are indistinguishable
 * from a run a person actually did, which matters when that page is being
 * demonstrated to someone.
 */
export const TEST_STUDENT = 'e2e'

export async function openTrainer(page: Page, options: Options = {}): Promise<void> {
  const params = new URLSearchParams({
    mode: options.mode ?? '2d',
    test: '1',
    student: options.student ?? TEST_STUDENT,
  })
  if (options.xr) params.set('xr', 'iwer')

  await page.goto(`/?${params.toString()}`)
  await waitForReady(page)
}

/** The scene loads a model over the network, so nothing is clickable at once. */
export async function waitForReady(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__trainer?.state().ready === true, undefined, {
    timeout: 30_000,
  })
  // The loading screen fades over 300 ms and would otherwise sit in screenshots.
  await expect(page.locator('.loading-screen')).toHaveCount(0, { timeout: 5_000 })

  // Let the scene actually render before anything projects a world position to
  // a screen point. Without this the first click of a run occasionally used a
  // stale camera matrix and missed, which showed up as a flake rather than a
  // failure and is worse than either.
  await frames(page, 5)
}

export async function state(page: Page): Promise<TrainerState> {
  return page.evaluate(() => window.__trainer!.state())
}

/** Clicks through the real raycaster at the node's projected position. */
export async function clickTarget(page: Page, name: string): Promise<void> {
  const point = await page.evaluate((n) => window.__trainer!.screenPos(n), name)
  expect(point, `${name} has no screen position, it may be off camera`).not.toBeNull()

  // Press and lift, because pointer input is press to preview, lift to commit.
  await page.mouse.move(point!.x, point!.y)
  await page.mouse.down()
  await page.mouse.up()
}

export async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `${SHOT_DIR}/${name}.png` })
}

/** Frames only advance while the tab renders, so waits are in frames, not ms. */
export async function frames(page: Page, count = 3): Promise<void> {
  await page.evaluate(async (n) => {
    for (let i = 0; i < n; i++) {
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
    }
  }, count)
}
