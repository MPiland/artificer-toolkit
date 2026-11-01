import { describe, expect, it } from 'vitest'

import { dnd5eMaintenanceLinkCapabilityAdapter } from '../systems/dnd5e/concentrationPolicy.js'
import {
  concentrationSaveItem,
  type ConcentrationSaveCondition
} from '../testing/concentrationSaveItem.js'
import { evaluateSrdCharacter } from '../testing/dnd5eSrdCharacter.js'

const advantageWhenOneHeld = concentrationSaveItem({
  number: 920,
  label: 'Lone Focus Ring',
  influence: 'ADVANTAGE',
  conditions: [{ predicateCode: 'HELD_CONCENTRATION_COUNT', min: 1, max: 1 }]
})
const disadvantageOnHeavyDamage = concentrationSaveItem({
  number: 921,
  label: 'Strained Focus Ring',
  influence: 'DISADVANTAGE',
  // 10 + the level of the spell concentrated on, authored as data.
  conditions: [{ predicateCode: 'CONCENTRATION_DAMAGE_OVER', over: 10, perSpellLevel: 1 }]
})
const disadvantageWhenTwoHeldAndHeavy = concentrationSaveItem({
  number: 922,
  label: 'Divided Focus Ring',
  influence: 'DISADVANTAGE',
  conditions: [
    { predicateCode: 'HELD_CONCENTRATION_COUNT', min: 2 },
    { predicateCode: 'CONCENTRATION_DAMAGE_OVER', over: 10, perSpellLevel: 1 }
  ] satisfies ConcentrationSaveCondition[]
})
const rings = [advantageWhenOneHeld, disadvantageOnHeavyDamage, disadvantageWhenTwoHeldAndHeavy]

function saveFor(
  ring: (typeof rings)[number] | null,
  roll: { appliedDamage: number; heldCount: number; spellLevel: number | null }
) {
  const { output } = evaluateSrdCharacter({
    classes: [{ label: 'Wizard', level: 5 }],
    items: ring ? [{ label: ring.label, equipped: true }] : [],
    extraEquipment: rings
  })
  return dnd5eMaintenanceLinkCapabilityAdapter.saveFacts({
    ...roll,
    targetActorId: 'holder',
    target: { effectiveRulePolicyOutput: output, targetDerivedFacts: {}, conditionMechanics: [] }
  })
}

describe('authored Concentration save predicates', () => {
  it('leave the Character-wide Constitution save alone', () => {
    const { output } = evaluateSrdCharacter({
      classes: [{ label: 'Wizard', level: 5 }],
      items: rings.map((ring) => ({ label: ring.label, equipped: true })),
      extraEquipment: rings
    })
    expect(output.savingThrowDefinitions.every((save) => save.rollMode === 'NORMAL')).toBe(true)
  })

  it('give advantage only while exactly one Concentration is held', () => {
    expect(
      saveFor(advantageWhenOneHeld, { appliedDamage: 5, heldCount: 1, spellLevel: 1 }).rollMode
    ).toBe('ADVANTAGE')
    expect(
      saveFor(advantageWhenOneHeld, { appliedDamage: 5, heldCount: 2, spellLevel: 1 }).rollMode
    ).toBe('NORMAL')
    expect(saveFor(null, { appliedDamage: 5, heldCount: 1, spellLevel: 1 }).rollMode).toBe('NORMAL')
  })

  it('give disadvantage when the damage exceeds the threshold for the spell saved for', () => {
    const save = (appliedDamage: number, spellLevel: number | null) =>
      saveFor(disadvantageOnHeavyDamage, { appliedDamage, heldCount: 1, spellLevel }).rollMode
    expect(save(12, 1)).toBe('DISADVANTAGE')
    expect(save(11, 1)).toBe('NORMAL')
    expect(save(12, 3)).toBe('NORMAL')
    expect(save(14, 3)).toBe('DISADVANTAGE')
  })

  it('fail closed when the save was not made for a spell', () => {
    expect(
      saveFor(disadvantageOnHeavyDamage, { appliedDamage: 40, heldCount: 1, spellLevel: null })
        .rollMode
    ).toBe('NORMAL')
  })

  it('judge each held spell on its own save', () => {
    const save = (spellLevel: number) =>
      saveFor(disadvantageWhenTwoHeldAndHeavy, { appliedDamage: 13, heldCount: 2, spellLevel })
        .rollMode
    expect(save(1)).toBe('DISADVANTAGE')
    expect(save(3)).toBe('NORMAL')
    expect(
      saveFor(disadvantageWhenTwoHeldAndHeavy, { appliedDamage: 13, heldCount: 1, spellLevel: 1 })
        .rollMode
    ).toBe('NORMAL')
  })
})
