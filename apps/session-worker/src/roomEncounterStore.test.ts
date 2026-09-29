import { describe, expect, it } from 'vitest'
import { encounterStoreSchemas } from '@artificer-toolkit/encounter-persistence/storeTables'
import type { EncounterTableName } from '@artificer-toolkit/encounter-persistence/store'
import { sha256Hex } from '@artificer-toolkit/shared/sha256'
import {
  RoomEncounterStore,
  RoomStoreCorruptError,
  RoomWriteSetTooLargeError,
  type RoomDocument,
  type RoomRecord
} from './roomEncounterStore.js'
import { createNodeSqliteRoomStorage } from './testing/nodeSqliteRoomStorage.js'

const tables = Object.keys(encounterStoreSchemas) as EncounterTableName[]
const uuid = (index: number) => `00000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`
const encounterId = uuid(1)
const checksum = (label: string) => sha256Hex(label)
const playState = (characterIndex: number) => ({
  kind: 'CHARACTER_PLAY_STATE',
  key: uuid(0x500 + characterIndex)
})

/** A Run aggregate sized like a live Encounter: JSON blobs the way the stored tables carry them. */
function aggregate(actorCount: number) {
  let creationTime = 1_780_000_000_000
  const documents: RoomDocument[] = []
  const add = (table: EncounterTableName, id: string, fields: Record<string, unknown>) =>
    documents.push({ table, id, creationTime: creationTime++, fields })
  add('encounterRuns', 'convex:run', {
    id: encounterId,
    campaignId: uuid(2),
    gameSystemId: uuid(3),
    status: 'ACTIVE',
    version: 1,
    stateJson: JSON.stringify({ padding: 'x'.repeat(30_000) }),
    stateChecksum: checksum('run'),
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z'
  })
  for (let source = 0; source < Math.ceil(actorCount / 5); source++)
    add('encounterSourceProjectionFacts', `convex:source:${source}`, {
      encounterId,
      checksum: checksum(`source:${source}`),
      factsJson: JSON.stringify({ statBlock: 'é'.repeat(40_000) })
    })
  for (let actor = 0; actor < actorCount; actor++) {
    add('encounterRunActors', `convex:actor:${actor}`, {
      id: uuid(0x100 + actor),
      encounterId,
      stateJson: JSON.stringify({ hitPoints: 10 + actor, padding: 'a'.repeat(6_000) }),
      stateChecksum: checksum(`actor:${actor}`)
    })
    add('encounterActorProjectionFacts', `convex:facts:${actor}`, {
      id: uuid(0x100 + actor),
      encounterId,
      factsJson: JSON.stringify({ padding: 'f'.repeat(4_000) }),
      sourceFactsChecksum: checksum(`source:${actor % Math.ceil(actorCount / 5)}`)
    })
  }
  const records: RoomRecord[] = Array.from({ length: Math.min(actorCount, 6) }, (_, index) => ({
    ...playState(index),
    revision: null,
    json: JSON.stringify({ streamVersion: index })
  }))
  return { documents, records }
}

function open() {
  const { database, storage } = createNodeSqliteRoomStorage()
  return { database, storage, room: new RoomEncounterStore(storage) }
}

function hydrated(actorCount = 11) {
  const context = open()
  context.room.hydrate({ epoch: uuid(0x900), ...aggregate(actorCount) })
  return context
}

/** One command: a Run patch, a movement insert (and an earlier movement's delete), and a record. */
async function command(room: RoomEncounterStore, ordinal: number) {
  await room.transact(async (transaction) => {
    const run = await room.store
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', encounterId))
      .unique()
    await room.store.patch(run!._id, {
      version: run!.version + 1,
      stateJson: JSON.stringify({ ordinal })
    })
    await room.store.insert('encounterTurnMovements', {
      encounterId,
      round: 1 + ordinal,
      turnActorId: uuid(0x100),
      actorId: uuid(0x100 + (ordinal % 11)),
      usedFeet: ordinal,
      speedBonuses: 0
    })
    if (ordinal % 3 === 0) {
      const [oldest] = await room.store.query('encounterTurnMovements').collect()
      await room.store.delete(oldest!._id)
    }
    transaction.setRecord({
      ...playState(ordinal % 6),
      revision: null,
      json: JSON.stringify({ streamVersion: ordinal })
    })
  })
}

/** A room that ran commands 1..count without ever sleeping: the reference a recovered room must match. */
async function replayed(actorCount: number, count: number) {
  const { room } = hydrated(actorCount)
  for (let ordinal = 1; ordinal <= count; ordinal++) await command(room, ordinal)
  return room
}

function state(room: RoomEncounterStore) {
  return {
    epoch: room.epoch,
    sequence: room.sequence,
    checksum: room.checksum,
    documents: Object.fromEntries(tables.map((table) => [table, room.documents(table)])),
    records: room.records('CHARACTER_PLAY_STATE')
  }
}

describe('room Encounter store', () => {
  describe.each([11, 100])('hydrating %i actors', (actorCount) => {
    it('holds the Convex aggregate with its identities and survives a restart', () => {
      const { storage, room } = hydrated(actorCount)
      const source = aggregate(actorCount)
      expect(room.epoch).toBe(uuid(0x900))
      for (const table of ['encounterRuns', 'encounterRunActors'] as const)
        expect(room.documents(table).map(({ _id, _creationTime }) => [_id, _creationTime])).toEqual(
          source.documents
            .filter((document) => document.table === table)
            .map(({ id, creationTime }) => [id, creationTime])
        )
      expect(room.documents('encounterRunActors')).toHaveLength(actorCount)
      const restarted = new RoomEncounterStore(storage)
      expect(state(restarted)).toEqual(state(room))
    })

    it('replays commands into the same aggregate and checksum after a restart', async () => {
      const { storage, room } = hydrated(actorCount)
      for (let ordinal = 1; ordinal <= 20; ordinal++) await command(room, ordinal)
      const restarted = new RoomEncounterStore(storage)
      expect(restarted.sequence).toBe(20)
      expect(state(restarted)).toEqual(state(room))
      // The old instance is gone; the restarted room continues exactly as a room that never slept.
      await command(restarted, 21)
      const reference = await replayed(actorCount, 21)
      expect(state(restarted)).toEqual(state(reference))
    })
  })

  it('writes exactly one row per command and none for a command that changes nothing', async () => {
    const { room } = hydrated()
    const before = room.usage.rowsWritten
    await command(room, 1)
    expect(room.usage.rowsWritten - before).toBe(1)
    await room.transact(async (transaction) => {
      transaction.record('CHARACTER_PLAY_STATE', playState(0).key)
      await room.store.get('convex:run')
    })
    expect(room.usage.rowsWritten - before).toBe(1)
    expect(room.sequence).toBe(1)
  })

  it('discards a failed command and its identities, records and checksum', async () => {
    const { storage, room } = hydrated()
    await command(room, 1)
    const before = state(room)
    await expect(
      room.transact(async (transaction) => {
        await room.store.insert('encounterTurnMovements', {
          encounterId,
          round: 9,
          turnActorId: uuid(0x100),
          actorId: uuid(0x100),
          usedFeet: 0,
          speedBonuses: 0
        })
        transaction.setRecord({ ...playState(0), revision: null, json: '{"aborted":true}' })
        throw new Error('command failed')
      })
    ).rejects.toThrow('command failed')
    expect(state(room)).toEqual(before)
    await command(room, 2)
    const twin = hydrated()
    await command(twin.room, 1)
    await command(twin.room, 2)
    expect(state(room)).toEqual(state(twin.room))
    expect(state(new RoomEncounterStore(storage))).toEqual(state(room))
  })

  it('refuses writes outside a command and a second command while one runs', async () => {
    const { room } = hydrated()
    const run = room.documents('encounterRuns')[0]!
    await expect(room.store.patch(run._id, { version: 9 })).rejects.toThrow('inside a room command')
    await expect(
      room.transact(async () => {
        await room.transact(async () => undefined)
      })
    ).rejects.toThrow('already running')
    expect(room.documents('encounterRuns')[0]!.version).toBe(1)
  })

  it('aborts a write set larger than a log row instead of splitting it', async () => {
    const { room } = hydrated()
    const before = state(room)
    await expect(
      room.transact(async (transaction) => {
        transaction.setRecord({
          kind: 'CHARACTER_PLAY_STATE',
          key: uuid(0x777),
          revision: null,
          json: 'x'.repeat(1_900_000)
        })
      })
    ).rejects.toBeInstanceOf(RoomWriteSetTooLargeError)
    expect(state(room)).toEqual(before)
  })

  describe('recovery', () => {
    const insertRow = (
      database: ReturnType<typeof open>['database'],
      row: { sequence: number; json: string; checksum: string; chain: string }
    ) =>
      database
        .prepare(
          'INSERT INTO room_writeset_log (sequence, json, checksum, chain) VALUES (?, ?, ?, ?)'
        )
        .run(row.sequence, row.json, row.checksum, row.chain)

    const nextRow = (room: RoomEncounterStore, json: string) => {
      const rowChecksum = sha256Hex(json)
      return {
        sequence: room.sequence + 1,
        json,
        checksum: rowChecksum,
        chain: sha256Hex(`${room.checksum}:${rowChecksum}`)
      }
    }

    it.each([
      [
        'truncated JSON',
        (room: RoomEncounterStore) => ({
          ...nextRow(room, '[{"op":"INSERT"'),
          json: '[{"op":"INSERT"'
        })
      ],
      [
        'a checksum that does not match',
        (room: RoomEncounterStore) => ({ ...nextRow(room, '[]'), checksum: 'f'.repeat(64) })
      ],
      [
        'a chain that does not follow',
        (room: RoomEncounterStore) => ({ ...nextRow(room, '[]'), chain: 'e'.repeat(64) })
      ],
      [
        'a sequence gap',
        (room: RoomEncounterStore) => ({ ...nextRow(room, '[]'), sequence: room.sequence + 2 })
      ],
      [
        'a write set that half applies',
        (room: RoomEncounterStore) =>
          nextRow(
            room,
            JSON.stringify([
              {
                op: 'INSERT',
                table: 'encounterTurnMovements',
                id: 'room:99',
                creationTime: 99,
                fields: {
                  encounterId,
                  round: 1,
                  turnActorId: uuid(0x100),
                  actorId: uuid(0x100),
                  usedFeet: 0,
                  speedBonuses: 0
                }
              },
              { op: 'PATCH', id: 'room:404', fields: { usedFeet: 1 }, remove: [] }
            ])
          )
      ]
    ])('drops a torn last row (%s) and applies nothing of it', async (_name, torn) => {
      const { database, storage, room } = hydrated()
      await command(room, 1)
      await command(room, 2)
      const committed = state(room)
      insertRow(database, torn(room))
      const restarted = new RoomEncounterStore(storage)
      expect(state(restarted)).toEqual(committed)
      expect(database.prepare('SELECT COUNT(*) AS rows FROM room_writeset_log').get()).toEqual({
        rows: 2
      })
      await command(restarted, 3)
      const reference = await replayed(11, 3)
      expect(state(restarted)).toEqual(state(reference))
      expect(state(new RoomEncounterStore(storage))).toEqual(state(reference))
    })

    it('refuses a damaged row that is not the last', async () => {
      const { database, storage, room } = hydrated()
      for (let ordinal = 1; ordinal <= 3; ordinal++) await command(room, ordinal)
      database.prepare("UPDATE room_writeset_log SET json = '[]' WHERE sequence = 2").run()
      expect(() => new RoomEncounterStore(storage)).toThrow(RoomStoreCorruptError)
    })

    it('refuses an incomplete or altered snapshot and a log without a snapshot', () => {
      const { database, storage } = hydrated(100)
      const parts = database.prepare('SELECT COUNT(*) AS parts FROM room_snapshot_chunks').get()
      expect(Number((parts as { parts: number }).parts)).toBeGreaterThan(1)
      database.prepare('DELETE FROM room_snapshot_chunks WHERE part = 1').run()
      expect(() => new RoomEncounterStore(storage)).toThrow('incomplete')

      const altered = hydrated()
      altered.database.prepare("UPDATE room_snapshot_chunks SET content = 'x' || content").run()
      expect(() => new RoomEncounterStore(altered.storage)).toThrow('checksum')

      const orphan = open()
      insertRow(orphan.database, {
        sequence: 1,
        json: '[]',
        checksum: sha256Hex('[]'),
        chain: 'a'.repeat(64)
      })
      expect(() => new RoomEncounterStore(orphan.storage)).toThrow('no snapshot')
    })
  })

  describe('compaction', () => {
    it('keeps the aggregate and checksum, and continues the chain', async () => {
      const compacted = hydrated(100)
      for (let ordinal = 1; ordinal <= 30; ordinal++) await command(compacted.room, ordinal)
      const before = state(compacted.room)
      compacted.room.compact()
      expect(state(compacted.room)).toEqual(before)
      expect(compacted.room.logRows).toBe(0)
      expect(
        compacted.database.prepare('SELECT COUNT(*) AS rows FROM room_writeset_log').get()
      ).toEqual({
        rows: 0
      })
      const restarted = new RoomEncounterStore(compacted.storage)
      expect(state(restarted)).toEqual(before)
      // A room that never compacted or slept holds the same aggregate and checksum after more commands.
      const plain = await replayed(100, 35)
      for (let ordinal = 31; ordinal <= 35; ordinal++) await command(restarted, ordinal)
      expect(state(restarted)).toEqual(state(plain))
      expect(state(new RoomEncounterStore(compacted.storage))).toEqual(state(plain))
    })

    it('keeps identities that a deleted newest document consumed', async () => {
      const movement = (round: number) => ({
        encounterId,
        round,
        turnActorId: uuid(0x100),
        actorId: uuid(0x100),
        usedFeet: 0,
        speedBonuses: 0
      })
      const insertAndDelete = async (room: RoomEncounterStore) =>
        room.transact(async () => {
          await room.store.delete(await room.store.insert('encounterTurnMovements', movement(1)))
        })
      const insertNext = async (room: RoomEncounterStore) =>
        room.transact(async () => {
          await room.store.insert('encounterTurnMovements', movement(2))
        })
      const { storage, room } = hydrated()
      await insertAndDelete(room)
      room.compact()
      const restarted = new RoomEncounterStore(storage)
      await insertNext(restarted)
      const reference = hydrated().room
      await insertAndDelete(reference)
      await insertNext(reference)
      expect(state(restarted)).toEqual(state(reference))
    })

    it('does nothing without log rows and leaves one snapshot generation', async () => {
      const { database, room } = hydrated()
      const written = room.usage.rowsWritten
      room.compact()
      expect(room.usage.rowsWritten).toBe(written)
      await command(room, 1)
      room.compact()
      room.compact()
      expect(
        database
          .prepare('SELECT COUNT(DISTINCT generation) AS generations FROM room_snapshot_chunks')
          .get()
      ).toEqual({ generations: 1 })
    })
  })

  describe('hydrating a new epoch', () => {
    it('replaces the aggregate, records and log of the previous epoch', async () => {
      const { storage, room } = hydrated()
      await command(room, 1)
      room.hydrate({ epoch: uuid(0x901), ...aggregate(11) })
      expect(room.epoch).toBe(uuid(0x901))
      expect(room.sequence).toBe(0)
      expect(room.documents('encounterTurnMovements')).toEqual([])
      expect(state(new RoomEncounterStore(storage))).toEqual(state(room))
      await expect(
        Promise.resolve().then(() =>
          room.hydrate({
            epoch: uuid(0x902),
            documents: [
              { table: 'encounterRuns', id: 'convex:bad', creationTime: 1, fields: { id: 'bad' } }
            ],
            records: []
          })
        )
      ).rejects.toThrow()
      expect(room.epoch).toBe(uuid(0x901))
      expect(state(new RoomEncounterStore(storage))).toEqual(state(room))
    })

    it('has no epoch before its first hydrate', () => {
      const { room } = open()
      expect(room.epoch).toBeNull()
      expect(() => room.compact()).not.toThrow()
    })
  })
})
