import { afterEach, describe, expect, it } from 'vitest'
import { RoomEncounterStore } from './roomEncounterStore.js'
import { RoomOutbox, type RoomOutboxPort } from './roomOutbox.js'
import { aggregate, command, uuid } from './testing/roomAggregateFixture.js'
import { createNodeSqliteRoomStorage } from './testing/nodeSqliteRoomStorage.js'

const EPOCH = uuid(0x900)
const databases: ReturnType<typeof createNodeSqliteRoomStorage>['database'][] = []
afterEach(() => {
  for (const database of databases.splice(0)) database.close()
})

/** A real outbox and room store; only the Convex-facing checkpoint steps and the journal head are recorded. */
async function backlogFlush(
  runStatus: string,
  reason: 'ADMISSION' | 'BACKLOG' = 'BACKLOG',
  withChat = false,
  retained = false
) {
  const opened = createNodeSqliteRoomStorage()
  databases.push(opened.database)
  const store = new RoomEncounterStore(opened.storage)
  const { documents, records } = aggregate(2)
  store.hydrate({
    epoch: EPOCH,
    documents: documents.map((document) =>
      document.table === 'encounterRuns'
        ? { ...document, fields: { ...document.fields, status: runStatus } }
        : document
    ),
    records
  })
  await command(store, 1)
  if (withChat)
    await store.transact(async () => {
      await store.store.insert('campaignConversationEntries', {
        id: uuid(0x901),
        campaignId: uuid(2),
        conversationId: uuid(0x800),
        authorUserId: uuid(0x801),
        createdAt: '2026-09-01T00:00:00.000Z',
        clientNonce: uuid(0xa01),
        kind: 'CHAT',
        mode: 'OOC',
        body: 'Hello table',
        rolls: [],
        authorUsername: 'Author',
        characterId: null,
        characterLabel: null,
        editedAt: null,
        unsentAt: null
      })
    })
  const calls: string[] = []
  const port = {
    store,
    roomCampaignId: () => uuid(2),
    journal: {
      readCurrent: () => ({
        status: 'ACTIVE',
        authorityEpoch: EPOCH,
        sequence: store.sequence,
        publishedSequence: 0,
        stateChecksum: store.checksum
      })
    },
    authorization: {
      current: () => null,
      acknowledgePlay: () => void calls.push('acknowledgePlay')
    },
    checkpoints: {
      retainsCheckpoint: () => retained,
      flush: async () => {
        calls.push('flush')
        return null
      },
      flushChat: async () => {
        calls.push('flushChat')
        return null
      }
    },
    scheduleAlarm: async () => undefined,
    waitUntil: () => undefined
  } as unknown as RoomOutboxPort
  await new RoomOutbox(port).flush(reason)
  return calls
}

describe('RoomOutbox backlog save', () => {
  it('publishes only chat and rolls while a Run is active', async () => {
    expect(await backlogFlush('ACTIVE')).toEqual(['flushChat'])
  })

  it('stays a full prefix save when no Run is active', async () => {
    expect(await backlogFlush('COMPLETED')).toEqual(['flush'])
  })
})

describe('RoomOutbox admission save', () => {
  it('publishes only chat and rolls while a Run is active', async () => {
    expect(await backlogFlush('ACTIVE', 'ADMISSION', true)).toEqual(['flushChat'])
  })

  it('publishes nothing while a Run is active and no chat is unsaved', async () => {
    expect(await backlogFlush('ACTIVE', 'ADMISSION')).toEqual([])
  })

  it('retries a retained checkpoint while a Run is active and no chat is unsaved', async () => {
    expect(await backlogFlush('ACTIVE', 'ADMISSION', false, true)).toEqual(['flushChat'])
  })

  it('stays a full prefix save when no Run is active', async () => {
    expect(await backlogFlush('COMPLETED', 'ADMISSION')).toEqual(['flush'])
  })
})
