import { describe, expect, it } from 'vitest'

import { selectHitPointTier, selectHitPointTierPlan, withinHitPointTier } from '../hitPointTiers.js'

const tiers = [{ atMost: 40 }, { atMost: 20 }, { atMost: 50 }, { atMost: 30 }]

describe('hit point tiers', () => {
  it('holds for a target at or under the ceiling', () => {
    expect(withinHitPointTier(20, 20)).toBe(true)
    expect(withinHitPointTier(21, 20)).toBe(false)
  })

  it.each([
    [1, 20],
    [20, 20],
    [21, 30],
    [30, 30],
    [31, 40],
    [40, 40],
    [41, 50],
    [50, 50]
  ])('picks the lowest satisfied tier for %i hit points', (hitPoints, atMost) => {
    expect(selectHitPointTier(tiers, hitPoints)).toEqual({ atMost })
  })

  it('picks no tier above the highest ceiling', () => {
    expect(selectHitPointTier(tiers, 51)).toBeNull()
    expect(selectHitPointTier([], 1)).toBeNull()
  })

  it('selects the plan carrying the chosen tier', () => {
    const plans = [
      { id: 'wide', hitPointTier: { atMost: 50 } },
      { id: 'narrow', hitPointTier: { atMost: 20 } }
    ]
    expect(selectHitPointTierPlan(plans, 20)?.id).toBe('narrow')
    expect(selectHitPointTierPlan(plans, 21)?.id).toBe('wide')
    expect(selectHitPointTierPlan(plans, 51)).toBeNull()
  })
})
