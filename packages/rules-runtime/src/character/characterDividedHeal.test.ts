import type { CharacterResolvedActionMechanic } from '@artificer-toolkit/schema/api/characterActionRules'
import { describe, expect, it } from 'vitest'

import { dividedHealOf, refuseHealShares } from './characterChosenSpend.js'

const divided = { total: 10, ceiling: { numerator: 1, denominator: 2 } }
const wolf = (id: string, currentHitPoints: number) => ({
  id,
  label: id,
  currentHitPoints,
  maxHitPoints: 11
})

const heal = (split?: {
  ceiling?: { numerator: number; denominator: number }
}): CharacterResolvedActionMechanic['outcomes'][number] => ({
  kind: 'HEAL',
  pathCode: 'path',
  expression: '10',
  temporary: false,
  scaling: [],
  ...(split ? { split } : {})
})

describe('refuseHealShares', () => {
  const targets = [wolf('a', 1), wolf('b', 1)]

  it('accepts shares within the pool and each creature’s ceiling', () => {
    expect(
      refuseHealShares({
        divided,
        targets,
        shares: [
          { actorId: 'a', amount: 4 },
          { actorId: 'b', amount: 4 }
        ]
      })
    ).toBeNull()
  })

  it('refuses a missing, repeated or unknown share', () => {
    const missing = [{ actorId: 'a', amount: 1 }]
    const repeated = [
      { actorId: 'a', amount: 1 },
      { actorId: 'a', amount: 1 }
    ]
    const unknown = [
      { actorId: 'a', amount: 1 },
      { actorId: 'c', amount: 1 }
    ]
    for (const shares of [missing, repeated, unknown])
      expect(refuseHealShares({ divided, targets, shares })).toBe(
        'Give each chosen creature a share.'
      )
  })

  it('refuses shares past the pool', () => {
    expect(
      refuseHealShares({
        divided: { total: 6 },
        targets,
        shares: [
          { actorId: 'a', amount: 4 },
          { actorId: 'b', amount: 4 }
        ]
      })
    ).toBe('Only 6 hit points to divide; 8 given.')
  })

  it('refuses a share past half the creature’s maximum, counting what it already has', () => {
    expect(
      refuseHealShares({
        divided,
        targets: [wolf('a', 3)],
        shares: [{ actorId: 'a', amount: 3 }]
      })
    ).toBe('a can take at most 2.')
  })
})

describe('dividedHealOf', () => {
  it('reads the total and ceiling of a resolved divided heal', () => {
    expect(
      dividedHealOf({ outcomes: [heal({ ceiling: { numerator: 1, denominator: 2 } })] })
    ).toEqual(divided)
  })

  it('finds none in a heal that is not divided', () => {
    expect(dividedHealOf({ outcomes: [heal()] })).toBeUndefined()
  })
})
