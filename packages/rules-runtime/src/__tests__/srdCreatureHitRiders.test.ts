import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { describe, expect, it } from 'vitest'

import { characterRuleActionSystemAdapterRegistry } from '../characterRuleActionSystemAdapterRegistry.js'
import { prepareNativeActionEffectsPlan } from '../encounterActionEffects.js'
import { readEncounterActorConditionState } from '../encounterCharacterMechanicsBatch.js'
import { nativeConcentrationDamageApplications } from '../encounterConcentrationDamage.js'
import { resolveCreatureDamageExpression } from '../systems/dnd5e/effectActionCompiler.js'
import { executeTargetBoundActiveRuleEffectWithPause } from '../targetBoundActiveRuleEffectExecutor.js'
import { SRD, srdByLabel } from './dnd5eSrdCharacter.js'
import {
  createSrdRulesRuntime,
  creatureFeature,
  srdCondition,
  srdCreatureActor,
  testUuid
} from './dnd5eSrdEncounter.js'
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
async function attackOgre(input: {
  attacker: string
  feature: string
  rolls: readonly number[]
  attackerHitPoints?: number
}) {
  const attacker = srdByLabel(SRD.creatures, input.attacker)
  const prepared = await prepareCreatureAction({
    actor: srdCreatureActor({
      id: ATTACKER_ID,
      creature: attacker,
      ...(input.attackerHitPoints === undefined
        ? {}
        : { currentHitPoints: input.attackerHitPoints })
    }),
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

/** One end-of-turn tick of a timed condition on the Ogre, with the given turns remaining. */
async function tickTimedCondition(input: {
  definition: Parameters<typeof executeTargetBoundActiveRuleEffectWithPause>[0]['definition']
  remainingTicks: number
}) {
  const lifecycle = { schemaVersion: 1 as const, remainingTicks: input.remainingTicks }
  const ogre = srdByLabel(SRD.creatures, 'Ogre')
  const result = await executeTargetBoundActiveRuleEffectWithPause({
    activeEffectId: testUuid(0xb5),
    activeEffectVersion: 1,
    definition: input.definition,
    lifecycle,
    lifecycleChecksum: checksumRuleDocument(lifecycle),
    occurrenceId: testUuid(0xb6),
    targetActorId: TARGET_ID,
    currentHitPoints: ogre.hitPoints,
    temporaryHitPoints: 0,
    maximumHitPoints: ogre.hitPoints,
    targetScalarValues: {},
    targetConditionIds: [srdCondition('Poisoned')],
    targetDerivedFacts: {},
    defenses: [],
    runtime: await createSrdRulesRuntime(),
    adapters: characterRuleActionSystemAdapterRegistry
  })
  if ('continuation' in result) throw new Error('A timed condition asks for no dice.')
  return result
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

describe('SRD Creature weapon attacks through held Equipment (D62, M9)', () => {
  it('deals the Ogre’s printed Greatclub damage, larger than the Equipment’s own dice', async () => {
    // Greatclub, +6: 13 (2d8 + 4) bludgeoning; a Greatclub alone deals 1d8.
    const hit = await attackOgre({ attacker: 'Ogre', feature: 'Greatclub', rolls: [9, 0, 1] })
    expect(hit.execution.d20).toMatchObject({ total: 16, resultPath: 'ON_HIT' })
    expect(hit.damage).toEqual([[1 + 2 + 4, srdDamageTypeId('BLUDGEONING')]])
  })
})

describe('SRD hits that apply several conditions (D62, M9)', () => {
  it('grapples and restrains the target of the Giant Toad’s Bite', async () => {
    // Bite, +4: 7 (1d10 + 2) piercing plus 5 (1d10) poison, grappled and restrained.
    const hit = await attackOgre({ attacker: 'Giant Toad', feature: 'Bite', rolls: [9, 0, 1] })
    expect(hit.damage).toEqual([
      [1 + 2, srdDamageTypeId('PIERCING')],
      [2, srdDamageTypeId('POISON')]
    ])
    expect(hit.conditionIds).toEqual([srdCondition('Grappled'), srdCondition('Restrained')].sort())
  })
})

describe('SRD one-time saves with a timed condition (D62.2)', () => {
  it('poisons the target of the Homunculus’s Bite for 1 minute, ending after 10 of its turns', async () => {
    // Bite, +4: 1 piercing, then DC 10 Constitution or poisoned for 1 minute. The Ogre saves at +3.
    const failed = await attackOgre({ attacker: 'Homunculus', feature: 'Bite', rolls: [9, 0] })
    expect(failed.execution.nestedD20).toMatchObject({ total: 4, resultPath: 'ON_SAVE_FAIL' })
    expect(failed.conditionIds).toEqual([srdCondition('Poisoned')])
    const effect = failed.effects.recurringEffect
    if (!effect) throw new Error('Expected the timed poison effect.')
    expect(effect).toMatchObject({
      definition: {
        recurrence: {
          recurrenceStage: 'END_OF_TURN',
          expiration: { kind: 'TICKS', initialRemaining: 10, decrementStage: 'END_OF_TURN' }
        }
      },
      lifecycle: { remainingTicks: 10 }
    })
    // No save repeats: each of the target's turn ends only counts down, and the last removes it.
    const tick = (remainingTicks: number) =>
      tickTimedCondition({ definition: effect.definition, remainingTicks })
    expect(await tick(10)).toMatchObject({ applications: [], terminal: false, d20: null })
    expect(await tick(1)).toMatchObject({
      applications: [{ kind: 'CONDITION_REMOVE', conditionId: srdCondition('Poisoned') }],
      terminal: true,
      d20: null
    })

    const saved = await attackOgre({ attacker: 'Homunculus', feature: 'Bite', rolls: [9, 19] })
    expect(saved.conditionIds).toEqual([])
    expect(saved.effects.recurringEffect).toBeNull()
  })

  it('poisons the target of the Drow’s Hand Crossbow for 1 hour: 600 of its turns', async () => {
    // Hand Crossbow, +4: 5 (1d6 + 2) piercing, then DC 13 Constitution or poisoned for 1 hour.
    const failed = await attackOgre({
      attacker: 'Drow',
      feature: 'Hand Crossbow',
      rolls: [9, 0, 0]
    })
    expect(failed.conditionIds).toEqual([srdCondition('Poisoned')])
    expect(failed.effects.recurringEffect?.lifecycle).toEqual({
      schemaVersion: 1,
      remainingTicks: 600
    })
  })
})

describe('SRD swarm attacks', () => {
  it('bites a creature in its space for half dice once it has half of its hit points or fewer', async () => {
    // Swarm of Insects (22 hit points) Bites, +3, reach 0 ft.: 10 (4d4) piercing, or 5 (2d4)
    // piercing if the swarm has half of its hit points or fewer.
    const bites = (attackerHitPoints: number, rolls: readonly number[]) =>
      attackOgre({ attacker: 'Swarm of Insects', feature: 'Bites', attackerHitPoints, rolls })
    const full = await bites(12, [9, 0, 1, 2, 3])
    expect(full.execution.d20).toMatchObject({ total: 13, resultPath: 'ON_HIT' })
    expect(full.damage).toEqual([[1 + 2 + 3 + 4, srdDamageTypeId('PIERCING')]])
    expect((await bites(11, [9, 0, 1])).damage).toEqual([[1 + 2, srdDamageTypeId('PIERCING')]])
    // A critical hit doubles the half dice too.
    expect((await bites(11, [19, 0, 1, 2, 3])).damage).toEqual([
      [1 + 2 + 3 + 4, srdDamageTypeId('PIERCING')]
    ])
  })

  it('leaves half-hit-point dice unresolved without the source’s hit points', () => {
    const outcome = { values: [{ dice: '4d4', halfHitPointsDice: '2d4' }], bonuses: [] }
    const resolve = (sourceHitPoints: { current: number; maximum: number } | null) =>
      resolveCreatureDamageExpression({ outcome, sourceDerivedFacts: {}, sourceHitPoints })
    expect(resolve(null)).toBeNull()
    expect(resolve({ current: 12, maximum: 22 })).toBe('4d4')
    expect(resolve({ current: 11, maximum: 22 })).toBe('2d4')
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
