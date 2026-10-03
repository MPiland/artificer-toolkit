import { expect, it } from 'vitest'
import { evaluateRollExpression, parseRollExpression } from '@artificer-toolkit/shared/rolls'
import { rollRecordDtoSchema } from '@artificer-toolkit/schema/api/rolls'
import { RoomEncounterStore } from './roomEncounterStore.js'
import { buildRoomCheckpointRecords } from './roomCheckpointRecords.js'
import { retainRoomPrivateRoll, ROOM_PRIVATE_ROLL } from './roomPrivateRolls.js'
import { createNodeSqliteRoomStorage } from './testing/nodeSqliteRoomStorage.js'
import { uuid } from './testing/roomAggregateFixture.js'

it('keeps twenty private rolls while checkpointing every committed append, including after eviction', async () => {
  const { storage, database } = createNodeSqliteRoomStorage()
  try {
    const epoch = uuid(301)
    const campaignId = uuid(302)
    const userId = uuid(303)
    let store = new RoomEncounterStore(storage)
    store.hydrate({ epoch, documents: [], records: [] })
    const checksum = store.checksum
    const rolls = Array.from({ length: 26 }, (_, index) => ({
      userId,
      record: rollRecordDtoSchema.parse({
        id: uuid(310 + index),
        characterId: null,
        characterLabel: 'Hidden Creature',
        source: { kind: 'MANUAL', label: 'Concentration' },
        ruleset: { systemId: uuid(304), code: 'DND5E', version: '2024' },
        ...evaluateRollExpression(parseRollExpression('1d20'), { nextInt: () => 4 }),
        createdAt: new Date(Date.UTC(2026, 8, 30, 12, 0, index)).toISOString()
      }),
      gmCampaignRoll: { campaignId, blind: false, revealedAt: null }
    }))
    await expect(
      store.transact(async (transaction) => {
        retainRoomPrivateRoll(store, transaction, rolls[0]!)
        throw new Error('Roll command failed.')
      })
    ).rejects.toThrow('Roll command failed.')
    expect(store.records(ROOM_PRIVATE_ROLL)).toEqual([])
    expect(store.sequence).toBe(0)
    // One command's own rolls all reach the journal, even past twenty.
    const command = rolls.slice(0, 25)
    await store.transact(async (transaction) => {
      for (const roll of command) retainRoomPrivateRoll(store, transaction, roll)
      expect(transaction.records(ROOM_PRIVATE_ROLL)).toHaveLength(25)
    })
    store = new RoomEncounterStore(storage)
    expect(store.corruption).toBeNull()
    expect(store.records(ROOM_PRIVATE_ROLL)).toHaveLength(25)
    const journal = store.committedWriteSets({
      epoch,
      fromSequence: 0,
      fromChecksum: checksum,
      toSequence: 1,
      maxEntries: 10,
      maxBytes: 1024 * 1024
    })
    const checkpoint = buildRoomCheckpointRecords({
      documents: [],
      records: [],
      fromSequence: 0,
      fromChecksum: checksum,
      entries: journal.entries
    })
    expect(checkpoint.retainedRolls).toEqual(command)
    const before = store.checksum
    await expect(
      store.transact(async (transaction) => {
        retainRoomPrivateRoll(store, transaction, {
          ...rolls[24]!,
          record: { ...rolls[24]!.record, characterLabel: 'Different evidence' }
        })
      })
    ).rejects.toThrow('different evidence')
    expect(store.checksum).toBe(before)
    expect(store.sequence).toBe(1)
    await store.transact(async (transaction) =>
      retainRoomPrivateRoll(store, transaction, rolls[24]!)
    )
    expect(store.sequence).toBe(1)
    // The next command's append expires the committed rolls past twenty.
    await store.transact(async (transaction) =>
      retainRoomPrivateRoll(store, transaction, rolls[25]!)
    )
    expect(store.sequence).toBe(2)
    expect(store.records(ROOM_PRIVATE_ROLL)).toHaveLength(20)
  } finally {
    database.close()
  }
})
