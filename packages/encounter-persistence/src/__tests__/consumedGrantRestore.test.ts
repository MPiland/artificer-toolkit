import { escapeGrappleEffectDefinition } from '@artificer-toolkit/rules-runtime/testing/escapeGrappleEffectFixture'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  deleteGrants,
  restoreConsumedGrants,
  spendEffectUses
} from '../consumedGrantPersistence.js'
import { createActiveRuleEffectStore } from '../effectStore.js'
import { createMemoryEncounterStore } from '../memoryEncounterStore.js'
import type { EncounterPersistenceTransaction } from '../ports.js'
import type { EncounterDocument } from '../store.js'

const ENCOUNTER_ID = '00000000-0000-4000-8000-0000000d0001'
const HOLDER_ID = '00000000-0000-4000-8000-0000000d0002'
const GRANTER_ID = '00000000-0000-4000-8000-0000000d0003'
const FIRST_ID = '00000000-0000-4000-8000-0000000d0004'
const SECOND_ID = '00000000-0000-4000-8000-0000000d0005'
const owner = {
  kind: 'ENCOUNTER_ACTOR' as const,
  encounterId: ENCOUNTER_ID,
  targetActorId: HOLDER_ID
}

afterEach(() => vi.useRealTimers())

/** A memory store holding the Run and the holder of two grants. */
function holderContext() {
  const memory = createMemoryEncounterStore()
  memory.load(
    'encounterRuns',
    [
      { _id: 'run', _creationTime: 1, id: ENCOUNTER_ID }
    ] as unknown as EncounterDocument<'encounterRuns'>[],
    { validate: false }
  )
  memory.load(
    'encounterRunActors',
    [
      { _id: 'actor', _creationTime: 2, encounterId: ENCOUNTER_ID, id: HOLDER_ID }
    ] as unknown as EncounterDocument<'encounterRunActors'>[],
    { validate: false }
  )
  return { db: memory.store } as unknown as EncounterPersistenceTransaction
}

describe('restoreConsumedGrants', () => {
  it('gives back the exact record an undone roll used up, in its original order', async () => {
    const ctx = holderContext()
    const store = createActiveRuleEffectStore(ctx)
    const definition = escapeGrappleEffectDefinition({
      encounterId: ENCOUNTER_ID,
      grapplerId: GRANTER_ID,
      conditionIds: []
    })
    const lifecycle = { schemaVersion: 1 as const, remainingTicks: null }
    vi.useFakeTimers()
    const first = await store.create({
      id: FIRST_ID,
      owner,
      definition,
      lifecycle,
      occurredAt: '2026-01-01T00:00:00.000Z'
    })
    await store.create({
      id: SECOND_ID,
      owner,
      definition,
      lifecycle,
      occurredAt: '2026-01-01T00:00:01.000Z'
    })
    vi.setSystemTime(new Date('2026-01-01T00:00:05.000Z'))
    const updated = await store.updateLifecycleCas({
      id: FIRST_ID,
      owner,
      expectedVersion: first.version,
      lifecycle
    })
    expect(updated).toMatchObject({ version: 2, updatedAt: '2026-01-01T00:00:05.000Z' })
    const before = await store.list(owner)

    vi.setSystemTime(new Date('2026-01-01T00:00:09.000Z'))
    await deleteGrants(ctx, [updated])
    expect((await store.list(owner)).map(({ id }) => id)).toEqual([SECOND_ID])
    await restoreConsumedGrants(ctx, [updated])

    expect(await store.list(owner)).toEqual(before)
    expect((await store.list(owner)).map(({ id }) => id)).toEqual([FIRST_ID, SECOND_ID])
  })

  it('spends one use of an effect that counts them, and an undo gives the use back in place', async () => {
    const ctx = holderContext()
    const store = createActiveRuleEffectStore(ctx)
    const definition = escapeGrappleEffectDefinition({
      encounterId: ENCOUNTER_ID,
      grapplerId: GRANTER_ID,
      conditionIds: []
    })
    const counted = await store.create({
      id: FIRST_ID,
      owner,
      definition,
      lifecycle: { schemaVersion: 1 as const, remainingTicks: null, remainingUses: 3 },
      occurredAt: '2026-01-01T00:00:00.000Z'
    })

    await spendEffectUses(ctx, [counted])
    expect((await store.list(owner))[0]?.lifecycle.remainingUses).toBe(2)

    await restoreConsumedGrants(ctx, [counted])
    expect((await store.list(owner))[0]?.lifecycle.remainingUses).toBe(3)
  })

  it('refuses to spend a use of an effect that does not count them', async () => {
    const ctx = holderContext()
    const store = createActiveRuleEffectStore(ctx)
    const uncounted = await store.create({
      id: FIRST_ID,
      owner,
      definition: escapeGrappleEffectDefinition({
        encounterId: ENCOUNTER_ID,
        grapplerId: GRANTER_ID,
        conditionIds: []
      }),
      lifecycle: { schemaVersion: 1 as const, remainingTicks: null },
      occurredAt: '2026-01-01T00:00:00.000Z'
    })
    await expect(spendEffectUses(ctx, [uncounted])).rejects.toThrow('does not count uses')
  })
})
