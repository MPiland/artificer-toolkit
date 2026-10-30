import { srdCreatureActor } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { plannedModifierGrant } from '@artificer-toolkit/rules-runtime/testing/modifierGrantFixture'
import { afterEach, describe, expect, it } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { movementRoom } from './movementRoomFixture.js'
import { readRoomHistory } from './roomHistoryReads.js'

/**
 * SPELLS-17.3: a GM edit that raises a creature's hit points ends the grants that last until hit
 * points are regained (Caltrops slows creatures, not only Characters), and leaves every other grant.
 */

const HOLDER_ID = testUuid(0x200)
const UNTIL_HEALED_ID = testUuid(0x5400)
const LASTING_ID = testUuid(0x5401)
const WOLF_HIT_POINTS = 5

afterEach(() => {
  closeTrackedSockets()
})

function woundedWolfRoom() {
  return movementRoom({
    actors: [
      srdCreatureActor({ id: HOLDER_ID, creature: plainWolf, currentHitPoints: WOLF_HIT_POINTS })
    ],
    moverActorId: HOLDER_ID,
    positions: { [HOLDER_ID]: { x: 150, y: 150 } },
    seed: async ({ effects, encounterId, occurredAt }) => {
      for (const [id, endEvents] of [
        [UNTIL_HEALED_ID, ['ON_HIT_POINTS_REGAINED']],
        [LASTING_ID, []]
      ] as const) {
        const grant = plannedModifierGrant({
          encounterId,
          sourceActorId: HOLDER_ID,
          holderActorId: HOLDER_ID,
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
          owner: { kind: 'ENCOUNTER_ACTOR', encounterId, targetActorId: HOLDER_ID },
          lifecycle: grant.lifecycle,
          definition: grant.definition,
          occurredAt
        })
      }
    }
  })
}

type Room = Awaited<ReturnType<typeof woundedWolfRoom>>

async function updateActor(room: Room, change: Record<string, unknown>) {
  const commandId = crypto.randomUUID()
  const version = (await readRoomHistory(room.base.stub)).runs[0]!.version
  const answer = await room.send(commandId, {
    scope: 'ENCOUNTER',
    command: {
      type: 'UPDATE_ACTOR',
      encounterId: room.encounterId,
      commandId,
      expectedVersion: version,
      actorId: HOLDER_ID,
      ...change
    }
  })
  if (answer.type !== 'COMMAND_COMMITTED') throw new Error(JSON.stringify(answer))
}

async function grantIds(room: Room) {
  return (await readRoomHistory(room.base.stub)).activeEffects.map(({ id }) => id).sort()
}

describe('a GM hit point edit on a creature (SPELLS-17.3)', () => {
  it('ends the grant that lasts until healed when the edit raises hit points, and keeps the rest', async () => {
    const room = await woundedWolfRoom()
    expect(await grantIds(room)).toEqual([UNTIL_HEALED_ID, LASTING_ID].sort())

    await updateActor(room, { currentHitPoints: WOLF_HIT_POINTS + 3 })

    expect(await grantIds(room)).toEqual([LASTING_ID])
  })

  it('keeps the grant through an edit that lowers hit points or leaves them as they were', async () => {
    const room = await woundedWolfRoom()

    await updateActor(room, { currentHitPoints: WOLF_HIT_POINTS - 1 })
    await updateActor(room, {
      currentHitPoints: WOLF_HIT_POINTS - 1,
      gmNotes: 'unchanged hit points'
    })

    expect(await grantIds(room)).toEqual([UNTIL_HEALED_ID, LASTING_ID].sort())
  })
})
