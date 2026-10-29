import { runInDurableObject } from 'cloudflare:test'
import { characterActor } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { plannedModifierGrant } from '@artificer-toolkit/rules-runtime/testing/modifierGrantFixture'
import { afterEach, describe, expect, it } from 'vitest'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { movementRoom } from './movementRoomFixture.js'
import { readRoomHistory } from './roomHistoryReads.js'

/**
 * SPELLS-17.3: a heal made on the Sheet inside a live Encounter ends the Character's "until
 * healed" grants in the Sheet command's own commit, and leaves every other grant alone.
 */

const HOLDER_ID = testUuid(0x200)
const CHARACTER_ID = testUuid(0x400)
const UNTIL_HEALED_ID = testUuid(0x5300)
const LASTING_ID = testUuid(0x5301)

afterEach(() => {
  closeTrackedSockets()
})

function healRoom() {
  return movementRoom({
    actors: [characterActor({ id: HOLDER_ID, characterId: CHARACTER_ID })],
    moverActorId: HOLDER_ID,
    positions: { [HOLDER_ID]: { x: 150, y: 150 } },
    characterPlay: { currentHitPoints: 5 },
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

type Room = Awaited<ReturnType<typeof healRoom>>

function streamVersionOf(room: Room) {
  return runInDurableObject(room.base.stub, (_instance, context) => {
    const play = new RoomEncounterStore(context.storage)
      .documents('characterPlayStates')
      .find((row) => row.characterId === CHARACTER_ID)
    if (!play) throw new Error('Missing room Character play state.')
    return play.streamVersion
  })
}

/** Sends a Sheet command as the GM, who may edit a player's Character's hit points. */
async function gmSheet(room: Room, command: Record<string, unknown>) {
  const commandId = crypto.randomUUID()
  const answer = await room.send(commandId, {
    scope: 'CHARACTER_SHEET',
    characterId: CHARACTER_ID,
    encounterId: room.encounterId,
    command: { ...command, commandId, expectedVersion: await streamVersionOf(room) }
  })
  if (answer.type !== 'COMMAND_COMMITTED') throw new Error(JSON.stringify(answer))
}

async function grantIds(room: Room) {
  return (await readRoomHistory(room.base.stub)).characterEffects.map(({ id }) => id).sort()
}

describe('Sheet healing in a live Encounter (SPELLS-17.3)', () => {
  it('ends the grant that lasts until healed, in the Sheet command commit, and keeps the rest', async () => {
    const room = await healRoom()
    expect(await grantIds(room)).toEqual([UNTIL_HEALED_ID, LASTING_ID].sort())
    const before = await streamVersionOf(room)

    await gmSheet(room, { type: 'ADJUST_HIT_POINTS', mode: 'HEAL', amount: 3 })

    expect(await grantIds(room)).toEqual([LASTING_ID])
    expect(await streamVersionOf(room)).toBe(before + 1)
  })

  it('keeps the grant through damage and through a heal that restores nothing', async () => {
    const room = await healRoom()

    await gmSheet(room, { type: 'ADJUST_HIT_POINTS', mode: 'DAMAGE', amount: 1 })
    await gmSheet(room, { type: 'ADJUST_HIT_POINTS', mode: 'HEAL', amount: 0 })

    expect(await grantIds(room)).toEqual([UNTIL_HEALED_ID, LASTING_ID].sort())
  })
})
