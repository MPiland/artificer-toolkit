import { runInDurableObject } from 'cloudflare:test'
import {
  characterActor,
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { readCharacterPlay } from '@artificer-toolkit/schema/projections/characterStoredState'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom, biteWolf } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { movementRoom } from './movementRoomFixture.js'
import { readRoomHistory } from './roomHistoryReads.js'

const SOURCE_ID = testUuid(0x700)
const TARGET_ID = testUuid(0x701)
const CHARACTER_ACTOR_ID = testUuid(0x710)
const CHARACTER_ID = testUuid(0x711)

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

describe('a refused room command', () => {
  it('leaves the held commands, receipts and evidence rolls as they were, even after a roll is held', async () => {
    const biter = biteWolf('SAVE')
    const room = await actionRoom({
      actors: [
        srdCreatureActor({ id: SOURCE_ID, creature: biter }),
        srdCreatureActor({ id: TARGET_ID, creature: plainWolf })
      ],
      ownerFeatureId: creatureFeature(biter, 'Bite').id,
      rolls: [4]
    })
    expect((await room.startAction(TARGET_ID)).answer.type).toBe('COMMAND_COMMITTED')
    const decision = await room.pendingDecision()
    expect((await room.rollDice(decision)).type).toBe('COMMAND_COMMITTED')
    const held = await readRoomHistory(room.room.base.stub)
    // The action waits on its roll: the room holds the one roll it made and the PENDING occurrence.
    expect(held.evidenceRolls).toHaveLength(1)
    expect(held.occurrences.map((occurrence) => occurrence.state)).toEqual(['PENDING'])

    // A SYSTEM_ROLL naming a request the decision never raised is refused ...
    const refused = await room.resolve(decision, {
      kind: 'SYSTEM_ROLL',
      requestId: 'stale-request',
      rollId: crypto.randomUUID()
    })
    expect(refused).toMatchObject({ type: 'COMMAND_REJECTED', reason: 'ROLL_UNAVAILABLE' })

    // ... and writes nothing: no command row, receipt, occurrence change or evidence roll.
    expect(await readRoomHistory(room.room.base.stub)).toEqual(held)
    expect(await room.pendingDecision()).toEqual(decision)
  })
})

describe('a Sheet command nested in a GM UPDATE_ACTOR', () => {
  async function sheetRoom() {
    const room = await movementRoom({
      actors: [
        characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID }),
        srdCreatureActor({ id: TARGET_ID, creature: plainWolf })
      ],
      moverActorId: CHARACTER_ACTOR_ID,
      positions: { [CHARACTER_ACTOR_ID]: { x: 150, y: 150 }, [TARGET_ID]: { x: 250, y: 150 } }
    })
    const sheet = () =>
      runInDurableObject(room.base.stub, (_instance, context) => {
        const store = new RoomEncounterStore(context.storage)
        const play = store
          .documents('characterPlayStates')
          .find((candidate) => candidate.characterId === CHARACTER_ID)
        if (!play) throw new Error('Missing room Character play state.')
        return {
          hitPoints: readCharacterPlay(play).hitpoints.current,
          streamVersion: play.streamVersion,
          receipts: store.documents('characterCommandReceipts')
        }
      })
    const version = async () => (await readRoomHistory(room.base.stub)).runs[0]!.version
    const update = (
      commandId: string,
      expectedVersion: number,
      characterCommand: { commandId: string; amount: number }
    ) =>
      room.send(commandId, {
        scope: 'ENCOUNTER',
        command: {
          type: 'UPDATE_ACTOR',
          encounterId: room.encounterId,
          commandId,
          expectedVersion,
          actorId: CHARACTER_ACTOR_ID,
          characterCommand: {
            type: 'ADJUST_HIT_POINTS',
            expectedVersion: 1,
            mode: 'DAMAGE',
            ...characterCommand
          }
        }
      })
    return { room, sheet, version, update }
  }

  it('replays a settled nested command id for a new outer command and never applies its damage twice', async () => {
    const { room, sheet, version, update } = await sheetRoom()
    const before = await sheet()
    const nestedId = crypto.randomUUID()
    const outerId = crypto.randomUUID()
    const first = await update(outerId, await version(), { commandId: nestedId, amount: 3 })
    expect(first.type).toBe('COMMAND_COMMITTED')
    const settled = await sheet()
    expect(settled.hitPoints).toBe(before.hitPoints - 3)
    expect(settled.receipts).toEqual([
      expect.objectContaining({ characterId: CHARACTER_ID, commandId: nestedId })
    ])

    // An exact retry of the outer command answers with the journaled result and writes nothing.
    const held = await readRoomHistory(room.base.stub)
    expect(
      await update(outerId, held.runs[0]!.version - 1, { commandId: nestedId, amount: 3 })
    ).toEqual(first)
    expect(await readRoomHistory(room.base.stub)).toEqual(held)
    expect(await sheet()).toEqual(settled)

    // The documented order (live-sessions.md: replay precedes version refusal) lets a new outer
    // command carry the settled nested id: the Sheet command replays and its damage is not repeated.
    const reusedOuterId = crypto.randomUUID()
    const reused = await update(reusedOuterId, await version(), { commandId: nestedId, amount: 3 })
    expect(reused.type).toBe('COMMAND_COMMITTED')
    expect(await sheet()).toEqual(settled)
    const after = await readRoomHistory(room.base.stub)
    expect(after.commands.map((command) => command.commandId)).toEqual([outerId, reusedOuterId])
  })

  it('refuses a reused outer command id with other input and a reused nested id with other input', async () => {
    const { room, sheet, version, update } = await sheetRoom()
    const nestedId = crypto.randomUUID()
    const outerId = crypto.randomUUID()
    const startVersion = await version()
    expect((await update(outerId, startVersion, { commandId: nestedId, amount: 3 })).type).toBe(
      'COMMAND_COMMITTED'
    )
    const settled = await sheet()
    const held = await readRoomHistory(room.base.stub)

    // The journal refuses the outer command id reused with different input.
    expect(await update(outerId, startVersion, { commandId: nestedId, amount: 4 })).toMatchObject({
      type: 'COMMAND_REJECTED',
      code: 'INVALID_COMMAND'
    })

    // A new outer command reusing the nested id with different input is a domain rejection.
    expect(
      await update(crypto.randomUUID(), await version(), { commandId: nestedId, amount: 4 })
    ).toMatchObject({
      type: 'COMMAND_REJECTED',
      code: 'DOMAIN_REJECTED',
      message: 'Command ID was already used with different input.'
    })

    expect(await sheet()).toEqual(settled)
    expect(await readRoomHistory(room.base.stub)).toEqual(held)
  })
})
