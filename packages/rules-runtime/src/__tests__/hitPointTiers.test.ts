import { describe, expect, it } from 'vitest'

import {
  hitPointTierCeilings,
  hitPointTierFloor,
  NO_HIT_POINT_FLOOR,
  selectHitPointTier,
  selectHitPointTierPlan,
  withinHitPointBand
} from '../hitPointTiers.js'

const ceilings = hitPointTierCeilings([
  { hitPointTier: { atMost: 40 } },
  { hitPointTier: { atMost: 20 } },
  {},
  { hitPointTier: { atMost: 50 } },
  { hitPointTier: { atMost: 30 } },
  { hitPointTier: { atMost: 30 } }
])

describe('hit point tiers', () => {
  it('lists each authored ceiling once, lowest first', () => {
    expect(ceilings).toEqual([20, 30, 40, 50])
    expect(hitPointTierCeilings([{}])).toEqual([])
  })

  it('holds for a target above the floor and at or under the ceiling', () => {
    expect(withinHitPointBand(20, 10, 20)).toBe(true)
    expect(withinHitPointBand(21, 10, 20)).toBe(false)
    expect(withinHitPointBand(10, 10, 20)).toBe(false)
    expect(withinHitPointBand(0, NO_HIT_POINT_FLOOR, 20)).toBe(true)
  })

  it('floors a tier at the nearest lower ceiling', () => {
    expect(hitPointTierFloor(ceilings, 20)).toBe(NO_HIT_POINT_FLOOR)
    expect(hitPointTierFloor(ceilings, 40)).toBe(30)
  })

  it.each([
    [0, 20],
    [1, 20],
    [20, 20],
    [21, 30],
    [30, 30],
    [31, 40],
    [40, 40],
    [41, 50],
    [50, 50]
  ])('picks the one tier whose band holds %i hit points', (hitPoints, atMost) => {
    expect(selectHitPointTier(ceilings, hitPoints)).toBe(atMost)
  })

  it('picks no tier above the highest ceiling', () => {
    expect(selectHitPointTier(ceilings, 51)).toBeNull()
    expect(selectHitPointTier([], 1)).toBeNull()
  })

  it('selects the plan carrying the chosen tier', () => {
    const plans = [
      { id: 'wide', hitPointTier: { atMost: 50 } },
      { id: 'narrow', hitPointTier: { atMost: 20 } }
    ]
    expect(selectHitPointTierPlan([20, 50], plans, 20)?.id).toBe('narrow')
    expect(selectHitPointTierPlan([20, 50], plans, 21)?.id).toBe('wide')
    expect(selectHitPointTierPlan([20, 50], plans, 51)).toBeNull()
  })

  it('gives a tier with no plan its band, so its targets get no plan', () => {
    const plans = [{ id: 'wide', hitPointTier: { atMost: 50 } }]
    expect(selectHitPointTierPlan([20, 50], plans, 20)).toBeNull()
    expect(selectHitPointTierPlan([20, 50], plans, 21)?.id).toBe('wide')
  })
})
