import { evictDurableObject, runInDurableObject } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { aggregate, command, uuid } from '../src/testing/roomAggregateFixture.js'

/**
 * The room store on real Durable Object SQLite: the billed row counts come from the storage
 * cursors, and eviction discards every in-memory copy, so a recovered store is rebuilt from rows.
 */

const EPOCH = uuid(0x900)
const stubFor = () =>
  env.LIVE_SESSION_ROOMS.get(env.LIVE_SESSION_ROOMS.idFromName(`store:${crypto.randomUUID()}`))

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

describe.each([11, 100])('room store on Durable Object SQLite, %i actors', (actorCount) => {
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
    // Snapshot chunks plus 12 log rows, never a scan of anything else.
    expect(after.rowsRead).toBeLessThan(actorCount + 20)
  })

  it('compacts to the same state in a bounded number of rows', async () => {
    const stub = stubFor()
    const outcome = await runInDurableObject(stub, async (_instance, state) => {
      const room = new RoomEncounterStore(state.storage)
      room.hydrate({ epoch: EPOCH, ...aggregate(actorCount) })
      for (let ordinal = 1; ordinal <= 40; ordinal++) await command(room, ordinal)
      const before = snapshotOf(room)
      const rowsBefore = room.usage.rowsWritten
      room.compact()
      return { before, compactionRows: room.usage.rowsWritten - rowsBefore, logRows: room.logRows }
    })
    expect(outcome.logRows).toBe(0)
    // New chunks, the deleted old chunks and the 40 folded log rows.
    expect(outcome.compactionRows).toBeLessThan(2 * actorCount + 60)
    await evictDurableObject(stub)
    const after = await runInDurableObject(stub, (_instance, state) =>
      snapshotOf(new RoomEncounterStore(state.storage))
    )
    expect(after).toEqual(outcome.before)
  })
})
