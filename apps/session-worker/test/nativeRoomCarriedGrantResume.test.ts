import {
  characterActor,
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { plannedModifierGrant } from '@artificer-toolkit/rules-runtime/testing/modifierGrantFixture'
import { readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readRoomHistory } from './roomHistoryReads.js'

/**
 * SPELLS-5.13, D151: a Run's START resumes the grants its Characters carried out of an earlier Run.
 * A grant carried with a Campaign-minute expiry counts down again from the clock's remaining time; one
 * the clock has reached ends; one carried untimed stays untimed. A Character's caster stamp survives.
 */

const WOLF_ID = testUuid(0x5600)
const CHARACTER_ACTOR_ID = testUuid(0x5601)
const CHARACTER_ID = testUuid(0x5602)
const PREVIOUS_RUN_ID = testUuid(0x5603)
const PREVIOUS_SOURCE_ID = testUuid(0x5604)
const CASTER_CHARACTER_ID = testUuid(0x5605)
const RESUMED_ID = testUuid(0x5610)
const EXPIRED_ID = testUuid(0x5611)
const UNTIMED_ID = testUuid(0x5612)
const CLOCK_MINUTE = 2001

afterEach(() => {
  closeTrackedSockets()
})

function carriedGrantRoom() {
  return actionRoom({
    actors: [
      srdCreatureActor({ id: WOLF_ID, creature: plainWolf }),
      {
        ...characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID }),
        // Initiative reads the Character's frozen identity.
        snapshot: { kind: 'CHARACTER', id: CHARACTER_ID, systemId: srdSystemRecord.id }
      }
    ],
    ownerFeatureId: creatureFeature(plainWolf, 'Bite').id,
    status: 'PREPARED',
    campaignClockMinute: CLOCK_MINUTE,
    autoRoll: 'EVERYONE',
    // The Character's initiative roll wins, so its turn opens the Run.
    rolls: [20, 1],
    seed: async ({ effects, encounterId, occurredAt }) => {
      // Carried out of the earlier Run (D99): an OWNER-scope grant of that Run, its ticks given up.
      const grant = plannedModifierGrant({
        encounterId: PREVIOUS_RUN_ID,
        sourceActorId: PREVIOUS_SOURCE_ID,
        holderActorId: CHARACTER_ACTOR_ID,
        lifecycle: {},
        rounds: 20,
        lifetimeScope: 'OWNER'
      })
      for (const [id, expiresAtCampaignMinute] of [
        [RESUMED_ID, CLOCK_MINUTE + 1],
        [EXPIRED_ID, CLOCK_MINUTE],
        [UNTIMED_ID, null]
      ] as const)
        await effects.create({
          id,
          owner: { kind: 'ENCOUNTER_ACTOR', encounterId, targetActorId: CHARACTER_ACTOR_ID },
          definition: grant.definition,
          lifecycle: {
            schemaVersion: 1,
            remainingTicks: null,
            expiresAtCampaignMinute,
            concentrationCasterCharacterId: CASTER_CHARACTER_ID
          },
          occurredAt
        })
    }
  })
}

type Room = Awaited<ReturnType<typeof carriedGrantRoom>>

async function lifecycles(room: Room) {
  const { characterEffects } = await readRoomHistory(room.room.base.stub)
  return Object.fromEntries(characterEffects.map(({ id, lifecycle }) => [id, lifecycle]))
}

async function send(room: Room, type: 'START' | 'ADVANCE_TURN') {
  const command = {
    type,
    encounterId: room.room.encounterId,
    commandId: crypto.randomUUID(),
    expectedVersion: await room.version()
  }
  const answer = await room.send(command)
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  return { command, answer }
}

describe('a room START with grants carried from an earlier Run (SPELLS-5.13, D151)', () => {
  it('resumes the timed grant from the clock, ends the one the clock reached and leaves the untimed one', async () => {
    const room = await carriedGrantRoom()

    const { command, answer } = await send(room, 'START')

    const history = await readRoomHistory(room.room.base.stub)
    expect(readRunState(history.runs[0]!)).toMatchObject({
      status: 'ACTIVE',
      currentActorId: CHARACTER_ACTOR_ID
    })
    // One Campaign minute left is ten rounds; the expiry gives way to the ticks.
    expect(await lifecycles(room)).toEqual({
      [RESUMED_ID]: {
        schemaVersion: 1,
        remainingTicks: 10,
        concentrationCasterCharacterId: CASTER_CHARACTER_ID
      },
      [UNTIMED_ID]: {
        schemaVersion: 1,
        remainingTicks: null,
        expiresAtCampaignMinute: null,
        concentrationCasterCharacterId: CASTER_CHARACTER_ID
      }
    })

    // The START replays exactly and resumes nothing twice.
    expect(await room.send(command)).toEqual(answer)
    expect((await lifecycles(room))[RESUMED_ID]).toMatchObject({ remainingTicks: 10 })
  })

  it('counts the resumed grant down as its holder’s turn ends, keeping the caster stamp', async () => {
    const room = await carriedGrantRoom()
    await send(room, 'START')

    // A grant timed in rounds counts as its holder's turn ends, so the Wolf's turn leaves it.
    await send(room, 'ADVANCE_TURN')
    expect((await lifecycles(room))[RESUMED_ID]).toMatchObject({ remainingTicks: 9 })
    await send(room, 'ADVANCE_TURN')

    const resumed = (await lifecycles(room))[RESUMED_ID]
    expect(resumed).toEqual({
      schemaVersion: 1,
      remainingTicks: 9,
      concentrationCasterCharacterId: CASTER_CHARACTER_ID
    })
  })
})
