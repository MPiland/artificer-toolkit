import { describe, expect, it } from 'vitest'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'

import { linkedRiderPlan } from '../encounterActionEffectPlans.js'
import { prepareNativeActionEffectsPlan } from '../encounterActionEffects.js'
import { SRD, srdByLabel } from '../testing/dnd5eSrdCharacter.js'
import { creatureFeature, srdCreatureActor, testUuid } from '../testing/dnd5eSrdEncounter.js'
import {
  prepareCreatureAction,
  settleCreatureAction,
  srdAbilityId
} from './encounterCreatureAction.js'

/**
 * SPELLS-33 T4i3c: the Giant Centipede's venom is authored data, a nested save whose failure deals
 * poison damage and, only if that damage takes the target to 0 hit points, stabilizes it and poisons
 * and paralyzes it.
 */

const ATTACKER_ID = testUuid(0x2600)
const TARGET_ID = testUuid(0x2601)
const CENTIPEDE = srdByLabel(SRD.creatures, 'Giant Centipede')
const OGRE = srdByLabel(SRD.creatures, 'Ogre')

const HIT = 14
const BITE_MAX = 3
const SAVE_FAILS = 0
const SAVE_SUCCEEDS = 19
const POISON_MAX = 5

/** The attack d20, the 1d4 bite die, the save d20, then 3d6 poison, every roll a 0-based die face. */
async function bite(saveFace: number, hitPoints: number, centipede: CreatureAuthored = CENTIPEDE) {
  const prepared = await prepareCreatureAction({
    actor: srdCreatureActor({ id: ATTACKER_ID, creature: centipede }),
    target: srdCreatureActor({ id: TARGET_ID, creature: OGRE, currentHitPoints: hitPoints }),
    featureId: creatureFeature(centipede, 'Bite').id,
    overridable: true
  })
  const settled = await settleCreatureAction({
    prepared,
    rolls: [HIT, BITE_MAX, saveFace, POISON_MAX, POISON_MAX, POISON_MAX]
  })
  return {
    ...settled,
    effects: prepareNativeActionEffectsPlan({
      prepared,
      execution: settled.execution,
      occurrenceId: testUuid(0x2602),
      commandId: testUuid(0x2603),
      activeEffectsByActorId: new Map()
    })
  }
}

const kinds = (result: Awaited<ReturnType<typeof bite>>) =>
  result.execution.applications.map(({ kind }) => kind)

describe('the Giant Centipede’s venom (SPELLS-33 T4i3c)', () => {
  it('stabilizes, poisons and paralyzes a target the poison damage takes to 0', async () => {
    expect(kinds(await bite(SAVE_FAILS, 20))).toEqual([
      'DAMAGE',
      'DAMAGE',
      'STABILIZE',
      'CONDITION_APPLY',
      'CONDITION_APPLY'
    ])
  })

  it('holds the poison for an hour and the paralysis only while that poison lasts (D172)', async () => {
    const { effects } = await bite(SAVE_FAILS, 20)
    const { recurringEffect, riderEffect } = effects
    if (!recurringEffect || !riderEffect)
      throw new Error('The venom planned no poison or paralysis.')
    expect(recurringEffect.definition.linkedEffectId).toBeNull()
    expect(riderEffect.linksToPrimary).toBe(true)
    expect(linkedRiderPlan(riderEffect, { id: testUuid(0x2604) })?.definition.linkedEffectId).toBe(
      testUuid(0x2604)
    )
    // A rider with no poison to follow, and a plan that links to nothing, keep their own lifetime.
    expect(linkedRiderPlan(riderEffect, null)?.definition.linkedEffectId).toBeNull()
    expect(
      linkedRiderPlan(recurringEffect, { id: testUuid(0x2604) })?.definition.linkedEffectId
    ).toBeNull()
    for (const effect of [recurringEffect, riderEffect]) {
      expect(effect.definition.recurrence).toMatchObject({
        expiration: { kind: 'TICKS', initialRemaining: 600 }
      })
    }
  })

  it('plans no timed effect unless the poison took the target to 0, or the save failed', async () => {
    for (const [saveFace, hitPoints] of [
      [SAVE_FAILS, OGRE.hitPoints ?? 59],
      [SAVE_SUCCEEDS, 20]
    ] as const) {
      const { effects } = await bite(saveFace, hitPoints)
      expect(effects.recurringEffect).toBeNull()
      expect(effects.riderEffect).toBeNull()
    }
  })

  it('only deals the poison damage when it leaves the target standing', async () => {
    expect(kinds(await bite(SAVE_FAILS, OGRE.hitPoints ?? 59))).toEqual(['DAMAGE', 'DAMAGE'])
  })

  it('does nothing further when the target makes the save', async () => {
    expect(kinds(await bite(SAVE_SUCCEEDS, 20))).toEqual(['DAMAGE'])
  })

  it('times only the poison when the band leaves the paralysis untimed', async () => {
    const untimedParalysis: CreatureAuthored = {
      ...CENTIPEDE,
      features: CENTIPEDE.features?.map((feature) => ({
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
                      outcome.effectKind !== 'FOLLOW_UP_SAVE' ||
                      outcome.onFailure.kind !== 'OUTCOMES'
                        ? outcome
                        : {
                            ...outcome,
                            onFailure: {
                              ...outcome.onFailure,
                              outcomes: outcome.onFailure.outcomes.map((banded) =>
                                banded.effectKind === 'CONDITION' && banded.endsWithOutcomeId
                                  ? {
                                      id: banded.id,
                                      effectKind: banded.effectKind,
                                      conditionId: banded.conditionId
                                    }
                                  : banded
                              )
                            }
                          }
                    )
                  }
                }
          )
        }))
      }))
    }
    const result = await bite(SAVE_FAILS, 20, untimedParalysis)
    expect(kinds(result)).toEqual(kinds(await bite(SAVE_FAILS, 20)))
    expect(result.effects.recurringEffect?.definition.recurrence).toMatchObject({
      expiration: { initialRemaining: 600 }
    })
    expect(result.effects.riderEffect).toBeNull()
  })

  // Parity (ADR 0038): the same venom written out in core options alone plays like the SRD data.
  it('plays a venom authored from core options only like the SRD Giant Centipede', async () => {
    const poison = testUuid(0x2610)
    const authored: CreatureAuthored = {
      ...CENTIPEDE,
      features: CENTIPEDE.features?.map((feature) =>
        feature.label !== 'Bite'
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
                                  ...outcome,
                                  savingThrow: {
                                    id: testUuid(0x2611),
                                    dcMethod: 'FIXED_DC' as const,
                                    abilityDefinitionId: srdAbilityId('CONSTITUTION'),
                                    baseDc: 11
                                  },
                                  onFailure: {
                                    kind: 'OUTCOMES' as const,
                                    endCurrent: false,
                                    resultKind: 'SEQUENCE' as const,
                                    gate: {
                                      kind: 'REDUCED_TO_ZERO_BY' as const,
                                      damageOutcomeId: poison
                                    },
                                    outcomes:
                                      outcome.onFailure.kind === 'OUTCOMES'
                                        ? outcome.onFailure.outcomes.map(
                                            (rewritten, index, original) => {
                                              const link = original.findIndex(
                                                ({ id }) =>
                                                  rewritten.effectKind === 'CONDITION' &&
                                                  id === rewritten.endsWithOutcomeId
                                              )
                                              return {
                                                ...rewritten,
                                                id: index === 0 ? poison : testUuid(0x2612 + index),
                                                ...(link < 0
                                                  ? {}
                                                  : {
                                                      endsWithOutcomeId:
                                                        link === 0
                                                          ? poison
                                                          : testUuid(0x2612 + link)
                                                    })
                                              }
                                            }
                                          )
                                        : []
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
    for (const [saveFace, hitPoints] of [
      [SAVE_FAILS, 20],
      [SAVE_FAILS, 59],
      [SAVE_SUCCEEDS, 20]
    ] as const) {
      expect(kinds(await bite(saveFace, hitPoints, authored))).toEqual(
        kinds(await bite(saveFace, hitPoints))
      )
    }
  })
})
