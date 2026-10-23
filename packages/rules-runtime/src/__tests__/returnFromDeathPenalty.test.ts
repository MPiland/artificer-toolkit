import { deathSavesAfterRoll } from '@artificer-toolkit/schema/shared/characterDeathSaves'
import { raiseDead } from '@artificer-toolkit/source-data/srd/spells/raise-dead.js'
import { describe, expect, it } from 'vitest'

import { prepareActiveRuleEffectRecord } from '../activeRuleEffectRecords.js'
import {
  activeAbilityCheckModifier,
  activeSavingThrowModifier
} from '../character/activeEffectGrantTotals.js'
import { steppedDownEffectState } from '../character/restStepDown.js'
import { carriedTestDice } from '../character/sheetRoll.js'
import { withCharacterActiveGrants } from '../encounterActiveGrants.js'
import { evaluateDnd5e2014CharacterPolicy } from '../systems/dnd5e/characterPolicy.js'
import { evaluateSrdCharacter } from '../testing/dnd5eSrdCharacter.js'
import { testUuid } from '../testing/dnd5eSrdEncounter.js'
import { plannedTimedCondition } from '../testing/plannedTimedCondition.js'

const holderId = testUuid(0xe203)

function penalty() {
  const planned = plannedTimedCondition({
    encounterId: testUuid(0xe201),
    sourceActorId: testUuid(0xe202),
    holderActorId: holderId,
    spell: raiseDead,
    lifetimeScope: 'OWNER'
  })
  return prepareActiveRuleEffectRecord({
    id: testUuid(0xe204),
    owner: { kind: 'CHARACTER', characterId: holderId },
    definition: planned.definition,
    lifecycle: planned.lifecycle,
    currentEffects: [],
    occurredAt: '2026-10-22T00:00:00.000Z'
  })
}

const check = (abilityCode: string) => ({
  expression: '1d20 + 3',
  rollMode: 'NORMAL',
  source: { kind: 'ABILITY_CHECK' as const, label: 'check' },
  abilityCode
})
const save = (abilityCode: string) => ({
  expression: '1d20 + 3',
  rollMode: 'NORMAL',
  source: { kind: 'SAVING_THROW' as const, label: 'save' },
  abilityCode
})

describe('the return-from-death penalty', () => {
  const wizard = evaluateSrdCharacter({
    classes: [{ label: 'Wizard', level: 5 }],
    abilities: { INTELLIGENCE: 16, CONSTITUTION: 14 }
  })
  const base = evaluateDnd5e2014CharacterPolicy(wizard.facts).derivedStats
  const withPenalty = (effect = penalty()) =>
    evaluateDnd5e2014CharacterPolicy(withCharacterActiveGrants(wizard.facts, [effect])).derivedStats

  it('lowers an Encounter Character saving throw and spell attack by the current amount', () => {
    const hit = withPenalty()
    for (const [index, entry] of base.savingThrows.entries())
      expect(hit.savingThrows[index]?.total.effective).toBe(entry.total.effective - 4)
    expect(hit.spellcasting?.attackBonus.effective).toBe(
      (base.spellcasting?.attackBonus.effective ?? 0) - 4
    )
  })

  it('feels one point less after a long rest steps it down', () => {
    const effect = penalty()
    const stepped = { ...effect, ...steppedDownEffectState(effect) }
    const hit = withPenalty(stepped)
    expect(hit.savingThrows[0]?.total.effective).toBe(base.savingThrows[0]!.total.effective - 3)
  })

  it('lowers an ability check by the same amount, whatever the ability', () => {
    expect(activeAbilityCheckModifier([penalty()], 'STRENGTH')).toBe(-4)
    expect(activeAbilityCheckModifier([], 'STRENGTH')).toBe(0)
  })

  it('takes the flat amount off a Sheet check and a Sheet saving throw', () => {
    expect(carriedTestDice(check('WISDOM'), [penalty()]).modifier).toBe(-4)
    expect(carriedTestDice(save('WISDOM'), [penalty()]).modifier).toBe(-4)
    expect(carriedTestDice(check('WISDOM'), []).modifier).toBe(0)
  })

  it('takes the flat amount off a death save, keeping a natural 1 and 20 natural', () => {
    const modifier = activeSavingThrowModifier([penalty()], null)
    const dying = { successes: 0, failures: 0, stable: false }
    expect(modifier).toBe(-4)
    expect(activeSavingThrowModifier([], null)).toBe(0)
    expect(deathSavesAfterRoll(dying, 12, 0).deathSaves.successes).toBe(1)
    expect(deathSavesAfterRoll(dying, 12, modifier).deathSaves.failures).toBe(1)
    expect(deathSavesAfterRoll(dying, 14, modifier).deathSaves.successes).toBe(1)
    expect(deathSavesAfterRoll(dying, 20, modifier).regainsHitPoint).toBe(true)
  })
})
