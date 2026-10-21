import { describe, expect, it } from 'vitest'
import { onEndGrantEffectId } from '@artificer-toolkit/rules-runtime/encounterEffectOnEnd'
import { turnEffectOwner } from '@artificer-toolkit/rules-runtime/encounterTurnEffectState'
import { DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID } from '@artificer-toolkit/rules-runtime/systems/dnd5e/concentrationIdentity'
import {
  ENCOUNTER_ID,
  creatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { plannedModifierGrant } from '@artificer-toolkit/rules-runtime/testing/modifierGrantFixture'
import { haste } from '@artificer-toolkit/source-data/srd/spells/haste.js'

import {
  endEffects,
  restoreConsumedGrants,
  restoreEndedMaintainedStates
} from '../consumedGrantPersistence.js'
import { createActiveRuleEffectStore } from '../effectStore.js'
import { createMemoryEncounterStore } from '../memoryEncounterStore.js'
import type { EncounterPersistenceTransaction } from '../ports.js'
import type { EncounterDocument } from '../store.js'

const CASTER_ID = '00000000-0000-4000-8000-0000000f0001'
const HOLDER_ID = '00000000-0000-4000-8000-0000000f0002'
const SLOT_ID = '00000000-0000-4000-8000-0000000f0003'
const OCCURRENCE_ID = '00000000-0000-4000-8000-0000000f0004'
const HASTE_ID = '00000000-0000-4000-8000-0000000f0005'

const holder = creatureActor({ id: HOLDER_ID, kind: 'CUSTOM', snapshot: {} })
const holderOwner = turnEffectOwner(holder, ENCOUNTER_ID)

/** A Run with a concentrating caster and a hasted holder, whose Haste depends on the caster's Concentration. */
async function hastedHolder() {
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
    [CASTER_ID, HOLDER_ID].map((id, index) => ({
      _id: `actor${index}`,
      _creationTime: 2 + index,
      encounterId: ENCOUNTER_ID,
      id
    })) as unknown as EncounterDocument<'encounterRunActors'>[],
    { validate: false }
  )
  const ctx = { db: memory.store } as unknown as EncounterPersistenceTransaction
  const store = createActiveRuleEffectStore(ctx)
  const state = await store.createMaintainedState({
    id: SLOT_ID,
    encounterId: ENCOUNTER_ID,
    ownerActorId: CASTER_ID,
    descriptor: {
      schemaVersion: 2,
      maintenanceDefinitionId: DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID,
      definitionChecksum: 'a'.repeat(64),
      provenance: { kind: 'ACTION', sourceActionId: 'cast', sourceOccurrenceId: OCCURRENCE_ID },
      sourceActorId: CASTER_ID,
      replacementPolicy: 'REPLACE_SAME_DEFINITION',
      emptyDependentPolicy: 'TERMINATE_WHEN_EMPTY'
    }
  })
  const [effect] = haste.effects ?? []
  const planned = plannedModifierGrant({
    encounterId: ENCOUNTER_ID,
    sourceActorId: CASTER_ID,
    holderActorId: HOLDER_ID,
    lifecycle: {},
    effect,
    rounds: 10
  })
  const hasted = await store.create({
    id: HASTE_ID,
    owner: holderOwner,
    definition: planned.definition,
    lifecycle: { schemaVersion: 1, remainingTicks: 10 },
    maintainedEffectStateId: SLOT_ID
  })
  return { ctx, store, state, hasted }
}

/** The lethargy the ended Haste left behind, or null when none. */
async function lethargy(store: ReturnType<typeof createActiveRuleEffectStore>) {
  return (
    (await store.list(holderOwner)).find(({ id }) => id === onEndGrantEffectId(HASTE_ID)) ?? null
  )
}

describe('a held effect’s onEnd grant (SPELLS-4.T2l)', () => {
  it('is created by an expiry, as a one-tick holder grant that stops movement and every action', async () => {
    const { store, hasted } = await hastedHolder()
    await store.deleteCas({
      id: hasted.id,
      owner: holderOwner,
      expectedVersion: hasted.version,
      removal: 'ENDED'
    })

    const left = await lethargy(store)
    expect(left?.lifecycle.remainingTicks).toBe(1)
    expect(left?.maintainedEffectStateId).toBeNull()
    // Held for the Run only: a Character's lethargy must not outlast it.
    expect(left?.definition.recurrence.lifetimeScope).toBe('ENCOUNTER')
    const [contribution] = left?.definition.stateContributions ?? []
    expect(contribution).toMatchObject({ kind: 'MODIFIER_GRANT' })
    expect(
      contribution?.kind === 'MODIFIER_GRANT'
        ? contribution.modifiers.map(({ valueDomainCode, modifierKind }) => [
            valueDomainCode,
            modifierKind
          ])
        : []
    ).toEqual([
      ['SPEED', 'MULTIPLY'],
      ['ACTION_COUNT', 'SET_VALUE'],
      ['BONUS_ACTION_COUNT', 'SET_VALUE'],
      ['REACTION_COUNT', 'SET_VALUE']
    ])
    // The lethargy ends once; it does not itself leave another.
    const [lethargyEffect] = [left!]
    await store.deleteCas({
      id: lethargyEffect.id,
      owner: holderOwner,
      expectedVersion: lethargyEffect.version,
      removal: 'ENDED'
    })
    expect(await store.list(holderOwner)).toEqual([])
  })

  it('is created when the caster’s Concentration drops', async () => {
    const { store, state } = await hastedHolder()
    const effects = await store.listDependentEffects({
      encounterId: ENCOUNTER_ID,
      stateId: SLOT_ID
    })
    expect(effects).toHaveLength(1)
    await store.deleteCas({
      id: effects[0]!.id,
      owner: holderOwner,
      expectedVersion: effects[0]!.version,
      removal: 'ENDED'
    })
    await store.deleteMaintainedStateCas({
      id: SLOT_ID,
      encounterId: ENCOUNTER_ID,
      ownerActorId: CASTER_ID,
      expectedVersion: state.version,
      removal: 'ENDED'
    })

    expect(await lethargy(store)).not.toBeNull()
  })

  it('is created when an early end (the grant’s own end, or a holder end) removes it', async () => {
    const { ctx, store, hasted } = await hastedHolder()

    await endEffects(ctx, [hasted])

    expect(await lethargy(store)).not.toBeNull()
  })

  it('is not created by a removal (undo, actor removal, Run completion)', async () => {
    const { store, hasted } = await hastedHolder()
    await store.deleteCas({
      id: hasted.id,
      owner: holderOwner,
      expectedVersion: hasted.version,
      removal: 'REMOVED'
    })

    expect(await lethargy(store)).toBeNull()
    expect(await store.list(holderOwner)).toEqual([])
  })

  it('is taken back when an undo restores the effect that left it', async () => {
    const { ctx, store, hasted } = await hastedHolder()
    const endedStates = await endEffects(ctx, [hasted])
    expect(await lethargy(store)).not.toBeNull()

    await restoreEndedMaintainedStates(ctx, endedStates)
    await restoreConsumedGrants(ctx, [hasted])

    expect(await lethargy(store)).toBeNull()
    expect(await store.list(holderOwner)).toEqual([hasted])
  })
})
