import { describe, expect, it } from 'vitest'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'

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
  return settleCreatureAction({
    prepared,
    rolls: [HIT, BITE_MAX, saveFace, POISON_MAX, POISON_MAX, POISON_MAX]
  })
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

  it('only deals the poison damage when it leaves the target standing', async () => {
    expect(kinds(await bite(SAVE_FAILS, OGRE.hitPoints ?? 59))).toEqual(['DAMAGE', 'DAMAGE'])
  })

  it('does nothing further when the target makes the save', async () => {
    expect(kinds(await bite(SAVE_SUCCEEDS, 20))).toEqual(['DAMAGE'])
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
                                        ? outcome.onFailure.outcomes.map((rewritten, index) => ({
                                            ...rewritten,
                                            id: index === 0 ? poison : testUuid(0x2612 + index)
                                          }))
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
