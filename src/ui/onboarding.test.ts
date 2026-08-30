import { describe, expect, it } from 'vitest'
import { ONBOARDING, type OnboardingKind, onboardingFor } from './onboarding'

describe('onboardingFor', () => {
  it('gives headset guidance in vr mode regardless of pointer', () => {
    expect(onboardingFor('vr', false)).toBe('vr')
    expect(onboardingFor('vr', true)).toBe('vr')
  })

  it('separates touch from mouse in 2d', () => {
    expect(onboardingFor('2d', true)).toBe('touch')
    expect(onboardingFor('2d', false)).toBe('desktop')
  })
})

describe('the copy itself', () => {
  const kinds: OnboardingKind[] = ['desktop', 'touch', 'vr']

  it.each(kinds)('%s has exactly two lines', (kind) => {
    expect(ONBOARDING[kind]).toHaveLength(2)
  })

  it.each(kinds)('%s lines are short enough to read at a glance', (kind) => {
    // Anything longer stops being a glance and starts being a manual.
    for (const line of ONBOARDING[kind]) {
      expect(line.length).toBeLessThanOrEqual(90)
      expect(line.trim()).toBe(line)
    }
  })

  it('names the right control for each mode and never the wrong one', () => {
    expect(ONBOARDING.desktop.join(' ')).toMatch(/click/i)
    expect(ONBOARDING.touch.join(' ')).toMatch(/finger|press/i)
    expect(ONBOARDING.touch.join(' ')).not.toMatch(/click/i)
    expect(ONBOARDING.vr.join(' ')).toMatch(/trigger/i)
    expect(ONBOARDING.vr.join(' ')).not.toMatch(/click|drag/i)
  })
})
