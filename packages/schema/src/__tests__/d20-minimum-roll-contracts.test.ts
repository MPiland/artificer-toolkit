import { describe, expect, it } from 'vitest'

import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import { rollRuleCheckDtoSchema } from '../api/rolls.js'
import { d20CheckTotal, d20MinimumRollDtoSchema } from '../shared/d20MinimumRoll.js'
import { ruleCheckD20EvidenceDtoSchema } from '../shared/ruleExecutionEncounterApplications.js'

const uuid = (suffix: number) => `00000000-0000-4000-8000-${suffix.toString(16).padStart(12, '0')}`
const floor = { amount: 15, label: 'Glibness', sourceId: uuid(1) }

const evidence = {
  requestId: 'check-request',
  rollMode: 'NORMAL' as const,
  keep: 'FIRST' as const,
  derivedRollMode: 'NORMAL' as const,
  rawFaces: [4],
  selectedNatural: 4,
  modifier: 3,
  contributors: [],
  contributorChecksum: checksumRuleDocument([]),
  dc: 15
}

describe('a d20 floor on a check (SPELLS-4.T2c3)', () => {
  it('counts the kept face as the floor when it is lower, with the modifier and added dice', () => {
    const addedDice = [
      { label: 'Bless', count: 1, faces: 4 as const, sign: 'ADD' as const, rolledFaces: [2] }
    ]
    expect(d20CheckTotal({ selectedNatural: 4, modifier: 3 })).toBe(7)
    expect(d20CheckTotal({ selectedNatural: 4, modifier: 3, minimumRoll: floor })).toBe(18)
    expect(d20CheckTotal({ selectedNatural: 4, modifier: 3, minimumRoll: floor, addedDice })).toBe(
      20
    )
  })

  it('leaves a face above the floor as rolled', () => {
    expect(d20CheckTotal({ selectedNatural: 18, modifier: 3, minimumRoll: floor })).toBe(21)
    expect(d20CheckTotal({ selectedNatural: 15, modifier: 3, minimumRoll: floor })).toBe(18)
  })

  it('accepts settled evidence whose total counts the floor and rejects one that does not', () => {
    const settled = { ...evidence, minimumRoll: floor, total: 18 }
    expect(ruleCheckD20EvidenceDtoSchema.safeParse(settled).success).toBe(true)
    expect(ruleCheckD20EvidenceDtoSchema.safeParse({ ...settled, total: 7 }).success).toBe(false)
    expect(ruleCheckD20EvidenceDtoSchema.safeParse({ ...evidence, total: 7 }).success).toBe(true)
    expect(ruleCheckD20EvidenceDtoSchema.safeParse({ ...evidence, total: 18 }).success).toBe(false)
  })

  it('keeps the floor within a d20 face', () => {
    for (const amount of [1, 21, 15.5])
      expect(d20MinimumRollDtoSchema.safeParse({ ...floor, amount }).success).toBe(false)
    expect(d20MinimumRollDtoSchema.safeParse({ ...floor, amount: 20 }).success).toBe(true)
  })

  it('records the floor on a roll as its own rule check', () => {
    const check = { kind: 'D20_MINIMUM_ROLL', amount: 15, label: 'Glibness' }
    expect(rollRuleCheckDtoSchema.safeParse(check).success).toBe(true)
    expect(rollRuleCheckDtoSchema.safeParse({ ...check, amount: 1 }).success).toBe(false)
  })
})
