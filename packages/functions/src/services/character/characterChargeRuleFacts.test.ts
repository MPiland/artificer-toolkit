import { describe, expect, it } from 'vitest'

import { compileCharge } from '@artificer-toolkit/shared/compilers'
import { CHARGE_RESET_KIND } from '@artificer-toolkit/shared/core'

import { buildCharacterChargeRuleFact } from './characterChargeRuleFacts.js'

describe('buildCharacterChargeRuleFact', () => {
  it('preserves raw identities without accepting resolved character values', () => {
    const fact = buildCharacterChargeRuleFact(
      compileCharge({
        id: 'arcane-charge',
        resetKind: CHARGE_RESET_KIND.LONG_REST,
        limitKind: 'CLASS_LEVEL',
        scalingKind: 'NONE',
        classId: 'wizard',
        bonuses: [
          { id: 'intelligence', bonusKind: 'ABILITY_MODIFIER', ability: 'INTELLIGENCE', order: 1 },
          { id: 'arcana', bonusKind: 'SKILL_BONUS', skillId: 'arcana', order: 2 },
          { id: 'proficiency', bonusKind: 'PROFICIENCY_BONUS', order: 3 }
        ]
      }),
      'arcane-charge:class'
    )

    expect(fact).toEqual({
      calculationId: 'arcane-charge:class',
      sourceId: 'arcane-charge',
      base: {
        kind: 'CLASS_LEVEL',
        classId: 'wizard',
        multiplier: null,
        minimum: null,
        maximum: null
      },
      bonuses: [
        {
          sourceId: 'arcane-charge:bonus:1:0',
          kind: 'ABILITY_MODIFIER',
          abilityId: 'INTELLIGENCE',
          multiplier: null,
          minimum: null,
          maximum: null
        },
        {
          sourceId: 'arcane-charge:bonus:2:1',
          kind: 'SKILL_BONUS',
          skillId: 'arcana',
          multiplier: null,
          minimum: null,
          maximum: null
        },
        {
          sourceId: 'arcane-charge:bonus:3:2',
          kind: 'PROFICIENCY_BONUS',
          multiplier: null,
          minimum: null,
          maximum: null
        }
      ]
    })
  })

  it('retains source-level identity and raw cast level for contextual bases', () => {
    const parent = buildCharacterChargeRuleFact(
      compileCharge({
        id: 'parent-charge',
        resetKind: CHARGE_RESET_KIND.LONG_REST,
        limitKind: 'PARENT_CLASS_LEVEL',
        scalingKind: 'NONE'
      }),
      'parent-charge:cleric',
      { sourceLevel: { kind: 'CLASS_LEVEL', classId: 'cleric' } }
    )
    const cast = buildCharacterChargeRuleFact(
      compileCharge({
        id: 'cast-charge',
        resetKind: CHARGE_RESET_KIND.LONG_REST,
        limitKind: 'SPELL_CAST_LEVEL',
        scalingKind: 'NONE'
      }),
      'cast-charge:level-4',
      { spellCastLevel: 4 }
    )

    expect(parent.base).toMatchObject({
      kind: 'PARENT_CLASS_LEVEL',
      sourceLevel: { kind: 'CLASS_LEVEL', classId: 'cleric' }
    })
    expect(cast.base).toMatchObject({ kind: 'SPELL_CAST_LEVEL', spellCastLevel: 4 })
  })
})
