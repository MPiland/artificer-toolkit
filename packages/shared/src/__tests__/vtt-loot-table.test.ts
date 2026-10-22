import { describe, expect, it } from 'vitest'

import {
  LOOT_RANGE_REFUSAL,
  findLootRangeForRoll,
  findLootRangeRefusal,
  formatLootRange
} from '../domains/vtt/lootTable.js'

describe('findLootRangeRefusal', () => {
  it('accepts exclusive ranges, gaps, unsorted input and an open top range', () => {
    expect(findLootRangeRefusal([])).toBeNull()
    expect(findLootRangeRefusal([{ min: 1, max: 1 }])).toBeNull()
    expect(
      findLootRangeRefusal([
        { min: 20, max: null },
        { min: 1, max: 5 },
        { min: 11, max: 15 }
      ])
    ).toBeNull()
  })

  it('allows adjacent ranges that share no integer', () => {
    expect(
      findLootRangeRefusal([
        { min: 5, max: 10 },
        { min: 11, max: 15 }
      ])
    ).toBeNull()
  })

  it('refuses touching ranges that share their boundary roll', () => {
    expect(
      findLootRangeRefusal([
        { min: 5, max: 10 },
        { min: 10, max: 15 }
      ])
    ).toMatchObject({ code: LOOT_RANGE_REFUSAL.OVERLAP, indexes: [0, 1] })
  })

  it('refuses a range contained in another and reports the list indexes', () => {
    expect(
      findLootRangeRefusal([
        { min: 18, max: 19 },
        { min: 1, max: 20 }
      ])
    ).toMatchObject({ code: LOOT_RANGE_REFUSAL.OVERLAP, indexes: [1, 0] })
  })

  it('refuses identical single-roll ranges', () => {
    expect(
      findLootRangeRefusal([
        { min: 7, max: 7 },
        { min: 7, max: 7 }
      ])?.code
    ).toBe(LOOT_RANGE_REFUSAL.OVERLAP)
  })

  it('refuses any range after an open-ended one', () => {
    expect(
      findLootRangeRefusal([
        { min: 15, max: null },
        { min: 30, max: 40 }
      ])?.code
    ).toBe(LOOT_RANGE_REFUSAL.OVERLAP)
    expect(
      findLootRangeRefusal([
        { min: 15, max: null },
        { min: 15, max: null }
      ])?.code
    ).toBe(LOOT_RANGE_REFUSAL.OVERLAP)
  })

  it('refuses a range whose min is above its max before checking overlap', () => {
    expect(
      findLootRangeRefusal([
        { min: 1, max: 20 },
        { min: 12, max: 8 }
      ])
    ).toMatchObject({ code: LOOT_RANGE_REFUSAL.MIN_GREATER_THAN_MAX, indexes: [1] })
  })

  it('names the code and both ranges in the message', () => {
    const refusal = findLootRangeRefusal([
      { min: 5, max: 10 },
      { min: 10, max: null }
    ])
    expect(refusal?.message).toBe('LOOT_RANGE_OVERLAP: loot ranges 5–10 and 10+ share a roll.')
  })
})

describe('formatLootRange', () => {
  it('prints single, closed and open ranges', () => {
    expect(formatLootRange({ min: 4, max: 4 })).toBe('4')
    expect(formatLootRange({ min: 4, max: 9 })).toBe('4–9')
    expect(formatLootRange({ min: 20, max: null })).toBe('20+')
  })
})

describe('findLootRangeForRoll', () => {
  const ranges = [
    { id: 'low', min: 1, max: 10 },
    { id: 'single', min: 12, max: 12 },
    { id: 'open', min: 18, max: null }
  ]

  it('finds the range holding the roll, at either end and in an open top range', () => {
    expect(findLootRangeForRoll(ranges, 1)?.id).toBe('low')
    expect(findLootRangeForRoll(ranges, 10)?.id).toBe('low')
    expect(findLootRangeForRoll(ranges, 12)?.id).toBe('single')
    expect(findLootRangeForRoll(ranges, 18)?.id).toBe('open')
    expect(findLootRangeForRoll(ranges, 400)?.id).toBe('open')
  })

  it('finds nothing for a roll in a gap or below every range', () => {
    expect(findLootRangeForRoll(ranges, 0)).toBeUndefined()
    expect(findLootRangeForRoll(ranges, 11)).toBeUndefined()
    expect(findLootRangeForRoll(ranges, 17)).toBeUndefined()
  })
})
