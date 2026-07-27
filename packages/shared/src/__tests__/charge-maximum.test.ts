import { describe, expect, it } from 'vitest'
import type { ChargeAuthored } from '#authored'
import { CHARGE_BONUS_KIND, CHARGE_RESET_KIND } from '#core'
import { compileCharge, resolveCompiledChargeMaximum } from '#compilers'

describe('compiled charge maximum resolution', () => {
  it('applies authored bonuses to level-based charge limits', () => {
    const compiled = compileCharge({
      id: 'tactical-reserve',
      limitKind: 'CLASS_LEVEL',
      scalingKind: 'NONE',
      resetKind: CHARGE_RESET_KIND.SHORT_REST,
      classId: 'fighter',
      multiplier: 1,
      bonuses: [
        {
          id: 'proficiency-bonus',
          bonusKind: CHARGE_BONUS_KIND.PROFICIENCY_BONUS,
          multiplier: 1,
          order: 1
        }
      ]
    })

    expect(
      resolveCompiledChargeMaximum(compiled, {
        abilities: {},
        classLevels: { fighter: 5 },
        sourceClassLevel: 5,
        proficiencyBonus: 3,
        totalLevel: 5
      })
    ).toBe(8)
  })

  it('resolves spell-level and skill-bonus values from explicit context', () => {
    const spellLevelCharge = compileCharge({
      id: 'upcast-reserve',
      limitKind: 'SPELL_CAST_LEVEL',
      scalingKind: 'NONE',
      resetKind: CHARGE_RESET_KIND.MANUAL,
      multiplier: 2
    })
    const skillBonusCharge = compileCharge({
      id: 'expert-reserve',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: CHARGE_RESET_KIND.MANUAL,
      amount: 1,
      bonuses: [
        {
          id: 'arcana-bonus',
          bonusKind: CHARGE_BONUS_KIND.SKILL_BONUS,
          skillId: 'arcana',
          multiplier: 1,
          order: 1
        }
      ]
    })
    const context = {
      abilities: {},
      proficiencyBonus: 3,
      totalLevel: 5
    }

    expect(
      resolveCompiledChargeMaximum(spellLevelCharge, {
        ...context,
        spellCastLevel: 3
      })
    ).toBe(6)
    expect(
      resolveCompiledChargeMaximum(skillBonusCharge, {
        ...context,
        skillBonuses: { arcana: 7 }
      })
    ).toBe(8)
  })

  it.each<{ charge: ChargeAuthored; message: string }>([
    {
      charge: {
        id: 'ability-reserve',
        limitKind: 'ABILITY_MODIFIER',
        scalingKind: 'NONE',
        resetKind: CHARGE_RESET_KIND.MANUAL,
        ability: 'WISDOM'
      },
      message: 'ability score "WISDOM" is missing'
    },
    {
      charge: {
        id: 'class-reserve',
        limitKind: 'CLASS_LEVEL',
        scalingKind: 'NONE',
        resetKind: CHARGE_RESET_KIND.MANUAL,
        classId: 'fighter'
      },
      message: 'class level for "fighter" is missing'
    },
    {
      charge: {
        id: 'spell-reserve',
        limitKind: 'SPELL_CAST_LEVEL',
        scalingKind: 'NONE',
        resetKind: CHARGE_RESET_KIND.MANUAL
      },
      message: 'spell cast level is required'
    },
    {
      charge: {
        id: 'skill-reserve',
        limitKind: 'FIXED_AMOUNT',
        scalingKind: 'NONE',
        resetKind: CHARGE_RESET_KIND.MANUAL,
        amount: 1,
        bonuses: [
          {
            id: 'arcana-bonus',
            bonusKind: CHARGE_BONUS_KIND.SKILL_BONUS,
            skillId: 'arcana',
            order: 1
          }
        ]
      },
      message: 'skill bonus for "arcana" is missing'
    }
  ])('rejects missing context instead of silently defaulting ($message)', ({ charge, message }) => {
    expect(() =>
      resolveCompiledChargeMaximum(compileCharge(charge), {
        abilities: {},
        proficiencyBonus: 3,
        totalLevel: 5
      })
    ).toThrow(message)
  })
})
