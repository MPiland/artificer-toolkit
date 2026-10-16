import { describe, expect, it } from 'vitest'
import { encounterStoreSchemas } from '@artificer-toolkit/encounter-persistence/storeTables'
import type { EncounterTableName } from '@artificer-toolkit/encounter-persistence/store'
import { sha256Hex } from '@artificer-toolkit/shared/sha256'
import {
  LIVE_SESSION_CHECKPOINT_JOURNAL_MAX_BYTES,
  liveSessionCheckpointJournalInputSchema,
  liveSessionCheckpointJournalResultSchema,
  type LiveSessionCheckpointJournalInput
} from '@artificer-toolkit/schema/api/liveSessionCheckpointJournal'
import { LIVE_SESSION_CHECKPOINT_MAX_BYTES } from '@artificer-toolkit/schema/api/liveSessionCheckpointFence'
import { MAX_ROOM_INPUT_RESPONSE_DOCUMENTS } from '@artificer-toolkit/schema/api/liveRoomInputsBatch'
import {
  RoomEncounterStore,
  RoomStoreCorruptError,
  RoomWriteSetTooLargeError,
  type RoomDocument
} from './roomEncounterStore.js'
import { createNodeSqliteRoomStorage } from './testing/nodeSqliteRoomStorage.js'
import { aggregate, command, encounterId, playState, uuid } from './testing/roomAggregateFixture.js'

const tables = Object.keys(encounterStoreSchemas) as EncounterTableName[]

function open() {
  const { database, storage } = createNodeSqliteRoomStorage()
  return { database, storage, room: new RoomEncounterStore(storage) }
}

function hydrated(actorCount = 11) {
  const context = open()
  context.room.hydrate({ epoch: uuid(0x900), ...aggregate(actorCount) })
  return context
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

function acknowledgementFor(room: RoomEncounterStore) {
  return { epoch: room.epoch!, sequence: room.sequence, checksum: room.checksum }
}

type Database = ReturnType<typeof open>['database']

function pageRows(database: Database) {
  return database.prepare('SELECT * FROM room_snapshot_pages ORDER BY page, part').all()
}

function durableState(database: Database) {
  return {
    head: database.prepare('SELECT * FROM room_snapshot_head').all(),
    pages: pageRows(database),
    rows: database.prepare('SELECT * FROM room_writeset_log ORDER BY sequence').all()
  }
}

describe('room Encounter store', () => {
  it('journals a write set committed without its own durable commit, and only one that wrote', async () => {
    const { storage } = open()
    const journaled: number[] = []
    const room = new RoomEncounterStore(storage, undefined, (entry) => {
      journaled.push(entry.sequence)
      return undefined
    })
    room.hydrate({ epoch: uuid(0x900), ...aggregate(2) })
    await room.transact(async () => undefined)
    const owned: number[] = []
    await command(room, 1)
    await room.transact(
      async (transaction) => {
        transaction.setRecord({ kind: 'OWNED', key: 'owned', revision: null, json: '{}' })
      },
      (entry) => {
        owned.push(entry.sequence)
        return undefined
      }
    )
    expect(journaled).toEqual([1])
    expect(owned).toEqual([2])
    expect(room.sequence).toBe(2)
  })

  it('upserts restored native identities and recovers new and refreshed inputs from SQLite', async () => {
    const { room, storage, database } = hydrated(2)
    const snapshot = room.checkpointSnapshot()
    const { _id, _creationTime, ...runFields } = room.documents('encounterRuns')[0]!
    const original: RoomDocument = {
      table: 'encounterRuns',
      id: _id,
      creationTime: _creationTime,
      fields: runFields
    }
    const fetched = { ...original, fields: { ...original.fields, version: 8 } }
    const movement = {
      table: 'encounterTurnMovements' as const,
      id: 'convex:restored:movement',
      creationTime: original.creationTime + 100,
      fields: {
        encounterId,
        round: 1,
        turnActorId: uuid(0x100),
        actorId: uuid(0x100),
        usedFeet: 5,
        speedBonuses: 0,
        speedId: null,
        usedOncePerTurn: [],
        teleportAllowances: []
      }
    }
    await room.transact(async (transaction) => {
      transaction.restoreDocument(fetched)
      transaction.restoreDocument(movement)
    })
    let recovered = new RoomEncounterStore(storage)
    expect(recovered.corruption).toBeNull()
    expect(state(recovered)).toEqual(state(room))
    const refreshed = {
      ...fetched,
      fields: { ...fetched.fields, version: 9 }
    }
    await recovered.transact(async (transaction) => {
      transaction.restoreDocument(refreshed)
      transaction.restoreDocument(movement)
    })
    const expected = state(recovered)
    recovered = new RoomEncounterStore(storage)
    expect(recovered.corruption).toBeNull()
    expect(state(recovered)).toEqual(expected)
    const native = ({ id, creationTime, fields }: RoomDocument) => ({
      ...fields,
      _id: id,
      _creationTime: creationTime
    })
    expect(recovered.documents('encounterRuns')).toEqual([native(refreshed)])
    expect(recovered.documents('encounterTurnMovements')).toEqual([native(movement)])
    const entries = recovered.committedWriteSets({
      epoch: snapshot.epoch,
      fromSequence: snapshot.sequence,
      fromChecksum: snapshot.checksum,
      toSequence: recovered.sequence,
      maxEntries: 100,
      maxBytes: LIVE_SESSION_CHECKPOINT_JOURNAL_MAX_BYTES
    }).entries
    expect(entries.map((entry) => JSON.parse(entry.writeSetJson))).toEqual([
      [
        { op: 'RESTORE', ...fetched },
        { op: 'RESTORE', ...movement }
      ],
      [
        { op: 'RESTORE', ...refreshed },
        { op: 'RESTORE', ...movement }
      ]
    ])
    expect(durableState(database).rows).toHaveLength(2)
    recovered.compact(acknowledgementFor(recovered))
    expect(state(new RoomEncounterStore(storage))).toEqual(expected)
  })

  it('reads the verified durable checkpoint base until compaction advances it', async () => {
    const { room, storage, database } = hydrated()
    const base = room.checkpointSnapshot()
    expect(base).toMatchObject({ epoch: room.epoch, sequence: 0, checksum: room.checksum })
    expect(base.documents).toHaveLength(aggregate(11).documents.length)
    expect(base.documents).toEqual(expect.arrayContaining(aggregate(11).documents))
    await command(room, 1)
    expect(room.checkpointSnapshot()).toEqual(base)
    expect(new RoomEncounterStore(storage).checkpointSnapshot()).toEqual(base)
    room.compact(acknowledgementFor(room))
    expect(room.checkpointSnapshot()).toMatchObject({ sequence: 1, checksum: room.checksum })
    const compacted = room.checkpointSnapshot()
    database.prepare("UPDATE room_snapshot_pages SET content = 'bad'").run()
    expect(room.checkpointSnapshot()).toEqual(compacted)
    expect(new RoomEncounterStore(storage).corruption?.message).toMatch('snapshot checksum')
  })

  describe('committed journal reads', () => {
    const inputFor = (room: RoomEncounterStore): LiveSessionCheckpointJournalInput => ({
      epoch: uuid(0x900),
      fromSequence: room.sequence,
      fromChecksum: room.checksum,
      toSequence: room.sequence,
      maxEntries: 100,
      maxBytes: LIVE_SESSION_CHECKPOINT_JOURNAL_MAX_BYTES
    })

    it('reads the exact range repeatedly and continues from a retained log row', async () => {
      const { room, storage } = hydrated()
      await command(room, 1)
      const input = inputFor(room)
      for (let ordinal = 2; ordinal <= 4; ordinal++) await command(room, ordinal)
      input.toSequence = 3
      const before = state(room)
      const written = room.usage.rowsWritten
      const result = room.committedWriteSets(input)
      expect(result.entries.map((entry) => entry.sequence)).toEqual([2, 3])
      expect(result).toEqual({
        entries: result.entries,
        toSequence: 3,
        toChecksum: result.entries[1]!.chainChecksum,
        complete: true
      })
      expect(liveSessionCheckpointJournalResultSchema.safeParse(result).success).toBe(true)
      expect(room.committedWriteSets(input)).toEqual(result)
      expect(new RoomEncounterStore(storage).committedWriteSets(input)).toEqual(result)
      expect(state(room)).toEqual(before)
      expect(room.usage.rowsWritten).toBe(written)
      expect(room.committedWriteSets(inputFor(room))).toEqual({
        entries: [],
        toSequence: 4,
        toChecksum: room.checksum,
        complete: true
      })
    })

    it('paginates by entries and exact serialized UTF-8 array bytes', async () => {
      const { room } = hydrated()
      const input = inputFor(room)
      for (let ordinal = 1; ordinal <= 3; ordinal++) await command(room, ordinal)
      input.toSequence = 3
      const all = room.committedWriteSets(input)
      const one = room.committedWriteSets({ ...input, maxEntries: 1 })
      expect(one.entries).toEqual(all.entries.slice(0, 1))
      expect(one.complete).toBe(false)
      expect(one.toSequence).toBe(1)
      const exactBytes = new TextEncoder().encode(
        JSON.stringify(all.entries.slice(0, 2))
      ).byteLength
      const two = room.committedWriteSets({ ...input, maxBytes: exactBytes })
      expect(two.entries).toEqual(all.entries.slice(0, 2))
      expect(two.toSequence).toBe(2)
      expect(two.toChecksum).toBe(all.entries[1]!.chainChecksum)
      expect(two.complete).toBe(false)
      expect(room.committedWriteSets({ ...input, maxBytes: exactBytes - 1 }).entries).toHaveLength(
        1
      )
      expect(() => room.committedWriteSets({ ...input, maxBytes: 2 })).toThrow('exceeds maxBytes')
      const rest = room.committedWriteSets({
        ...input,
        fromSequence: two.toSequence,
        fromChecksum: two.toChecksum
      })
      expect(rest.entries).toEqual(all.entries.slice(2))
      expect(rest.complete).toBe(true)
      expect(rest.toChecksum).toBe(room.checksum)
    })

    it('fences epochs, checksums, invalid bounds and unhydrated or corrupt stores', async () => {
      const { room } = hydrated()
      const input = inputFor(room)
      expect(() => open().room.committedWriteSets(input)).toThrow('not been hydrated')
      expect(() => room.committedWriteSets({ ...input, epoch: uuid(0x901) })).toThrow('epoch')
      expect(() => room.committedWriteSets({ ...input, fromChecksum: 'f'.repeat(64) })).toThrow(
        'checksum'
      )
      expect(() => room.committedWriteSets({ ...input, toSequence: 1 })).toThrow(
        'committed sequence'
      )
      await command(room, 1)
      expect(() => room.committedWriteSets({ ...inputFor(room), toSequence: 0 })).toThrow(
        'committed sequence'
      )
      expect(() =>
        room.committedWriteSets({ ...inputFor(room), fromChecksum: input.fromChecksum })
      ).toThrow('checksum')
      for (const invalid of [
        { fromSequence: -1 },
        { toSequence: Number.MAX_SAFE_INTEGER + 1 },
        { maxEntries: 0 },
        { maxEntries: MAX_ROOM_INPUT_RESPONSE_DOCUMENTS + 1 },
        { maxEntries: 1.5 },
        { maxBytes: 0 },
        { maxBytes: 1 },
        { maxBytes: LIVE_SESSION_CHECKPOINT_JOURNAL_MAX_BYTES + 1 },
        { epoch: 'not-a-uuid' },
        { fromChecksum: 'bad' },
        { extra: true }
      ]) {
        expect(
          liveSessionCheckpointJournalInputSchema.safeParse({ ...input, ...invalid }).success
        ).toBe(false)
        expect(() => room.committedWriteSets({ ...input, ...invalid })).toThrow()
      }
      const damaged = hydrated()
      damaged.database.prepare("UPDATE room_snapshot_pages SET content = 'bad'").run()
      const corrupt = new RoomEncounterStore(damaged.storage)
      expect(() => corrupt.committedWriteSets(input)).toThrow(RoomStoreCorruptError)
    })

    it.each(['missing', 'checksum', 'chain', 'syntax', 'non-array'])(
      'refuses %s rows without altering state or SQLite',
      async (damage) => {
        const { room, database } = hydrated()
        const input = inputFor(room)
        await command(room, 1)
        await command(room, 2)
        input.toSequence = 2
        if (damage === 'missing')
          database.prepare('DELETE FROM room_writeset_log WHERE sequence = 1').run()
        else if (damage === 'checksum')
          database.prepare("UPDATE room_writeset_log SET json = '[]' WHERE sequence = 1").run()
        else if (damage === 'chain')
          database
            .prepare('UPDATE room_writeset_log SET chain = ? WHERE sequence = 1')
            .run('f'.repeat(64))
        else {
          const json = damage === 'syntax' ? '[' : '{}'
          const checksum = sha256Hex(json)
          database
            .prepare(
              'UPDATE room_writeset_log SET json = ?, checksum = ?, chain = ? WHERE sequence = 1'
            )
            .run(json, checksum, sha256Hex(`${input.fromChecksum}:${checksum}`))
        }
        const before = state(room)
        const rows = database.prepare('SELECT * FROM room_writeset_log ORDER BY sequence').all()
        expect(() => room.committedWriteSets(input)).toThrow(RoomStoreCorruptError)
        expect(state(room)).toEqual(before)
        expect(database.prepare('SELECT * FROM room_writeset_log ORDER BY sequence').all()).toEqual(
          rows
        )
      }
    )

    it('refuses a missing starting row and every read while a transaction is open', async () => {
      const { room, database } = hydrated()
      const input = inputFor(room)
      await expect(
        room.transact(async (transaction) => {
          transaction.setRecord({ ...playState(0), revision: null, json: '{"pending":true}' })
          expect(() => room.committedWriteSets(input)).toThrow('already running')
          throw new Error('abort')
        })
      ).rejects.toThrow('abort')
      expect(room.committedWriteSets(input).entries).toEqual([])
      await command(room, 1)
      const anchor = inputFor(room)
      await command(room, 2)
      database.prepare('DELETE FROM room_writeset_log WHERE sequence = 1').run()
      expect(() => room.committedWriteSets({ ...anchor, toSequence: 2 })).toThrow(
        'missing journal anchor'
      )
    })

    it('retires earlier ranges after compaction and retains the snapshot fence after restart', async () => {
      const { room, storage } = hydrated()
      const prior = inputFor(room)
      await command(room, 1)
      const snapshot = inputFor(room)
      room.compact(acknowledgementFor(room))
      expect(() => room.committedWriteSets({ ...prior, toSequence: 1 })).toThrow('compacted')
      const restarted = new RoomEncounterStore(storage)
      expect(() => restarted.committedWriteSets(prior)).toThrow('compacted')
      expect(restarted.committedWriteSets(snapshot).entries).toEqual([])
      await command(restarted, 2)
      const result = restarted.committedWriteSets({ ...snapshot, toSequence: 2 })
      expect(result.entries.map((entry) => entry.sequence)).toEqual([2])
      expect(result.toChecksum).toBe(restarted.checksum)
      expect(result.complete).toBe(true)
    })
  })

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
      await room.store.query('encounterTurnMovements').collect()
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
          speedBonuses: 0,
          speedId: null,
          usedOncePerTurn: [],
          teleportAllowances: []
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

  it('aborts a write set too large for one checkpoint instead of splitting it', async () => {
    const { room } = hydrated()
    const before = state(room)
    await expect(
      room.transact(async (transaction) => {
        transaction.setRecord({
          kind: 'CHARACTER_PLAY_STATE',
          key: uuid(0x777),
          revision: null,
          json: 'x'.repeat((LIVE_SESSION_CHECKPOINT_MAX_BYTES * 3) / 4)
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
      ['truncated JSON', (room: RoomEncounterStore) => nextRow(room, '[{"op":"INSERT"')],
      ['a non-array write set', (room: RoomEncounterStore) => nextRow(room, '{}')],
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
                  speedBonuses: 0,
                  speedId: null,
                  usedOncePerTurn: [],
                  teleportAllowances: []
                }
              },
              { op: 'PATCH', id: 'room:404', fields: { usedFeet: 1 }, remove: [] }
            ])
          )
      ]
    ])(
      'fails closed on %s at every log position without deleting durable data',
      async (_name, corruptRow) => {
        for (const prefixCount of [0, 1, 2]) {
          const { database, storage, room } = hydrated()
          for (let ordinal = 1; ordinal <= prefixCount; ordinal++) await command(room, ordinal)
          let row = corruptRow(room)
          insertRow(database, row)
          for (let suffixCount = prefixCount; suffixCount < 2; suffixCount++) {
            const checksum = sha256Hex('[]')
            row = {
              sequence: row.sequence + 1,
              json: '[]',
              checksum,
              chain: sha256Hex(`${row.chain}:${checksum}`)
            }
            insertRow(database, row)
          }
          const persisted = durableState(database)
          const restarted = new RoomEncounterStore(storage)
          expect(restarted.corruption).toBeInstanceOf(RoomStoreCorruptError)
          expect(restarted.epoch).toBeNull()
          expect(restarted.documents('encounterRuns')).toEqual([])
          expect(durableState(database)).toEqual(persisted)
          expect(() => restarted.checkpointSnapshot()).toThrow(RoomStoreCorruptError)
          expect(durableState(database)).toEqual(persisted)
        }
      }
    )

    it.each([1, 2])(
      'fails closed when log row %i is missing before a surviving row',
      async (sequence) => {
        const { database, storage, room } = hydrated()
        for (let ordinal = 1; ordinal <= 3; ordinal++) await command(room, ordinal)
        database.prepare('DELETE FROM room_writeset_log WHERE sequence = ?').run(sequence)
        const persisted = durableState(database)
        const restarted = new RoomEncounterStore(storage)
        expect(restarted.corruption?.message).toContain('out of sequence')
        expect(restarted.epoch).toBeNull()
        expect(durableState(database)).toEqual(persisted)
      }
    )

    it('reports a damaged row that is not the last, and a hydrate supersedes the damage', async () => {
      const { database, storage, room } = hydrated()
      for (let ordinal = 1; ordinal <= 3; ordinal++) await command(room, ordinal)
      database.prepare("UPDATE room_writeset_log SET json = '[]' WHERE sequence = 2").run()
      const damaged = new RoomEncounterStore(storage)
      expect(damaged.corruption).toBeInstanceOf(RoomStoreCorruptError)
      expect(damaged.epoch).toBeNull()
      expect(damaged.documents('encounterRuns')).toEqual([])

      damaged.hydrate({ epoch: uuid(0x901), ...aggregate(11) })
      expect(damaged.corruption).toBeNull()
      expect(state(new RoomEncounterStore(storage))).toEqual(state(damaged))
    })

    it('reports an incomplete or altered snapshot and a log without a snapshot', () => {
      const { database, storage } = hydrated(100)
      const parts = database
        .prepare('SELECT COUNT(*) AS parts FROM room_snapshot_pages WHERE part = 1')
        .get()
      expect(Number((parts as { parts: number }).parts)).toBeGreaterThan(0)
      database.prepare('DELETE FROM room_snapshot_pages WHERE part = 1').run()
      expect(new RoomEncounterStore(storage).corruption?.message).toContain('incomplete')

      const altered = hydrated()
      altered.database.prepare("UPDATE room_snapshot_pages SET content = 'x' || content").run()
      expect(new RoomEncounterStore(altered.storage).corruption?.message).toContain('checksum')

      const headless = hydrated()
      headless.database.prepare('DELETE FROM room_snapshot_head').run()
      expect(new RoomEncounterStore(headless.storage).corruption?.message).toContain('head')

      const vanished = hydrated(2)
      vanished.database
        .prepare(
          'DELETE FROM room_snapshot_pages WHERE page = (SELECT MAX(page) FROM room_snapshot_pages)'
        )
        .run()
      expect(new RoomEncounterStore(vanished.storage).corruption?.message).toContain(
        'page is missing'
      )

      const repeated = hydrated(2)
      const [first] = repeated.database
        .prepare('SELECT * FROM room_snapshot_pages WHERE part_count = 1 ORDER BY page')
        .all() as { page: number; checksum: string; content: string }[]
      repeated.database
        .prepare(
          'INSERT INTO room_snapshot_pages (page, part, part_count, checksum, content) VALUES (?, 0, 1, ?, ?)'
        )
        .run(first!.page + 1000, first!.checksum, first!.content)
      expect(new RoomEncounterStore(repeated.storage).corruption?.message).toContain('repeats')

      const orphan = open()
      insertRow(orphan.database, {
        sequence: 1,
        json: '[]',
        checksum: sha256Hex('[]'),
        chain: 'a'.repeat(64)
      })
      expect(new RoomEncounterStore(orphan.storage).corruption?.message).toContain('no snapshot')
    })
  })

  describe('compaction', () => {
    it('retires the acknowledged prefix while later commands survive retries and restart', async () => {
      const { room, database, storage } = hydrated()
      await command(room, 1)
      const acknowledgement = acknowledgementFor(room)
      const expectedBase = state(room)
      await command(room, 2)
      await command(room, 3)
      const before = state(room)
      const suffix = durableState(database).rows.slice(1)
      room.compact(acknowledgement)
      expect(state(room)).toEqual(before)
      expect(room.logRows).toBe(2)
      expect(durableState(database).rows).toEqual(suffix)
      const base = room.checkpointSnapshot()
      expect(base).toMatchObject(acknowledgement)
      expect(base.records).toEqual(expectedBase.records)
      expect(base.documents.find(({ table }) => table === 'encounterRuns')?.fields.version).toBe(2)
      const persisted = durableState(database)
      const written = room.usage.rowsWritten
      room.compact(acknowledgement)
      expect(room.usage.rowsWritten).toBe(written)
      expect(durableState(database)).toEqual(persisted)
      const restarted = new RoomEncounterStore(storage)
      expect(state(restarted)).toEqual(before)
      expect(restarted.checkpointSnapshot()).toEqual(base)
      const recoveredWritten = restarted.usage.rowsWritten
      restarted.compact(acknowledgement)
      expect(restarted.usage.rowsWritten).toBe(recoveredWritten)
      restarted.compact(acknowledgementFor(restarted))
      expect(restarted.logRows).toBe(0)
      expect(restarted.checkpointSnapshot()).toMatchObject({
        sequence: 3,
        checksum: before.checksum
      })
      expect(state(new RoomEncounterStore(storage))).toEqual(before)
      await command(restarted, 4)
      expect(state(restarted)).toEqual(state(await replayed(11, 4)))
    })

    it('snapshots opaque records at the prefix and replays later updates and deletions', async () => {
      const { room, storage } = hydrated()
      const first = { kind: 'OPAQUE', key: 'one', revision: 'rev1', json: 'opaque: é' }
      const deleted = { kind: 'OPAQUE', key: 'two', revision: null, json: 'not JSON' }
      await room.transact(async (transaction) => {
        transaction.setRecord(first)
        transaction.setRecord(deleted)
      })
      const acknowledgement = acknowledgementFor(room)
      await room.transact(async (transaction) => {
        transaction.setRecord({ ...first, revision: 'rev2', json: 'changed' })
        transaction.deleteRecord(deleted.kind, deleted.key)
      })
      const secondAcknowledgement = acknowledgementFor(room)
      await room.transact(async (transaction) => transaction.deleteRecord(first.kind, first.key))
      room.compact(acknowledgement)
      const base = room.checkpointSnapshot()
      expect(base.records.filter(({ kind }) => kind === 'OPAQUE')).toEqual([first, deleted])
      base.records.find(({ kind }) => kind === 'OPAQUE')!.json = 'mutated caller copy'
      expect(room.checkpointSnapshot().records.filter(({ kind }) => kind === 'OPAQUE')).toEqual([
        first,
        deleted
      ])
      const restarted = new RoomEncounterStore(storage)
      expect(restarted.records('OPAQUE')).toEqual([])
      expect(state(restarted)).toEqual(state(room))
      restarted.compact(secondAcknowledgement)
      expect(
        restarted.checkpointSnapshot().records.filter(({ kind }) => kind === 'OPAQUE')
      ).toEqual([{ ...first, revision: 'rev2', json: 'changed' }])
      expect(new RoomEncounterStore(storage).records('OPAQUE')).toEqual([])
      restarted.compact(acknowledgementFor(restarted))
      expect(
        restarted.checkpointSnapshot().records.filter(({ kind }) => kind === 'OPAQUE')
      ).toEqual([])
      expect(new RoomEncounterStore(storage).records('OPAQUE')).toEqual([])
    })

    it('rolls page rewrites, the head and prefix pruning back together', async () => {
      const { room, database, storage } = hydrated()
      await command(room, 1)
      const acknowledgement = acknowledgementFor(room)
      await command(room, 2)
      const before = state(room)
      const durableBefore = durableState(database)
      const snapshotBefore = room.checkpointSnapshot()
      database.exec(`CREATE TRIGGER fail_snapshot_prune BEFORE DELETE ON room_snapshot_pages
        BEGIN SELECT RAISE(ABORT, 'injected snapshot failure'); END`)
      expect(() => room.compact(acknowledgement)).toThrow('injected snapshot failure')
      expect(state(room)).toEqual(before)
      expect(room.checkpointSnapshot()).toEqual(snapshotBefore)
      expect(durableState(database)).toEqual(durableBefore)
      expect(room.logRows).toBe(2)
      expect(state(new RoomEncounterStore(storage))).toEqual(before)
      database.exec('DROP TRIGGER fail_snapshot_prune')
      room.compact(acknowledgement)
      expect(room.logRows).toBe(1)
      expect(state(new RoomEncounterStore(storage))).toEqual(before)
    })

    it('refuses invalid acknowledgements and an open command without changing live or durable state', async () => {
      const { room, database } = hydrated()
      const old = acknowledgementFor(room)
      await command(room, 1)
      room.compact(acknowledgementFor(room))
      await command(room, 2)
      const current = acknowledgementFor(room)
      const before = state(room)
      const durableBefore = durableState(database)
      const written = room.usage.rowsWritten
      for (const invalid of [
        old,
        { ...current, epoch: uuid(0x901) },
        { ...current, sequence: 3 },
        { ...current, checksum: 'f'.repeat(64) },
        { ...current, sequence: -1 },
        { ...current, sequence: 1.5 },
        { ...current, sequence: Number.MAX_SAFE_INTEGER + 1 },
        { ...current, epoch: 'bad' },
        { ...current, checksum: 'bad' },
        { ...current, extra: true }
      ]) {
        expect(() => room.compact(invalid)).toThrow()
        expect(state(room)).toEqual(before)
        expect(durableState(database)).toEqual(durableBefore)
        expect(room.usage.rowsWritten).toBe(written)
      }
      await expect(
        room.transact(async (transaction) => {
          transaction.deleteRecord('CHARACTER_PLAY_STATE', playState(0).key)
          expect(() => room.compact(current)).toThrow('already running')
          throw new Error('abort')
        })
      ).rejects.toThrow('abort')
      expect(state(room)).toEqual(before)
      expect(durableState(database)).toEqual(durableBefore)
    })

    it('refuses corruption in the acknowledged prefix without retiring rows', async () => {
      const { room, database } = hydrated()
      await command(room, 1)
      const acknowledgement = acknowledgementFor(room)
      await command(room, 2)
      database.prepare("UPDATE room_writeset_log SET json = '[]' WHERE sequence = 1").run()
      const before = state(room)
      const durableBefore = durableState(database)
      expect(() => room.compact(acknowledgement)).toThrow(RoomStoreCorruptError)
      expect(state(room)).toEqual(before)
      expect(durableState(database)).toEqual(durableBefore)
    })

    it('compacts past a damaged suffix and refuses it once it is acknowledged', async () => {
      const { room, database } = hydrated()
      await command(room, 1)
      const first = acknowledgementFor(room)
      await command(room, 2)
      const second = acknowledgementFor(room)
      database.prepare("UPDATE room_writeset_log SET json = '[]' WHERE sequence = 2").run()
      room.compact(first)
      const durableBefore = durableState(database)
      expect(() => room.compact(second)).toThrow(RoomStoreCorruptError)
      expect(durableState(database)).toEqual(durableBefore)
    })

    it('compacts a damaged snapshot from the one it verified, while a restart refuses it', async () => {
      const { room, database, storage } = hydrated()
      await command(room, 1)
      const acknowledgement = acknowledgementFor(room)
      await command(room, 2)
      // Compaction rewrites only the pages the acknowledged prefix touched, so it heals those.
      database
        .prepare(
          `UPDATE room_snapshot_pages SET content = 'bad'
           WHERE content LIKE '{"table":"encounterRuns"%'
             OR content LIKE '{"table":"encounterTurnMovements"%'
             OR content LIKE '{"records"%'`
        )
        .run()
      const durableBefore = durableState(database)
      const corrupt = new RoomEncounterStore(storage)
      expect(() => corrupt.compact(acknowledgement)).toThrow(RoomStoreCorruptError)
      expect(durableState(database)).toEqual(durableBefore)
      const before = state(room)
      room.compact(acknowledgement)
      expect(state(room)).toEqual(before)
      expect(state(new RoomEncounterStore(storage))).toEqual(before)
    })

    it('reads bounded journal pages when the acknowledged range exceeds one page', async () => {
      const { room, storage, database } = hydrated()
      for (let index = 1; index <= 105; index++)
        await room.transact(async (transaction) =>
          transaction.setRecord({ kind: 'PAGE', key: 'one', revision: null, json: String(index) })
        )
      const acknowledgement = acknowledgementFor(room)
      await room.transact(async (transaction) =>
        transaction.setRecord({ kind: 'PAGE', key: 'one', revision: null, json: '106' })
      )
      room.compact(acknowledgement)
      expect(room.checkpointSnapshot().records.find(({ kind }) => kind === 'PAGE')?.json).toBe(
        '105'
      )
      expect(durableState(database).rows).toHaveLength(1)
      expect(new RoomEncounterStore(storage).record('PAGE', 'one')?.json).toBe('106')
    })

    it('keeps the aggregate and checksum, and continues the chain', async () => {
      const compacted = hydrated(100)
      for (let ordinal = 1; ordinal <= 30; ordinal++) await command(compacted.room, ordinal)
      const before = state(compacted.room)
      compacted.room.compact(acknowledgementFor(compacted.room))
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
        speedBonuses: 0,
        speedId: null,
        usedOncePerTurn: [],
        teleportAllowances: []
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
      room.compact(acknowledgementFor(room))
      const restarted = new RoomEncounterStore(storage)
      await insertNext(restarted)
      const reference = hydrated().room
      await insertAndDelete(reference)
      await insertNext(reference)
      expect(state(restarted)).toEqual(state(reference))
    })

    it('does nothing without log rows and leaves one snapshot', async () => {
      const { database, room } = hydrated()
      const written = room.usage.rowsWritten
      room.compact(acknowledgementFor(room))
      expect(room.usage.rowsWritten).toBe(written)
      await command(room, 1)
      room.compact(acknowledgementFor(room))
      const pages = pageRows(database)
      room.compact(acknowledgementFor(room))
      expect(pageRows(database)).toEqual(pages)
      expect(database.prepare('SELECT COUNT(*) AS heads FROM room_snapshot_head').get()).toEqual({
        heads: 1
      })
    })

    describe('paged snapshot', () => {
      const rowsWrittenByOneCommand = async (actorCount: number) => {
        const { room } = hydrated(actorCount)
        await command(room, 1)
        const before = room.usage.rowsWritten
        room.compact(acknowledgementFor(room))
        return room.usage.rowsWritten - before
      }

      it('rewrites only the pages a compaction touched, whatever the untouched history', async () => {
        const { room, database } = hydrated(100)
        const before = pageRows(database)
        await command(room, 1)
        room.compact(acknowledgementFor(room))
        const after = pageRows(database)
        const untouched = before.filter((row) =>
          after.some((candidate) => JSON.stringify(candidate) === JSON.stringify(row))
        )
        const pagesOf = (rows: typeof before) =>
          new Set(rows.map((row) => (row as { page: number }).page))
        expect(pagesOf(before).size).toBeGreaterThan(10)
        // The Run, the new movement and the Character records: three pages at most.
        expect(pagesOf(before).size - pagesOf(untouched).size).toBeLessThanOrEqual(3)
        const rowsWritten = await rowsWrittenByOneCommand(100)
        expect(rowsWritten).toBe(await rowsWrittenByOneCommand(11))
        expect(rowsWritten).toBeLessThan(12)
      })

      it('recovers exactly the live state after several compactions', async () => {
        const { room, storage } = hydrated()
        const acknowledgements: ReturnType<typeof acknowledgementFor>[] = []
        for (let ordinal = 1; ordinal <= 8; ordinal++) {
          await command(room, ordinal)
          acknowledgements.push(acknowledgementFor(room))
          // Prefixes behind the newest command, so later rows stay retained.
          if (ordinal === 4) room.compact(acknowledgements[2]!)
          if (ordinal === 7) room.compact(acknowledgements[5]!)
        }
        const recovered = new RoomEncounterStore(storage)
        expect(recovered.corruption).toBeNull()
        expect(recovered.logRows).toBe(room.logRows)
        expect(state(recovered)).toEqual(state(room))
        expect(recovered.checkpointSnapshot()).toEqual(room.checkpointSnapshot())
        // Counters carry through: both rooms keep issuing the identities a never-compacted room does.
        await command(recovered, 9)
        const reference = state(await replayed(11, 9))
        expect(state(recovered)).toEqual(reference)
        recovered.compact(acknowledgementFor(recovered))
        expect(state(new RoomEncounterStore(storage))).toEqual(reference)
      })

      it('round-trips a document larger than a chunk through a multi-part page', async () => {
        const { room, database, storage } = hydrated(2)
        const [facts] = room.documents('encounterSourceProjectionFacts')
        await room.transact(async () => {
          await room.store.patch(facts!._id, {
            factsJson: JSON.stringify({ statBlock: 'ü'.repeat(30_000) })
          })
        })
        room.compact(acknowledgementFor(room))
        const pages = database
          .prepare(
            'SELECT MAX(part_count) AS parts, MAX(LENGTH(content)) AS longest FROM room_snapshot_pages GROUP BY page'
          )
          .all() as { parts: number; longest: number }[]
        expect(pages.some(({ parts }) => parts > 1)).toBe(true)
        expect(Math.max(...pages.map(({ longest }) => longest))).toBeLessThanOrEqual(96_000)
        expect(new RoomEncounterStore(storage).documents('encounterSourceProjectionFacts')).toEqual(
          room.documents('encounterSourceProjectionFacts')
        )
        expect(state(new RoomEncounterStore(storage))).toEqual(state(room))
      })

      it('splits a page that grows past a chunk and still recovers', async () => {
        const { room, database, storage } = hydrated()
        const tablePages = () =>
          database
            .prepare(
              `SELECT COUNT(*) AS pages FROM room_snapshot_pages
               WHERE part = 0 AND content LIKE '{"table":"encounterActorSnapshots"%'`
            )
            .get()
        expect(tablePages()).toEqual({ pages: 1 })
        await room.transact(async (transaction) => {
          for (let index = 0; index < 3; index++)
            transaction.restoreDocument({
              table: 'encounterActorSnapshots',
              id: `convex:more:${index}`,
              creationTime: 1_790_000_000_000 + index,
              fields: {
                encounterId,
                checksum: sha256Hex(`snapshot:more:${index}`),
                snapshotJson: JSON.stringify({ padding: 'f'.repeat(40_000) })
              }
            })
        })
        room.compact(acknowledgementFor(room))
        expect(Number((tablePages() as { pages: number }).pages)).toBeGreaterThan(1)
        const recovered = new RoomEncounterStore(storage)
        expect(state(recovered)).toEqual(state(room))
        expect(recovered.documents('encounterActorSnapshots')).toHaveLength(3 + 3)
      })
    })
  })

  describe('hydrating a new epoch', () => {
    it('replaces the aggregate, records and log of the previous epoch', async () => {
      const { storage, room, database } = hydrated()
      await command(room, 1)
      room.compact(acknowledgementFor(room))
      await command(room, 2)
      await command(room, 3)
      room.hydrate({ epoch: uuid(0x901), ...aggregate(11) })
      expect(room.epoch).toBe(uuid(0x901))
      expect(room.sequence).toBe(0)
      expect(room.documents('encounterTurnMovements')).toEqual([])
      expect(durableState(database).rows).toEqual([])
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
      expect(() =>
        room.compact({ epoch: uuid(0x900), sequence: 0, checksum: room.checksum })
      ).toThrow('not been hydrated')
    })
  })
})
