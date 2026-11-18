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
async function backlogFlush(runStatus: string, reason: 'ADMISSION' | 'BACKLOG' = 'BACKLOG') {
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
    expect(await backlogFlush('ACTIVE', 'ADMISSION')).toEqual(['flushChat'])
  })

  it('stays a full prefix save when no Run is active', async () => {
    expect(await backlogFlush('COMPLETED', 'ADMISSION')).toEqual(['flush'])
  })
})
