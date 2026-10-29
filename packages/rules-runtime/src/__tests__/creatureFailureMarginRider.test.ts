import { describe, expect, it } from 'vitest'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { SRD_BASIC_ACTION_IDS } from '@artificer-toolkit/source-data/srd/basicActions.js'

import { prepareNativeActionEffectsPlan } from '../encounterActionEffects.js'
import { createLinkedRiders } from '../encounterActionEffectPlans.js'
import { readEncounterActorConditionState } from '../encounterCharacterMechanicsBatch.js'
import {
  actionUsedOnHolderEndedEffects,
  targetEndedEffects
} from '../encounterEndedEffectRelease.js'
import { discoverEncounterEventHooks } from '../events/encounterEventHooks.js'
import { SRD, srdByLabel } from '../testing/dnd5eSrdCharacter.js'
import {
  ENCOUNTER_ID,
  creatureFeature,
  srdCondition,
  srdCreatureActor,
  testUuid
} from '../testing/dnd5eSrdEncounter.js'
import { activeEffect } from './encounterActiveEffectFixtures.js'
import {
  prepareCreatureAction,
  settleCreatureAction,
  srdAbilityId
} from './encounterCreatureAction.js'

const ATTACKER_ID = testUuid(0x2200)
const TARGET_ID = testUuid(0x2201)
const POISONED = srdCondition('Poisoned')
const UNCONSCIOUS = srdCondition('Unconscious')

/** Shaking a sleeper awake, and any damage, wake it (SRD 5.1). */
const WAKE_TRIGGERS = [
  { event: 'ACTION_USED_ON_HOLDER', actionDefinitionIds: [SRD_BASIC_ACTION_IDS.ROUSE] },
  { event: 'DAMAGE_TAKEN', by: 'ANYONE', damageTypeIds: null }
]

/**
 * A Creature's attack against the seeded Ogre (AC 11, CON 16: +3 to its save), with every roll a
 * 0-based die face in request order: the attack d20, its damage dice, then the save d20.
 */
async function attackOgre(attacker: CreatureAuthored, feature: string, rolls: readonly number[]) {
  const prepared = await prepareCreatureAction({
    actor: srdCreatureActor({ id: ATTACKER_ID, creature: attacker }),
    target: srdCreatureActor({ id: TARGET_ID, creature: srdByLabel(SRD.creatures, 'Ogre') }),
    featureId: creatureFeature(attacker, feature).id,
    overridable: true
  })
  const { execution, mechanics } = await settleCreatureAction({ prepared, rolls })
  const target = mechanics.targetPlan.updatedActor
  if (target.kind === 'CHARACTER') throw new Error('Expected the Ogre target.')
  return {
    conditionIds: readEncounterActorConditionState(target.conditions).ids,
    effects: prepareNativeActionEffectsPlan({
      prepared,
      execution,
      occurrenceId: testUuid(0x2202),
      commandId: testUuid(0x2203),
      activeEffectsByActorId: new Map()
    })
  }
}

/**
 * SRD text: a save failed by 5 or more (the Sprite's "5 or lower" against DC 10 is the same) also
 * knocks the target unconscious for the poison's duration. `marginFace` is the save d20 face whose
 * total fails by exactly 5; one face higher fails by 4.
 */
const ATTACKS = [
  // Hand Crossbow, +4: 1d6 + 2 piercing, then DC 13 Constitution: a total of 8 fails by 5.
  { creature: 'Drow', feature: 'Hand Crossbow', hit: [9, 0], marginFace: 4, turns: 600 },
  // Sting, +4: 1d4 + 2 piercing, then DC 11 Constitution: a total of 6 fails by 5.
  { creature: 'Pseudodragon', feature: 'Sting', hit: [9, 0], marginFace: 2, turns: 600 },
  // Shortbow, +6: 1 piercing, then DC 10 Constitution: a total of 5 fails by 5.
  { creature: 'Sprite', feature: 'Shortbow', hit: [9], marginFace: 1, turns: 10 }
]

describe('a save failed by a margin applies a rider condition (SPELLS-27.T11)', () => {
  it.each(ATTACKS)(
    '$creature’s $feature poisons on a failed save and adds a waking sleep on a failure by 5',
    async ({ creature, feature, hit, marginFace, turns }) => {
      const attacker = srdByLabel(SRD.creatures, creature)
      const asleep = await attackOgre(attacker, feature, [...hit, marginFace])
      expect([...asleep.conditionIds].sort()).toEqual([POISONED, UNCONSCIOUS].sort())
      expect(asleep.effects.recurringEffect?.definition.recurrence).toMatchObject({
        endTriggers: [],
        expiration: { kind: 'TICKS', initialRemaining: turns }
      })
      // The sleep is its own effect: it lasts as long as the poison, or until it is woken.
      expect(asleep.effects.riderEffects[0]?.definition).toMatchObject({
        recurrence: {
          endTriggers: WAKE_TRIGGERS,
          expiration: { kind: 'TICKS', initialRemaining: turns }
        },
        stateContributions: [
          { kind: 'CONDITION_OWNERSHIP', conditionId: UNCONSCIOUS, baselinePresent: false }
        ]
      })

      const poisoned = await attackOgre(attacker, feature, [...hit, marginFace + 1])
      expect(poisoned.conditionIds).toEqual([POISONED])
      expect(poisoned.effects.recurringEffect).not.toBeNull()
      expect(poisoned.effects.riderEffects.filter(Boolean)).toEqual([])
    }
  )

  it.each(ATTACKS)(
    '$creature’s sleep lasts only while its poison does (D172)',
    async ({ creature, feature, hit, marginFace }) => {
      const { effects } = await attackOgre(srdByLabel(SRD.creatures, creature), feature, [
        ...hit,
        marginFace
      ])
      const { recurringEffect, riderEffects } = effects
      if (!recurringEffect || !riderEffects[0]) throw new Error(`${creature} planned no sleep.`)
      expect(riderEffects[0].endsWith).toBe('PRIMARY')
      expect(recurringEffect).not.toHaveProperty('endsWith')
      const poison = { id: testUuid(0x2208) }
      const created = (recurring: typeof poison | null) =>
        createLinkedRiders(
          riderEffects,
          recurring,
          (plan) => plan && { id: testUuid(0x2209), definition: plan.definition }
        )[0]?.definition
      expect(created(poison)?.linkedEffectId).toBe(poison.id)
      expect(created(null)?.linkedEffectId).toBeNull()
    }
  )

  it('ends the sleep with the poison and the poison not with the sleep', () => {
    const owner = {
      kind: 'ENCOUNTER_ACTOR' as const,
      encounterId: ENCOUNTER_ID,
      targetActorId: TARGET_ID
    }
    const poison = activeEffect({
      id: testUuid(0x2209),
      owner,
      createdOrdinal: 1,
      endTriggers: [{ event: 'LIFECYCLE', timing: 'END', code: 'ON_ATTACK_ROLL' }],
      stateContributions: [
        { kind: 'CONDITION_OWNERSHIP', conditionId: POISONED, baselinePresent: false }
      ]
    })
    const sleep = activeEffect({
      id: testUuid(0x220a),
      owner,
      createdOrdinal: 2,
      linkedEffectId: poison.id,
      stateContributions: [
        { kind: 'CONDITION_OWNERSHIP', conditionId: UNCONSCIOUS, baselinePresent: false }
      ]
    })
    const attack = [
      { kind: 'ACTION' as const, attackRoll: true, spellCast: false, againstEnemy: false }
    ]
    expect(
      discoverEncounterEventHooks({ effects: [poison, sleep], events: attack }).ended.map(
        ({ id }) => id
      )
    ).toEqual([poison.id, sleep.id])
    expect(discoverEncounterEventHooks({ effects: [sleep], events: attack }).ended).toEqual([])
  })

  it('refuses a rider that ends with anything but its save’s one condition', async () => {
    const drow = srdByLabel(SRD.creatures, 'Drow')
    const linkedTo = (endsWithOutcomeId: string): CreatureAuthored => ({
      ...drow,
      features: drow.features?.map((feature) =>
        feature.label !== 'Hand Crossbow'
          ? feature
          : {
              ...feature,
              effects: feature.effects?.map((effect) => ({
                ...effect,
                paths: effect.paths.map((path) =>
                  path.selectionKind !== 'FIXED'
                    ? path
                    : {
                        ...path,
                        resultBlock: {
                          ...path.resultBlock,
                          outcomes: path.resultBlock.outcomes.map((outcome) =>
                            outcome.effectKind === 'FOLLOW_UP_SAVE' && outcome.failureMarginRider
                              ? {
                                  ...outcome,
                                  failureMarginRider: {
                                    ...outcome.failureMarginRider,
                                    endsWithOutcomeId
                                  }
                                }
                              : outcome
                          )
                        }
                      }
                )
              }))
            }
      )
    })
    await expect(
      attackOgre(linkedTo(testUuid(0x220b)), 'Hand Crossbow', [9, 0, 4])
    ).rejects.toThrow(/no discovered action/)
  })

  it('ends the sleep on damage or a Rouse while the poison stays', async () => {
    const { effects } = await attackOgre(
      srdByLabel(SRD.creatures, 'Pseudodragon'),
      'Sting',
      [9, 0, 2]
    )
    const {
      recurringEffect,
      riderEffects: [riderEffect]
    } = effects
    if (!recurringEffect || !riderEffect) throw new Error('The sting planned no poison or sleep.')
    const owner = {
      kind: 'ENCOUNTER_ACTOR' as const,
      encounterId: ENCOUNTER_ID,
      targetActorId: TARGET_ID
    }
    const held = [
      { id: testUuid(0x2204), effect: recurringEffect },
      { id: testUuid(0x2205), effect: riderEffect }
    ].map(({ id, effect }, index) => ({
      ...activeEffect({
        id,
        owner,
        createdOrdinal: index + 1,
        stateContributions: [
          { kind: 'CONDITION_OWNERSHIP', conditionId: POISONED, baselinePresent: false }
        ]
      }),
      definition: effect.definition
    }))
    const roused = actionUsedOnHolderEndedEffects({
      holderActorId: TARGET_ID,
      held,
      usedByActorId: testUuid(0x2206),
      basicActionDefinitionId: SRD_BASIC_ACTION_IDS.ROUSE
    })
    expect(roused.endedEffects.map(({ id }) => id)).toEqual([testUuid(0x2205)])
    expect(roused.releases).toMatchObject([{ conditionId: UNCONSCIOUS }])
    const damaged = targetEndedEffects({
      holderActorId: TARGET_ID,
      held,
      attack: null,
      testEvidence: [],
      turnActorId: null,
      applications: [
        {
          kind: 'DAMAGE',
          targetActorId: TARGET_ID,
          damageTypeId: testUuid(0x2207),
          resolvedAmount: 1
        } as Parameters<typeof targetEndedEffects>[0]['applications'][number]
      ],
      damagerActorId: testUuid(0x2206),
      dispositions: new Map()
    })
    expect(damaged.endedEffects.map(({ id }) => id)).toEqual([testUuid(0x2205)])
    expect(damaged.releases).toMatchObject([{ conditionId: UNCONSCIOUS }])
  })

  // Parity (ADR 0038): the rider written out in core options alone plays like the SRD data.
  it('plays a rider authored from core options only like the SRD Sprite', async () => {
    const sprite = srdByLabel(SRD.creatures, 'Sprite')
    const authored: CreatureAuthored = {
      ...sprite,
      features: sprite.features?.map((feature) =>
        feature.label !== 'Shortbow'
          ? feature
          : {
              ...feature,
              effects: feature.effects?.map((effect) => ({
                ...effect,
                paths: effect.paths.map((path) =>
                  path.selectionKind !== 'FIXED'
                    ? path
                    : {
                        ...path,
                        resultBlock: {
                          ...path.resultBlock,
                          outcomes: path.resultBlock.outcomes.map((outcome) =>
                            outcome.effectKind !== 'FOLLOW_UP_SAVE'
                              ? outcome
                              : {
                                  id: outcome.id,
                                  effectKind: 'FOLLOW_UP_SAVE' as const,
                                  timing: 'IMMEDIATE' as const,
                                  savingThrow: {
                                    id: testUuid(0x2212),
                                    dcMethod: 'FIXED_DC' as const,
                                    abilityDefinitionId: srdAbilityId('CONSTITUTION'),
                                    baseDc: 10
                                  },
                                  attempts: { kind: 'ONCE' as const },
                                  onSuccess: { kind: 'END' as const },
                                  onFailure: {
                                    kind: 'OUTCOMES' as const,
                                    endCurrent: false,
                                    resultKind: 'SINGLE' as const,
                                    outcomes: [
                                      {
                                        id: testUuid(0x2213),
                                        effectKind: 'CONDITION' as const,
                                        conditionId: POISONED
                                      }
                                    ]
                                  },
                                  failureMarginRider: {
                                    id: testUuid(0x2210),
                                    failedBy: 5,
                                    endsWithOutcomeId: testUuid(0x2213),
                                    outcomes: [
                                      {
                                        id: testUuid(0x2211),
                                        effectKind: 'CONDITION' as const,
                                        conditionId: UNCONSCIOUS
                                      }
                                    ],
                                    lifecycle: {
                                      endTriggers: [
                                        { event: 'DAMAGE_TAKEN' as const, by: 'ANYONE' as const },
                                        {
                                          event: 'ACTION_USED_ON_HOLDER' as const,
                                          actionDefinitionIds: [SRD_BASIC_ACTION_IDS.ROUSE]
                                        }
                                      ]
                                    }
                                  }
                                }
                          )
                        }
                      }
                )
              }))
            }
      )
    }
    const played = async (creature: CreatureAuthored, saveFace: number) => {
      const { conditionIds, effects } = await attackOgre(creature, 'Shortbow', [9, saveFace])
      const rider = effects.riderEffects[0]?.definition
      return {
        conditionIds: [...conditionIds].sort(),
        rider: rider
          ? {
              linkedTo: effects.riderEffects[0]?.endsWith,
              recurrence: rider.recurrence,
              stateContributions: 'stateContributions' in rider ? rider.stateContributions : null
            }
          : null
      }
    }
    for (const saveFace of [1, 2]) {
      const authoredPlay = await played(authored, saveFace)
      expect(authoredPlay).toEqual(await played(sprite, saveFace))
      expect(authoredPlay.rider !== null).toBe(saveFace === 1)
    }
  })
})
