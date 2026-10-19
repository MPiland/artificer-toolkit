import { describe, expect, it } from 'vitest'
import type { D20RolledAddedDieDto } from '@artificer-toolkit/schema/shared/d20AddedDice'
import { deathSaveRollRecord } from '../encounterRuleCheckRolls.js'

const ruleset = { systemId: '00000000-0000-4000-8000-000000000001', code: 'dnd5e', version: '1' }
const bless: D20RolledAddedDieDto = {
  label: 'Bless',
  count: 1,
  faces: 4,
  sign: 'ADD',
  rolledFaces: [3]
}
const bane: D20RolledAddedDieDto = {
  label: 'Bane',
  count: 1,
  faces: 4,
  sign: 'SUBTRACT',
  rolledFaces: [2]
}

function record(addedDice?: D20RolledAddedDieDto[]) {
  return deathSaveRollRecord({
    occurrenceId: '00000000-0000-4000-8000-0000000000aa',
    rawDie: 9,
    ...(addedDice ? { addedDice } : {}),
    rollerLabel: 'Aria',
    ruleset,
    createdAt: '2026-10-18T00:00:00.000Z'
  })
}

describe('a d20 roll record with added dice (D156)', () => {
  it('records the d20 alone when the test adds no dice', () => {
    const roll = record()
    expect(roll.normalizedExpression).toBe('1d20')
    expect(roll.evidence.terms).toHaveLength(1)
    expect(roll.evidence.total).toBe(9)
  })

  it('appends each added die as a term after the d20, a subtracted one marked and negative', () => {
    const roll = record([bane, bless])
    expect(roll.normalizedExpression).toBe('1d20 - 1d4 + 1d4')
    expect(roll.evidence.terms.slice(1)).toEqual([
      { count: 1, die: 4, rolls: [2], subtotal: -2, subtracted: true },
      { count: 1, die: 4, rolls: [3], subtotal: 3 }
    ])
    expect(roll.evidence.subtotal).toBe(10)
    expect(roll.evidence.total).toBe(10)
  })
})
