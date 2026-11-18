import { afterEach, describe, expect, it } from 'vitest'
import type {
  LiveSessionCheckpointInput,
  LiveSessionCheckpointResponse
} from '@artificer-toolkit/schema/api/liveSessionCheckpoint'
import type { LiveSessionChatCheckpointInput } from '@artificer-toolkit/schema/api/liveSessionChatCheckpoint'
import { rollRecordDtoSchema } from '@artificer-toolkit/schema/api/rolls'
import { evaluateRollExpression, parseRollExpression } from '@artificer-toolkit/shared/rolls'
import { sha256Hex } from '@artificer-toolkit/shared/sha256'
import { RoomCheckpoints } from './roomCheckpoints.js'
import { RoomEncounterStore } from './roomEncounterStore.js'
import { retainRoomPrivateRoll } from './roomPrivateRolls.js'
import {
  LIVE_SESSION_CHECKPOINT_MAX_BYTES,
  LIVE_SESSION_CHECKPOINT_MAX_CHANGES
} from '@artificer-toolkit/schema/api/liveSessionCheckpointFence'
import { canonicalizeJson } from '@artificer-toolkit/shared/canonicalJson'
import { aggregate, command, encounterId, uuid } from './testing/roomAggregateFixture.js'
import { createNodeSqliteRoomStorage } from './testing/nodeSqliteRoomStorage.js'
import { NO_CHECKPOINT_IO } from '../test/checkpointIoFixture.js'

const EPOCH = uuid(0x900)
const CAMPAIGN = uuid(2)
const scope = { campaignId: CAMPAIGN, epoch: EPOCH, knownAuthorization: null }
const databases: ReturnType<typeof createNodeSqliteRoomStorage>['database'][] = []
afterEach(() => {
  for (const database of databases.splice(0)) database.close()
})

function open() {
  const opened = createNodeSqliteRoomStorage()
  databases.push(opened.database)
  const store = new RoomEncounterStore(opened.storage)
  store.hydrate({ epoch: EPOCH, ...aggregate(2) })
  return { ...opened, store }
}

const response = (
  head: Pick<LiveSessionCheckpointInput, 'sequence' | 'checksum'>
): LiveSessionCheckpointResponse => ({
  status: 'COMMITTED',
  authority: {
    campaignId: CAMPAIGN,
    epoch: EPOCH,
    phase: 'DO_ACTIVE',
    activationFingerprint: sha256Hex('activation'),
    persistedSequence: head.sequence,
    persistedStateChecksum: head.checksum,
    createdAt: '2026-09-30T00:00:00.000Z',
    updatedAt: '2026-09-30T00:00:00.000Z'
  },
  adopted: { characters: [] },
  io: NO_CHECKPOINT_IO
})

const chatEntry = (ordinal: number) => ({
  id: uuid(0x900 + ordinal),
  campaignId: CAMPAIGN,
  conversationId: uuid(0x800),
  authorUserId: uuid(0x801),
  createdAt: '2026-09-01T00:00:00.000Z',
  clientNonce: uuid(0xa00 + ordinal),
  kind: 'CHAT' as const,
  mode: 'OOC' as const,
  body: 'Hello table',
  roll: null,
  revealedByGm: false,
  authorUsername: 'Author',
  characterId: null,
  characterLabel: null,
  editedAt: null,
  unsentAt: null,
  consumedAt: null
})

const chat = (room: RoomEncounterStore, ordinal: number) =>
  room.transact(async () => {
    await room.store.insert('campaignConversationEntries', chatEntry(ordinal))
  })

const roll = (ordinal: number) => ({
  userId: uuid(303),
  record: rollRecordDtoSchema.parse({
    id: uuid(0x310 + ordinal),
    characterId: null,
    characterLabel: 'Hidden Creature',
    source: { kind: 'MANUAL', label: 'Concentration' },
    ruleset: { systemId: uuid(3), code: 'DND5E', version: '2024' },
    ...evaluateRollExpression(parseRollExpression('1d20'), { nextInt: () => 4 }),
    createdAt: new Date(Date.UTC(2026, 8, 30, 12, 0, ordinal)).toISOString()
  }),
  gmCampaignRoll: { campaignId: CAMPAIGN, creature: null, revealedAt: null, noticedAt: null }
})

const head = (room: RoomEncounterStore) => ({ sequence: room.sequence, checksum: room.checksum })

/** A room whose chat saves and full checkpoints are recorded; `failChat` fails the next chat send after recording. */
function recorders(room: RoomEncounterStore, storage: ReturnType<typeof open>['storage']) {
  const chats: LiveSessionChatCheckpointInput[] = []
  const fulls: LiveSessionCheckpointInput[] = []
  const calls: string[] = []
  const state = { failChat: false }
  const checkpoints = new RoomCheckpoints(
    room,
    storage,
    async (input) => {
      calls.push('full')
      fulls.push(structuredClone(input))
      return response(input)
    },
    undefined,
    undefined,
    async (input) => {
      calls.push('chat')
      chats.push(structuredClone(input))
      if (state.failChat) {
        state.failChat = false
        throw new Error('Chat acknowledgement lost.')
      }
      return response(head(room))
    }
  )
  return { checkpoints, chats, fulls, calls, state }
}

describe('mid-Run chat save (ADR 0035 Amendment 32)', () => {
  it('publishes only chat and rolls, moves no fence, and the next full checkpoint carries no chat it already sent and no row created and dropped in the fight', async () => {
    const { store, storage } = open()
    const { checkpoints, chats, fulls } = recorders(store, storage)
    const baseline = store.checkpointSnapshot()
    await command(store, 1)
    await store.transact(async (transaction) => retainRoomPrivateRoll(store, transaction, roll(1)))
    await chat(store, 1)
    await chat(store, 2)

    await checkpoints.flushChat(scope)

    expect(chats).toHaveLength(1)
    expect(chats[0]!.changes.map(({ table }) => table)).toEqual([
      'campaignConversationEntries',
      'campaignConversationEntries'
    ])
    expect(chats[0]!.changes.every(({ previousChecksum }) => previousChecksum === null)).toBe(true)
    expect(chats[0]!.retainedRolls).toHaveLength(1)
    expect(fulls).toHaveLength(0)
    expect(store.checkpointSnapshot()).toMatchObject({
      sequence: baseline.sequence,
      checksum: baseline.checksum
    })
    expect(store.logRows).toBe(4)
    expect(store.chatPublication).toEqual({ throughSequence: 4, pendingSequence: null })

    await command(store, 2)
    await command(store, 3)
    await chat(store, 3)
    await store.transact(async (transaction) => retainRoomPrivateRoll(store, transaction, roll(2)))
    await checkpoints.flush(scope, 'DRAIN')

    expect(fulls).toHaveLength(1)
    const full = fulls[0]!
    const entries = full.records.changes.filter(
      ({ table }) => table === 'campaignConversationEntries'
    )
    expect(entries).toHaveLength(1)
    expect(entries[0]!.key).toEqual([uuid(0x903)])
    // Movements of commands 2 and 3 survive; command 1's was deleted by command 3, so none reaches Convex.
    expect(
      full.records.changes.filter(({ table }) => table === 'encounterTurnMovements')
    ).toHaveLength(2)
    expect(full.records.retainedRolls?.map(({ record }) => record.id)).toEqual([uuid(0x312)])
    expect(store.logRows).toBe(0)
    expect(store.chatPublication).toEqual({ throughSequence: 0, pendingSequence: null })
    expect(storage.sql.exec('SELECT * FROM room_chat_publication').toArray()).toEqual([])
  })

  it('sends the same input again after an unacknowledged commit and a restart with its storage intact', async () => {
    const { store, storage } = open()
    const first = recorders(store, storage)
    await command(store, 1)
    await chat(store, 1)
    first.state.failChat = true
    await expect(first.checkpoints.flushChat(scope)).rejects.toThrow('Chat acknowledgement lost.')
    expect(store.chatPublication).toEqual({ throughSequence: 0, pendingSequence: 2 })
    expect(store.unsavedChatEntries).toBe(1)

    // Convex committed, then the room lost the response and was evicted.
    const restarted = new RoomEncounterStore(storage)
    expect(restarted.corruption).toBeNull()
    expect(restarted.chatPublication).toEqual({ throughSequence: 0, pendingSequence: 2 })
    const second = recorders(restarted, storage)
    await chat(restarted, 2)
    await second.checkpoints.flushChat(scope)

    expect(second.chats).toHaveLength(1)
    expect(second.chats[0]).toEqual(first.chats[0])
    expect(restarted.chatPublication).toEqual({ throughSequence: 2, pendingSequence: null })
    // The chat written after the pending target stays unsaved and waits for the next save.
    expect(restarted.unsavedChatEntries).toBe(1)
    expect(restarted.logRows).toBe(3)
  })

  it('finishes a pending chat save before a full checkpoint is built from its watermark', async () => {
    const { store, storage } = open()
    const { checkpoints, chats, fulls, calls, state } = recorders(store, storage)
    await command(store, 1)
    await chat(store, 1)
    state.failChat = true
    await expect(checkpoints.flushChat(scope)).rejects.toThrow('Chat acknowledgement lost.')

    await checkpoints.flush(scope, 'DRAIN')

    expect(calls).toEqual(['chat', 'chat', 'full'])
    expect(chats[1]).toEqual(chats[0])
    expect(
      fulls[0]!.records.changes.some(({ table }) => table === 'campaignConversationEntries')
    ).toBe(false)
    expect(store.logRows).toBe(0)
  })

  it('splits an oversize full save below the chat watermark, drops the chat already published, and publishes every prefix', async () => {
    const { store, storage } = open()
    const { checkpoints, fulls } = recorders(store, storage)
    for (let ordinal = 1; ordinal <= 4; ordinal += 1) {
      await store.transact(async () => {
        for (let row = 0; row < 1000; row += 1)
          await store.store.insert('encounterTurnMovements', {
            encounterId,
            round: ordinal * 1000 + row,
            turnActorId: uuid(0x100),
            actorId: uuid(0x100 + (row % 11)),
            usedFeet: row,
            speedBonuses: 0,
            speedId: null,
            usedOncePerTurn: [],
            startedByCommandId: null,
            lastMove: null,
            teleportAllowances: []
          })
      })
      await chat(store, ordinal)
    }
    const published = store.sequence
    await checkpoints.flushChat(scope)
    expect(store.chatPublication.throughSequence).toBe(published)

    await checkpoints.flush(scope, 'DRAIN')

    expect(fulls.length).toBeGreaterThan(1)
    expect(fulls.at(-1)!.sequence).toBe(published)
    for (const full of fulls) {
      expect(full.records.changes.length).toBeLessThanOrEqual(LIVE_SESSION_CHECKPOINT_MAX_CHANGES)
      expect(
        new TextEncoder().encode(canonicalizeJson(full.records)).byteLength
      ).toBeLessThanOrEqual(LIVE_SESSION_CHECKPOINT_MAX_BYTES)
      expect(
        full.records.changes.some(({ table }) => table === 'campaignConversationEntries')
      ).toBe(false)
    }
    expect(
      fulls.slice(1).every((full, index) => full.fromSequence === fulls[index]!.sequence)
    ).toBe(true)
    expect(store.logRows).toBe(0)
  })

  it('rebuilds after storage loss with chat ahead of the Run head: re-run commands publish and never touch the held chat rows', async () => {
    const lost = open()
    const first = recorders(lost.store, lost.storage)
    await command(lost.store, 1)
    await chat(lost.store, 1)
    await first.checkpoints.flushChat(scope)
    expect(first.chats[0]!.changes).toHaveLength(1)

    // Convex now holds chat entry 1; the room's storage is lost and it hydrates from Convex alone.
    const rebuilt = createNodeSqliteRoomStorage()
    databases.push(rebuilt.database)
    const store = new RoomEncounterStore(rebuilt.storage)
    const held = aggregate(2)
    store.hydrate({
      epoch: EPOCH,
      ...held,
      documents: [
        ...held.documents,
        {
          table: 'campaignConversationEntries',
          id: 'convex:chat:1',
          creationTime: 1_790_000_000_000,
          fields: chatEntry(1)
        }
      ]
    })
    const second = recorders(store, rebuilt.storage)
    await command(store, 1)
    await chat(store, 2)
    await second.checkpoints.flush(scope, 'DRAIN')

    expect(second.fulls).toHaveLength(1)
    const entries = second.fulls[0]!.records.changes.filter(
      ({ table }) => table === 'campaignConversationEntries'
    )
    expect(entries.map(({ key }) => key)).toEqual([[uuid(0x902)]])
  })

  it('frees the push window: saved chat leaves unsavedChatEntries, across eviction, until a full checkpoint', async () => {
    const { store, storage } = open()
    const { checkpoints } = recorders(store, storage)
    await chat(store, 1)
    await chat(store, 2)
    await chat(store, 3)
    expect(store.unsavedChatEntries).toBe(3)

    await checkpoints.flushChat(scope)
    expect(store.unsavedChatEntries).toBe(0)

    await chat(store, 4)
    expect(store.unsavedChatEntries).toBe(1)
    expect(new RoomEncounterStore(storage).unsavedChatEntries).toBe(1)

    await checkpoints.flush(scope, 'DRAIN')
    expect(store.unsavedChatEntries).toBe(0)
    expect(new RoomEncounterStore(storage).unsavedChatEntries).toBe(0)
  })
})
