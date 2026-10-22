import { describe, expect, it } from 'vitest'
import {
  ABILITY_MODIFIER_REFERENCE_OPTIONS,
  ABILITY_OPTIONS,
  type AbilityCode
} from '../domains/core/ability.js'

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
})
