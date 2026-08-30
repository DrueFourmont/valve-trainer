import { describe, expect, it } from 'vitest'
import { MAX_FRAMEBUFFER_SCALE, framebufferScale } from './vr-button'

describe('framebufferScale', () => {
  it('uses the headset native factor when it is reasonable', () => {
    // The whole point of the change: WebXR defaults to 1.0, which is the
    // recommended resolution rather than the panel's native one.
    expect(framebufferScale(1.4)).toBe(1.4)
    expect(framebufferScale(1.0)).toBe(1.0)
  })

  it('clamps a native factor that would cost more fill than it is worth', () => {
    expect(framebufferScale(2)).toBe(MAX_FRAMEBUFFER_SCALE)
    expect(framebufferScale(4)).toBe(MAX_FRAMEBUFFER_SCALE)
  })

  it('honours an explicit ceiling', () => {
    expect(framebufferScale(2, 1.2)).toBe(1.2)
  })

  it('falls back to the WebXR default when the device reports nothing usable', () => {
    // A zero or NaN here would produce a zero sized framebuffer, which on a
    // headset is a black screen rather than an error.
    expect(framebufferScale(Number.NaN)).toBe(1)
    expect(framebufferScale(0)).toBe(1)
    expect(framebufferScale(-1)).toBe(1)
    expect(framebufferScale(Number.POSITIVE_INFINITY)).toBe(1)
  })

  it('never returns something that would blank the headset', () => {
    for (const native of [-10, -0.001, 0, Number.NaN, 0.5, 1, 3, 100]) {
      const scale = framebufferScale(native)
      expect(scale).toBeGreaterThan(0)
      expect(scale).toBeLessThanOrEqual(MAX_FRAMEBUFFER_SCALE)
    }
  })
})
