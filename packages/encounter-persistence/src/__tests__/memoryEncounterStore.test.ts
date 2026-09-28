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
  speedBonuses: 0
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
})
