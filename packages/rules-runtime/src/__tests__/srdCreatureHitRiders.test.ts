import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { describe, expect, it } from 'vitest'

import { prepareNativeActionEffectsPlan } from '../encounterActionEffects.js'
import { readEncounterActorConditionState } from '../encounterCharacterMechanicsBatch.js'
import { nativeConcentrationDamageApplications } from '../encounterConcentrationDamage.js'
import { lockedRelationshipActionFacts } from '../encounterRelationshipActionFacts.js'
import { resolveCreatureDamageExpression } from '../systems/dnd5e/effectActionCompiler.js'
import { executeTargetBoundActiveRuleEffectWithPause } from '../targetBoundActiveRuleEffectExecutor.js'
import { SRD, srdByLabel } from '../testing/dnd5eSrdCharacter.js'
import {
  createSrdRulesRuntime,
  creatureFeature,
  srdCondition,
  srdCreatureActor,
  testUuid
} from '../testing/dnd5eSrdEncounter.js'
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
  /** The label of the feature option the GM picks (a Dryad's Shillelagh club, an enlarged Duergar pick). */
  option?: string
  /** The label of the target Creature; the Ogre unless the attack is size-capped. */
  target?: string
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
    target: srdCreatureActor({
      id: TARGET_ID,
      creature: srdByLabel(SRD.creatures, input.target ?? 'Ogre')
    }),
    featureId: creatureFeature(attacker, input.feature).id,
    ...(input.option && {
      effectId: creatureFeature(attacker, input.feature).options?.find(
        ({ label }) => label === input.option
      )?.effects?.[0]?.id
    }),
    overridable: true
  })
  const { execution, mechanics } = await settleCreatureAction({ prepared, rolls: input.rolls })
  const target = mechanics.targetPlan.updatedActor
  if (target.kind === 'CHARACTER') throw new Error('Expected the Ogre target.')
  return {
    execution,
    effects: prepareNativeActionEffectsPlan({
      prepared,
      execution,
      occurrenceId: testUuid(0xb3),
      commandId: testUuid(0xb4),
      activeEffectsByActorId: new Map()
    }),
    spatial:
      prepared.adapter.interpretSpatial?.({
        execution: execution.execution,
        occurrenceId: testUuid(0xb3),
        published: execution.published,
        targetActorId: TARGET_ID
      }) ?? [],
    hitPoints: target.currentHitPoints,
    conditionIds: readEncounterActorConditionState(target.conditions).ids,
    receiptApplications: mechanics.targetPlan.receiptApplications,
    transition: mechanics.targetPlan.targetTransition,
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

/**
 * The relationship action facts of the attacker's next use of `feature`, against the given target,
 * while the relationship its `hit` created holds the Ogre.
 */
function heldActionFacts(input: {
  hit: Awaited<ReturnType<typeof attackOgre>>
  creature: Parameters<typeof creatureFeature>[0]
  feature: string
}) {
  const definition = input.hit.effects.recurringEffect?.definition
  if (!definition) throw new Error('Expected the relationship effect.')
  const [effect] = creatureFeature(input.creature, input.feature).effects ?? []
  if (!effect) throw new Error('Expected the attack effect.')
  return (targetActorId: string) =>
    lockedRelationshipActionFacts({
      actionEffectId: effect.id,
      sourceActorId: ATTACKER_ID,
      targetActorId,
      targets: {
        activeEffectsByActorId: new Map([[TARGET_ID, [{ id: testUuid(0xb7), definition }]]])
      }
    })
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
    runtime: createSrdRulesRuntime()
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

describe('SRD Creature critical hits and hit point maximum drains', () => {
  it('rolls every damage die of the Hell Hound’s Bite twice on a natural 20', async () => {
    // Bite, +5: 2d8 + 3 piercing and 4d6 fire when critical; every die rolling 1.
    const crit = await attackOgre({
      attacker: 'Hell Hound',
      feature: 'Bite',
      rolls: [19, 0, 0, 0, 0, 0, 0]
    })
    expect(crit.execution.d20).toMatchObject({ selectedNatural: 20, resultPath: 'ON_CRIT' })
    expect(crit.damage).toEqual([
      [2 + 3, srdDamageTypeId('PIERCING')],
      [4, srdDamageTypeId('FIRE')]
    ])
  })

  it('reports the natural 20 and DC of the Giant Spider’s saved poison', async () => {
    const saved = await attackOgre({
      attacker: 'Giant Spider',
      feature: 'Bite',
      rolls: [9, 3, 19, 2, 4]
    })
    expect(saved.execution.nestedD20).toMatchObject({
      selectedNatural: 20,
      defenseOrDc: 11,
      resultPath: 'ON_SAVE_SUCCESS'
    })
  })

  it('drains the target’s hit point maximum with the Wight’s Life Drain until a long rest (D62)', async () => {
    // Life Drain, +4: 6 (1d6 + 2) necrotic, then DC 13 Constitution or the maximum drops by that much.
    const drained = await attackOgre({
      attacker: 'Wight',
      feature: 'Life Drain',
      rolls: [9, 3, 0]
    })
    expect(drained.execution.nestedD20).toMatchObject({
      defenseOrDc: 13,
      resultPath: 'ON_SAVE_FAIL'
    })
    expect(drained.damage).toEqual([[6, srdDamageTypeId('NECROTIC')]])
    expect(drained.transition.after.maximumHitPoints).toBe(
      drained.transition.before.maximumHitPoints - 6
    )
    expect(drained.receiptApplications).toContainEqual(
      expect.objectContaining({
        kind: 'HIT_POINT_MAXIMUM_REDUCTION',
        reductionAmount: 6,
        recoveryTags: ['RESTORE_HIT_POINT_MAXIMUM', 'LONG_REST']
      })
    )
  })

  it.each([
    // DC 15 Constitution, the Ogre +3: a 5 fails, a 15 succeeds; 5d10 + 5 psychic, every die a 3.
    ['fails', 4, 'ON_SAVE_FAIL', 3 * 5 + 5],
    ['makes', 14, 'ON_SAVE_SUCCESS', Math.floor((3 * 5 + 5) / 2)]
  ] as const)(
    'drains the hit point maximum by the psychic damage of the Succubus’s Draining Kiss when the target %s its save',
    async (_result, saveFace, resultPath, damage) => {
      const kissed = await attackOgre({
        attacker: 'Succubus/Incubus',
        feature: 'Draining Kiss',
        rolls: [saveFace, 2, 2, 2, 2, 2]
      })
      expect(kissed.execution.d20).toMatchObject({ defenseOrDc: 15, resultPath })
      expect(kissed.damage).toEqual([[damage, srdDamageTypeId('PSYCHIC')]])
      expect(kissed.transition.after.maximumHitPoints).toBe(
        kissed.transition.before.maximumHitPoints - damage
      )
      expect(kissed.receiptApplications).toContainEqual(
        expect.objectContaining({
          kind: 'HIT_POINT_MAXIMUM_REDUCTION',
          reductionAmount: damage,
          resolvedPath: resultPath,
          recoveryTags: ['RESTORE_HIT_POINT_MAXIMUM', 'LONG_REST']
        })
      )
    }
  )
})

describe('SRD Creature weapon attacks through held Equipment (D62, M9)', () => {
  it('deals the Ogre’s printed Greatclub damage, larger than the Equipment’s own dice', async () => {
    // Greatclub, +6: 13 (2d8 + 4) bludgeoning; a Greatclub alone deals 1d8.
    const hit = await attackOgre({ attacker: 'Ogre', feature: 'Greatclub', rolls: [9, 0, 1] })
    expect(hit.execution.d20).toMatchObject({ total: 16, resultPath: 'ON_HIT' })
    expect(hit.damage).toEqual([[1 + 2 + 4, srdDamageTypeId('BLUDGEONING')]])
  })

  it('deals the Ogre Zombie’s printed bludgeoning, whatever damage type its held Morningstar defaults to (ATTACK-5.T4a)', async () => {
    // Morningstar, +6: 13 (2d8 + 4) bludgeoning, printed over the Equipment's own piercing.
    const hit = await attackOgre({
      attacker: 'Ogre Zombie',
      feature: 'Morningstar',
      rolls: [9, 0, 1]
    })
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
    // D105: the conditions belong to one relationship effect, which the settlement applies to the
    // target (proved for a Creature target in the Session Worker room: nativeRoomHitRiders.test.ts).
    const definition = hit.effects.recurringEffect?.definition
    if (!definition) throw new Error('Expected the grapple relationship effect.')
    const conditionIds = [srdCondition('Grappled'), srdCondition('Restrained')].sort()
    const contributions = definition.stateContributions
    expect(
      contributions
        .flatMap((contribution) =>
          contribution.kind === 'ACTOR_RELATIONSHIP' ? contribution.conditionIds : []
        )
        .sort()
    ).toEqual(conditionIds)
    expect(
      contributions
        .flatMap((contribution) =>
          contribution.kind === 'CONDITION_OWNERSHIP' ? [contribution.conditionId] : []
        )
        .sort()
    ).toEqual(conditionIds)
  })

  it('restrains the Giant Frog’s Bite target, and the frog can bite no other target while it holds one', async () => {
    // Bite, +3: 4 (1d6 + 1) piercing, grappled and restrained; the frog can't bite another target.
    const frog = srdByLabel(SRD.creatures, 'Giant Frog')
    const hit = await attackOgre({ attacker: 'Giant Frog', feature: 'Bite', rolls: [9, 2] })
    expect(hit.damage).toEqual([[3 + 1, srdDamageTypeId('PIERCING')]])
    const definition = hit.effects.recurringEffect?.definition
    if (!definition) throw new Error('Expected the grapple relationship effect.')
    expect(
      definition.stateContributions
        .flatMap((contribution) =>
          contribution.kind === 'ACTOR_RELATIONSHIP' ? contribution.conditionIds : []
        )
        .sort()
    ).toEqual([srdCondition('Grappled'), srdCondition('Restrained')].sort())

    const bite = heldActionFacts({ hit, creature: frog, feature: 'Bite' })
    expect(bite(TARGET_ID)).toEqual([])
    expect(() => bite(testUuid(0xb8))).toThrow(
      'The selected action target is restricted by an active relationship.'
    )
  })

  it('attaches the Darkmantle to its Crush target: advantage on it, no other target, blinded only on an advantaged hit', async () => {
    // Crush, +5: 6 (1d6 + 3) bludgeoning, and the darkmantle attaches; a normal roll does not engulf.
    const darkmantle = srdByLabel(SRD.creatures, 'Darkmantle')
    const hit = await attackOgre({ attacker: 'Darkmantle', feature: 'Crush', rolls: [9, 2] })
    expect(hit.damage).toEqual([[3 + 3, srdDamageTypeId('BLUDGEONING')]])
    expect(hit.conditionIds).not.toContain(srdCondition('Blinded'))

    const crush = heldActionFacts({ hit, creature: darkmantle, feature: 'Crush' })
    expect(crush(TARGET_ID)).toMatchObject([{ influence: 'ADVANTAGE' }])
    expect(() => crush(testUuid(0xb8))).toThrow(
      'The selected action target is restricted by an active relationship.'
    )
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
          expiration: {
            kind: 'TICKS',
            initialRemaining: 10,
            decrementStage: 'END_OF_TURN',
            anchor: 'HOLDER'
          }
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
    // Hand Crossbow, +4: 5 (1d6 + 2) piercing, then DC 13 Constitution or poisoned for 1 hour. The
    // Ogre's 9 fails by 4, short of the unconscious rider (creatureFailureMarginRider.test.ts).
    const failed = await attackOgre({
      attacker: 'Drow',
      feature: 'Hand Crossbow',
      rolls: [9, 0, 5]
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

describe('SRD Creature hits the GM picks the exact option of (ATTACK-5.3 to 5.7)', () => {
  it('reduces the target’s hit point maximum by the Clay Golem’s Slam damage on a failed save, not on a success', async () => {
    // Slam, +8: 2d10 + 5 bludgeoning, then DC 15 Constitution; the Ogre saves at +3.
    const failed = await attackOgre({
      attacker: 'Clay Golem',
      feature: 'Slam',
      rolls: [9, 0, 0, 0]
    })
    expect(failed.execution.nestedD20).toMatchObject({
      defenseOrDc: 15,
      resultPath: 'ON_SAVE_FAIL'
    })
    expect(failed.damage).toEqual([[7, srdDamageTypeId('BLUDGEONING')]])
    expect(failed.transition.after.maximumHitPoints).toBe(
      failed.transition.before.maximumHitPoints - 7
    )

    const saved = await attackOgre({
      attacker: 'Clay Golem',
      feature: 'Slam',
      rolls: [9, 0, 0, 19]
    })
    expect(saved.execution.nestedD20).toMatchObject({ resultPath: 'ON_SAVE_SUCCESS' })
    expect(saved.transition.after.maximumHitPoints).toBe(saved.transition.before.maximumHitPoints)
  })

  it('deals the Cloaker’s Bite damage and attaches it to the Ogre, a Large target', async () => {
    // Bite, +6: 2d6 + 3 piercing with both dice rolling 1.
    const hit = await attackOgre({ attacker: 'Cloaker', feature: 'Bite', rolls: [9, 0, 0] })
    expect(hit.damage).toEqual([[5, srdDamageTypeId('PIERCING')]])
    expect(hit.effects.recurringEffect?.definition).toBeDefined()
  })

  it.each([
    { attacker: 'Dryad', feature: 'Club', option: 'Club', rolls: [9, 0], damage: 1 },
    { attacker: 'Dryad', feature: 'Club', option: 'Club (Shillelagh)', rolls: [9, 0], damage: 5 },
    { attacker: 'Duergar', feature: 'War Pick', option: 'War Pick', rolls: [9, 0], damage: 3 },
    {
      attacker: 'Duergar',
      feature: 'War Pick',
      option: 'War Pick (Enlarged)',
      rolls: [9, 0, 0],
      damage: 4
    },
    {
      attacker: 'Duergar',
      feature: 'Javelin',
      option: 'Javelin (Melee, Enlarged)',
      rolls: [9, 0, 0],
      damage: 4
    },
    {
      attacker: 'Duergar',
      feature: 'Javelin',
      option: 'Javelin (Ranged, Enlarged)',
      rolls: [9, 0, 0],
      damage: 4
    }
  ])('deals the $attacker’s $option damage', async ({ damage, ...input }) => {
    const hit = await attackOgre(input)
    expect(hit.damage.map(([amount]) => amount)).toEqual([damage])
  })
})

describe('SRD Creature hits with saves, drains and holds (ATTACK-5.10 to 5.14)', () => {
  it('poisons the Ogre with the Quasit’s Claws on a failed save, not on a success', async () => {
    // Claws, +4: 1d4 + 3 piercing, then DC 10 Constitution: 2d4 poison and poisoned for 1 minute.
    const failed = await attackOgre({
      attacker: 'Quasit',
      feature: 'Claws (Bite in Beast Form)',
      rolls: [9, 0, 0, 0, 0]
    })
    expect(failed.execution.nestedD20).toMatchObject({
      defenseOrDc: 10,
      resultPath: 'ON_SAVE_FAIL'
    })
    expect(failed.damage).toEqual([
      [4, srdDamageTypeId('PIERCING')],
      [2, srdDamageTypeId('POISON')]
    ])
    expect(failed.conditionIds).toEqual([srdCondition('Poisoned')])

    const saved = await attackOgre({
      attacker: 'Quasit',
      feature: 'Claws (Bite in Beast Form)',
      rolls: [9, 0, 19, 0, 0]
    })
    expect(saved.execution.nestedD20).toMatchObject({ resultPath: 'ON_SAVE_SUCCESS' })
    expect(saved.damage.map(([amount]) => amount)).toEqual([4])
    expect(saved.conditionIds).toEqual([])
  })

  it('frightens the Ogre with the Quasit’s Scare on a failed Wisdom save', async () => {
    const scared = await attackOgre({
      attacker: 'Quasit',
      feature: 'Scare (1/Day)',
      rolls: [0]
    })
    expect(scared.execution.d20).toMatchObject({ defenseOrDc: 10, resultPath: 'ON_SAVE_FAIL' })
    expect(scared.conditionIds).toEqual([srdCondition('Frightened')])
  })

  it('takes the Spirit Naga’s Bite poison in full on a failed save and half on a success', async () => {
    // Bite, +7: 1d6 + 4 piercing, then DC 13 Constitution: 7d8 poison, half on a success.
    const failed = await attackOgre({
      attacker: 'Spirit Naga',
      feature: 'Bite',
      rolls: [9, 0, 0, ...Array<number>(7).fill(0)]
    })
    expect(failed.damage).toEqual([
      [5, srdDamageTypeId('PIERCING')],
      [7, srdDamageTypeId('POISON')]
    ])
    const saved = await attackOgre({
      attacker: 'Spirit Naga',
      feature: 'Bite',
      rolls: [9, 0, 19, ...Array<number>(7).fill(0)]
    })
    expect(saved.execution.nestedD20).toMatchObject({ resultPath: 'ON_SAVE_SUCCESS' })
    expect(saved.damage.map(([amount]) => amount)).toEqual([5, 3])
  })

  it('restrains with the Cockatrice’s Bite on a failed save, escalating to petrified at its turn end (ATTACK-5.15)', async () => {
    // Bite, +3: 1d4 + 1 piercing, then DC 11 Constitution: restrained, repeating at the target's turn end.
    const failed = await attackOgre({ attacker: 'Cockatrice', feature: 'Bite', rolls: [9, 0, 0] })
    expect(failed.execution.nestedD20).toMatchObject({
      defenseOrDc: 11,
      resultPath: 'ON_SAVE_FAIL'
    })
    expect(failed.damage).toEqual([[2, srdDamageTypeId('PIERCING')]])
    expect(failed.conditionIds).toEqual([srdCondition('Restrained')])
    expect(failed.effects.recurringEffect).toMatchObject({
      definition: {
        recurrence: {
          recurrenceStage: 'END_OF_TURN',
          expiration: { kind: 'TICKS', initialRemaining: 1 }
        }
      },
      lifecycle: { remainingTicks: 1 }
    })

    const saved = await attackOgre({ attacker: 'Cockatrice', feature: 'Bite', rolls: [9, 0, 19] })
    expect(saved.execution.nestedD20).toMatchObject({ resultPath: 'ON_SAVE_SUCCESS' })
    expect(saved.conditionIds).toEqual([])
    expect(saved.effects.recurringEffect).toBeNull()
  })

  it('spits the Guardian Naga’s poison with no hit damage: full on a failed save, half on a success (ATTACK-5.15)', async () => {
    // Spit Poison, +8: no damage on the hit itself, then DC 15 Constitution: 10d8 poison, half on a success.
    const failed = await attackOgre({
      attacker: 'Guardian Naga',
      feature: 'Spit Poison',
      rolls: [9, 0, ...Array<number>(10).fill(0)]
    })
    expect(failed.execution.nestedD20).toMatchObject({
      defenseOrDc: 15,
      resultPath: 'ON_SAVE_FAIL'
    })
    expect(failed.damage).toEqual([[10, srdDamageTypeId('POISON')]])
    const saved = await attackOgre({
      attacker: 'Guardian Naga',
      feature: 'Spit Poison',
      rolls: [9, 19, ...Array<number>(10).fill(0)]
    })
    expect(saved.execution.nestedD20).toMatchObject({ resultPath: 'ON_SAVE_SUCCESS' })
    expect(saved.damage).toEqual([[5, srdDamageTypeId('POISON')]])
  })

  it('reduces the Ogre’s Strength with the Shadow’s Strength Drain', async () => {
    // Strength Drain, +4: 2d6 + 2 necrotic, and Strength drops by 1d4 (rolling 4).
    const drained = await attackOgre({
      attacker: 'Shadow',
      feature: 'Strength Drain',
      rolls: [9, 0, 0, 3]
    })
    expect(drained.damage).toEqual([[4, srdDamageTypeId('NECROTIC')]])
    expect(drained.receiptApplications).toContainEqual(
      expect.objectContaining({ kind: 'SCALAR_REDUCTION', reductionAmount: 4 })
    )
  })

  it('grapples, restrains and blinds a Medium target with the Rug of Smothering', async () => {
    // Smother, +5 against the Veteran's AC 17: grappled, restrained and blinded, escape DC 13.
    const hit = await attackOgre({
      attacker: 'Rug of Smothering',
      feature: 'Smother',
      rolls: [14],
      target: 'Veteran'
    })
    const definition = hit.effects.recurringEffect?.definition
    if (!definition) throw new Error('Expected the grapple relationship effect.')
    expect(
      definition.stateContributions
        .flatMap((contribution) =>
          contribution.kind === 'ACTOR_RELATIONSHIP' ? contribution.conditionIds : []
        )
        .sort()
    ).toEqual(
      [srdCondition('Blinded'), srdCondition('Grappled'), srdCondition('Restrained')].sort()
    )
  })
})

describe('SRD Creature hits that force a saving throw', () => {
  it('adds the Purple Worm’s Tail Stinger poison on its hit: full on a failed save, half on a success (ATTACK-5.9)', async () => {
    // Tail Stinger, +9: 3d6 + 9 piercing, then DC 19 Constitution: 12d6 poison, half on a success.
    const failed = await attackOgre({
      attacker: 'Purple Worm',
      feature: 'Tail Stinger',
      rolls: [9, 0, 0, 0, 0, ...Array<number>(12).fill(1)]
    })
    expect(failed.execution.nestedD20).toMatchObject({
      defenseOrDc: 19,
      resultPath: 'ON_SAVE_FAIL'
    })
    expect(failed.damage).toEqual([
      [12, srdDamageTypeId('PIERCING')],
      [24, srdDamageTypeId('POISON')]
    ])

    const saved = await attackOgre({
      attacker: 'Purple Worm',
      feature: 'Tail Stinger',
      rolls: [9, 0, 0, 0, 19, ...Array<number>(12).fill(1)]
    })
    expect(saved.execution.nestedD20).toMatchObject({ resultPath: 'ON_SAVE_SUCCESS' })
    expect(saved.damage.map(([amount]) => amount)).toEqual([12, 12])
  })

  it('pulls the target of the Balor’s Whip 25 feet on a failed Strength save (ATTACK-5.2)', async () => {
    // Whip, +14: 2d6 + 3d6 damage, then DC 20 Strength or pulled up to 25 feet toward the Balor.
    const failed = await attackOgre({
      attacker: 'Balor',
      feature: 'Whip',
      rolls: [9, 0, 0, 0, 0, 0, 0]
    })
    expect(failed.execution.nestedD20).toMatchObject({
      defenseOrDc: 20,
      resultPath: 'ON_SAVE_FAIL'
    })
    expect(failed.spatial).toEqual([
      expect.objectContaining({
        kind: 'FORCED_MOVEMENT',
        targetActorId: TARGET_ID,
        direction: 'TOWARD_SOURCE',
        feet: 25
      })
    ])

    const saved = await attackOgre({
      attacker: 'Balor',
      feature: 'Whip',
      rolls: [9, 0, 0, 0, 0, 0, 19]
    })
    expect(saved.execution.nestedD20).toMatchObject({ resultPath: 'ON_SAVE_SUCCESS' })
    expect(saved.spatial).toEqual([])
  })

  it('pushes the target 10 feet and knocks it prone with the Dragon Turtle’s Tail on a failed save (ATTACK-5.15)', async () => {
    // Tail, +13: 3d12 + 7 bludgeoning, then DC 20 Strength or pushed up to 10 feet and prone.
    const failed = await attackOgre({
      attacker: 'Dragon Turtle',
      feature: 'Tail',
      rolls: [9, 0, 0, 0, 0]
    })
    expect(failed.execution.nestedD20).toMatchObject({
      defenseOrDc: 20,
      resultPath: 'ON_SAVE_FAIL'
    })
    expect(failed.conditionIds).toEqual([srdCondition('Prone')])
    expect(failed.spatial).toEqual([
      expect.objectContaining({
        kind: 'FORCED_MOVEMENT',
        targetActorId: TARGET_ID,
        direction: 'AWAY_FROM_SOURCE',
        feet: 10
      })
    ])

    const saved = await attackOgre({
      attacker: 'Dragon Turtle',
      feature: 'Tail',
      rolls: [9, 0, 0, 0, 19]
    })
    expect(saved.execution.nestedD20).toMatchObject({ resultPath: 'ON_SAVE_SUCCESS' })
    expect(saved.conditionIds).toEqual([])
    expect(saved.spatial).toEqual([])
  })

  it('deals the Kraken’s Lightning Storm bolt in full on a failed Dexterity save (ATTACK-5.8)', async () => {
    // DC 23 Dexterity: 4d10 lightning, half on a success. The Ogre's -1 never meets the DC.
    const bolt = await attackOgre({
      attacker: 'Kraken',
      feature: 'Lightning Storm',
      rolls: [19, 3, 3, 3, 3]
    })
    expect(bolt.execution.d20).toMatchObject({ defenseOrDc: 23, resultPath: 'ON_SAVE_FAIL' })
    expect(bolt.damage).toEqual([[16, srdDamageTypeId('LIGHTNING')]])
  })

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
          expiration: {
            kind: 'TICKS',
            initialRemaining: 10,
            decrementStage: 'END_OF_TURN',
            anchor: 'HOLDER'
          }
        }
      },
      lifecycle: { remainingTicks: 10 }
    })
  })
})
