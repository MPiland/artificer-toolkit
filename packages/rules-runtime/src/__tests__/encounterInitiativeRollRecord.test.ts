import { describe, expect, it } from 'vitest'
import { initiativeRollExpression, initiativeRollRecord } from '../encounterRuleCheckRolls.js'

import { DND5E_SYSTEM_ID } from '../systems/dnd5e/identity.js'

const ruleset = { systemId: DND5E_SYSTEM_ID, code: 'dnd5e', version: '1' }

function record(rollMode: 'NORMAL' | 'ADVANTAGE' | 'DISADVANTAGE', faces: number[], modifier = 3) {
  const remaining = [...faces]
  return initiativeRollRecord({
    id: '00000000-0000-4000-8000-0000000000aa',
    expression: initiativeRollExpression(20, modifier),
    rollMode,
    nextInt: () => remaining.shift()! - 1,
    characterId: null,
    rollerLabel: 'Mira',
    ruleset,
    createdAt: '2026-10-14T00:00:00.000Z'
  })
}

describe('initiativeRollRecord', () => {
  it('writes the one Initiative record of a normal roll: the die plus the modifier', () => {
    const roll = record('NORMAL', [12])
    expect(roll).toMatchObject({
      id: '00000000-0000-4000-8000-0000000000aa',
      characterLabel: 'Mira',
      source: { kind: 'INITIATIVE', label: 'Initiative' },
      normalizedExpression: '1d20 + 3'
    })
    expect(roll.evidence.terms[0]?.rolls).toEqual([12])
    expect(roll.evidence.total).toBe(15)
  })

  it('shows both dice of an advantage roll and keeps the higher', () => {
    const roll = record('ADVANTAGE', [4, 17])
    expect(roll.evidence.mode).toBe('ADVANTAGE')
    expect(roll.evidence.terms[0]?.rolls).toEqual([4, 17])
    expect(roll.evidence.terms[0]?.keptRollIndex).toBe(1)
    expect(roll.evidence.total).toBe(20)
  })

  it('shows both dice of a disadvantage roll and keeps the lower', () => {
    const roll = record('DISADVANTAGE', [4, 17])
    expect(roll.evidence.mode).toBe('DISADVANTAGE')
    expect(roll.evidence.terms[0]?.rolls).toEqual([4, 17])
    expect(roll.evidence.terms[0]?.keptRollIndex).toBe(0)
    expect(roll.evidence.total).toBe(7)
  })

  it('writes a negative modifier and omits a zero one', () => {
    expect(initiativeRollExpression(20, -2)).toBe('1d20-2')
    expect(initiativeRollExpression(20, 0)).toBe('1d20')
  })
})
