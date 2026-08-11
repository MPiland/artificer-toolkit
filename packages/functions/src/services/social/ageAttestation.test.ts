import { describe, expect, it } from 'vitest'
import { isAtLeast18 } from './ageAttestation.js'

describe('Social adult self-attestation', () => {
  const now = new Date('2026-08-10T15:00:00.000Z')

  it('accepts an eighteenth birthday and older dates', () => {
    expect(isAtLeast18('2008-08-10', now)).toBe(true)
    expect(isAtLeast18('1955-01-01', now)).toBe(true)
  })

  it('rejects younger and invalid dates', () => {
    expect(isAtLeast18('2008-08-11', now)).toBe(false)
    expect(isAtLeast18('not-a-date', now)).toBe(false)
    expect(isAtLeast18('2026-02-31', now)).toBe(false)
  })
})
