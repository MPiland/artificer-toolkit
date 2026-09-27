import { describe, expect, it } from 'vitest'

import { prepareNativeActionEffectsPlan } from '../encounterActionEffects.js'
import { readEncounterActorConditionState } from '../encounterCharacterMechanicsBatch.js'
import { nativeConcentrationDamageApplications } from '../encounterConcentrationDamage.js'
import { SRD, srdByLabel } from './dnd5eSrdCharacter.js'
import { creatureFeature, srdCondition, srdCreatureActor, testUuid } from './dnd5eSrdEncounter.js'
import {
  prepareCreatureAction,
  settleCreatureAction,
  srdDamageTypeId
} from './encounterCreatureAction.js'

const ATTACKER_ID = testUuid(0xb1)
const TARGET_ID = testUuid(0xb2)

/**
 * A seeded SRD Creature's attack against the seeded Ogre (AC 11, 59 hit points, STR 19, CON 16),
 * with every roll a 0-based die face in request order.
 */
async function attackOgre(input: { attacker: string; feature: string; rolls: readonly number[] }) {
  const attacker = srdByLabel(SRD.creatures, input.attacker)
  const prepared = await prepareCreatureAction({
    actor: srdCreatureActor({ id: ATTACKER_ID, creature: attacker }),
    target: srdCreatureActor({ id: TARGET_ID, creature: srdByLabel(SRD.creatures, 'Ogre') }),
    featureId: creatureFeature(attacker, input.feature).id,
    overridable: true
  })
  const { execution, mechanics } = await settleCreatureAction({ prepared, rolls: input.rolls })
  const target = mechanics.targetPlan.updatedActor
  if (target.kind === 'CHARACTER') throw new Error('Expected the Ogre target.')
  return {
    execution,
    effects: prepareNativeActionEffectsPlan({
      prepared,
      execution: { kind: 'COMPLETE', ...execution },
      occurrenceId: testUuid(0xb3),
      commandId: testUuid(0xb4),
      activeEffectsByActorId: new Map()
    }),
    hitPoints: target.currentHitPoints,
    conditionIds: readEncounterActorConditionState(target.conditions).ids,
    damage: execution.applications.flatMap((application) =>
      application.kind === 'DAMAGE'
        ? [[application.requestedAmount, application.damageTypeId] as const]
        : []
    ),
    concentrationChecks: nativeConcentrationDamageApplications([
      { targetActorId: TARGET_ID, applications: mechanics.mechanics.receiptApplications }
    ])
  }
}

describe('SRD Creature attacks with several hit results', () => {
  it('deals every damage part of one hit as one damage source', async () => {
    // Adult Red Dragon Bite, +14: 19 (2d10 + 8) piercing plus 7 (2d6) fire.
    const hit = await attackOgre({
      attacker: 'Adult Red Dragon',
      feature: 'Bite',
      rolls: [9, 0, 1, 2, 3]
    })
    expect(hit.execution.d20).toMatchObject({ total: 24, resultPath: 'ON_HIT' })
    expect(hit.damage).toEqual([
      [11, srdDamageTypeId('PIERCING')],
      [7, srdDamageTypeId('FIRE')]
    ])
    expect(hit.hitPoints).toBe(59 - 18)
    // One damage source, so one Concentration check at the DC of its total.
    expect(hit.concentrationChecks).toMatchObject([{ appliedAmount: 18, damageTypeId: null }])
  })
})

describe('SRD Creature hits that force a saving throw', () => {
  it('takes the Giant Spider’s full poison on a failed save and half on a success', async () => {
    // Bite, +5: 7 (1d8 + 3) piercing, then DC 11 Constitution: 9 (2d8) poison, half on a success.
    const failed = await attackOgre({
      attacker: 'Giant Spider',
      feature: 'Bite',
      rolls: [9, 3, 0, 2, 4]
    })
    expect(failed.execution.nestedD20).toMatchObject({
      total: 1 + 3,
      defenseOrDc: 11,
      resultPath: 'ON_SAVE_FAIL'
    })
    expect(failed.damage).toEqual([
      [7, srdDamageTypeId('PIERCING')],
      [8, srdDamageTypeId('POISON')]
    ])
    expect(failed.hitPoints).toBe(59 - 15)
    expect(failed.concentrationChecks).toMatchObject([{ appliedAmount: 15, damageTypeId: null }])

    const saved = await attackOgre({
      attacker: 'Giant Spider',
      feature: 'Bite',
      rolls: [9, 3, 9, 2, 4]
    })
    expect(saved.execution.nestedD20).toMatchObject({ total: 13, resultPath: 'ON_SAVE_SUCCESS' })
    expect(saved.damage.map(([amount]) => amount)).toEqual([7, 4])
  })

  it('deals the Poisonous Snake’s fixed 1 piercing before its poison save', async () => {
    // Bite, +5: 1 piercing, then DC 10 Constitution: 5 (2d4) poison, half on a success.
    const failed = await attackOgre({
      attacker: 'Poisonous Snake',
      feature: 'Bite',
      rolls: [9, 0, 1, 3]
    })
    expect(failed.execution.nestedD20).toMatchObject({
      defenseOrDc: 10,
      resultPath: 'ON_SAVE_FAIL'
    })
    expect(failed.damage).toEqual([
      [1, srdDamageTypeId('PIERCING')],
      [6, srdDamageTypeId('POISON')]
    ])
  })

  it('knocks the target prone only on a failed save against the Mastiff’s Bite', async () => {
    // Bite, +3: 4 (1d6 + 1) piercing, then DC 11 Strength or prone. The Ogre saves at +4.
    const failed = await attackOgre({ attacker: 'Mastiff', feature: 'Bite', rolls: [9, 2, 5] })
    expect(failed.execution.nestedD20).toMatchObject({
      total: 6 + 4,
      defenseOrDc: 11,
      resultPath: 'ON_SAVE_FAIL'
    })
    expect(failed.damage.map(([amount]) => amount)).toEqual([4])
    expect(failed.conditionIds).toEqual([srdCondition('Prone')])
    // Prone is applied once: no repeated save follows.
    expect(failed.effects.recurringEffect).toBeNull()

    const saved = await attackOgre({ attacker: 'Mastiff', feature: 'Bite', rolls: [9, 2, 6] })
    expect(saved.execution.nestedD20).toMatchObject({ total: 11, resultPath: 'ON_SAVE_SUCCESS' })
    expect(saved.conditionIds).toEqual([])
  })

  it('deals the Spider’s poison only on a failed save', async () => {
    // Bite, +4: 1 piercing, then DC 9 Constitution or 2 (1d4) poison; nothing on a success.
    const failed = await attackOgre({ attacker: 'Spider', feature: 'Bite', rolls: [9, 1, 2] })
    expect(failed.execution.nestedD20).toMatchObject({
      total: 2 + 3,
      defenseOrDc: 9,
      resultPath: 'ON_SAVE_FAIL'
    })
    expect(failed.damage).toEqual([
      [1, srdDamageTypeId('PIERCING')],
      [3, srdDamageTypeId('POISON')]
    ])

    const saved = await attackOgre({ attacker: 'Spider', feature: 'Bite', rolls: [9, 5, 2] })
    expect(saved.execution.nestedD20).toMatchObject({ total: 9, resultPath: 'ON_SAVE_SUCCESS' })
    expect(saved.damage).toEqual([[1, srdDamageTypeId('PIERCING')]])
  })

  it('paralyzes on a failed save against the Ghoul’s Claws, repeating the save each turn', async () => {
    // Claws, +4: 7 (2d4 + 2) slashing, then DC 10 Constitution or paralyzed.
    const failed = await attackOgre({ attacker: 'Ghoul', feature: 'Claws', rolls: [9, 1, 2, 5] })
    expect(failed.execution.nestedD20).toMatchObject({
      total: 6 + 3,
      defenseOrDc: 10,
      resultPath: 'ON_SAVE_FAIL'
    })
    expect(failed.damage.map(([amount]) => amount)).toEqual([2 + 3 + 2])
    expect(failed.conditionIds).toEqual([srdCondition('Paralyzed')])
    // "Paralyzed for 1 minute" ends after 10 of the target's turns at the latest.
    expect(failed.effects.recurringEffect).toMatchObject({
      definition: {
        recurrence: {
          recurrenceStage: 'END_OF_TURN',
          expiration: { kind: 'TICKS', initialRemaining: 10, decrementStage: 'END_OF_TURN' }
        }
      },
      lifecycle: { remainingTicks: 10 }
    })
  })
})
