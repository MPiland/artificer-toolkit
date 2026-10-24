import { evictDurableObject, runInDurableObject } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'
import { LIVE_SESSION_CHECKPOINT_JOURNAL_MAX_BYTES } from '@artificer-toolkit/schema/api/liveSessionCheckpointJournal'
import { DurableCommandJournal } from '../src/durableCommandJournal.js'
import {
  RoomEncounterStore,
  RoomStoreCorruptError,
  SCENE_EVIDENCE_ROW
} from '../src/roomEncounterStore.js'
import { aggregate, command, encounterId, uuid } from '../src/testing/roomAggregateFixture.js'
import { roomStub } from './roomTeardown.js'

/**
 * The room store on real Durable Object SQLite: the billed row counts come from the storage
 * cursors, and eviction discards every in-memory copy, so a recovered store is rebuilt from rows.
 */

const EPOCH = uuid(0x900)
const stubFor = () => roomStub(`store:${crypto.randomUUID()}`)

function snapshotOf(room: RoomEncounterStore) {
  return {
    epoch: room.epoch,
    sequence: room.sequence,
    checksum: room.checksum,
    runs: room.documents('encounterRuns'),
    actors: room.documents('encounterRunActors'),
    movements: room.documents('encounterTurnMovements'),
    records: room.records('CHARACTER_PLAY_STATE')
  }
}

function durableCommandRows(storage: DurableObjectStorage) {
  return {
    snapshotHead: storage.sql
      .exec('SELECT epoch, sequence, chain, counters FROM room_snapshot_head')
      .toArray(),
    snapshotPages: storage.sql
      .exec(
        'SELECT page, part, part_count, checksum, content FROM room_snapshot_pages ORDER BY page, part'
      )
      .toArray(),
    writes: storage.sql
      .exec('SELECT sequence, json, checksum, chain FROM room_writeset_log ORDER BY sequence')
      .toArray(),
    authority: storage.sql
      .exec(
        `SELECT authority_epoch, state_checksum, state_json, sequence, published_sequence,
              published_checksum, status, drain_final_sequence, drain_final_checksum
       FROM durable_session_authority`
      )
      .toArray(),
    receipts: storage.sql
      .exec(
        `SELECT command_id, actor_id, fingerprint, sequence, state_checksum, receipt_json
       FROM durable_command_receipts ORDER BY sequence`
      )
      .toArray(),
    outbox: storage.sql
      .exec(
        'SELECT sequence, state_checksum, payload_json FROM durable_command_outbox ORDER BY sequence'
      )
      .toArray()
  }
}

describe('room command transaction on Durable Object SQLite', () => {
  it('rolls back state and inserted replay evidence together, retries once, and recovers after eviction', async () => {
    const stub = stubFor()
    const identity = {
      actorId: uuid(0x910),
      commandId: uuid(0x911),
      fingerprint: 'encounter-and-scene-version-2'
    }
    const sceneContent = {
      sceneId: uuid(0x912),
      version: 1,
      fogLayerCount: 0,
      nextFogOrdinal: 0,
      settings: {
        ambientIllumination: { value: 'BRIGHT', daylight: false, version: 0 },
        visionRevealMode: { value: 'ON_DRAG', version: 0 },
        fogMode: { value: 'OFF', version: 0 }
      },
      counts: {
        annotations: 0,
        barriers: 0,
        darknessZones: 0,
        lights: 0,
        tokens: 0,
        measurements: 0
      },
      nextOrdinals: {
        annotations: 0,
        barriers: 0,
        darknessZones: 0,
        lights: 0,
        tokens: 0,
        measurements: 0
      }
    }
    const scene = {
      kind: 'SCENE_CHECKPOINT_ROW',
      key: JSON.stringify(['sceneLiveStates', sceneContent.sceneId]),
      revision: null,
      json: JSON.stringify(sceneContent)
    }
    const nextScene = {
      ...scene,
      json: JSON.stringify({ ...sceneContent, version: 2 })
    }
    const saved = await runInDurableObject(stub, async (_instance, state) => {
      const room = new RoomEncounterStore(state.storage)
      const initial = aggregate(1)
      const journal = new DurableCommandJournal(state.storage)
      const authority = journal.activate({
        authorityEpoch: EPOCH,
        snapshotChecksum: 'a'.repeat(64),
        stateJson: JSON.stringify({ roomSequence: 0 })
      })
      room.hydrate({
        epoch: EPOCH,
        ...initial,
        records: [...initial.records, scene],
        checkpoint: {
          epoch: authority.authorityEpoch,
          sequence: authority.sequence,
          checksum: authority.stateChecksum
        }
      })
      const before = snapshotOf(room)
      const apply = async (abort: boolean) => {
        const current = journal.readCurrent()!
        await room.transact(
          async (transaction) => {
            const run = await room.store
              .query('encounterRuns')
              .withIndex('by_publicId', (q) => q.eq('id', encounterId))
              .unique()
            await room.store.patch(run!._id, { version: run!.version + 1 })
            transaction.setRecord(nextScene)
          },
          (entry) => {
            const result = journal.commitInTransaction({
              ...identity,
              authorityEpoch: EPOCH,
              expectedSequence: current.sequence,
              expectedStateChecksum: current.stateChecksum,
              nextStateChecksum: entry.chainChecksum,
              nextStateJson: JSON.stringify({ roomSequence: entry.sequence }),
              receiptJson: JSON.stringify({ accepted: true, sequence: entry.sequence }),
              outboxPayloadJson: JSON.stringify({ sequence: entry.sequence })
            })
            expect(result.kind).toBe('COMMITTED')
            expect(journal.lookupCommand(identity)).toEqual({
              kind: 'REPLAY',
              receipt: result.receipt
            })
            expect(journal.readCurrent()).toMatchObject({
              sequence: entry.sequence,
              stateChecksum: entry.chainChecksum
            })
            expect(journal.listPending(1)).toHaveLength(1)
            expect(
              state.storage.sql
                .exec<{ count: number }>('SELECT COUNT(*) AS count FROM room_writeset_log')
                .one().count
            ).toBe(1)
            if (abort) throw new Error('Injected failure after receipt insertion.')
            return undefined
          }
        )
      }

      await expect(apply(true)).rejects.toThrow('Injected failure after receipt insertion.')
      expect(snapshotOf(room)).toEqual(before)
      expect(room.record(scene.kind, scene.key)).toEqual(scene)
      expect(journal.readCurrent()).toEqual(authority)
      expect(journal.lookupCommand(identity)).toEqual({ kind: 'MISSING' })
      expect(journal.listPending(1)).toEqual([])
      expect(
        state.storage.sql
          .exec<{ count: number }>(
            `SELECT (SELECT COUNT(*) FROM room_writeset_log)
               + (SELECT COUNT(*) FROM durable_command_receipts)
               + (SELECT COUNT(*) FROM durable_command_outbox) AS count`
          )
          .one().count
      ).toBe(0)
      const restored = new RoomEncounterStore(state.storage)
      restored.assertAuthorityHead({
        epoch: authority.authorityEpoch,
        sequence: authority.sequence,
        checksum: authority.stateChecksum
      })
      expect(snapshotOf(restored)).toEqual(before)
      expect(restored.record(scene.kind, scene.key)).toEqual(scene)

      await apply(false)
      expect(room.sequence).toBe(1)
      expect(room.logRows).toBe(1)
      expect(room.documents('encounterRuns')[0]?.version).toBe(2)
      expect(room.record(scene.kind, scene.key)).toEqual(nextScene)
      const current = journal.readCurrent()!
      expect(current.sequence).toBe(room.sequence)
      expect(current.stateChecksum).toBe(room.checksum)
      const receipt = journal.lookupCommand(identity)
      expect(receipt).toMatchObject({
        kind: 'REPLAY',
        receipt: { sequence: 1, stateChecksum: room.checksum }
      })
      const committed = snapshotOf(room)
      const outbox = journal.listPending(1)
      const replay = journal.commit({
        ...identity,
        authorityEpoch: EPOCH,
        expectedSequence: current.sequence,
        expectedStateChecksum: current.stateChecksum,
        nextStateChecksum: current.stateChecksum,
        nextStateJson: current.stateJson,
        receiptJson: '{}',
        outboxPayloadJson: '{}'
      })
      expect(replay).toEqual(receipt)
      expect(snapshotOf(room)).toEqual(committed)
      expect(journal.readCurrent()).toEqual(current)
      expect(journal.listPending(1)).toEqual(outbox)
      return { room: committed, authority: current, receipt, outbox }
    })

    await evictDurableObject(stub)
    await runInDurableObject(stub, (_instance, state) => {
      const room = new RoomEncounterStore(state.storage)
      const journal = new DurableCommandJournal(state.storage)
      const current = journal.readCurrent()!
      room.assertAuthorityHead({
        epoch: current.authorityEpoch,
        sequence: current.sequence,
        checksum: current.stateChecksum
      })
      expect(room.corruption).toBeNull()
      expect(snapshotOf(room)).toEqual(saved.room)
      expect(room.record(scene.kind, scene.key)).toEqual(nextScene)
      expect(room.logRows).toBe(1)
      expect(journal.readCurrent()).toEqual(saved.authority)
      expect(journal.lookupCommand(identity)).toEqual(saved.receipt)
      expect(journal.listPending(1)).toEqual(saved.outbox)
    })
  })

  it('commits one sequence and an empty write set above an existing authority checkpoint', async () => {
    const stub = stubFor()
    const identity = {
      actorId: uuid(0x920),
      commandId: uuid(0x921),
      fingerprint: 'receipt-only'
    }
    const saved = await runInDurableObject(stub, async (_instance, state) => {
      const room = new RoomEncounterStore(state.storage)
      const journal = new DurableCommandJournal(state.storage)
      const initial = journal.activate({
        authorityEpoch: EPOCH,
        snapshotChecksum: 'b'.repeat(64),
        stateJson: JSON.stringify({ roomSequence: 0 })
      })
      expect(
        journal.commit({
          actorId: identity.actorId,
          commandId: uuid(0x922),
          fingerprint: 'existing-authority-command',
          authorityEpoch: EPOCH,
          expectedSequence: initial.sequence,
          expectedStateChecksum: initial.stateChecksum,
          nextStateChecksum: 'd'.repeat(64),
          nextStateJson: JSON.stringify({ roomSequence: 1 }),
          receiptJson: JSON.stringify({ accepted: true, sequence: 1 }),
          outboxPayloadJson: JSON.stringify({ sequence: 1 })
        }).kind
      ).toBe('COMMITTED')
      const current = journal.acknowledge({
        authorityEpoch: EPOCH,
        throughSequence: 1,
        stateChecksum: 'd'.repeat(64)
      })
      room.hydrate({
        epoch: EPOCH,
        ...aggregate(1),
        checkpoint: {
          epoch: current.authorityEpoch,
          sequence: current.sequence,
          checksum: current.stateChecksum
        }
      })
      const before = snapshotOf(room)
      let callbacks = 0
      await room.transact(
        async () => undefined,
        (entry) => {
          callbacks++
          expect(entry.sequence).toBe(2)
          expect(entry.writeSetJson).toBe('[]')
          expect(
            journal.commitInTransaction({
              ...identity,
              authorityEpoch: EPOCH,
              expectedSequence: current.sequence,
              expectedStateChecksum: current.stateChecksum,
              nextStateChecksum: entry.chainChecksum,
              nextStateJson: JSON.stringify({ roomSequence: entry.sequence }),
              receiptJson: JSON.stringify({ accepted: true, sequence: entry.sequence }),
              outboxPayloadJson: JSON.stringify({ sequence: entry.sequence })
            }).kind
          ).toBe('COMMITTED')
          return undefined
        }
      )
      expect(callbacks).toBe(1)
      expect(room.logRows).toBe(1)
      expect(room.checksum).not.toBe(before.checksum)
      expect(snapshotOf(room)).toEqual({ ...before, sequence: 2, checksum: room.checksum })
      const log = room.committedWriteSets({
        epoch: EPOCH,
        fromSequence: 1,
        fromChecksum: before.checksum,
        toSequence: 2,
        maxEntries: 1,
        maxBytes: 1024
      })
      expect(log.entries).toHaveLength(1)
      expect(log.entries[0]).toMatchObject({
        sequence: 2,
        writeSetJson: '[]',
        chainChecksum: room.checksum
      })
      expect(journal.readCurrent()).toMatchObject({ sequence: 2, stateChecksum: room.checksum })
      expect(journal.lookupCommand(identity)).toMatchObject({
        kind: 'REPLAY',
        receipt: { sequence: 2, stateChecksum: room.checksum }
      })
      expect(journal.listPending(1)).toMatchObject([{ sequence: 2, stateChecksum: room.checksum }])
      return { room: snapshotOf(room), receipt: journal.lookupCommand(identity) }
    })
    await evictDurableObject(stub)
    await runInDurableObject(stub, (_instance, state) => {
      const room = new RoomEncounterStore(state.storage)
      const journal = new DurableCommandJournal(state.storage)
      const current = journal.readCurrent()!
      room.assertAuthorityHead({
        epoch: current.authorityEpoch,
        sequence: current.sequence,
        checksum: current.stateChecksum
      })
      expect(room.corruption).toBeNull()
      expect(snapshotOf(room)).toEqual(saved.room)
      expect(journal.readCurrent()).toMatchObject({
        sequence: 2,
        stateChecksum: room.checksum
      })
      expect(journal.lookupCommand(identity)).toEqual(saved.receipt)
    })
  })

  it.each(['terminal log deletion', 'authority checksum mismatch'])(
    'fails closed after %s without altering retained SQLite evidence',
    async (damage) => {
      const stub = stubFor()
      const saved = await runInDurableObject(stub, async (_instance, state) => {
        const journal = new DurableCommandJournal(state.storage)
        const authority = journal.activate({
          authorityEpoch: EPOCH,
          snapshotChecksum: 'c'.repeat(64),
          stateJson: JSON.stringify({ roomSequence: 0 })
        })
        const room = new RoomEncounterStore(state.storage)
        room.hydrate({
          epoch: EPOCH,
          ...aggregate(1),
          checkpoint: {
            epoch: authority.authorityEpoch,
            sequence: authority.sequence,
            checksum: authority.stateChecksum
          }
        })
        for (let ordinal = 1; ordinal <= 2; ordinal++) {
          const current = journal.readCurrent()!
          await room.transact(
            async () => {
              const run = await room.store
                .query('encounterRuns')
                .withIndex('by_publicId', (q) => q.eq('id', encounterId))
                .unique()
              await room.store.patch(run!._id, { version: run!.version + 1 })
            },
            (entry) => {
              journal.commitInTransaction({
                actorId: uuid(0x930),
                commandId: uuid(0x930 + ordinal),
                fingerprint: `run-version-${ordinal + 1}`,
                authorityEpoch: current.authorityEpoch,
                expectedSequence: current.sequence,
                expectedStateChecksum: current.stateChecksum,
                nextStateChecksum: entry.chainChecksum,
                nextStateJson: JSON.stringify({ roomSequence: entry.sequence }),
                receiptJson: JSON.stringify({ accepted: true, sequence: entry.sequence }),
                outboxPayloadJson: JSON.stringify({ sequence: entry.sequence })
              })
              return undefined
            }
          )
        }
        const current = journal.readCurrent()!
        room.assertAuthorityHead({
          epoch: current.authorityEpoch,
          sequence: current.sequence,
          checksum: current.stateChecksum
        })
        if (damage === 'terminal log deletion')
          state.storage.sql.exec('DELETE FROM room_writeset_log WHERE sequence = ?', 2)
        else
          state.storage.sql.exec(
            'UPDATE durable_session_authority SET state_checksum = ? WHERE id = 1',
            'f'.repeat(64)
          )
        const evidence = durableCommandRows(state.storage)
        expect(evidence.writes).toHaveLength(damage === 'terminal log deletion' ? 1 : 2)
        expect(evidence.receipts).toHaveLength(2)
        expect(evidence.outbox).toHaveLength(2)
        return evidence
      })
      await evictDurableObject(stub)
      await runInDurableObject(stub, (_instance, state) => {
        const room = new RoomEncounterStore(state.storage)
        const journal = new DurableCommandJournal(state.storage)
        const current = journal.readCurrent()!
        expect(room.corruption).toBeNull()
        expect(room.sequence).toBe(damage === 'terminal log deletion' ? 1 : 2)
        expect(room.documents('encounterRuns')[0]?.version).toBe(
          damage === 'terminal log deletion' ? 2 : 3
        )
        expect(current.sequence).toBe(2)
        expect(() =>
          room.assertAuthorityHead({
            epoch: current.authorityEpoch,
            sequence: current.sequence,
            checksum: current.stateChecksum
          })
        ).toThrow(RoomStoreCorruptError)
        expect(room.corruption).toBeInstanceOf(RoomStoreCorruptError)
        expect(room.epoch).toBeNull()
        expect(room.documents('encounterRuns')).toEqual([])
        expect(room.documents('encounterRunActors')).toEqual([])
        expect(room.records('CHARACTER_PLAY_STATE')).toEqual([])
        expect(() => room.checkpointSnapshot()).toThrow(RoomStoreCorruptError)
        expect(durableCommandRows(state.storage)).toEqual(saved)
      })
    }
  )
})

describe.each([11, 100])('room store on Durable Object SQLite, %i actors', (actorCount) => {
  it('reads committed prefixes without writes and preserves the snapshot fence through eviction', async () => {
    const stub = stubFor()
    const saved = await runInDurableObject(stub, async (_instance, state) => {
      const room = new RoomEncounterStore(state.storage)
      room.hydrate({ epoch: EPOCH, ...aggregate(actorCount) })
      const input = {
        epoch: EPOCH,
        fromSequence: 0,
        fromChecksum: room.checksum,
        toSequence: 3,
        maxEntries: 100,
        maxBytes: LIVE_SESSION_CHECKPOINT_JOURNAL_MAX_BYTES
      }
      for (let ordinal = 1; ordinal <= 3; ordinal++) await command(room, ordinal)
      const before = room.usage.rowsWritten
      const all = room.committedWriteSets(input)
      expect(room.committedWriteSets(input)).toEqual(all)
      const bytes = new TextEncoder().encode(JSON.stringify(all.entries.slice(0, 2))).byteLength
      const page = room.committedWriteSets({ ...input, maxBytes: bytes })
      expect(page.entries.map((entry) => entry.sequence)).toEqual([1, 2])
      expect(page.complete).toBe(false)
      const end = room.committedWriteSets({
        ...input,
        fromSequence: page.toSequence,
        fromChecksum: page.toChecksum,
        maxEntries: 1
      })
      expect(end.entries.map((entry) => entry.sequence)).toEqual([3])
      expect(end.complete).toBe(true)
      expect(end.toChecksum).toBe(room.checksum)
      await room.transact(async () => {
        expect(() => room.committedWriteSets(input)).toThrow('already running')
      })
      expect(room.usage.rowsWritten).toBe(before)
      room.compact({ epoch: EPOCH, sequence: room.sequence, checksum: room.checksum })
      expect(() => room.committedWriteSets(input)).toThrow('compacted')
      return { input, checksum: room.checksum }
    })
    await evictDurableObject(stub)
    await runInDurableObject(stub, async (_instance, state) => {
      const room = new RoomEncounterStore(state.storage)
      expect(() => room.committedWriteSets(saved.input)).toThrow('compacted')
      await command(room, 4)
      const result = room.committedWriteSets({
        ...saved.input,
        fromSequence: 3,
        fromChecksum: saved.checksum,
        toSequence: 4
      })
      expect(result.entries.map((entry) => entry.sequence)).toEqual([4])
      expect(result.toChecksum).toBe(room.checksum)
      expect(result.complete).toBe(true)
    })
  })

  it('writes one row per command and none for a command that changes nothing', async () => {
    const stub = stubFor()
    const written = await runInDurableObject(stub, async (_instance, state) => {
      const room = new RoomEncounterStore(state.storage)
      room.hydrate({ epoch: EPOCH, ...aggregate(actorCount) })
      const perCommand: number[] = []
      for (let ordinal = 1; ordinal <= 6; ordinal++) {
        const before = room.usage.rowsWritten
        await command(room, ordinal)
        perCommand.push(room.usage.rowsWritten - before)
      }
      const before = room.usage.rowsWritten
      await room.transact(async () => undefined)
      return { perCommand, empty: room.usage.rowsWritten - before }
    })
    expect(written.perCommand).toEqual([1, 1, 1, 1, 1, 1])
    expect(written.empty).toBe(0)
  })

  it('rebuilds the same aggregate and checksum after eviction, then keeps going', async () => {
    const stub = stubFor()
    const before = await runInDurableObject(stub, async (_instance, state) => {
      const room = new RoomEncounterStore(state.storage)
      room.hydrate({ epoch: EPOCH, ...aggregate(actorCount) })
      for (let ordinal = 1; ordinal <= 12; ordinal++) await command(room, ordinal)
      return snapshotOf(room)
    })
    await evictDurableObject(stub)
    const after = await runInDurableObject(stub, async (_instance, state) => {
      const room = new RoomEncounterStore(state.storage)
      const rebuilt = snapshotOf(room)
      const rowsRead = room.usage.rowsRead
      await command(room, 13)
      return { rebuilt, rowsRead, next: room.sequence, corruption: room.corruption }
    })
    expect(after.rebuilt).toEqual(before)
    expect(after.corruption).toBeNull()
    expect(after.next).toBe(13)
    // The snapshot head and page parts plus 12 log rows, never a scan of anything else.
    expect(after.rowsRead).toBeLessThan(actorCount + 20)
  })

  it.each([1, 2, 3])(
    'retains corrupt log row %i and fails closed after eviction',
    async (sequence) => {
      const stub = stubFor()
      const persisted = await runInDurableObject(stub, async (_instance, state) => {
        const room = new RoomEncounterStore(state.storage)
        room.hydrate({ epoch: EPOCH, ...aggregate(actorCount) })
        for (let ordinal = 1; ordinal <= 3; ordinal++) await command(room, ordinal)
        state.storage.sql.exec(
          "UPDATE room_writeset_log SET json = '[]' WHERE sequence = ?",
          sequence
        )
        return state.storage.sql.exec('SELECT * FROM room_writeset_log ORDER BY sequence').toArray()
      })
      await evictDurableObject(stub)
      await runInDurableObject(stub, (_instance, state) => {
        const room = new RoomEncounterStore(state.storage)
        expect(room.corruption).toBeInstanceOf(RoomStoreCorruptError)
        expect(room.epoch).toBeNull()
        expect(room.documents('encounterRuns')).toEqual([])
        expect(() => room.checkpointSnapshot()).toThrow(RoomStoreCorruptError)
        expect(
          state.storage.sql.exec('SELECT * FROM room_writeset_log ORDER BY sequence').toArray()
        ).toEqual(persisted)
      })
    }
  )

  it('compacts to the same state in a bounded number of rows', async () => {
    const stub = stubFor()
    const outcome = await runInDurableObject(stub, async (_instance, state) => {
      const room = new RoomEncounterStore(state.storage)
      room.hydrate({ epoch: EPOCH, ...aggregate(actorCount) })
      for (let ordinal = 1; ordinal <= 40; ordinal++) await command(room, ordinal)
      const before = snapshotOf(room)
      const rowsBefore = room.usage.rowsWritten
      room.compact({ epoch: EPOCH, sequence: room.sequence, checksum: room.checksum })
      return { before, compactionRows: room.usage.rowsWritten - rowsBefore, logRows: room.logRows }
    })
    expect(outcome.logRows).toBe(0)
    // The touched pages' old and new parts, the head and the 40 folded log rows.
    expect(outcome.compactionRows).toBeLessThan(2 * actorCount + 60)
    await evictDurableObject(stub)
    const after = await runInDurableObject(stub, (_instance, state) =>
      snapshotOf(new RoomEncounterStore(state.storage))
    )
    expect(after).toEqual(outcome.before)
  })

  it('retains commands after the acknowledged checkpoint through eviction', async () => {
    const stub = stubFor()
    const saved = await runInDurableObject(stub, async (_instance, state) => {
      const room = new RoomEncounterStore(state.storage)
      room.hydrate({ epoch: EPOCH, ...aggregate(actorCount) })
      await command(room, 1)
      const acknowledged = { epoch: EPOCH, sequence: room.sequence, checksum: room.checksum }
      const records = room.records('CHARACTER_PLAY_STATE')
      await command(room, 2)
      await command(room, 3)
      const current = snapshotOf(room)
      room.compact(acknowledged)
      expect(snapshotOf(room)).toEqual(current)
      expect(room.logRows).toBe(2)
      expect(room.checkpointSnapshot()).toMatchObject({ ...acknowledged, records })
      const written = room.usage.rowsWritten
      room.compact(acknowledged)
      expect(room.usage.rowsWritten).toBe(written)
      return current
    })
    await evictDurableObject(stub)
    const after = await runInDurableObject(stub, async (_instance, state) => {
      const room = new RoomEncounterStore(state.storage)
      expect(snapshotOf(room)).toEqual(saved)
      expect(room.logRows).toBe(2)
      await command(room, 4)
      const current = snapshotOf(room)
      room.compact({ epoch: EPOCH, sequence: room.sequence, checksum: room.checksum })
      expect(room.logRows).toBe(0)
      return current
    })
    await evictDurableObject(stub)
    await runInDurableObject(stub, (_instance, state) => {
      expect(snapshotOf(new RoomEncounterStore(state.storage))).toEqual(after)
    })
  })

  it('counts the unsaved chat entries as the log grows and shrinks, and again after eviction (Amendment 25)', async () => {
    const stub = stubFor()
    const chat = (room: RoomEncounterStore, ordinal: number) =>
      room.transact(async () => {
        await room.store.insert('campaignConversationEntries', {
          id: uuid(0x900 + ordinal),
          campaignId: uuid(2),
          conversationId: uuid(0x800),
          authorUserId: uuid(0x801),
          createdAt: '2026-09-01T00:00:00.000Z',
          clientNonce: uuid(0xa00 + ordinal),
          kind: 'CHAT',
          rollNonceFingerprint: null
        })
      })
    await runInDurableObject(stub, async (_instance, state) => {
      const room = new RoomEncounterStore(state.storage)
      room.hydrate({ epoch: EPOCH, ...aggregate(actorCount) })
      expect(room.unsavedChatEntries).toBe(0)
      await chat(room, 1)
      const acknowledged = { epoch: EPOCH, sequence: room.sequence, checksum: room.checksum }
      await command(room, 1)
      await chat(room, 2)
      await chat(room, 3)
      expect(room.unsavedChatEntries).toBe(3)
      room.compact(acknowledged)
      expect(room.logRows).toBe(3)
      expect(room.unsavedChatEntries).toBe(2)
    })
    await evictDurableObject(stub)
    await runInDurableObject(stub, (_instance, state) => {
      const room = new RoomEncounterStore(state.storage)
      expect(room.unsavedChatEntries).toBe(2)
      room.compact({ epoch: EPOCH, sequence: room.sequence, checksum: room.checksum })
      expect(room.unsavedChatEntries).toBe(0)
    })
  })

  it('does not count commands or Scene command evidence as unsaved chat entries (Amendment 26)', async () => {
    const stub = stubFor()
    await runInDurableObject(stub, async (_instance, state) => {
      const room = new RoomEncounterStore(state.storage)
      room.hydrate({ epoch: EPOCH, ...aggregate(actorCount) })
      await command(room, 1)
      await room.transact(async (transaction) => {
        transaction.setRecord({
          kind: SCENE_EVIDENCE_ROW,
          key: JSON.stringify(['sceneLiveCommands', uuid(1), uuid(2)]),
          revision: String(Date.now()),
          json: JSON.stringify({ padding: 'x'.repeat(5_000) })
        })
      })
      expect(room.unsavedChatEntries).toBe(0)
      expect(room.records(SCENE_EVIDENCE_ROW)).toHaveLength(1)
    })
    await evictDurableObject(stub)
    await runInDurableObject(stub, (_instance, state) => {
      const room = new RoomEncounterStore(state.storage)
      expect(room.unsavedChatEntries).toBe(0)
      expect(room.records(SCENE_EVIDENCE_ROW)).toHaveLength(1)
    })
  })
})
