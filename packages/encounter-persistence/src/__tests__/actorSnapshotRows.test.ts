import { describe, expect, it } from 'vitest'
import { checksumActorSnapshot } from '@artificer-toolkit/rules-runtime/encounterActorStorage'
import {
  ENCOUNTER_ID,
  creatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { readActorSnapshot } from '../actorSnapshots.js'
import { deleteRunActor, insertRunActor, writeRunActor } from '../documents.js'
import { createMemoryEncounterStore } from '../memoryEncounterStore.js'

const FIRST_ID = '00000000-0000-4000-8000-0000000a5001'
const SECOND_ID = '00000000-0000-4000-8000-0000000a5002'
const BANDIT = { label: 'Bandit', armorClass: 12 }
const VETERAN = { label: 'Veteran', armorClass: 17 }

const actor = (id: string, snapshot: Record<string, unknown>, currentHitPoints = 11) =>
  creatureActor({ id, kind: 'CUSTOM', snapshot, currentHitPoints })

function actorRow(memory: ReturnType<typeof createMemoryEncounterStore>, id: string) {
  const row = memory.documents('encounterRunActors').find((document) => document.id === id)
  if (!row) throw new Error(`Actor ${id} has no row.`)
  return row
}

const snapshotChecksums = (memory: ReturnType<typeof createMemoryEncounterStore>) =>
  memory.documents('encounterActorSnapshots').map((row) => row.checksum)

describe('static actor snapshots live in their own immutable rows (ADR 0035 Amendment 29)', () => {
  it('stores the snapshot once, apart from the actor row that names it by checksum', async () => {
    const memory = createMemoryEncounterStore()
    const ctx = { db: memory.store }
    await insertRunActor(ctx, actor(FIRST_ID, BANDIT))
    await insertRunActor(ctx, actor(SECOND_ID, BANDIT))

    const checksum = checksumActorSnapshot(BANDIT)
    expect(snapshotChecksums(memory)).toEqual([checksum])
    for (const id of [FIRST_ID, SECOND_ID]) {
      const row = actorRow(memory, id)
      expect(row.snapshotChecksum).toBe(checksum)
      expect(row).not.toHaveProperty('snapshot')
      expect(JSON.parse(row.stateJson)).not.toHaveProperty('snapshot')
    }
    expect(await readActorSnapshot(ctx, ENCOUNTER_ID, checksum)).toEqual(BANDIT)
  })

  it('writes a play-state change to the actor row alone, leaving the snapshot row untouched', async () => {
    const memory = createMemoryEncounterStore()
    const ctx = { db: memory.store }
    await insertRunActor(ctx, actor(FIRST_ID, BANDIT))
    const [snapshotBefore] = memory.documents('encounterActorSnapshots')
    const row = actorRow(memory, FIRST_ID)

    memory.transaction.begin()
    await writeRunActor(ctx, row._id, actor(FIRST_ID, BANDIT, 4))
    const writes = memory.transaction.commit()

    expect(writes).toEqual([expect.objectContaining({ op: 'PATCH', id: row._id })])
    expect(memory.documents('encounterActorSnapshots')).toEqual([snapshotBefore])
    expect(JSON.parse(actorRow(memory, FIRST_ID).stateJson)).toMatchObject({ currentHitPoints: 4 })
  })

  it('writes a changed snapshot as a new row, repoints the actor and releases the old row', async () => {
    const memory = createMemoryEncounterStore()
    const ctx = { db: memory.store }
    await insertRunActor(ctx, actor(FIRST_ID, BANDIT))
    const [banditRow] = memory.documents('encounterActorSnapshots')

    await writeRunActor(ctx, actorRow(memory, FIRST_ID)._id, actor(FIRST_ID, VETERAN))

    const veteran = checksumActorSnapshot(VETERAN)
    expect(actorRow(memory, FIRST_ID).snapshotChecksum).toBe(veteran)
    expect(snapshotChecksums(memory)).toEqual([veteran])
    expect(memory.document(banditRow!._id)).toBeNull()
  })

  it('keeps a snapshot row while another actor still names it', async () => {
    const memory = createMemoryEncounterStore()
    const ctx = { db: memory.store }
    await insertRunActor(ctx, actor(FIRST_ID, BANDIT))
    await insertRunActor(ctx, actor(SECOND_ID, BANDIT))
    const bandit = checksumActorSnapshot(BANDIT)
    const veteran = checksumActorSnapshot(VETERAN)

    await writeRunActor(ctx, actorRow(memory, FIRST_ID)._id, actor(FIRST_ID, VETERAN))
    expect(snapshotChecksums(memory)).toEqual([bandit, veteran])

    await deleteRunActor(ctx, actorRow(memory, FIRST_ID))
    expect(snapshotChecksums(memory)).toEqual([bandit])
  })

  it('deletes a shared snapshot row with the last actor that names it', async () => {
    const memory = createMemoryEncounterStore()
    const ctx = { db: memory.store }
    await insertRunActor(ctx, actor(FIRST_ID, BANDIT))
    await insertRunActor(ctx, actor(SECOND_ID, BANDIT))

    await deleteRunActor(ctx, actorRow(memory, FIRST_ID))
    expect(snapshotChecksums(memory)).toEqual([checksumActorSnapshot(BANDIT)])

    await deleteRunActor(ctx, actorRow(memory, SECOND_ID))
    expect(memory.documents('encounterActorSnapshots')).toEqual([])
  })
})
