import { describe, expect, it } from 'vitest'
import { Effects } from './effects'

const FRAME = 1 / 60

function run(effects: Effects, seconds: number): void {
  for (let i = 0; i < Math.round(seconds / FRAME); i++) effects.update(FRAME)
}

describe('Effects tweens', () => {
  it('runs a tween to completion and then drops it', () => {
    const effects = new Effects()
    const seen: number[] = []
    let done = false

    effects.tween(
      100,
      (t) => seen.push(t),
      () => {
        done = true
      },
    )

    run(effects, 0.3)
    expect(done).toBe(true)
    expect(seen.at(-1)).toBe(1)

    const before = seen.length
    run(effects, 0.3)
    expect(seen.length).toBe(before)
  })

  it('keeps a tween started from inside another tween completing', () => {
    // Regression: update() rebuilt the tween list with filter(), so a tween
    // queued by a completion callback was discarded. The teleport faded to
    // black and never faded back.
    const effects = new Effects()
    let secondRan = false
    let secondFinished = false

    effects.tween(
      50,
      () => {},
      () => {
        effects.tween(
          50,
          () => {
            secondRan = true
          },
          () => {
            secondFinished = true
          },
        )
      },
    )

    run(effects, 0.5)
    expect(secondRan).toBe(true)
    expect(secondFinished).toBe(true)
  })
})
