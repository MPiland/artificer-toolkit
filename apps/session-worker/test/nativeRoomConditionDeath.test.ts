import { runInDurableObject } from 'cloudflare:test'
import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { readCharacterPlay } from '@artificer-toolkit/schema/projections/characterStoredState'
import { SRD_CONDITION_TYPES } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it } from 'vitest'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { CONCENTRATION_STATE_ID, movementRoom } from './movementRoomFixture.js'
import { readActorHitPoints, readRoomHistory } from './roomHistoryReads.js'

const HOLDER_ID = testUuid(0x7c0)
const CHARACTER_ID = testUuid(0x7c1)
const EXHAUSTION = SRD_CONDITION_TYPES.find(({ code }) => code === 'EXHAUSTION')!.id

type Room = Awaited<ReturnType<typeof movementRoom>>

afterEach(closeTrackedSockets)

function roomWith(actor: Parameters<typeof movementRoom>[0]['actors'][number]) {
  return movementRoom({
    actors: [actor],
    moverActorId: HOLDER_ID,
    positions: { [HOLDER_ID]: { x: 150, y: 150 } },
    concentration: true,
    concentrationDependentActorIds: [HOLDER_ID]
  })
}

function characterPlay(room: Room) {
  return runInDurableObject(room.base.stub, (_instance, context) => {
    const row = new RoomEncounterStore(context.storage)
      .documents('characterPlayStates')
      .find((play) => play.characterId === CHARACTER_ID)
    if (!row) throw new Error('Missing room Character play state.')
    return {
      streamVersion: row.streamVersion,
      maximumHitPoints: row.maximumHitPoints,
      state: readCharacterPlay(row)
    }
  })
}

async function gmSheet(room: Room, command: Record<string, unknown>) {
  const commandId = crypto.randomUUID()
  const answer = await room.send(commandId, {
    scope: 'CHARACTER_SHEET',
    characterId: CHARACTER_ID,
    encounterId: room.encounterId,
    command: {
      ...command,
      commandId,
      expectedVersion: (await characterPlay(room)).streamVersion
    }
  })
  if (answer.type !== 'COMMAND_COMMITTED') throw new Error(JSON.stringify(answer))
}

async function gmLevel(room: Room, level: number) {
  const commandId = crypto.randomUUID()
  const answer = await room.send(commandId, {
    scope: 'ENCOUNTER',
    command: {
      type: 'UPDATE_ACTOR',
      encounterId: room.encounterId,
      commandId,
      expectedVersion: (await readRoomHistory(room.base.stub)).runs[0]!.version,
      actorId: HOLDER_ID,
      conditions: [{ conditionTypeId: EXHAUSTION, level }]
    }
  })
  if (answer.type !== 'COMMAND_COMMITTED') throw new Error(JSON.stringify(answer))
}

async function concentrationEnds(room: Room) {
  return (await room.receipts()).filter((entry) => entry.commandType === 'CONCENTRATION_END')
}

describe('authored condition-level death in the room (SPELLS-10.T1c)', () => {
  it('a Character at the authored level dies with no death save and loses its Concentration', async () => {
    const room = await roomWith(characterActor({ id: HOLDER_ID, characterId: CHARACTER_ID }))

    const { maximumHitPoints } = await characterPlay(room)
    expect((await characterPlay(room)).state.hitpoints.current).toBe(maximumHitPoints)

    await gmSheet(room, { type: 'SET_EXHAUSTION', level: 5 })
    // Level 4 halves the maximum: the stored fraction clamps the hit points to half of it.
    const halved = (await characterPlay(room)).state.hitpoints
    expect(halved.maximumFraction).toEqual({ numerator: 1, denominator: 2 })
    expect(halved.current).toBe(Math.floor(maximumHitPoints / 2))
    expect(await concentrationEnds(room)).toHaveLength(0)

    await gmSheet(room, { type: 'SET_EXHAUSTION', level: 6 })

    const { hitpoints } = (await characterPlay(room)).state
    expect(hitpoints.current).toBe(0)
    expect(hitpoints.deathSaves).toEqual({ successes: 0, failures: 3, stable: false })
    const [end, ...rest] = await concentrationEnds(room)
    expect(rest).toHaveLength(0)
    expect(end?.result).toMatchObject({
      applicationOutputs: {
        kind: 'CONCENTRATION_END',
        maintainedStateId: CONCENTRATION_STATE_ID
      }
    })
  })

  it('a Character at the halving level cannot be healed past the halved maximum', async () => {
    const room = await roomWith(characterActor({ id: HOLDER_ID, characterId: CHARACTER_ID }))
    const { maximumHitPoints } = await characterPlay(room)

    await gmSheet(room, { type: 'SET_EXHAUSTION', level: 4 })
    await gmSheet(room, { type: 'ADJUST_HIT_POINTS', mode: 'DAMAGE', amount: 1 })
    await gmSheet(room, { type: 'ADJUST_HIT_POINTS', mode: 'HEAL', amount: maximumHitPoints })

    expect((await characterPlay(room)).state.hitpoints.current).toBe(
      Math.floor(maximumHitPoints / 2)
    )

    await gmSheet(room, { type: 'SET_EXHAUSTION', level: 3 })
    await gmSheet(room, { type: 'ADJUST_HIT_POINTS', mode: 'HEAL', amount: maximumHitPoints })

    expect((await characterPlay(room)).state.hitpoints.current).toBe(maximumHitPoints)
  })

  it('a Creature at the authored level drops to 0 and loses its Concentration', async () => {
    const room = await roomWith(srdCreatureActor({ id: HOLDER_ID, creature: plainWolf }))

    const maximum = readActorHitPoints(await readRoomHistory(room.base.stub), HOLDER_ID)
    await gmLevel(room, 5)
    // Level 4 halves the maximum: the creature's hit points are held within half of it.
    expect(readActorHitPoints(await readRoomHistory(room.base.stub), HOLDER_ID)).toBe(
      Math.floor(maximum / 2)
    )

    await gmLevel(room, 6)

    expect(readActorHitPoints(await readRoomHistory(room.base.stub), HOLDER_ID)).toBe(0)
    expect(await concentrationEnds(room)).toHaveLength(1)
  })
})
