import { describe, expect, it } from 'vitest'
import { SIZE_CODE, sizeRank, sizeSpaceFeet } from '../domains/core/size.js'

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

describe('sizeSpaceFeet', () => {
  it('gives the edge of the square a creature of each size fills, and null for no size', () => {
    expect(sizeSpaceFeet(SIZE_CODE.TINY)).toBe(2.5)
    expect(sizeSpaceFeet(SIZE_CODE.MEDIUM)).toBe(5)
    expect(sizeSpaceFeet(SIZE_CODE.LARGE)).toBe(10)
    expect(sizeSpaceFeet(SIZE_CODE.GARGANTUAN)).toBe(20)
    expect(sizeSpaceFeet(undefined)).toBeNull()
    expect(sizeSpaceFeet('toString')).toBeNull()
  })
})
