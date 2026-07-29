import { describe, expect, it } from 'vitest'

import {
  clampCharacterCurrentHitPoints,
  dnd5e2014RulesSystem,
  formatCharacterHitDiceRollExpression,
  resolveCharacterEffectiveMaximumHitPoints,
  rollCharacterHitDice,
  validateCharacterHitDiceRollEvidence
} from '@artificer-toolkit/shared'

describe('character Sheet rest rules', () => {
  it('formats and rolls mixed hit dice with each denomination modifier', () => {
    const values = [7, 2]
    const evidence = rollCharacterHitDice(
      [
        { die: 8, count: 1, modifierPerDie: 2 },
        { die: 10, count: 1, modifierPerDie: 2 }
      ],
      {
        nextInt() {
          const value = values.shift()
          if (value === undefined) throw new Error('Unexpected random request.')
          return value
        }
      }
    )

    expect(evidence).toEqual({
      expression: '1d10 + 1d8 + 4',
      terms: [
        { die: 10, count: 1, modifierPerDie: 2, rolls: [8] },
        { die: 8, count: 1, modifierPerDie: 2, rolls: [3] }
      ],
      total: 15
    })
  })

  it('formats negative and zero hit-die modifiers canonically', () => {
    expect(
      formatCharacterHitDiceRollExpression([
        { die: 10, count: 2, modifierPerDie: -1 },
        { die: 8, count: 1, modifierPerDie: 2 }
      ])
    ).toBe('2d10 + 1d8')
    expect(formatCharacterHitDiceRollExpression([{ die: 8, count: 2, modifierPerDie: -1 }])).toBe(
      '2d8 - 2'
    )
  })

  it('rejects duplicate dice and inexact evidence', () => {
    expect(() =>
      formatCharacterHitDiceRollExpression([
        { die: 8, count: 1, modifierPerDie: 1 },
        { die: 8, count: 1, modifierPerDie: 1 }
      ])
    ).toThrow('may appear only once')
    expect(() =>
      validateCharacterHitDiceRollEvidence({
        expression: '1d8 + 2',
        terms: [{ die: 8, count: 1, modifierPerDie: 2, rolls: [9] }],
        total: 11
      })
    ).toThrow('must not exceed 8')
  })

  it('owns D&D 5e 2014 hit-die and exhaustion recovery policy', () => {
    expect(dnd5e2014RulesSystem.rest.hitDiceRecoveredAfterLongRest(0)).toBe(0)
    expect(dnd5e2014RulesSystem.rest.hitDiceRecoveredAfterLongRest(1)).toBe(1)
    expect(dnd5e2014RulesSystem.rest.hitDiceRecoveredAfterLongRest(5)).toBe(2)
    expect(dnd5e2014RulesSystem.exhaustion.maximumLevel).toBe(6)
    expect(dnd5e2014RulesSystem.exhaustion.levelAfterLongRest(3)).toBe(2)
    expect(dnd5e2014RulesSystem.exhaustion.levelAfterLongRest(0)).toBe(0)
  })

  it('floors effective maximum HP and clamps current HP', () => {
    expect(resolveCharacterEffectiveMaximumHitPoints(-4)).toBe(0)
    expect(clampCharacterCurrentHitPoints(12, 8)).toBe(8)
    expect(clampCharacterCurrentHitPoints(-2, 8)).toBe(0)
    expect(clampCharacterCurrentHitPoints(4, -8)).toBe(0)
  })
})
