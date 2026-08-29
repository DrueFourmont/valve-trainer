import { describe, expect, it } from 'vitest'
import { normalizeProjectUrl } from './config'

describe('normalizeProjectUrl', () => {
  const base = 'https://abcdefghijklmnopqrst.supabase.co'

  it('leaves a correct project url alone', () => {
    expect(normalizeProjectUrl(base)).toBe(base)
  })

  it('drops a trailing slash', () => {
    expect(normalizeProjectUrl(`${base}/`)).toBe(base)
  })

  it('drops a pasted rest endpoint path', () => {
    // The actual mistake this exists for. Left in place it builds
    // /rest/v1//rest/v1/attempts, which PostgREST rejects with PGRST125.
    expect(normalizeProjectUrl(`${base}/rest/v1/`)).toBe(base)
    expect(normalizeProjectUrl(`${base}/rest/v1`)).toBe(base)
  })

  it('drops a pasted functions endpoint path', () => {
    expect(normalizeProjectUrl(`${base}/functions/v1`)).toBe(base)
  })

  it('tolerates surrounding whitespace', () => {
    expect(normalizeProjectUrl(`  ${base}  `)).toBe(base)
  })
})
