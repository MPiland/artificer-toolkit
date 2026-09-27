import { describe, expect, it } from 'vitest'
import type { HitPointMaximumReductionRecoveryTag } from '@artificer-toolkit/schema/effects/hitPointMaximumReduction'

import {
  listHitPointMaximumReductions,
  reduceHitPointMaximum
} from '../character/hitPointMaximumReductions.js'
import { activeEffect } from './encounterActiveEffectFixtures.js'

const owner = { kind: 'CHARACTER' as const, characterId: '00000000-0000-4000-8000-00000000d001' }

function reduction(
  id: string,
  createdOrdinal: number,
  amount: number,
  recoveryTags: HitPointMaximumReductionRecoveryTag[]
) {
  return activeEffect({
    id,
    owner,
    createdOrdinal,
    stateContributions: [
      {
        kind: 'HIT_POINT_MAXIMUM_REDUCTION',
        amount,
        recoveryTags,
        sourceDamageOutcomeId: '00000000-0000-4000-8000-00000000d002',
        sourceDamageNodeId: 'entry',
        sourceDamageOperationKey: 'comparison'
      }
    ]
  })
}

describe('hit point maximum reductions', () => {
  const golem = reduction('00000000-0000-4000-8000-00000000d0b2', 2, 5, [
    'RESTORE_HIT_POINT_MAXIMUM'
  ])
  const drain = reduction('00000000-0000-4000-8000-00000000d0a1', 1, 3, [
    'RESTORE_HIT_POINT_MAXIMUM',
    'LONG_REST'
  ])

  it('lists every reduction contribution in creation order', () => {
    expect(listHitPointMaximumReductions([golem, drain])).toEqual([
      {
        activeEffectId: drain.id,
        amount: 3,
        recoveryTags: ['RESTORE_HIT_POINT_MAXIMUM', 'LONG_REST']
      },
      { activeEffectId: golem.id, amount: 5, recoveryTags: ['RESTORE_HIT_POINT_MAXIMUM'] }
    ])
  })

  it('subtracts every reduction and never goes below 0', () => {
    const reductions = listHitPointMaximumReductions([golem, drain])
    expect(reduceHitPointMaximum(20, reductions)).toBe(12)
    expect(reduceHitPointMaximum(6, reductions)).toBe(0)
    expect(reduceHitPointMaximum(20, [])).toBe(20)
  })
})
