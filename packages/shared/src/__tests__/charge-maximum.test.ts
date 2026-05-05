import { describe, expect, it } from 'vitest'
import { CHARGE_BONUS_KIND, CHARGE_RESET_KIND } from '#core'
import {
  compileCharge,
  resolveCompiledChargeMaximum
} from '#compilers'

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

    expect(resolveCompiledChargeMaximum(compiled, {
      abilities: {},
      classLevel: 5,
      proficiencyBonus: 3,
      totalLevel: 5
    })).toBe(8)
  })
})
