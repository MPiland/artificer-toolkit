import {
  concentrationCommandId,
  concentrationOccurrenceId
} from '@artificer-toolkit/rules-runtime/encounterConcentrationIdentity'
import { DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID } from '@artificer-toolkit/rules-runtime/systems/dnd5e/concentrationIdentity'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import {
  movementConcentrationExecutionDtoSchema,
  type MovementConcentrationExecutionDto
} from '@artificer-toolkit/schema/shared/ruleExecutionMovementConcentration'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { MutationCtx } from '../_generated/server'
import { persistNativeConcentrationResult } from '../encounters/actionChildPersistence'
import { createActiveRuleEffectStore } from '@artificer-toolkit/encounter-persistence/effectStore'
import { applyLiveConcentrationCleanup } from './concentrationCleanupCommit'
import {
  movementPersistedTransitionState,
  readLiveCharacterStreamVersion,
  readLiveMovementTargetState
} from './encounterMovementTargetState'

/**
 * Persists one DO-prepared child in its parent's mutation. The enclosing caller has already
 * validated the revision cohort, parent command, and exact damage order against the movement
 * receipt; this helper validates the child's current persistence scope and cleanup projection.
 */
export async function persistLiveMovementConcentration(
  ctx: MutationCtx,
  input: {
    state: EncounterRunState
    actors: EncounterRunActorState[]
    execution: MovementConcentrationExecutionDto
    parentOccurrenceId: string
    sourceCommandId: string
    userId: string
    authorizedCharacterIds: ReadonlySet<string>
    occurredAt: string
  }
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
    target.kind !== 'CHARACTER' ||
    !input.authorizedCharacterIds.has(target.sourceId) ||
    (await readLiveCharacterStreamVersion(ctx, state, target.sourceId)) !==
      output.targetCharacter.streamVersion
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
  for (const transition of execution.ownerTransitions) {
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
        await readLiveMovementTargetState(ctx, state, actor, transition.before.maximumHitPoints)
      )
    )
      throw new Error('Live Session movement Concentration owner projection changed.')
  }
  const actors = output.cleanup
    ? await applyLiveConcentrationCleanup(ctx, {
        state,
        actors: input.actors,
        slot,
        cleanup: output.cleanup,
        authorizedCharacterIds: input.authorizedCharacterIds,
        occurredAt: input.occurredAt
      })
    : input.actors
  for (const transition of execution.ownerTransitions) {
    const actor = actors.find((entry) => entry.id === transition.targetActorId)
    const characterVersion = output.cleanup?.characterOwnerTransitions.find(
      (entry) => entry.characterId === transition.characterId
    )
    if (
      !actor ||
      (characterVersion &&
        (await readLiveCharacterStreamVersion(ctx, state, characterVersion.characterId)) !==
          characterVersion.afterStreamVersion)
    )
      throw new Error('Live Session movement Concentration cleanup differs from its plan.')
    if (
      checksumCanonicalJson(movementPersistedTransitionState(transition.after)) !==
      checksumCanonicalJson(
        await readLiveMovementTargetState(ctx, state, actor, transition.after.maximumHitPoints)
      )
    )
      throw new Error('Live Session movement Concentration cleanup differs from its plan.')
  }
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
