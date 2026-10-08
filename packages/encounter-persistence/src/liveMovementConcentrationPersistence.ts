import {
  concentrationCommandId,
  concentrationEndOccurrenceId,
  concentrationOccurrenceId
} from '@artificer-toolkit/rules-runtime/encounterConcentrationIdentity'
import { DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID } from '@artificer-toolkit/rules-runtime/systems/dnd5e/concentrationIdentity'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import {
  movementConcentrationEndDtoSchema,
  movementConcentrationExecutionDtoSchema,
  type MovementConcentrationEndDto,
  type MovementConcentrationExecutionDto
} from '@artificer-toolkit/schema/shared/ruleExecutionMovementConcentration'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { EncounterPersistenceTransaction } from './ports.js'
import {
  persistNativeConcentrationEnd,
  persistNativeConcentrationResult
} from './actionChildPersistence.js'
import { postConcentrationEndMessage, readConcentrationEndReason } from './concentrationEnd.js'
import { createActiveRuleEffectStore } from './effectStore.js'
import type { applyLiveConcentrationCleanup } from './concentrationCleanupPersistence.js'
import { movementPersistedTransitionState } from './liveMovementTargetState.js'
import { concentrationTargetPinChanged } from './concentrationTargetPin.js'

type MovementConcentrationPersistenceCallbacks = {
  applyCleanup: (
    input: Parameters<typeof applyLiveConcentrationCleanup>[1]
  ) => ReturnType<typeof applyLiveConcentrationCleanup>
  currentCharacterStreamVersion(state: EncounterRunState, id: string): Promise<number>
  readTargetState(
    state: EncounterRunState,
    actor: EncounterRunActorState,
    plannedMaximumHitPoints: number
  ): Promise<ReturnType<typeof movementPersistedTransitionState>>
}

/** The cleanup's owner projection must still be the one the DO planned from, before it runs. */
async function requireOwnerTransitionsBefore(
  input: {
    state: EncounterRunState
    actors: EncounterRunActorState[]
    ownerTransitions: MovementConcentrationExecutionDto['ownerTransitions']
  },
  callbacks: Pick<MovementConcentrationPersistenceCallbacks, 'readTargetState'>
) {
  const { state } = input
  for (const transition of input.ownerTransitions) {
    const actor = input.actors.find((entry) => entry.id === transition.targetActorId)
    if (
      !actor ||
      actor.encounterId !== state.id ||
      !state.actorIds.includes(actor.id) ||
      transition.characterId !== (actor.kind === 'CHARACTER' ? actor.sourceId : null)
    )
      throw new Error('Live Session movement Concentration owner projection changed.')
    if (
      checksumCanonicalJson(movementPersistedTransitionState(transition.before)) !==
      checksumCanonicalJson(
        movementPersistedTransitionState(
          await callbacks.readTargetState(state, actor, transition.before.maximumHitPoints)
        )
      )
    )
      throw new Error('Live Session movement Concentration owner projection changed.')
  }
}

/** After cleanup runs, the committed owners must be exactly the planned ones. */
async function requireOwnerTransitionsAfter(
  input: {
    state: EncounterRunState
    actors: EncounterRunActorState[]
    ownerTransitions: MovementConcentrationExecutionDto['ownerTransitions']
    cleanup: MovementConcentrationEndDto['result']['applicationOutputs']['cleanup'] | null
  },
  callbacks: Pick<
    MovementConcentrationPersistenceCallbacks,
    'currentCharacterStreamVersion' | 'readTargetState'
  >
) {
  const { state } = input
  for (const transition of input.ownerTransitions) {
    const actor = input.actors.find((entry) => entry.id === transition.targetActorId)
    const characterVersion = input.cleanup?.characterOwnerTransitions.find(
      (entry) => entry.characterId === transition.characterId
    )
    if (
      !actor ||
      (characterVersion &&
        (await callbacks.currentCharacterStreamVersion(state, characterVersion.characterId)) !==
          characterVersion.afterStreamVersion)
    )
      throw new Error('Live Session movement Concentration cleanup differs from its plan.')
    if (
      checksumCanonicalJson(movementPersistedTransitionState(transition.after)) !==
      checksumCanonicalJson(
        movementPersistedTransitionState(
          await callbacks.readTargetState(state, actor, transition.after.maximumHitPoints)
        )
      )
    )
      throw new Error('Live Session movement Concentration cleanup differs from its plan.')
  }
}

/**
 * Persists one DO-prepared child in its parent's mutation. The enclosing caller has already
 * validated the revision cohort, parent command, and exact damage order against the movement
 * receipt; this helper validates the child's current persistence scope and cleanup projection.
 */
export async function persistLiveMovementConcentration(
  ctx: EncounterPersistenceTransaction & Parameters<typeof persistNativeConcentrationResult>[0],
  input: {
    state: EncounterRunState
    actors: EncounterRunActorState[]
    execution: MovementConcentrationExecutionDto
    parentOccurrenceId: string
    sourceCommandId: string
    userId: string
    authorizedCharacterIds: ReadonlySet<string>
    occurredAt: string
  },
  callbacks: MovementConcentrationPersistenceCallbacks
): Promise<EncounterRunActorState[]> {
  const execution = movementConcentrationExecutionDtoSchema.parse(input.execution)
  const { state, parentOccurrenceId } = input
  const result = execution.result
  const output = result.applicationOutputs
  const { maintainedStateId, ...damage } = output.application
  const expectedId = concentrationOccurrenceId(parentOccurrenceId, damage)
  if (
    execution.sourceCommandId !== input.sourceCommandId ||
    result.occurrenceId !== expectedId ||
    result.occurrenceVersion !== 1 ||
    output.occurrenceId !== expectedId ||
    output.parentOccurrenceId !== parentOccurrenceId ||
    result.evidence.source.gameSystemId !== state.gameSystemId ||
    result.evidence.source.definitionId !== output.concentrationDefinition.id ||
    result.evidence.source.checksum !== output.concentrationDefinition.checksum ||
    (output.outcome === 'SAVE_FAILURE') !== (output.cleanup !== null)
  )
    throw new Error('Live Session movement Concentration receipt scope mismatch.')
  const target = input.actors.find((actor) => actor.id === output.application.targetActorId)
  if (
    !target ||
    target.encounterId !== state.id ||
    target.systemId !== state.gameSystemId ||
    !state.actorIds.includes(target.id) ||
    (target.kind === 'CHARACTER' && !input.authorizedCharacterIds.has(target.sourceId)) ||
    (await concentrationTargetPinChanged(target, output.targetCharacter, (characterId) =>
      callbacks.currentCharacterStreamVersion(state, characterId)
    ))
  )
    throw new Error('Live Session movement Concentration target changed.')
  const store = createActiveRuleEffectStore(ctx)
  const slot = await store.findMaintainedStateById({
    encounterId: state.id,
    stateId: maintainedStateId
  })
  if (
    !slot ||
    slot.id !== maintainedStateId ||
    slot.encounterId !== state.id ||
    slot.ownerActorId !== target.id ||
    slot.maintenanceDefinitionId !== DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID
  )
    throw new Error('Live Session movement Concentration state changed.')
  const existing = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_publicId', (q) => q.eq('id', expectedId))
    .unique()
  if (existing) throw new Error('The concentration child occurrence already exists.')
  await requireOwnerTransitionsBefore(
    { state, actors: input.actors, ownerTransitions: execution.ownerTransitions },
    callbacks
  )
  const actors = output.cleanup
    ? await callbacks.applyCleanup({
        state,
        actors: input.actors,
        slot,
        cleanup: output.cleanup,
        authorizedCharacterIds: input.authorizedCharacterIds,
        occurredAt: input.occurredAt
      })
    : input.actors
  await requireOwnerTransitionsAfter(
    { state, actors, ownerTransitions: execution.ownerTransitions, cleanup: output.cleanup },
    callbacks
  )
  await persistNativeConcentrationResult(ctx, {
    state,
    result,
    commandId: concentrationCommandId(expectedId),
    fingerprint: checksumRuleDocument(execution),
    userId: input.userId,
    correlationId: parentOccurrenceId,
    occurredAt: input.occurredAt,
    metadata: {
      schemaVersion: 1,
      transition: 'START',
      definitionId: output.concentrationDefinition.id,
      expectedAggregateVersion: state.version,
      factsChecksum: result.initialFactsChecksum,
      optionalCombatSnapshotChecksum: state.optionalCombatSnapshotChecksum
    }
  })
  return actors
}

/**
 * Persists one Concentration end (D95) a movement contact caused. Its reason is re-derived from
 * the state the contact just committed, so a forged end is refused, and its cleanup, receipt and
 * chat entry follow the same path as an end from a direct action.
 */
export async function persistLiveMovementConcentrationEnd(
  ctx: EncounterPersistenceTransaction &
    Parameters<typeof persistNativeConcentrationEnd>[0] &
    Parameters<typeof postConcentrationEndMessage>[0],
  input: {
    state: EncounterRunState
    actors: EncounterRunActorState[]
    execution: MovementConcentrationEndDto
    parentOccurrenceId: string
    sourceCommandId: string
    userId: string
    authorizedCharacterIds: ReadonlySet<string>
    occurredAt: string
  },
  callbacks: MovementConcentrationPersistenceCallbacks
): Promise<EncounterRunActorState[]> {
  const execution = movementConcentrationEndDtoSchema.parse(input.execution)
  const { state, parentOccurrenceId } = input
  const output = execution.result.applicationOutputs
  const expectedId = concentrationEndOccurrenceId(parentOccurrenceId, output.maintainedStateId)
  const holder = input.actors.find((actor) => actor.id === output.ownerActorId)
  const slot = await createActiveRuleEffectStore(ctx).findMaintainedStateById({
    encounterId: state.id,
    stateId: output.maintainedStateId
  })
  if (
    state.automationMode === 'MANUAL' ||
    execution.sourceCommandId !== input.sourceCommandId ||
    execution.result.occurrenceId !== expectedId ||
    output.occurrenceId !== expectedId ||
    output.parentOccurrenceId !== parentOccurrenceId ||
    !holder ||
    holder.encounterId !== state.id ||
    !state.actorIds.includes(holder.id) ||
    !slot ||
    slot.ownerActorId !== holder.id ||
    slot.maintenanceDefinitionId !== DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID ||
    (await readConcentrationEndReason(ctx, { state, actor: holder, userId: input.userId })) !==
      output.reason
  )
    throw new Error('Live Session movement Concentration end is unexpected.')
  await requireOwnerTransitionsBefore(
    { state, actors: input.actors, ownerTransitions: execution.ownerTransitions },
    callbacks
  )
  const actors = await callbacks.applyCleanup({
    state,
    actors: input.actors,
    slot,
    cleanup: output.cleanup,
    authorizedCharacterIds: input.authorizedCharacterIds,
    occurredAt: input.occurredAt
  })
  await requireOwnerTransitionsAfter(
    { state, actors, ownerTransitions: execution.ownerTransitions, cleanup: output.cleanup },
    callbacks
  )
  const occurrenceId = await persistNativeConcentrationEnd(ctx, {
    state,
    parentOccurrenceId,
    end: output,
    userId: input.userId,
    correlationId: parentOccurrenceId,
    occurredAt: input.occurredAt
  })
  await postConcentrationEndMessage(ctx, {
    state,
    actor: holder,
    reason: output.reason,
    occurrenceId,
    userId: input.userId
  })
  return actors
}
