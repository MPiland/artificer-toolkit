import {
  d20FoldedBonusTotal,
  formatD20FoldedBonus
} from '@artificer-toolkit/schema/shared/d20FoldedBonuses'
import {
  SRD_ABILITY_DEFINITION_IDS,
  srdSystemRecord
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { describe, expect, it } from 'vitest'

import { coverFoldedBonuses, type EncounterCoverFacts } from '../encounterCover.js'

/** The SRD System's own cover data: what each tier adds and to which saves. */
const rules = srdSystemRecord.cover
if (!rules) throw new Error('The SRD System authors no cover rules.')
const tier = (code: string): EncounterCoverFacts['tier'] => {
  const found = rules.tiers.find((candidate) => candidate.code === code)
  if (!found) throw new Error(`The SRD System has no ${code} cover tier.`)
  return found
}
const facts = (code: string): EncounterCoverFacts => ({
  tier: tier(code),
  saveAbilityDefinitionIds: rules.saveAbilityDefinitionIds
})

describe('the d20 bonus a cover tier folds (SPELLS-14.T2)', () => {
  it('raises an attack’s target defense by the tier’s bonus', () => {
    expect(coverFoldedBonuses(facts('HALF'), { kind: 'ATTACK' })).toEqual([
      { label: 'Half cover', amount: 2, operand: 'defenseOrDc' }
    ])
    expect(coverFoldedBonuses(facts('THREE_QUARTERS'), { kind: 'ATTACK' })[0]?.amount).toBe(5)
  })

  it('adds to the saver’s roll only for the abilities the System names', () => {
    expect(
      coverFoldedBonuses(facts('HALF'), {
        kind: 'SAVE',
        abilityDefinitionId: SRD_ABILITY_DEFINITION_IDS.DEXTERITY
      })
    ).toEqual([{ label: 'Half cover', amount: 2, operand: 'modifier' }])
    expect(
      coverFoldedBonuses(facts('HALF'), {
        kind: 'SAVE',
        abilityDefinitionId: SRD_ABILITY_DEFINITION_IDS.CONSTITUTION
      })
    ).toEqual([])
  })

  it('folds nothing without cover', () => {
    expect(coverFoldedBonuses(null, { kind: 'ATTACK' })).toEqual([])
    expect(
      coverFoldedBonuses({ tier: null, saveAbilityDefinitionIds: [] }, { kind: 'ATTACK' })
    ).toEqual([])
  })

  it('totals and labels each operand separately', () => {
    const bonuses = coverFoldedBonuses(facts('HALF'), { kind: 'ATTACK' })
    expect(d20FoldedBonusTotal(bonuses, 'defenseOrDc')).toBe(2)
    expect(d20FoldedBonusTotal(bonuses, 'modifier')).toBe(0)
    expect(formatD20FoldedBonus({ label: 'Half cover', amount: 2, operand: 'modifier' })).toBe(
      'Half cover +2'
    )
    expect(formatD20FoldedBonus(bonuses[0]!)).toBe("Half cover: target's defense +2")
  })
})
