import {
  characterActor,
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { plannedModifierGrant } from '@artificer-toolkit/rules-runtime/testing/modifierGrantFixture'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { afterEach, describe, expect, it } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readRoomHistory } from './roomHistoryReads.js'

/**
 * SPELLS-17.3: an Encounter heal on a Character ends the Character's "until healed" grants in the
 * action's commit, and the GM's undo of that action gives them back to the Character's own effects.
 */

const HEALER_ID = testUuid(0x800)
const CHARACTER_ACTOR_ID = testUuid(0x801)
const CHARACTER_ID = testUuid(0x802)
const UNTIL_HEALED_ID = testUuid(0x5500)
const LASTING_ID = testUuid(0x5501)

afterEach(() => {
  closeTrackedSockets()
})

/** A Wolf whose Bite heals one hit point of one target. */
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
                          id: testUuid(0x5510),
                          effectKind: 'HEAL' as const,
                          valueKind: 'FIXED' as const,
                          scalingKind: 'NONE' as const,
                          amount: 1
                        }
                      ]
                    }
                  }
            )
          }))
        }
  )
}

function healRoom() {
  return actionRoom({
    actors: [
      srdCreatureActor({ id: HEALER_ID, creature: healingWolf }),
      characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID })
    ],
    ownerFeatureId: creatureFeature(healingWolf, 'Bite').id,
    autoRoll: 'GAME_MASTER',
    characterPlay: { currentHitPoints: 5 },
    seed: async ({ effects, encounterId, occurredAt }) => {
      for (const [id, endEvents] of [
        [UNTIL_HEALED_ID, ['ON_HIT_POINTS_REGAINED']],
        [LASTING_ID, []]
      ] as const) {
        const grant = plannedModifierGrant({
          encounterId,
          sourceActorId: HEALER_ID,
          holderActorId: CHARACTER_ACTOR_ID,
          lifecycle: {
            endTriggers: endEvents.map((code) => ({
              event: 'LIFECYCLE' as const,
              timing: 'END' as const,
              code
            }))
          }
        })
        await effects.create({
          id,
          // The room fixture moves a Character actor's effects onto the Character, as a live Run holds them.
          owner: { kind: 'ENCOUNTER_ACTOR', encounterId, targetActorId: CHARACTER_ACTOR_ID },
          lifecycle: grant.lifecycle,
          definition: grant.definition,
          occurredAt
        })
      }
    }
  })
}

async function grantIds(room: Awaited<ReturnType<typeof healRoom>>) {
  return (await readRoomHistory(room.room.base.stub)).characterEffects.map(({ id }) => id).sort()
}

describe('an Encounter heal on a Character (SPELLS-17.3)', () => {
  it('ends the grant that lasts until healed and keeps the rest, and the action’s undo restores it', async () => {
    const room = await healRoom()
    expect(await grantIds(room)).toEqual([UNTIL_HEALED_ID, LASTING_ID].sort())

    const { answer } = await room.startAction(CHARACTER_ACTOR_ID, ['TARGET_RANGE_UNCHECKED'])
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect(await grantIds(room)).toEqual([LASTING_ID])

    const undone = await room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version()
    })
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
    expect(await grantIds(room)).toEqual([UNTIL_HEALED_ID, LASTING_ID].sort())
  })
})
