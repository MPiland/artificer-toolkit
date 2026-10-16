import { describe, expect, it } from 'vitest'
import { createMemoryEncounterStore } from '../memoryEncounterStore.js'

const encounterId = '00000000-0000-4000-8000-000000000001'
const otherEncounterId = '00000000-0000-4000-8000-000000000002'
const actor = (index: number) =>
  `00000000-0000-4000-8000-0000000001${String(index).padStart(2, '0')}`
const movement = (round: number, actorIndex: number, usedFeet = 0, id = encounterId) => ({
  encounterId: id,
  round,
  turnActorId: actor(1),
  actorId: actor(actorIndex),
  usedFeet,
  speedId: null,
  speedBonuses: 0,
  usedOncePerTurn: [],
  teleportAllowances: []
})

describe('memory Encounter store', () => {
  it('orders an index by its fields, then by creation time', async () => {
    const { store } = createMemoryEncounterStore()
    await store.insert('encounterTurnMovements', movement(2, 3))
    await store.insert('encounterTurnMovements', movement(1, 2, 5))
    await store.insert('encounterTurnMovements', movement(1, 2, 10))
    await store.insert('encounterTurnMovements', movement(1, 1, 0, otherEncounterId))
    const rows = await store
      .query('encounterTurnMovements')
      .withIndex('by_encounterId_round_turnActorId_actorId', (q) =>
        q.eq('encounterId', encounterId)
      )
      .collect()
    expect(rows.map((row) => [row.round, row.usedFeet])).toEqual([
      [1, 5],
      [1, 10],
      [2, 0]
    ])
    const descending = await store
      .query('encounterTurnMovements')
      .withIndex('by_encounterId_round_turnActorId_actorId', (q) =>
        q.eq('encounterId', encounterId).gt('round', 1)
      )
      .order('desc')
      .take(5)
    expect(descending.map((row) => row.round)).toEqual([2])
  })

  it('refuses a non-unique unique read and serves private copies', async () => {
    const { store } = createMemoryEncounterStore()
    const id = await store.insert('encounterTurnMovements', movement(1, 1))
    await store.insert('encounterTurnMovements', movement(1, 1, 5))
    const read = store
      .query('encounterTurnMovements')
      .withIndex('by_encounterId_round_turnActorId_actorId', (q) =>
        q.eq('encounterId', encounterId).eq('round', 1).eq('turnActorId', actor(1))
      )
    await expect(read.unique()).rejects.toThrow('more than one')
    const copy = await store.get(id)
    copy!.usedFeet = 99
    expect((await store.get(id))!.usedFeet).toBe(0)
  })

  it('patches, replaces and deletes with schema validation', async () => {
    const { store, documents } = createMemoryEncounterStore()
    const id = await store.insert('encounterTurnMovements', movement(1, 1))
    await store.patch(id, { usedFeet: 15 })
    expect((await store.get(id))!.usedFeet).toBe(15)
    await expect(store.patch(id, { round: 0 })).rejects.toThrow()
    await store.replace(id, movement(3, 2))
    const [replaced] = documents('encounterTurnMovements')
    expect(replaced).toMatchObject({ _id: id, round: 3, actorId: actor(2) })
    await store.delete(id)
    expect(await store.get(id)).toBeNull()
    await expect(store.delete(id)).rejects.toThrow('nonexistent')
  })

  it('returns fields in key order, as Convex does', async () => {
    const { store } = createMemoryEncounterStore()
    const id = await store.insert('encounterTurnMovements', {
      speedBonuses: 0,
      speedId: null,
      usedOncePerTurn: [],
      teleportAllowances: [],
      usedFeet: 0,
      actorId: actor(1),
      turnActorId: actor(1),
      round: 1,
      encounterId
    })
    expect(Object.keys((await store.get(id))!)).toEqual([
      '_creationTime',
      '_id',
      'actorId',
      'encounterId',
      'round',
      'speedBonuses',
      'speedId',
      'teleportAllowances',
      'turnActorId',
      'usedFeet',
      'usedOncePerTurn'
    ])
  })

  it('restores loaded documents with their identities', async () => {
    const source = createMemoryEncounterStore()
    await source.store.insert('encounterTurnMovements', movement(1, 1))
    const restored = createMemoryEncounterStore()
    restored.load('encounterTurnMovements', source.documents('encounterTurnMovements'))
    expect(restored.documents('encounterTurnMovements')).toEqual(
      source.documents('encounterTurnMovements')
    )
    const insertedAfter = await restored.store.insert('encounterTurnMovements', movement(2, 1))
    const rows = restored.documents('encounterTurnMovements')
    expect(rows.at(-1)!._id).toBe(insertedAfter)
    expect(rows[1]!._creationTime).toBeGreaterThan(rows[0]!._creationTime)
  })

  describe('transactions', () => {
    const seed = async (source = createMemoryEncounterStore()) => {
      await source.store.insert('encounterTurnMovements', movement(1, 1))
      await source.store.insert('encounterTurnMovements', movement(1, 2, 5))
      return source
    }

    it('records a transaction that a replay onto the same documents reproduces exactly', async () => {
      const source = await seed()
      const replica = createMemoryEncounterStore()
      const before = source.documents('encounterTurnMovements')
      replica.load('encounterTurnMovements', before)

      source.transaction.begin()
      const [first, second] = before
      const created = await source.store.insert('encounterTurnMovements', movement(2, 3))
      await source.store.patch(first!._id, { usedFeet: 20 })
      await source.store.replace(second!._id, movement(4, 4))
      await source.store.delete(created)
      await source.store.insert('encounterTurnMovements', movement(5, 5))
      const writes = source.transaction.commit()

      replica.apply(JSON.parse(JSON.stringify(writes)))
      expect(replica.documents('encounterTurnMovements')).toEqual(
        source.documents('encounterTurnMovements')
      )
      const nextOnSource = await source.store.insert('encounterTurnMovements', movement(6, 6))
      const nextOnReplica = await replica.store.insert('encounterTurnMovements', movement(6, 6))
      expect(nextOnReplica).toBe(nextOnSource)
      expect(replica.documents('encounterTurnMovements')).toEqual(
        source.documents('encounterTurnMovements')
      )
    })

    it('abort restores documents, identities and creation times', async () => {
      const source = await seed()
      const before = source.documents('encounterTurnMovements')
      source.transaction.begin()
      await source.store.insert('encounterTurnMovements', movement(2, 3))
      await source.store.patch(before[0]!._id, { usedFeet: 30 })
      await source.store.replace(before[1]!._id, movement(4, 4))
      await source.store.delete(before[0]!._id)
      source.transaction.abort()
      expect(source.documents('encounterTurnMovements')).toEqual(before)
      const inserted = await source.store.insert('encounterTurnMovements', movement(2, 3))
      expect(inserted).toBe('memory:3')
      expect(source.documents('encounterTurnMovements').at(-1)!._creationTime).toBe(3)
    })

    it('records nothing outside a transaction and refuses nesting', async () => {
      const source = await seed()
      expect(() => source.transaction.commit()).toThrow('No store transaction')
      source.transaction.begin()
      expect(() => source.transaction.begin()).toThrow('already open')
      source.transaction.abort()
    })

    it('exposes open writes and restores counters past deleted documents', async () => {
      const source = await seed()
      source.transaction.begin()
      const created = await source.store.insert('encounterTurnMovements', movement(3, 3))
      expect(source.transaction.writes()).toHaveLength(1)
      await source.store.delete(created)
      source.transaction.commit()
      const restored = createMemoryEncounterStore()
      restored.load('encounterTurnMovements', source.documents('encounterTurnMovements'))
      restored.restoreCounters(source.counters())
      expect(restored.counters()).toEqual(source.counters())
      expect(await restored.store.insert('encounterTurnMovements', movement(4, 4))).toBe(
        await source.store.insert('encounterTurnMovements', movement(4, 4))
      )
      expect(() => restored.transaction.writes()).toThrow('No store transaction')
    })

    it('replays without validation for a trusted restore and prefixes identities', async () => {
      const source = createMemoryEncounterStore({ idPrefix: 'room' })
      source.transaction.begin()
      const id = await source.store.insert('encounterTurnMovements', movement(1, 1))
      const writes = source.transaction.commit()
      expect(id).toBe('room:1')
      const replica = createMemoryEncounterStore({ idPrefix: 'room' })
      const invalid = writes.map((change) =>
        change.op === 'INSERT' ? { ...change, fields: { ...change.fields, round: 0 } } : change
      )
      expect(() => replica.apply(invalid)).toThrow()
      replica.clear()
      replica.apply(invalid, { validate: false })
      expect(await replica.store.insert('encounterTurnMovements', movement(2, 1))).toBe('room:2')
    })
  })
})
