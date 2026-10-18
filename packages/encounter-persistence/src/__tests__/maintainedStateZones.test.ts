import { describe, expect, it } from 'vitest'
import { prepareMaintainedEffectStateRecord } from '@artificer-toolkit/rules-runtime/activeRuleEffectRecords'
import { DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID } from '@artificer-toolkit/rules-runtime/systems/dnd5e/concentrationIdentity'
import {
  ENCOUNTER_ID,
  creatureActor,
  srdEncounterState
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'

import { applyMaintenanceReplacement } from '../actionEffectPersistence.js'
import { createActiveRuleEffectStore } from '../effectStore.js'
import { createMemoryEncounterStore } from '../memoryEncounterStore.js'
import type { EncounterCharacterWriteTransaction } from '../ports.js'
import type { EncounterDocument } from '../store.js'

const ACTOR_ID = '00000000-0000-4000-8000-0000000f0001'
const PRIOR_ID = '00000000-0000-4000-8000-0000000f0002'
const NEXT_ID = '00000000-0000-4000-8000-0000000f0003'
const OCCURRENCE_ID = '00000000-0000-4000-8000-0000000f0004'
const SCENE_ID = '00000000-0000-4000-8000-0000000f0005'
const PRIOR_ZONE_ID = '00000000-0000-4000-8000-0000000f0006'
const OTHER_ZONE_ID = '00000000-0000-4000-8000-0000000f0007'
const OCCURRED_AT = '2026-10-16T00:00:00.000Z'

const descriptor = {
  schemaVersion: 2 as const,
  maintenanceDefinitionId: DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID,
  definitionChecksum: 'a'.repeat(64),
  provenance: {
    kind: 'ACTION' as const,
    sourceActionId: 'cast',
    sourceOccurrenceId: OCCURRENCE_ID
  },
  sourceActorId: ACTOR_ID,
  replacementPolicy: 'REPLACE_SAME_DEFINITION' as const,
  emptyDependentPolicy: 'TERMINATE_WHEN_EMPTY' as const
}

/** A memory store holding the Run, an actor, its Concentration, and one zone that depends on it. */
async function concentratingCaster() {
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
      { _id: 'actor', _creationTime: 2, encounterId: ENCOUNTER_ID, id: ACTOR_ID }
    ] as unknown as EncounterDocument<'encounterRunActors'>[],
    { validate: false }
  )
  const zone = (id: string, maintainedEffectStateId: string | null, ordinal: number) => ({
    _id: id,
    _creationTime: ordinal + 2,
    id,
    encounterId: ENCOUNTER_ID,
    sceneId: SCENE_ID,
    createdOrdinal: ordinal,
    version: 1,
    maintainedEffectStateId
  })
  memory.load(
    'encounterSpatialRuleEffects',
    [zone(PRIOR_ZONE_ID, PRIOR_ID, 1), zone(OTHER_ZONE_ID, null, 2)] as never,
    { validate: false }
  )
  const ctx = { db: memory.store } as unknown as EncounterCharacterWriteTransaction
  const store = createActiveRuleEffectStore(ctx)
  const prior = await store.createMaintainedState({
    id: PRIOR_ID,
    encounterId: ENCOUNTER_ID,
    ownerActorId: ACTOR_ID,
    descriptor,
    occurredAt: OCCURRED_AT
  })
  return { memory, ctx, store, prior }
}

describe('a Concentration zone is a dependent of its maintained state (D135)', () => {
  it('removes the zones of the Concentration a new cast replaces, keeping every other zone', async () => {
    const { memory, ctx, store, prior } = await concentratingCaster()
    const created = prepareMaintainedEffectStateRecord({
      id: NEXT_ID,
      encounterId: ENCOUNTER_ID,
      ownerActorId: ACTOR_ID,
      descriptor: {
        ...descriptor,
        provenance: { ...descriptor.provenance, sourceOccurrenceId: NEXT_ID }
      },
      occurredAt: OCCURRED_AT
    })

    await applyMaintenanceReplacement(ctx, {
      state: srdEncounterState({
        actors: [creatureActor({ id: ACTOR_ID, kind: 'CUSTOM', snapshot: {} })],
        currentActorId: null
      }),
      actorId: ACTOR_ID,
      maintenance: {
        prior,
        removed: [],
        carried: [],
        characterVersions: [],
        addedConcentrationCasterId: null
      },
      created,
      occurredAt: OCCURRED_AT
    })

    expect(memory.documents('encounterSpatialRuleEffects').map(({ id }) => id)).toEqual([
      OTHER_ZONE_ID
    ])
    expect(
      await store.findMaintainedStateById({ encounterId: ENCOUNTER_ID, stateId: PRIOR_ID })
    ).toBe(null)
    expect(
      await store.findMaintainedStateById({ encounterId: ENCOUNTER_ID, stateId: NEXT_ID })
    ).toEqual(created)
  })

  it('refuses to delete a maintained state a zone still depends on, so no path can orphan one', async () => {
    const { memory, store, prior } = await concentratingCaster()

    await expect(
      store.deleteMaintainedStateCas({
        id: prior.id,
        encounterId: ENCOUNTER_ID,
        ownerActorId: ACTOR_ID,
        expectedVersion: prior.version
      })
    ).rejects.toThrow('Maintained effect state still has zone dependents.')
    expect(memory.documents('encounterMaintainedEffectStates')).toHaveLength(1)
    expect(memory.documents('encounterSpatialRuleEffects')).toHaveLength(2)
  })
})
