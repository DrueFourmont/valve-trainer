import { describe, expect, it } from 'vitest'
import { scoreAttempt } from './score'

describe('scoreAttempt', () => {
  it('gives a clean fast run full marks', () => {
    expect(scoreAttempt({ errorCount: 0, durationSeconds: 62, targetSeconds: 90 })).toBe(100)
  })

  it('charges 15 per wrong action', () => {
    expect(scoreAttempt({ errorCount: 2, durationSeconds: 90, targetSeconds: 90 })).toBe(70)
  })

  it('charges 1 per full 10 seconds over target and ignores the remainder', () => {
    // 35 seconds over is three full penalties, not three and a half.
    expect(scoreAttempt({ errorCount: 1, durationSeconds: 125, targetSeconds: 90 })).toBe(82)
  })

  it('floors at zero instead of going negative', () => {
    expect(scoreAttempt({ errorCount: 9, durationSeconds: 600, targetSeconds: 90 })).toBe(0)
  })
})
