import { afterEach, describe, expect, it, vi } from 'vitest'
import type {
  LiveSessionCheckpointInput,
  LiveSessionCheckpointResponse
} from '@artificer-toolkit/schema/api/liveSessionCheckpoint'
import { LIVE_SESSION_CHECKPOINT_MAX_BYTES } from '@artificer-toolkit/schema/api/liveSessionCheckpointFence'
import { LIVE_SESSION_CHECKPOINT_JOURNAL_MAX_BYTES } from '@artificer-toolkit/schema/api/liveSessionCheckpointJournal'
import { MAX_ROOM_INPUT_RESPONSE_DOCUMENTS } from '@artificer-toolkit/schema/api/liveRoomInputsBatch'
import { canonicalizeJson } from '@artificer-toolkit/shared/canonicalJson'
import { JSON_PAYLOAD_CHUNK_MAX_BYTES } from '@artificer-toolkit/shared/jsonPayloadChunks'
import { sha256Hex } from '@artificer-toolkit/shared/sha256'
import { RoomCheckpoints } from './roomCheckpoints.js'
import { RoomEncounterStore } from './roomEncounterStore.js'
import { buildRoomCheckpointRecords } from './roomCheckpointRecords.js'
import { aggregate, command, encounterId, uuid } from './testing/roomAggregateFixture.js'
import { createNodeSqliteRoomStorage } from './testing/nodeSqliteRoomStorage.js'
import { NO_CHECKPOINT_IO } from '../test/checkpointIoFixture.js'
import { roomAuthorizationResponse } from '../test/roomAuthorizationFixture.js'

const EPOCH = uuid(0x900)
const CAMPAIGN = uuid(2)
const scope = { campaignId: CAMPAIGN, epoch: EPOCH, knownAuthorization: null }
const databases: ReturnType<typeof createNodeSqliteRoomStorage>['database'][] = []
afterEach(() => {
  for (const database of databases.splice(0)) database.close()
})

function open(actorCount = 2) {
  const opened = createNodeSqliteRoomStorage()
  databases.push(opened.database)
  const store = new RoomEncounterStore(opened.storage)
  store.hydrate({ epoch: EPOCH, ...aggregate(actorCount) })
  return { ...opened, store }
}

function response(input: LiveSessionCheckpointInput): LiveSessionCheckpointResponse {
  return {
    status: 'COMMITTED',
    authority: {
      campaignId: input.campaignId,
      epoch: input.epoch,
      phase: 'DO_ACTIVE',
      activationFingerprint: sha256Hex('activation'),
      persistedSequence: input.sequence,
      persistedStateChecksum: input.checksum,
      createdAt: '2026-09-30T00:00:00.000Z',
      updatedAt: '2026-09-30T00:00:00.000Z'
    },
    adopted: { characters: [] },
    io: NO_CHECKPOINT_IO
  }
}

describe('room checkpoints', () => {
  it('returns null without creating a pending checkpoint when no writes are unacknowledged', async () => {
    const { store, storage } = open()
    const publish =
      vi.fn<(input: LiveSessionCheckpointInput) => Promise<LiveSessionCheckpointResponse>>()
    const checkpoints = new RoomCheckpoints(store, storage, publish)
    expect(await checkpoints.flush(scope, 'BACKLOG')).toBeNull()
    expect(publish).not.toHaveBeenCalled()
    expect(storage.sql.exec('SELECT * FROM room_pending_checkpoint').toArray()).toEqual([])
    expect(storage.sql.exec('SELECT * FROM room_pending_checkpoint_chunks').toArray()).toEqual([])
  })

  it('retries the exact checkpoint identity, payload and authorization after publication failure and reconstruction', async () => {
    const { store, storage } = open()
    await command(store, 1)
    const before = store.checkpointSnapshot()
    const inputs: LiveSessionCheckpointInput[] = []
    const knownAuthorization = roomAuthorizationResponse({ members: [] }).revisions
    const failed = new RoomCheckpoints(store, storage, async (input) => {
      inputs.push(structuredClone(input))
      input.checkpointId = uuid(0x999)
      throw new Error('Publication unavailable.')
    })
    await expect(failed.flush({ ...scope, knownAuthorization }, 'BACKLOG')).rejects.toThrow(
      'Publication unavailable.'
    )
    expect(store.checkpointSnapshot()).toEqual(before)
    expect(store.logRows).toBe(1)

    const restarted = new RoomEncounterStore(storage)
    const checkpoints = new RoomCheckpoints(restarted, storage, async (input) => {
      inputs.push(structuredClone(input))
      return { ...response(input), status: 'REPLAYED' }
    })
    const result = await checkpoints.flush(scope, 'BACKLOG')
    expect(inputs).toHaveLength(2)
    expect(inputs[1]).toEqual(inputs[0])
    expect(inputs[1]!.knownAuthorization).toEqual(knownAuthorization)
    expect(result?.status).toBe('REPLAYED')
    expect(restarted.checkpointSnapshot()).toMatchObject({
      sequence: 1,
      checksum: inputs[0]!.checksum
    })
    expect(restarted.logRows).toBe(0)
    expect(storage.sql.exec('SELECT * FROM room_pending_checkpoint').toArray()).toEqual([])
  })

  it('compacts only the selected prefix and leaves a concurrent suffix for the next flush', async () => {
    const { store, storage } = open()
    await command(store, 1)
    const inputs: LiveSessionCheckpointInput[] = []
    const checkpoints = new RoomCheckpoints(store, storage, async (input) => {
      inputs.push(input)
      if (inputs.length === 1) await command(store, 2)
      return response(input)
    })
    await checkpoints.flush(scope, 'BACKLOG')
    expect(inputs).toHaveLength(1)
    expect(inputs[0]!.sequence).toBe(1)
    expect(store.sequence).toBe(2)
    expect(store.logRows).toBe(1)
    expect(store.checkpointSnapshot()).toMatchObject({ sequence: 1, checksum: inputs[0]!.checksum })
    const restarted = new RoomEncounterStore(storage)
    expect(restarted.sequence).toBe(2)
    expect(restarted.logRows).toBe(1)

    await checkpoints.flush(scope, 'BACKLOG')
    expect(inputs).toHaveLength(2)
    expect(inputs[1]).toMatchObject({
      fromSequence: 1,
      fromChecksum: inputs[0]!.checksum,
      sequence: 2
    })
    expect(store.logRows).toBe(0)
  })

  it('waits for a command transaction held across a read before preparing or compacting', async () => {
    const { store, storage } = open()
    await command(store, 1)
    let release: (() => void) | undefined
    const read = new Promise<void>((resolve) => {
      release = resolve
    })
    let running: Promise<void> | undefined
    const inputs: LiveSessionCheckpointInput[] = []
    const checkpoints = new RoomCheckpoints(store, storage, async (input) => {
      inputs.push(input)
      // The acknowledgement arrives while a command waits on a read inside its transaction.
      if (inputs.length === 1) running = store.transact(() => read)
      return response(input)
    })
    const flushed = checkpoints.flush(scope, 'BACKLOG')
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(store.logRows).toBe(1)
    release!()
    await running
    await flushed
    expect(store.checkpointSnapshot()).toMatchObject({ sequence: 1, checksum: inputs[0]!.checksum })
    expect(store.logRows).toBe(0)

    await command(store, 2)
    let releaseSecond: (() => void) | undefined
    const opened = store.transact(
      () =>
        new Promise<void>((resolve) => {
          releaseSecond = resolve
        })
    )
    const second = checkpoints.flush(scope, 'BACKLOG')
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(inputs).toHaveLength(1)
    releaseSecond!()
    await opened
    await second
    expect(inputs).toHaveLength(2)
    expect(store.logRows).toBe(0)
  })

  it.each(['campaignId', 'epoch', 'persistedSequence', 'persistedStateChecksum'] as const)(
    'retains pending evidence when the response %s does not match',
    async (field) => {
      const { store, storage } = open()
      await command(store, 1)
      const before = store.checkpointSnapshot()
      const inputs: LiveSessionCheckpointInput[] = []
      const checkpoints = new RoomCheckpoints(store, storage, async (input) => {
        inputs.push(input)
        const result = response(input)
        if (inputs.length === 1) {
          if (field === 'persistedSequence') result.authority[field] += 1
          else if (field === 'persistedStateChecksum')
            result.authority[field] = sha256Hex('different')
          else result.authority[field] = uuid(0x999)
        }
        return result
      })
      await expect(checkpoints.flush(scope, 'BACKLOG')).rejects.toThrow('exact committed prefix')
      expect(store.checkpointSnapshot()).toEqual(before)
      expect(store.logRows).toBe(1)
      expect(storage.sql.exec('SELECT * FROM room_pending_checkpoint').toArray()).toHaveLength(1)
      await checkpoints.flush(scope, 'BACKLOG')
      expect(inputs[1]).toEqual(inputs[0])
      expect(store.logRows).toBe(0)
    }
  )

  it('retains and reconstructs a multi-chunk payload in bounded SQL text chunks', async () => {
    const { store, storage } = open(3)
    for (let index = 0; index < 3; index++) {
      await store.transact(async () => {
        const actor = await store.store
          .query('encounterRunActors')
          .withIndex('by_encounterId_id', (q) =>
            q.eq('encounterId', encounterId).eq('id', uuid(0x100 + index))
          )
          .unique()
        const stateJson = canonicalizeJson({ padding: 'x'.repeat(70_000) })
        await store.store.patch(actor!._id, { stateJson, stateChecksum: sha256Hex(stateJson) })
      })
    }
    let original: LiveSessionCheckpointInput | null = null
    const checkpoints = new RoomCheckpoints(store, storage, async (input) => {
      original = input
      expect(input.sequence).toBe(3)
      throw new Error('Upload interrupted.')
    })
    await expect(checkpoints.flush(scope, 'BACKLOG')).rejects.toThrow('Upload interrupted.')
    const chunks = storage.sql
      .exec(
        'SELECT part, length(data) AS characters FROM room_pending_checkpoint_chunks ORDER BY part'
      )
      .toArray()
    expect(chunks.length).toBeGreaterThanOrEqual(3)
    expect(
      chunks.every((row) => typeof row.characters === 'number' && row.characters <= 96_000)
    ).toBe(true)
    const restarted = new RoomEncounterStore(storage)
    await new RoomCheckpoints(restarted, storage, async (input) => {
      expect(input).toEqual(original)
      return response(input)
    }).flush(scope, 'BACKLOG')
    expect(restarted.logRows).toBe(0)
    expect(restarted.sequence).toBe(3)
  })

  it('attributes each send to its flush trigger without storing the trigger in the pending input', async () => {
    const { store, storage } = open()
    await command(store, 1)
    const sends: { reason: string; keys: string[] }[] = []
    const failed = new RoomCheckpoints(store, storage, async (input, reason) => {
      sends.push({ reason, keys: Object.keys(input) })
      throw new Error('Publication unavailable.')
    })
    await expect(failed.flush(scope, 'ADMISSION')).rejects.toThrow('Publication unavailable.')
    const retry = new RoomCheckpoints(
      new RoomEncounterStore(storage),
      storage,
      async (input, reason) => {
        sends.push({ reason, keys: Object.keys(input) })
        return response(input)
      }
    )
    await retry.flush(scope, 'BACKLOG')
    expect(sends.map(({ reason }) => reason)).toEqual(['ADMISSION', 'BACKLOG'])
    expect(sends[1]!.keys).toEqual(sends[0]!.keys)
    expect(sends[0]!.keys).not.toContain('reason')
  })

  it('coalesces concurrent flush callers into one publication', async () => {
    const { store, storage } = open()
    await command(store, 1)
    let finish: (() => void) | undefined
    const gate = new Promise<void>((resolve) => {
      finish = resolve
    })
    const publish = vi.fn(async (input: LiveSessionCheckpointInput) => {
      await gate
      return response(input)
    })
    const checkpoints = new RoomCheckpoints(store, storage, publish)
    const first = checkpoints.flush(scope, 'BACKLOG')
    const second = checkpoints.flush(scope, 'BACKLOG')
    expect(second).toBe(first)
    finish!()
    expect(await first).toEqual(await second)
    expect(publish).toHaveBeenCalledOnce()
  })

  it('folds a multi-command backlog that fits the atomic bound into one checkpoint', async () => {
    const { store, storage } = open()
    // Five commands, together about 400 KB of records: more than the old 240 KiB page, under 1 MiB.
    for (let command = 0; command < 5; command++) {
      await store.transact(async () => {
        for (let row = 0; row < 8; row++) {
          const stateJson = canonicalizeJson({ row, padding: 'x'.repeat(10_000) })
          await store.store.insert('encounterRunActors', {
            id: uuid(0x30000 + command * 8 + row),
            encounterId,
            stateJson,
            stateChecksum: sha256Hex(stateJson),
            snapshotChecksum: sha256Hex('snapshot'),
            sourceFactsChecksum: null
          })
        }
      })
    }
    const inputs: LiveSessionCheckpointInput[] = []
    await new RoomCheckpoints(store, storage, async (input) => {
      inputs.push(input)
      return response(input)
    }).flush(scope, 'BACKLOG')
    expect(inputs).toHaveLength(1)
    expect(inputs[0]!.sequence).toBe(store.sequence)
    const bytes = new TextEncoder().encode(canonicalizeJson(inputs[0]!.records)).byteLength
    expect(bytes).toBeGreaterThan(JSON_PAYLOAD_CHUNK_MAX_BYTES)
    expect(bytes).toBeLessThanOrEqual(LIVE_SESSION_CHECKPOINT_MAX_BYTES)
    expect(store.logRows).toBe(0)
  })

  it('folds a raw journal larger than one read page into one checkpoint', async () => {
    const { store, storage } = open(1)
    const base = store.checkpointSnapshot()
    // Every command rewrites the same 100 KB row, so the raw journal outgrows one bounded read
    // while the folded records stay one row.
    const commands = Math.ceil(LIVE_SESSION_CHECKPOINT_JOURNAL_MAX_BYTES / 100_000) + 8
    for (let ordinal = 0; ordinal < commands; ordinal++) {
      await store.transact(async () => {
        const actor = await store.store
          .query('encounterRunActors')
          .withIndex('by_encounterId_id', (q) =>
            q.eq('encounterId', encounterId).eq('id', uuid(0x100))
          )
          .unique()
        const stateJson = canonicalizeJson({ ordinal, padding: 'x'.repeat(100_000) })
        await store.store.patch(actor!._id, { stateJson, stateChecksum: sha256Hex(stateJson) })
      })
    }
    const reads = vi.spyOn(store, 'committedWriteSets')
    const inputs: LiveSessionCheckpointInput[] = []
    await new RoomCheckpoints(store, storage, async (input) => {
      inputs.push(input)
      return response(input)
    }).flush(scope, 'BACKLOG')
    expect(reads.mock.calls.length).toBeGreaterThan(1)
    expect(reads.mock.calls[0]![0].maxBytes).toBe(LIVE_SESSION_CHECKPOINT_JOURNAL_MAX_BYTES)
    expect(inputs).toHaveLength(1)
    expect(inputs[0]).toMatchObject({
      fromSequence: base.sequence,
      fromChecksum: base.checksum,
      sequence: commands
    })
    expect(inputs[0]!.checksum).toBe(store.checkpointSnapshot().checksum)
    expect(store.logRows).toBe(0)
  })

  it('never publishes rows a later command in the same checkpoint deleted', async () => {
    const { store, storage } = open()
    const ids = Array.from({ length: 4 }, (_, row) => uuid(0x40000 + row))
    await store.transact(async () => {
      for (const id of ids) {
        const stateJson = canonicalizeJson({ id })
        await store.store.insert('encounterRunActors', {
          id,
          encounterId,
          stateJson,
          stateChecksum: sha256Hex(stateJson),
          snapshotChecksum: sha256Hex('snapshot'),
          sourceFactsChecksum: null
        })
      }
    })
    await command(store, 1)
    await store.transact(async () => {
      for (const id of ids) {
        const row = await store.store
          .query('encounterRunActors')
          .withIndex('by_encounterId_id', (q) => q.eq('encounterId', encounterId).eq('id', id))
          .unique()
        await store.store.delete(row!._id)
      }
    })
    const inputs: LiveSessionCheckpointInput[] = []
    await new RoomCheckpoints(store, storage, async (input) => {
      inputs.push(input)
      return response(input)
    }).flush(scope, 'BACKLOG')
    expect(inputs).toHaveLength(1)
    expect(inputs[0]!.sequence).toBe(store.sequence)
    const published = JSON.stringify(inputs[0]!.records)
    for (const id of ids) expect(published).not.toContain(id)
  })

  it('trims a journal page to a fitting records prefix and publishes the remainder', async () => {
    const { store, storage } = open()
    const base = store.checkpointSnapshot()
    // A small inserted row checkpoints as a keyed, checksummed change larger than its journal
    // write, so a full journal page's records outgrow the checkpoint budget.
    for (let index = 0; index < 30; index++) {
      await store.transact(async () => {
        for (let row = 0; row < 40; row++) {
          const stateJson = canonicalizeJson({ row, padding: 'x'.repeat(1_000) })
          await store.store.insert('encounterRunActors', {
            id: uuid(0x10000 + index * 40 + row),
            encounterId,
            stateJson,
            stateChecksum: sha256Hex(stateJson),
            snapshotChecksum: sha256Hex('snapshot'),
            sourceFactsChecksum: null
          })
        }
      })
    }
    const page = store.committedWriteSets({
      epoch: EPOCH,
      fromSequence: base.sequence,
      fromChecksum: base.checksum,
      toSequence: store.sequence,
      maxEntries: MAX_ROOM_INPUT_RESPONSE_DOCUMENTS,
      maxBytes: LIVE_SESSION_CHECKPOINT_JOURNAL_MAX_BYTES
    })
    const recordsFor = (count: number) =>
      buildRoomCheckpointRecords({
        documents: base.documents,
        records: base.records,
        fromSequence: base.sequence,
        fromChecksum: base.checksum,
        entries: page.entries.slice(0, count)
      })
    expect(
      new TextEncoder().encode(canonicalizeJson(recordsFor(page.entries.length))).byteLength
    ).toBeGreaterThan(LIVE_SESSION_CHECKPOINT_MAX_BYTES)
    const inputs: LiveSessionCheckpointInput[] = []
    await new RoomCheckpoints(store, storage, async (input) => {
      inputs.push(input)
      expect(
        new TextEncoder().encode(canonicalizeJson(input.records)).byteLength
      ).toBeLessThanOrEqual(LIVE_SESSION_CHECKPOINT_MAX_BYTES)
      return response(input)
    }).flush(scope, 'BACKLOG')
    expect(inputs.length).toBeGreaterThan(1)
    expect(inputs[0]!.sequence).toBeLessThan(page.toSequence)
    // The proportional step fills most of the budget instead of settling on a small prefix.
    expect(
      new TextEncoder().encode(canonicalizeJson(inputs[0]!.records)).byteLength
    ).toBeGreaterThan(LIVE_SESSION_CHECKPOINT_MAX_BYTES * 0.75)
    expect(store.logRows).toBe(0)
  })

  it('sends each page the revisions the previous page adopted and reports every adoption', async () => {
    const { store, storage } = open()
    for (let index = 0; index < 30; index++) {
      await store.transact(async () => {
        for (let row = 0; row < 40; row++) {
          const stateJson = canonicalizeJson({ row, padding: 'x'.repeat(1_000) })
          await store.store.insert('encounterRunActors', {
            id: uuid(0x10000 + index * 40 + row),
            encounterId,
            stateJson,
            stateChecksum: sha256Hex(stateJson),
            snapshotChecksum: sha256Hex('snapshot'),
            sourceFactsChecksum: null
          })
        }
      })
    }
    const knownAuthorization = roomAuthorizationResponse({ members: [] }).revisions
    const sent: LiveSessionCheckpointInput['knownAuthorization'][] = []
    const adopted: LiveSessionCheckpointResponse['adopted'][] = []
    const last = await new RoomCheckpoints(
      store,
      storage,
      async (input) => {
        sent.push(input.knownAuthorization && structuredClone(input.knownAuthorization))
        return { ...response(input), adopted: { play: uuid(0x7000 + sent.length), characters: [] } }
      },
      undefined,
      (page, published) => {
        expect(page.knownAuthorization).toEqual(sent[adopted.length])
        adopted.push(published.adopted)
      }
    ).flush({ ...scope, knownAuthorization }, 'BACKLOG')
    expect(sent.length).toBeGreaterThan(1)
    expect(sent[0]).toEqual(knownAuthorization)
    sent
      .slice(1)
      .forEach((known, index) =>
        expect(known).toEqual({ ...knownAuthorization, play: uuid(0x7000 + index + 1) })
      )
    expect(adopted).toHaveLength(sent.length)
    expect(last?.adopted).toEqual(adopted.at(-1))
  })

  it('publishes one command above 240 KiB in a single checkpoint', async () => {
    const { store, storage } = open()
    await store.transact(async () => {
      for (let row = 0; row < 10; row++) {
        const stateJson = canonicalizeJson({ row, padding: 'x'.repeat(40_000) })
        await store.store.insert('encounterRunActors', {
          id: uuid(0x20000 + row),
          encounterId,
          stateJson,
          stateChecksum: sha256Hex(stateJson),
          snapshotChecksum: sha256Hex('snapshot'),
          sourceFactsChecksum: null
        })
      }
    })
    const inputs: LiveSessionCheckpointInput[] = []
    await new RoomCheckpoints(store, storage, async (input) => {
      inputs.push(input)
      return response(input)
    }).flush(scope, 'BACKLOG')
    expect(inputs).toHaveLength(1)
    const bytes = new TextEncoder().encode(canonicalizeJson(inputs[0]!.records)).byteLength
    expect(bytes).toBeGreaterThan(JSON_PAYLOAD_CHUNK_MAX_BYTES)
    expect(bytes).toBeLessThanOrEqual(LIVE_SESSION_CHECKPOINT_MAX_BYTES)
  })

  it('clears only an exact already-compacted pending frame after interrupted cleanup', async () => {
    const { store, storage } = open()
    await command(store, 1)
    const failed = new RoomCheckpoints(store, storage, async () => {
      throw new Error('Interrupted.')
    })
    await expect(failed.flush(scope, 'BACKLOG')).rejects.toThrow('Interrupted.')
    const ack = { epoch: EPOCH, sequence: store.sequence, checksum: store.checksum }
    store.compact(ack)
    const restarted = new RoomEncounterStore(storage)
    const publish =
      vi.fn<(input: LiveSessionCheckpointInput) => Promise<LiveSessionCheckpointResponse>>()
    expect(
      await new RoomCheckpoints(restarted, storage, publish).flush(scope, 'BACKLOG')
    ).toBeNull()
    expect(publish).not.toHaveBeenCalled()
    expect(storage.sql.exec('SELECT * FROM room_pending_checkpoint').toArray()).toEqual([])
  })

  it('rolls snapshot acknowledgement back together when the synchronous acknowledgement hook fails', async () => {
    const { store, storage } = open()
    storage.sql.exec('CREATE TABLE checkpoint_test_ack (sequence INTEGER NOT NULL)')
    await command(store, 1)
    const before = store.checkpointSnapshot()
    let fail = true
    const checkpoints = new RoomCheckpoints(
      store,
      storage,
      async (input) => response(input),
      (ack) => {
        storage.sql.exec('INSERT INTO checkpoint_test_ack (sequence) VALUES (?)', ack.sequence)
        if (fail) throw new Error('Acknowledgement interrupted.')
        return undefined
      }
    )
    await expect(checkpoints.flush(scope, 'BACKLOG')).rejects.toThrow(
      'Acknowledgement interrupted.'
    )
    expect(store.checkpointSnapshot()).toEqual(before)
    expect(storage.sql.exec('SELECT * FROM checkpoint_test_ack').toArray()).toEqual([])
    expect(storage.sql.exec('SELECT * FROM room_pending_checkpoint').toArray()).toHaveLength(1)
    fail = false
    await checkpoints.flush(scope, 'BACKLOG')
    expect(store.logRows).toBe(0)
    expect(storage.sql.exec('SELECT * FROM checkpoint_test_ack').toArray()).toEqual([
      { sequence: 1 }
    ])
  })
})
