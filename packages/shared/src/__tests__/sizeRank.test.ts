import { describe, expect, it } from 'vitest'
import { SIZE_CODE, sizeRank } from '../domains/core/size.js'

describe('sizeRank', () => {
  it('orders every size code from smallest to largest', () => {
    const ordered = [
      SIZE_CODE.FINE,
      SIZE_CODE.DIMUNITIVE,
      SIZE_CODE.TINY,
      SIZE_CODE.SMALL,
      SIZE_CODE.MEDIUM,
      SIZE_CODE.LARGE,
      SIZE_CODE.HUGE,
      SIZE_CODE.GARGANTUAN,
      SIZE_CODE.GIANT,
      SIZE_CODE.COLOSSAL
    ]
    const ranks = ordered.map((code) => sizeRank(code))
    expect(ranks.every((rank) => rank !== null)).toBe(true)
    expect(ranks).toEqual([...ranks].sort((left, right) => left! - right!))
    expect(new Set(ranks).size).toBe(ordered.length)
  })

  it('puts the SRD sizes one step apart', () => {
    expect(sizeRank('LARGE')! - sizeRank('MEDIUM')!).toBe(1)
    expect(sizeRank('GARGANTUAN')! - sizeRank('TINY')!).toBe(5)
  })

  it('returns null for an unknown or missing size', () => {
    expect(sizeRank('ENORMOUS')).toBeNull()
    expect(sizeRank(null)).toBeNull()
    expect(sizeRank(undefined)).toBeNull()
  })
})
