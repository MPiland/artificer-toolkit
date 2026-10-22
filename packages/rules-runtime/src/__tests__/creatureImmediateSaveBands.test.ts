import { describe, expect, it } from 'vitest'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'

import { readEncounterActorConditionState } from '../encounterCharacterMechanicsBatch.js'
import { SRD, srdByLabel } from '../testing/dnd5eSrdCharacter.js'
import {
  creatureFeature,
  srdCondition,
  srdCreatureActor,
  testUuid
} from '../testing/dnd5eSrdEncounter.js'
import { prepareCreatureAction, settleCreatureAction } from './encounterCreatureAction.js'

const ATTACKER_ID = testUuid(0x2300)
const TARGET_ID = testUuid(0x2301)
const PRONE = srdCondition('Prone')
const SPIDER = srdByLabel(SRD.creatures, 'Giant Spider')

type FixedPath = Extract<
  NonNullable<
    NonNullable<CreatureAuthored['features']>[number]['effects']
  >[number]['paths'][number],
  { selectionKind: 'FIXED' }
>
type FollowUpSave = Extract<
  FixedPath['resultBlock']['outcomes'][number],
  { effectKind: 'FOLLOW_UP_SAVE' }
>

/** The seeded Giant Spider with its Bite's poison save rewritten by `rewrite`. */
function spiderWithBiteSave(rewrite: (save: FollowUpSave) => FollowUpSave): CreatureAuthored {
  return {
    ...SPIDER,
    features: SPIDER.features?.map((feature) =>
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
                          outcome.effectKind === 'FOLLOW_UP_SAVE' ? rewrite(outcome) : outcome
                        )
                      }
                    }
              )
            }))
          }
    )
  }
}

/**
 * The Bite against the seeded Ogre (AC 11, CON 16: +3 to its save), every roll a 0-based die face in
 * request order: the attack d20, the 1d8 bite die, the save d20, then the save's damage dice.
 */
async function biteOgre(attacker: CreatureAuthored, rolls: readonly number[]) {
  const target = srdCreatureActor({ id: TARGET_ID, creature: srdByLabel(SRD.creatures, 'Ogre') })
  const prepared = await prepareCreatureAction({
    actor: srdCreatureActor({ id: ATTACKER_ID, creature: attacker }),
    target,
    featureId: creatureFeature(attacker, 'Bite').id,
    overridable: true
  })
  const { mechanics } = await settleCreatureAction({ prepared, rolls })
  const updated = mechanics.targetPlan.updatedActor
  if (updated.kind === 'CHARACTER' || target.kind === 'CHARACTER')
    throw new Error('Expected the Ogre target.')
  return {
    damageTaken: target.currentHitPoints - updated.currentHitPoints,
    conditionIds: readEncounterActorConditionState(updated.conditions).ids
  }
}

const HIT = 9
const BITE_FACE = 0 // 1 + 3 piercing
const SAVE_FAILS = 0 // 1 + 3 against DC 11
const SAVE_PASSES = 19 // 20 + 3 against DC 11

describe('an immediate save composes each band from the outcome registry (RULES-2.T6d2)', () => {
  // SRD: "or half as much damage on a successful one" — half of a rolled 1 rounds down to 0.
  it('deals no poison when a successful save halves a roll of 1', async () => {
    const spider = spiderWithBiteSave((save) => ({
      ...save,
      onFailure:
        save.onFailure.kind !== 'OUTCOMES'
          ? save.onFailure
          : {
              ...save.onFailure,
              outcomes: save.onFailure.outcomes.map((outcome) => ({
                ...outcome,
                diceConfig: '1d4'
              }))
            },
      onSuccess:
        save.onSuccess.kind !== 'OUTCOMES'
          ? save.onSuccess
          : {
              ...save.onSuccess,
              outcomes: save.onSuccess.outcomes.map((outcome) => ({
                ...outcome,
                diceConfig: '1d4'
              }))
            }
    }))
    expect(await biteOgre(spider, [HIT, BITE_FACE, SAVE_PASSES, 0])).toEqual({
      damageTaken: 4,
      conditionIds: []
    })
    expect(await biteOgre(spider, [HIT, BITE_FACE, SAVE_FAILS, 0])).toEqual({
      damageTaken: 5,
      conditionIds: []
    })
  })

  it('applies a condition authored on the successful save’s band', async () => {
    const spider = spiderWithBiteSave((save) => ({
      ...save,
      onSuccess: {
        kind: 'OUTCOMES',
        endCurrent: false,
        resultKind: 'SINGLE',
        outcomes: [{ id: testUuid(0x2302), effectKind: 'CONDITION', conditionId: PRONE }]
      }
    }))
    // The save's 2d8 poison is rolled once whichever band it lands on.
    expect(await biteOgre(spider, [HIT, BITE_FACE, SAVE_PASSES, 0, 0])).toEqual({
      damageTaken: 4,
      conditionIds: [PRONE]
    })
    expect(await biteOgre(spider, [HIT, BITE_FACE, SAVE_FAILS, 0, 0])).toEqual({
      damageTaken: 6,
      conditionIds: []
    })
  })
})
