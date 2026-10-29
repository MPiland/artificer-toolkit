import { describe, expect, it } from 'vitest'

import { EncounterActionEffectPlanError } from '../encounterActionEffectPlans.js'
import { srdDamageTypeId } from '../testing/absorbElementsSpell.js'
import { testUuid } from '../testing/dnd5eSrdEncounter.js'
import { plannedAbsorbElements } from '../testing/plannedAbsorbElements.js'

/**
 * REACTION-4.2: an authored Absorb Elements resists only the damage type that triggered it, and its
 * follow-up melee damage scales with the slot it was cast with.
 */

const ids = { commandId: testUuid(0x7d0), occurrenceId: testUuid(0x7d1) }

function grantOf(effect: ReturnType<typeof plannedAbsorbElements>) {
  const { definition } = effect
  if (!('stateContributions' in definition)) throw new Error('The reaction has no state.')
  const contribution = definition.stateContributions.find(
    (candidate) => candidate.kind === 'MODIFIER_GRANT'
  )
  if (contribution?.kind !== 'MODIFIER_GRANT') throw new Error('The reaction grants modifiers.')
  return contribution
}

function payloads(effect: ReturnType<typeof plannedAbsorbElements>) {
  return grantOf(effect).modifiers.map((modifier) => modifier.payload)
}

describe('the resistance an Absorb Elements reaction leaves', () => {
  it('resists only the type that triggered it, though the spell names several', () => {
    const effect = plannedAbsorbElements({
      ...ids,
      chosenDamageTypeCodes: ['FIRE', 'COLD'],
      triggerDamageTypeCodes: ['COLD']
    })

    expect(payloads(effect)).toContainEqual({ damageTypeId: srdDamageTypeId('COLD') })
    expect(payloads(effect)).not.toContainEqual({ damageTypeId: srdDamageTypeId('FIRE') })
  })

  it('resists each type a hit dealt that the spell names', () => {
    const effect = plannedAbsorbElements({
      ...ids,
      chosenDamageTypeCodes: ['FIRE', 'COLD'],
      triggerDamageTypeCodes: ['FIRE', 'COLD']
    })

    expect(payloads(effect)).toEqual(
      expect.arrayContaining([
        { damageTypeId: srdDamageTypeId('FIRE') },
        { damageTypeId: srdDamageTypeId('COLD') }
      ])
    )
  })

  it('refuses to plan a resistance when no damage triggered the reaction', () => {
    expect(() => plannedAbsorbElements({ ...ids, triggerDamageTypeCodes: [] })).toThrow(
      EncounterActionEffectPlanError
    )
  })
})

describe('the follow-up an Absorb Elements reaction leaves', () => {
  const bonusOf = (castLevel: number) =>
    payloads(plannedAbsorbElements({ ...ids, castLevel })).find(
      (payload) => (payload as { valueKind?: string }).valueKind !== undefined
    )

  it.each([
    [1, 2],
    [3, 6]
  ])('adds the slot-scaled melee damage at cast level %i', (castLevel, amount) => {
    expect(bonusOf(castLevel)).toMatchObject({ valueKind: 'FIXED', amount })
  })

  it('is spent by the first attack roll', () => {
    expect(plannedAbsorbElements(ids).definition.recurrence.endTriggers).toContainEqual({
      event: 'LIFECYCLE',
      timing: 'CONSUME',
      code: 'ON_ATTACK_ROLL'
    })
  })
})
