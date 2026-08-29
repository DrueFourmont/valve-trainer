import { describe, expect, it } from 'vitest'
import { studentIdFromSearch } from './attempts'

describe('studentIdFromSearch', () => {
  it('defaults to demo when no student is given', () => {
    expect(studentIdFromSearch('')).toBe('demo')
    expect(studentIdFromSearch('?mode=vr')).toBe('demo')
  })

  it('reads the student param', () => {
    expect(studentIdFromSearch('?student=drue')).toBe('drue')
    expect(studentIdFromSearch('?mode=2d&student=drue')).toBe('drue')
  })

  it('trims whitespace and falls back when the value is blank', () => {
    expect(studentIdFromSearch('?student=%20%20')).toBe('demo')
    expect(studentIdFromSearch('?student=%20drue%20')).toBe('drue')
  })

  it('caps the length so a long value cannot be used as a payload', () => {
    const long = 'a'.repeat(200)
    expect(studentIdFromSearch(`?student=${long}`)).toHaveLength(64)
  })
})
