import {
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { beaconOfHope } from '@artificer-toolkit/source-data/srd/spells/beacon-of-hope.js'
import { afterEach, describe, expect, it } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { seedModifierGrant } from './grantSeed.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readActorHitPoints, readRoomHistory } from './roomHistoryReads.js'

/**
 * SPELLS-4.T2n1 through the room: a creature under the SRD Beacon of Hope regains the maximum of
 * every healing die, and one without it rolls them.
 */

const HEALER_ID = testUuid(0x940)
const HEALED_ID = testUuid(0x941)
/** Zero-based dice faces: both d4s roll a 1 unless healing takes its maximum. */
const LOW_ROLLS = [0, 0]
const STARTING_HIT_POINTS = 1

afterEach(() => {
  closeTrackedSockets()
})

/** A Wolf whose Bite heals 2d4 hit points of one target. */
const healingWolf: CreatureAuthored = {
  ...plainWolf,
  features: plainWolf.features?.map((feature) =>
    feature.label !== 'Bite'
      ? feature
      : {
          ...feature,
          effects: feature.effects?.map((effect) => ({
            ...effect,
            invocation: {
              ...effect.invocation,
              triggerCode: 'ACTIVATED' as const,
              targeting: {
                selectionKind: 'SINGLE_TARGET' as const,
                dispositionKind: 'ANY' as const
              }
            },
            paths: effect.paths.slice(0, 1).map((path) =>
              !('resultBlock' in path)
                ? path
                : {
                    ...path,
                    pathCode: 'ON_USE' as const,
                    resultBlock: {
                      ...path.resultBlock,
                      outcomes: [
                        {
                          id: testUuid(0x950),
                          effectKind: 'HEAL' as const,
                          valueKind: 'DICE' as const,
                          scalingKind: 'NONE' as const,
                          diceConfig: '2d4'
                        }
                      ]
                    }
                  }
            )
          }))
        }
  )
}

/** The healed hit points after the healing Wolf heals the target, with or without Beacon of Hope. */
async function healedHitPoints(beacon: boolean) {
  const [grant] = beaconOfHope.effects ?? []
  if (!grant) throw new Error('The SRD Beacon of Hope has no effect.')
  const room = await actionRoom({
    actors: [
      srdCreatureActor({ id: HEALER_ID, creature: healingWolf, disposition: 'FRIENDLY' }),
      srdCreatureActor({
        id: HEALED_ID,
        creature: plainWolf,
        disposition: 'FRIENDLY',
        currentHitPoints: STARTING_HIT_POINTS
      })
    ],
    ownerFeatureId: creatureFeature(healingWolf, 'Bite').id,
    autoRoll: 'BOTH',
    rolls: LOW_ROLLS,
    fallbackRoll: 0,
    ...(beacon && {
      seed: seedModifierGrant({
        sourceActorId: HEALER_ID,
        holderActorId: HEALED_ID,
        lifecycle: {},
        effect: grant,
        sourceLabel: beaconOfHope.label
      })
    })
  })
  const { answer } = await room.startAction(HEALED_ID, ['TARGET_RANGE_UNCHECKED'])
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  return readActorHitPoints(await readRoomHistory(room.room.base.stub), HEALED_ID)
}

describe('Beacon of Hope maximizes the healing a creature receives (SPELLS-4.T2n1)', () => {
  it('rolls the healing dice for a creature without the spell', async () => {
    expect(await healedHitPoints(false)).toBe(STARTING_HIT_POINTS + 2)
  })

  it('heals the maximum of every die for a creature under the spell', async () => {
    expect(await healedHitPoints(true)).toBe(STARTING_HIT_POINTS + 8)
  })
})
