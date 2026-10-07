import { describe, expect, it } from 'vitest'
import { sha256Hex } from '@artificer-toolkit/shared/sha256'
import {
  lookupRoomEncounterReplay,
  recordRoomEncounterReplay,
  removeRoomFinishedRunRows
} from './roomEncounterReplayIndex.js'
import { RoomEncounterStore } from './roomEncounterStore.js'
import { createNodeSqliteRoomStorage } from './testing/nodeSqliteRoomStorage.js'
import { aggregate, encounterId, uuid } from './testing/roomAggregateFixture.js'

const campaignId = uuid(2)
const userId = uuid(4)
const commandId = uuid(0x400)
const fingerprint = sha256Hex('command')
const indexed = { campaignId, encounterId, actorUserId: userId, commandFingerprint: fingerprint }

function lookup(
  room: RoomEncounterStore,
  input: Partial<{ encounterId: string; userId: string; fingerprint: string }> = {}
) {
  return lookupRoomEncounterReplay(room, {
    campaignId,
    commandId,
    encounterId,
    userId,
    fingerprint,
    ...input
  })
}

function openRoom() {
  const { storage } = createNodeSqliteRoomStorage()
  const room = new RoomEncounterStore(storage)
  room.hydrate({ epoch: uuid(0x900), ...aggregate(2) })
  return room
}

async function indexCommand(room: RoomEncounterStore) {
  await room.transact(async () => {
    await room.store.insert('encounterReplayIndex', {
      ...indexed,
      commandId,
      version: 7,
      rollCardId: null
    })
  })
}

describe('room Encounter replay index', () => {
  it('knows nothing of a command ID it never indexed', async () => {
    expect(await lookup(openRoom())).toEqual({ kind: 'NONE' })
  })

  it('recognizes an indexed command ID of the same actor and input once its history is gone', async () => {
    const room = openRoom()
    await indexCommand(room)
    expect(await lookup(room)).toEqual({
      kind: 'INDEXED',
      encounterId,
      version: 7,
      roll: null
    })
  })

  it('refuses an indexed command ID reused with another input, actor or Encounter', async () => {
    const room = openRoom()
    await indexCommand(room)
    expect(await lookup(room, { fingerprint: sha256Hex('other') })).toEqual({ kind: 'MISMATCH' })
    expect(await lookup(room, { userId: uuid(5) })).toEqual({ kind: 'MISMATCH' })
    expect(await lookup(room, { encounterId: uuid(9) })).toEqual({ kind: 'MISMATCH' })
  })

  it('leaves a command the held history still records to the Encounter planner', async () => {
    const room = openRoom()
    await indexCommand(room)
    await room.transact(async () => {
      await room.store.insert('encounterRunCommands', {
        ...indexed,
        commandId,
        createdAt: '2026-05-05T12:00:00.000Z',
        commandType: 'CREATE'
      })
    })
    expect(await lookup(room)).toEqual({ kind: 'NONE' })
    expect(await lookup(room, { fingerprint: sha256Hex('other') })).toEqual({ kind: 'NONE' })
  })

  it('indexes a committed command once, whatever replays it', async () => {
    const room = openRoom()
    const row = { ...indexed, commandId, version: 7, rollCardId: null }
    await room.transact(async () => {
      await recordRoomEncounterReplay(room.store, row)
      await recordRoomEncounterReplay(room.store, { ...row, version: 8 })
    })
    expect(room.documents('encounterReplayIndex')).toHaveLength(1)
    expect(await lookup(room)).toMatchObject({ kind: 'INDEXED', version: 7 })
  })

  it('leaves no history or replay index for a Run that completes, and keeps any other Run', async () => {
    const room = openRoom()
    const otherEncounterId = uuid(9)
    const history = (runId: string, id: string) => ({
      ...indexed,
      encounterId: runId,
      commandId: id,
      createdAt: '2026-05-05T12:00:00.000Z',
      commandType: 'CREATE' as const
    })
    await room.transact(async () => {
      for (const [runId, id] of [
        [encounterId, commandId],
        [otherEncounterId, uuid(0x401)]
      ] as const) {
        await room.store.insert('encounterRunCommands', history(runId, id))
        await recordRoomEncounterReplay(room.store, {
          ...indexed,
          encounterId: runId,
          commandId: id,
          version: 1,
          rollCardId: null
        })
      }
    })
    await room.transact(async () => {
      await removeRoomFinishedRunRows(room.store, encounterId)
    })
    expect(room.documents('encounterRunCommands').map((row) => row.encounterId)).toEqual([
      otherEncounterId
    ])
    expect(room.documents('encounterReplayIndex').map((row) => row.encounterId)).toEqual([
      otherEncounterId
    ])
  })
})
