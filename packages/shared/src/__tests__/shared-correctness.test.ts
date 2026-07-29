import { describe, expect, it } from 'vitest'
import {
  ABILITY_MODIFIER_REFERENCE_OPTIONS,
  ABILITY_OPTIONS,
  type AbilityCode
} from '../domains/core/ability.js'
import { compileCurrencyGroups } from '../domains/subjects/compilers/character/state.js'
import { currencies, CurrencyCode } from '../domains/vocabulary/authored/currency.js'
import { passives, PassiveCode } from '../domains/vocabulary/authored/passive.js'

describe('shared D&D 5e correctness regressions', () => {
  it('keeps spellcasting as a contextual modifier reference, not an ability score', () => {
    const abilityCodes: AbilityCode[] = ABILITY_OPTIONS.map((option) => option.code)

    expect(abilityCodes).toEqual([
      'STRENGTH',
      'DEXTERITY',
      'CONSTITUTION',
      'INTELLIGENCE',
      'WISDOM',
      'CHARISMA'
    ])
    expect(ABILITY_MODIFIER_REFERENCE_OPTIONS.map((option) => option.code)).toContain(
      'SPELLCASTING'
    )
  })

  it('uses SRD currency values expressed in copper pieces', () => {
    const values = Object.fromEntries(
      currencies.map((currency) => [currency.code, currency.baseValue])
    )

    expect(values).toMatchObject({
      [CurrencyCode.COPPER]: 1,
      [CurrencyCode.SILVER]: 10,
      [CurrencyCode.ELECTRUM]: 50,
      [CurrencyCode.GOLD]: 100,
      [CurrencyCode.PLATINUM]: 1000
    })
  })

  it('uses Intelligence for Passive Investigation', () => {
    expect(passives.find((passive) => passive.code === PassiveCode.INVESTIGATION)?.ability).toBe(
      'INTELLIGENCE'
    )
  })

  it('preserves stable currency-group identity through compilation', () => {
    const groups = [
      {
        id: 'coin-purse',
        currencies: [{ currencyId: 'gold', amount: 12 }]
      }
    ]

    expect(compileCurrencyGroups(groups)).toEqual(groups)
  })
})
