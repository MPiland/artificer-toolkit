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
 * SPELLS-33 T4i3b: the Solar's Slaying Longbow is authored data, a nested save whose failure branch
 * is a KILL gated to targets with 100 hit points or fewer.
 */

const ATTACKER_ID = testUuid(0x2500)
const TARGET_ID = testUuid(0x2501)
const SOLAR = srdByLabel(SRD.creatures, 'Solar')
const DRAGON = srdByLabel(SRD.creatures, 'Young Red Dragon')

const HIT = 14
const SAVE_FAILS = 0
const SAVE_SUCCEEDS = 19
const LOW_DIE = 0

/** The attack d20, 2d8 piercing, 6d8 radiant, then the save d20, every roll a 0-based die face. */
async function shoot(saveFace: number, hitPoints: number, solar: CreatureAuthored = SOLAR) {
  const prepared = await prepareCreatureAction({
    actor: srdCreatureActor({ id: ATTACKER_ID, creature: solar }),
    target: srdCreatureActor({ id: TARGET_ID, creature: DRAGON, currentHitPoints: hitPoints }),
    featureId: creatureFeature(solar, 'Slaying Longbow').id,
    overridable: true
  })
  return settleCreatureAction({
    prepared,
    rolls: [HIT, ...Array<number>(8).fill(LOW_DIE), saveFace]
  })
}

const kinds = (result: Awaited<ReturnType<typeof shoot>>) =>
  result.execution.applications.map(({ kind }) => kind)

describe('the Solar’s Slaying Longbow (SPELLS-33 T4i3b)', () => {
  it('kills a target with 100 hit points or fewer that fails the save', async () => {
    expect(kinds(await shoot(SAVE_FAILS, 100))).toEqual(['DAMAGE', 'DAMAGE', 'KILL'])
  })

  it('spares a target that makes the save', async () => {
    expect(kinds(await shoot(SAVE_SUCCEEDS, 100))).toEqual(['DAMAGE', 'DAMAGE'])
  })

  it('spares a target with more than 100 hit points even when it fails the save', async () => {
    expect(kinds(await shoot(SAVE_FAILS, 101))).toEqual(['DAMAGE', 'DAMAGE'])
  })

  // Parity (ADR 0038): the same rider written out in core options alone plays like the SRD data.
  it('plays a rider authored from core options only like the SRD Solar', async () => {
    const authored: CreatureAuthored = {
      ...SOLAR,
      features: SOLAR.features?.map((feature) =>
        feature.label !== 'Slaying Longbow'
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
                                    id: testUuid(0x2510),
                                    dcMethod: 'FIXED_DC' as const,
                                    abilityDefinitionId: srdAbilityId('CONSTITUTION'),
                                    baseDc: 15
                                  },
                                  attempts: { kind: 'ONCE' as const },
                                  onSuccess: { kind: 'END' as const },
                                  onFailure: {
                                    kind: 'OUTCOMES' as const,
                                    endCurrent: false,
                                    resultKind: 'SINGLE' as const,
                                    gate: {
                                      kind: 'TARGET_HIT_POINTS_AT_MOST' as const,
                                      amount: 100
                                    },
                                    outcomes: [
                                      { id: testUuid(0x2511), effectKind: 'KILL' as const }
                                    ]
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
      [SAVE_FAILS, 100],
      [SAVE_SUCCEEDS, 100],
      [SAVE_FAILS, 101]
    ] as const) {
      expect(kinds(await shoot(saveFace, hitPoints, authored))).toEqual(
        kinds(await shoot(saveFace, hitPoints))
      )
    }
  })
})
