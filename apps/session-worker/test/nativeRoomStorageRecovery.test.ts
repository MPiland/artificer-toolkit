import { evictDurableObject, runInDurableObject } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { expect, it, vi } from 'vitest'
import { sha256Hex } from '@artificer-toolkit/shared/sha256'
import { DurableCommandJournal, DurableCommandJournalError } from '../src/durableCommandJournal.js'
import { RoomCheckpoints } from '../src/roomCheckpoints.js'
import { RoomEncounterStore, RoomStoreCorruptError } from '../src/roomEncounterStore.js'
import { aggregate, encounterId, uuid } from '../src/testing/roomAggregateFixture.js'

const OLD_EPOCH = uuid(0xa10)
const NEW_EPOCH = uuid(0xa11)
const TABLES = [
  'room_snapshot_head',
  'room_snapshot_pages',
  'room_writeset_log',
  'durable_session_authority',
  'durable_command_receipts',
  'durable_command_outbox',
  'durable_command_json_chunks',
  'room_pending_checkpoint',
  'room_pending_checkpoint_chunks'
] as const

function rowCounts(storage: DurableObjectStorage) {
  return TABLES.map((table) => ({
    table,
    count: storage.sql
      .exec<{ count: number }>(`SELECT COUNT(*) AS count FROM ${table}`)
      .toArray()[0]!.count
  }))
}

it('replaces a fenced corrupt snapshot and clears its journal and pending upload atomically, surviving eviction', async () => {
  const stub = env.LIVE_SESSION_ROOMS.get(
    env.LIVE_SESSION_ROOMS.idFromName(`storage-recovery:${crypto.randomUUID()}`)
  )
  const recoveredChecksum = await runInDurableObject(stub, async (_instance, state) => {
    const { storage } = state
    const store = new RoomEncounterStore(storage)
    store.hydrate({ epoch: OLD_EPOCH, ...aggregate(1) })
    const journal = new DurableCommandJournal(storage)
    const sceneJson = JSON.stringify({ padding: 's'.repeat(300_000) })
    const current = journal.activate({
      authorityEpoch: OLD_EPOCH,
      snapshotChecksum: store.checksum,
      stateJson: sceneJson
    })
    await store.transact(
      async () => {
        const run = await store.store
          .query('encounterRuns')
          .withIndex('by_publicId', (q) => q.eq('id', encounterId))
          .unique()
        if (!run) throw new Error('Missing Run fixture.')
        const stateJson = JSON.stringify({ command: 1 })
        await store.store.patch(run._id, {
          version: run.version + 1,
          stateJson,
          stateChecksum: sha256Hex(stateJson)
        })
      },
      (entry) => {
        journal.commitInTransaction({
          actorId: uuid(0xa12),
          authorityEpoch: OLD_EPOCH,
          commandId: uuid(0xa13),
          expectedSequence: current.sequence,
          expectedStateChecksum: current.stateChecksum,
          fingerprint: 'storage-recovery-command',
          nextStateChecksum: entry.chainChecksum,
          nextStateJson: sceneJson,
          outboxPayloadJson: JSON.stringify({ sequence: entry.sequence }),
          receiptJson: JSON.stringify({ accepted: true })
        })
        return undefined
      }
    )
    const publish = vi.fn(async () => {
      await Promise.resolve()
      expect(() =>
        storage.transactionSync(() => checkpoints.discardFencedCheckpointInTransaction())
      ).toThrow('The old checkpoint is still publishing.')
      throw new Error('Checkpoint upload interrupted.')
    })
    const checkpoints = new RoomCheckpoints(store, storage, publish)
    await expect(
      checkpoints.flush(
        {
          campaignId: uuid(2),
          epoch: OLD_EPOCH,
          knownAuthorization: null
        },
        'BACKLOG'
      )
    ).rejects.toThrow('Checkpoint upload interrupted.')
    expect(publish).toHaveBeenCalledOnce()
    for (const { table, count } of rowCounts(storage)) {
      expect(count, table).toBeGreaterThan(0)
    }

    storage.sql.exec("UPDATE room_snapshot_pages SET content = 'corrupt snapshot'")
    storage.sql.exec("UPDATE durable_session_authority SET state_json = 'corrupt journal'")
    const corrupt = new RoomEncounterStore(storage)
    const recoveredJournal = new DurableCommandJournal(storage)
    const recoveredCheckpoints = new RoomCheckpoints(corrupt, storage, publish)
    expect(corrupt.corruption).toBeInstanceOf(RoomStoreCorruptError)
    expect(corrupt.epoch).toBeNull()
    expect(recoveredJournal.authorityEpoch).toBe(OLD_EPOCH)
    expect(() => recoveredJournal.readCurrent()).toThrow(DurableCommandJournalError)
    const retained = {
      counts: rowCounts(storage),
      snapshot: storage.sql
        .exec(
          'SELECT page, part, part_count, checksum, content FROM room_snapshot_pages ORDER BY page, part'
        )
        .toArray(),
      authority: storage.sql
        .exec(
          'SELECT authority_epoch, state_checksum, state_json, sequence FROM durable_session_authority'
        )
        .toArray()
    }
    // The backend fence must complete outside, and before, the local replacement transaction.
    const fenceOldAuthority = vi.fn(async (epoch: string) => {
      expect(epoch).toBe(OLD_EPOCH)
      expect(rowCounts(storage)).toEqual(retained.counts)
    })
    await fenceOldAuthority(recoveredJournal.authorityEpoch!)
    expect(fenceOldAuthority).toHaveBeenCalledOnce()
    expect(() =>
      storage.transactionSync(() => recoveredJournal.discardFencedAuthorityInTransaction(NEW_EPOCH))
    ).toThrow('recovered authority epoch is stale')

    const discardOld = () => {
      recoveredJournal.discardFencedAuthorityInTransaction(OLD_EPOCH)
      recoveredCheckpoints.discardFencedCheckpointInTransaction()
      return undefined
    }
    expect(() =>
      corrupt.hydrate({
        epoch: NEW_EPOCH,
        documents: [],
        records: [],
        commitDurable: () => {
          discardOld()
          throw new Error('Recovery cleanup interrupted.')
        }
      })
    ).toThrow('Recovery cleanup interrupted.')
    expect(corrupt.corruption).toBeInstanceOf(RoomStoreCorruptError)
    expect(corrupt.epoch).toBeNull()
    expect({
      counts: rowCounts(storage),
      snapshot: storage.sql
        .exec(
          'SELECT page, part, part_count, checksum, content FROM room_snapshot_pages ORDER BY page, part'
        )
        .toArray(),
      authority: storage.sql
        .exec(
          'SELECT authority_epoch, state_checksum, state_json, sequence FROM durable_session_authority'
        )
        .toArray()
    }).toEqual(retained)
    expect(new RoomEncounterStore(storage).corruption).toBeInstanceOf(RoomStoreCorruptError)
    expect(recoveredJournal.authorityEpoch).toBe(OLD_EPOCH)

    corrupt.hydrate({ epoch: NEW_EPOCH, documents: [], records: [], commitDurable: discardOld })
    expect(corrupt.corruption).toBeNull()
    expect(corrupt.epoch).toBe(NEW_EPOCH)
    expect(corrupt.sequence).toBe(0)
    expect(corrupt.logRows).toBe(0)
    expect(corrupt.checkpointSnapshot()).toMatchObject({
      epoch: NEW_EPOCH,
      sequence: 0,
      documents: [],
      records: []
    })
    const [head] = storage.sql
      .exec<{ chain: string; counters: string }>('SELECT chain, counters FROM room_snapshot_head')
      .toArray()
    // The genesis chain hashes the canonical full content, here an empty aggregate.
    const emptyContent = JSON.stringify({
      counters: JSON.parse(head!.counters),
      documents: {},
      records: []
    })
    expect(corrupt.checksum).toBe(sha256Hex(`room-store:genesis:${sha256Hex(emptyContent)}`))
    expect(head!.chain).toBe(corrupt.checksum)
    expect(rowCounts(storage)).toEqual(
      TABLES.map((table) => ({
        table,
        count: table === 'room_snapshot_head' ? 1 : 0
      }))
    )
    expect(recoveredJournal.authorityEpoch).toBeNull()
    expect(recoveredJournal.readCurrent()).toBeNull()
    return corrupt.checksum
  })

  await evictDurableObject(stub)
  await runInDurableObject(stub, async (_instance, state) => {
    const store = new RoomEncounterStore(state.storage)
    const journal = new DurableCommandJournal(state.storage)
    const publish = vi.fn(async () => {
      throw new Error('Unexpected old checkpoint retry.')
    })
    const checkpoints = new RoomCheckpoints(store, state.storage, publish)
    expect(store.corruption).toBeNull()
    expect(store.epoch).toBe(NEW_EPOCH)
    expect(store.sequence).toBe(0)
    expect(store.checksum).toBe(recoveredChecksum)
    expect(store.checkpointSnapshot()).toMatchObject({ documents: [], records: [] })
    expect(journal.authorityEpoch).toBeNull()
    expect(journal.readCurrent()).toBeNull()
    expect(
      await checkpoints.flush(
        {
          campaignId: uuid(2),
          epoch: NEW_EPOCH,
          knownAuthorization: null
        },
        'BACKLOG'
      )
    ).toBeNull()
    expect(publish).not.toHaveBeenCalled()
  })
})
