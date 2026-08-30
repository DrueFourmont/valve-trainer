import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * The test affordances must not reach a production bundle.
 *
 * An earlier version guarded them with a runtime check inside src/dev, which a
 * bundler cannot prove is always false, so the whole of the test surface
 * shipped. The guard is now a dead branch at the call site in main.ts, and this
 * is what keeps it that way.
 *
 * Skips when there is no build to inspect. CI builds before it tests.
 */

const DIST = new URL('../../dist/assets', import.meta.url).pathname
const FORBIDDEN = ['__trainer', 'screenPos', 'xrAimAt', 'installTestHooks', 'XRDevice']

describe('production bundle', () => {
  const built = existsSync(DIST)

  it.skipIf(!built)('does not contain the test hooks or the emulated headset', () => {
    const bundles = readdirSync(DIST).filter((name) => name.endsWith('.js'))
    expect(bundles.length, 'no javascript in dist/assets').toBeGreaterThan(0)

    const source = bundles.map((name) => readFileSync(`${DIST}/${name}`, 'utf8')).join('\n')

    for (const token of FORBIDDEN) {
      expect(source, `"${token}" reached the production bundle`).not.toContain(token)
    }
  })
})
