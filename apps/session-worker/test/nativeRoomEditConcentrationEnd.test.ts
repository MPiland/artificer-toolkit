import { runInDurableObject } from 'cloudflare:test'
import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { SRD_CONDITION_TYPES } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it } from 'vitest'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { closeTrackedSockets, connectPlayer } from './liveRoomFixture.js'
import { CONCENTRATION_STATE_ID, movementRoom } from './movementRoomFixture.js'
import { readRoomChatBodies, readRoomHistory } from './roomHistoryReads.js'

/**
 * D95 on the edit paths: a GM actor edit or a Sheet edit that leaves a Concentration holder
 * defeated or unable to act ends it with no check, in the edit's own commit.
 */

const HOLDER_ID = testUuid(0x200)
const CHARACTER_ID = testUuid(0x400)

afterEach(() => {
  closeTrackedSockets()
})

type Room = Awaited<ReturnType<typeof movementRoom>>

function conditionId(code: string) {
  const condition = SRD_CONDITION_TYPES.find((type) => type.code === code)
  if (!condition) throw new Error(`The SRD ${code} condition is missing.`)
  return condition.id
}

function characterRoom(config: Partial<Parameters<typeof movementRoom>[0]> = {}) {
  return movementRoom({
    actors: [characterActor({ id: HOLDER_ID, characterId: CHARACTER_ID })],
    moverActorId: HOLDER_ID,
    positions: { [HOLDER_ID]: { x: 150, y: 150 } },
    concentration: true,
    concentrationDependentActorIds: [HOLDER_ID],
    characterPlay: { currentHitPoints: 5 },
    ...config
  })
}

function creatureRoom(config: Partial<Parameters<typeof movementRoom>[0]> = {}) {
  return movementRoom({
    actors: [srdCreatureActor({ id: HOLDER_ID, creature: plainWolf })],
    moverActorId: HOLDER_ID,
    positions: { [HOLDER_ID]: { x: 150, y: 150 } },
    concentration: true,
    concentrationDependentActorIds: [HOLDER_ID],
    ...config
  })
}

async function ends(room: Room) {
  return (await room.receipts()).filter((entry) => entry.commandType === 'CONCENTRATION_END')
}

async function streamVersionOf(room: Room) {
  return runInDurableObject(room.base.stub, (_instance, context) => {
    const play = new RoomEncounterStore(context.storage)
      .documents('characterPlayStates')
      .find((row) => row.characterId === CHARACTER_ID)
    if (!play) throw new Error('Missing room Character play state.')
    return play.streamVersion
  })
}

/** The Run's concentration slot and the effects hanging on it. */
async function maintained(room: Room) {
  const history = await readRoomHistory(room.base.stub)
  return {
    slots: history.maintainedStates.filter((state) => state.id === CONCENTRATION_STATE_ID),
    dependents: [...history.activeEffects, ...history.characterEffects]
  }
}

async function sheetCommand(room: Room, command: Record<string, unknown>) {
  const commandId = crypto.randomUUID()
  return {
    commandId,
    frame: {
      scope: 'CHARACTER_SHEET',
      characterId: CHARACTER_ID,
      encounterId: room.encounterId,
      command: { ...command, commandId, expectedVersion: await streamVersionOf(room) }
    }
  }
}

/** Sends a Sheet command as the GM, who may edit a player's Character's hit points and conditions. */
async function gmSheet(room: Room, command: Record<string, unknown>) {
  const { commandId, frame } = await sheetCommand(room, command)
  const answer = await room.send(commandId, frame)
  if (answer.type !== 'COMMAND_COMMITTED') throw new Error(JSON.stringify(answer))
}

/** Sends a Sheet command as the Character's own player. */
async function playerSheet(room: Room, command: Record<string, unknown>) {
  const player = await connectPlayer(room.base)
  const { commandId, frame } = await sheetCommand(room, command)
  player.socket.send(
    JSON.stringify({
      type: 'COMMAND',
      expectedSessionSequence: 0,
      command: frame
    })
  )
  await expect
    .poll(
      () =>
        player.messages.find(
          (message) =>
            (message.type === 'COMMAND_COMMITTED' || message.type === 'COMMAND_REJECTED') &&
            message.commandId === commandId
        )?.type
    )
    .toBe('COMMAND_COMMITTED')
}

async function encounterVersion(room: Room) {
  return (await readRoomHistory(room.base.stub)).runs[0]!.version
}

async function updateActor(room: Room, change: Record<string, unknown>) {
  const commandId = crypto.randomUUID()
  const answer = await room.send(commandId, {
    scope: 'ENCOUNTER',
    command: {
      type: 'UPDATE_ACTOR',
      encounterId: room.encounterId,
      commandId,
      expectedVersion: await encounterVersion(room),
      actorId: HOLDER_ID,
      ...change
    }
  })
  if (answer.type !== 'COMMAND_COMMITTED') throw new Error(JSON.stringify(answer))
}

describe('Sheet-edit Concentration ends (D95)', () => {
  it("ends Concentration with no check when a player's Sheet edit drops the Character to 0 hit points", async () => {
    const room = await characterRoom()

    const before = await streamVersionOf(room)

    await playerSheet(room, { type: 'ADJUST_HIT_POINTS', mode: 'DAMAGE', amount: 5 })

    const [end, ...rest] = await ends(room)
    expect(rest).toHaveLength(0)
    expect(end?.result).toMatchObject({
      applicationOutputs: {
        kind: 'CONCENTRATION_END',
        ownerActorId: HOLDER_ID,
        maintainedStateId: CONCENTRATION_STATE_ID,
        reason: 'INCAPACITATED'
      }
    })
    expect((await room.receipts()).filter((r) => r.commandType === 'CONCENTRATION_CHECK')).toEqual(
      []
    )
    expect(await maintained(room)).toEqual({ slots: [], dependents: [] })
    // The Sheet write and the cleanup share one stream-version increment.
    expect(await streamVersionOf(room)).toBe(before + 1)
    expect(room.diceDrawn()).toBe(0)
    expect(await readRoomChatBodies(room.base.stub)).toEqual([
      expect.stringMatching(/loses Concentration\.$/)
    ])
  })

  it('ends Concentration with no check when a Sheet edit marks the Character Paralyzed', async () => {
    const room = await characterRoom({ characterPlay: { currentHitPoints: 20 } })

    const before = await streamVersionOf(room)

    await gmSheet(room, { type: 'ADD_CONDITION', conditionTypeId: conditionId('PARALYZED') })

    const [end, ...rest] = await ends(room)
    expect(rest).toHaveLength(0)
    expect(end?.result).toMatchObject({
      applicationOutputs: { ownerActorId: HOLDER_ID, reason: 'INCAPACITATED' }
    })
    expect(await maintained(room)).toEqual({ slots: [], dependents: [] })
    expect(await streamVersionOf(room)).toBe(before + 1)
    expect(room.diceDrawn()).toBe(0)
  })

  it('ends nothing when a Sheet edit leaves the Character able to act above 0 hit points', async () => {
    const room = await characterRoom({ characterPlay: { currentHitPoints: 20 } })

    const before = await streamVersionOf(room)

    await gmSheet(room, { type: 'ADJUST_HIT_POINTS', mode: 'DAMAGE', amount: 1 })

    expect(await ends(room)).toEqual([])
    const kept = await maintained(room)
    expect(kept.slots).toHaveLength(1)
    expect(kept.dependents).toHaveLength(1)
    expect(await streamVersionOf(room)).toBe(before + 1)
  })

  it('ends nothing in a MANUAL Run', async () => {
    const room = await characterRoom({ automationMode: 'MANUAL' })

    await playerSheet(room, { type: 'ADJUST_HIT_POINTS', mode: 'DAMAGE', amount: 5 })

    expect(await ends(room)).toEqual([])
    expect((await maintained(room)).slots).toHaveLength(1)
  })
})

describe('GM actor-edit Concentration ends (D95)', () => {
  it('ends a Creature holder Concentration with no check when the GM sets its hit points to 0', async () => {
    const room = await creatureRoom()

    await updateActor(room, { currentHitPoints: 0 })

    const [end, ...rest] = await ends(room)
    expect(rest).toHaveLength(0)
    expect(end?.result).toMatchObject({
      applicationOutputs: {
        kind: 'CONCENTRATION_END',
        ownerActorId: HOLDER_ID,
        maintainedStateId: CONCENTRATION_STATE_ID,
        reason: 'DEFEATED'
      }
    })
    expect(await maintained(room)).toEqual({ slots: [], dependents: [] })
    expect(room.diceDrawn()).toBe(0)
  })

  it('ends a Creature holder Concentration when the GM makes it unable to act', async () => {
    const room = await creatureRoom()

    await updateActor(room, { conditions: [conditionId('STUNNED')] })

    const [end] = await ends(room)
    expect(end?.result).toMatchObject({
      applicationOutputs: { ownerActorId: HOLDER_ID, reason: 'INCAPACITATED' }
    })
    expect((await maintained(room)).slots).toEqual([])
  })

  it('ends nothing when the GM edit leaves a Creature holder alive and able to act', async () => {
    const room = await creatureRoom()

    await updateActor(room, { currentHitPoints: 1 })

    expect(await ends(room)).toEqual([])
    expect((await maintained(room)).slots).toHaveLength(1)
  })

  it("ends a Character holder's Concentration when the GM's Sheet command drops it to 0", async () => {
    const room = await characterRoom()
    const before = await streamVersionOf(room)

    await updateActor(room, {
      characterCommand: {
        type: 'ADJUST_HIT_POINTS',
        mode: 'DAMAGE',
        amount: 5,
        commandId: crypto.randomUUID(),
        expectedVersion: before
      }
    })

    const [end, ...rest] = await ends(room)
    expect(rest).toHaveLength(0)
    expect(end?.result).toMatchObject({
      applicationOutputs: { ownerActorId: HOLDER_ID, reason: 'INCAPACITATED' }
    })
    expect(await maintained(room)).toEqual({ slots: [], dependents: [] })
    expect(await streamVersionOf(room)).toBe(before + 1)
    expect(await readRoomChatBodies(room.base.stub)).toEqual([
      expect.stringMatching(/loses Concentration\.$/)
    ])
  })
})
