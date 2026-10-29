import { describe, expect, it } from 'vitest'
import { turnEffectOwner } from '@artificer-toolkit/rules-runtime/encounterTurnEffectState'
import { DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID } from '@artificer-toolkit/rules-runtime/systems/dnd5e/concentrationIdentity'
import { plannedModifierGrant } from '@artificer-toolkit/rules-runtime/testing/modifierGrantFixture'
import {
  ENCOUNTER_ID,
  creatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'

import {
  endEffects,
  restoreConsumedGrants,
  restoreEndedMaintainedStates
} from '../consumedGrantPersistence.js'
import { createActiveRuleEffectStore } from '../effectStore.js'
import { createMemoryEncounterStore } from '../memoryEncounterStore.js'
import type { EncounterPersistenceTransaction } from '../ports.js'
import type { EncounterDocument } from '../store.js'

const ACTOR_ID = '00000000-0000-4000-8000-0000000e0001'
const SLOT_ID = '00000000-0000-4000-8000-0000000e0002'
const OCCURRENCE_ID = '00000000-0000-4000-8000-0000000e0003'
const FIRST_ID = '00000000-0000-4000-8000-0000000e0004'
const SECOND_ID = '00000000-0000-4000-8000-0000000e0005'
const ZONE_ID = '00000000-0000-4000-8000-0000000e0006'

const holder = creatureActor({ id: ACTOR_ID, kind: 'CUSTOM', snapshot: {} })

/** A memory store holding the Run, an actor, and the actor's Concentration, with room for dependents. */
async function concentratingActor() {
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
  const ctx = { db: memory.store } as unknown as EncounterPersistenceTransaction
  const store = createActiveRuleEffectStore(ctx)
  const state = await store.createMaintainedState({
    id: SLOT_ID,
    encounterId: ENCOUNTER_ID,
    ownerActorId: ACTOR_ID,
    descriptor: {
      schemaVersion: 2,
      maintenanceDefinitionId: DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID,
      definitionChecksum: 'a'.repeat(64),
      provenance: { kind: 'ACTION', sourceActionId: 'cast', sourceOccurrenceId: OCCURRENCE_ID },
      sourceActorId: ACTOR_ID,
      replacementPolicy: 'REPLACE_SAME_DEFINITION',
      emptyDependentPolicy: 'TERMINATE_WHEN_EMPTY'
    }
  })
  const dependent = (id: string) =>
    store.create({
      id,
      owner: turnEffectOwner(holder, ENCOUNTER_ID),
      definition: plannedModifierGrant({
        encounterId: ENCOUNTER_ID,
        sourceActorId: ACTOR_ID,
        holderActorId: ACTOR_ID,
        lifecycle: {
          endTriggers: [{ event: 'LIFECYCLE', timing: 'CONSUME', code: 'ON_ATTACK_ROLL' }]
        },
        rounds: 10
      }).definition,
      lifecycle: { schemaVersion: 1, remainingTicks: 10 },
      maintainedEffectStateId: SLOT_ID
    })
  return { memory, ctx, store, state, dependent }
}

describe('endEffects', () => {
  it('ends the Concentration its last dependent sustained, and an undo gives both back exactly', async () => {
    const { ctx, store, state, dependent } = await concentratingActor()
    const effect = await dependent(FIRST_ID)
    const owner = turnEffectOwner(holder, ENCOUNTER_ID)

    const ended = await endEffects(ctx, [effect])
    expect(ended).toEqual([state])
    expect(await store.list(owner)).toEqual([])
    expect(
      await store.findMaintainedStateById({ encounterId: ENCOUNTER_ID, stateId: SLOT_ID })
    ).toBe(null)

    await restoreEndedMaintainedStates(ctx, ended)
    await restoreConsumedGrants(ctx, [effect])
    expect(await store.list(owner)).toEqual([effect])
    expect(
      await store.findMaintainedStateById({ encounterId: ENCOUNTER_ID, stateId: SLOT_ID })
    ).toEqual(state)
  })

  it('keeps the Concentration while another effect still depends on it', async () => {
    const { ctx, store, state, dependent } = await concentratingActor()
    const ending = await dependent(FIRST_ID)
    const remaining = await dependent(SECOND_ID)

    expect(await endEffects(ctx, [ending])).toEqual([])
    expect(await store.list(turnEffectOwner(holder, ENCOUNTER_ID))).toEqual([remaining])
    expect(
      await store.findMaintainedStateById({ encounterId: ENCOUNTER_ID, stateId: SLOT_ID })
    ).toEqual(state)
  })

  it('keeps the Concentration while a zone still depends on it, though no effect does (D135)', async () => {
    const { memory, ctx, store, state, dependent } = await concentratingActor()
    memory.load(
      'encounterSpatialRuleEffects',
      [
        {
          _id: ZONE_ID,
          _creationTime: 3,
          id: ZONE_ID,
          encounterId: ENCOUNTER_ID,
          sceneId: ZONE_ID,
          createdOrdinal: 1,
          version: 1,
          maintainedEffectStateId: SLOT_ID
        }
      ] as never,
      { validate: false }
    )
    const effect = await dependent(FIRST_ID)

    expect(await endEffects(ctx, [effect])).toEqual([])
    expect(
      await store.findMaintainedStateById({ encounterId: ENCOUNTER_ID, stateId: SLOT_ID })
    ).toEqual(state)
  })

  it('ends both dependents and the Concentration once, when one event ends them together', async () => {
    const { ctx, store, state, dependent } = await concentratingActor()
    const both = [await dependent(FIRST_ID), await dependent(SECOND_ID)]

    expect(await endEffects(ctx, both)).toEqual([state])
    expect(await store.list(turnEffectOwner(holder, ENCOUNTER_ID))).toEqual([])
  })

  it('refuses to give back a Concentration that is already held', async () => {
    const { ctx, state } = await concentratingActor()
    await expect(restoreEndedMaintainedStates(ctx, [state])).rejects.toThrow(
      'Maintained effect state already exists.'
    )
  })
})
