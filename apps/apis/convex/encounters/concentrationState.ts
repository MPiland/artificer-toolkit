import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID } from '@artificer-toolkit/rules-runtime/systems/dnd5e/concentrationIdentity'
import {
  prepareEncounterConcentrationState,
  type NativeConcentrationContext
} from '@artificer-toolkit/rules-runtime/encounterConcentration'
import type { MutationCtx } from '../_generated/server'
import { readDefinitionRoot } from '../content/definitionStore'
import { ensureSystemVocabularySnapshot } from '../content/systemVocabulary'
import { createActiveRuleEffectStore } from '../rules/effectStore'
import { loadMovementTargets, type MovementTarget } from './movementTargets'
import {
  prepareNativeMaintenanceOwners,
  type NativeMaintenanceProjection
} from './actionMaintenance'
import { reconcileNativeMaintenanceOwners } from './maintenanceOwnerPersistence'

/** Reads the exact post-damage Character facts; no default Constitution modifier is permitted. */
export async function loadNativeConcentrationState(
  ctx: MutationCtx,
  input: {
    state: EncounterRunState
    readVersion: number
    targetActorId: string
    userId: string
    targets?: ReadonlyMap<string, MovementTarget>
    projection?: NativeMaintenanceProjection
  }
) {
  const store = createActiveRuleEffectStore(ctx)
  const projectedSlot = input.projection?.slots.get(
    `${input.targetActorId}:${DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID}`
  )
  const maintained = projectedSlot
    ? projectedSlot.state
    : await store.findMaintainedState({
        encounterId: input.state.id,
        ownerActorId: input.targetActorId,
        maintenanceDefinitionId: DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID
      })
  return prepareEncounterConcentrationState({
    state: input.state,
    targetActorId: input.targetActorId,
    maintained,
    readDefinition: async (definitionId) =>
      (await readDefinitionRoot(ctx, definitionId, input.userId))?.current ?? null,
    loadTarget: async () =>
      input.targets
        ? input.targets.get(input.targetActorId)
        : (
            await loadMovementTargets(ctx, {
              encounterId: input.state.id,
              expectedEncounterVersion: input.readVersion,
              targetActorIds: [input.targetActorId]
            })
          ).get(input.targetActorId),
    readVocabulary: () => ensureSystemVocabularySnapshot(ctx, input.state.gameSystemId)
  })
}

/** Binds exact cleanup inputs without writes, including prior uncommitted movement changes. */
export async function prepareNativeConcentrationEnd(
  ctx: MutationCtx,
  input: {
    state: EncounterRunState
    context: NativeConcentrationContext
    targets?: ReadonlyMap<string, MovementTarget>
    projection?: NativeMaintenanceProjection
  }
) {
  const store = createActiveRuleEffectStore(ctx)
  const projectedSlot = input.projection?.slots.get(
    `${input.context.application.targetActorId}:${input.context.maintainedState.maintenanceDefinitionId}`
  )
  const state = projectedSlot
    ? projectedSlot.state
    : await store.findMaintainedStateById({
        encounterId: input.state.id,
        stateId: input.context.maintainedState.id
      })
  if (
    !state ||
    state.id !== input.context.maintainedState.id ||
    state.encounterId !== input.state.id ||
    state.version !== input.context.maintainedState.version ||
    state.ownerActorId !== input.context.application.targetActorId ||
    state.maintenanceDefinitionId !== input.context.maintainedState.maintenanceDefinitionId ||
    state.descriptorChecksum !== input.context.maintainedState.descriptorChecksum
  )
    throw new Error('The concentration state changed before cleanup.')
  const removed = projectedSlot
    ? [...projectedSlot.dependents]
    : await store.listDependentEffects({
        encounterId: input.state.id,
        stateId: state.id
      })
  const owners = await prepareNativeMaintenanceOwners(ctx, {
    gameSystemId: input.state.gameSystemId,
    removed,
    targets: input.targets,
    projection: input.projection
  })
  return { state, removed, ...owners }
}

/** Ends exactly the failed slot and reconciles every owner, including detached Characters. */
export async function endNativeConcentration(
  ctx: MutationCtx,
  input: {
    state: EncounterRunState
    context: NativeConcentrationContext
    actors: EncounterRunActorState[]
    occurredAt: string
  }
) {
  const { state, removed, characterVersions } = await prepareNativeConcentrationEnd(ctx, input)
  const store = createActiveRuleEffectStore(ctx)
  for (const effect of removed)
    await store.deleteCas({ id: effect.id, owner: effect.owner, expectedVersion: effect.version })
  await store.deleteMaintainedStateCas({
    id: state.id,
    encounterId: state.encounterId,
    ownerActorId: state.ownerActorId,
    expectedVersion: state.version
  })
  const actors = await reconcileNativeMaintenanceOwners(ctx, {
    encounterId: input.state.id,
    maintenance: { removed, characterVersions },
    actors: input.actors,
    occurredAt: input.occurredAt
  })
  return {
    actors,
    cleanup: {
      maintainedStateId: state.id,
      removedDependentEffectIds: removed.map((effect) => effect.id),
      characterOwnerTransitions: characterVersions.map((entry) => ({
        ...entry,
        afterStreamVersion: entry.beforeStreamVersion + 1
      }))
    }
  }
}
