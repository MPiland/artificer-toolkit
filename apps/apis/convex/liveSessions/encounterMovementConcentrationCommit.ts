import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { MovementConcentrationExecutionDto } from '@artificer-toolkit/schema/shared/ruleExecutionMovementConcentration'
import { persistLiveMovementConcentration as persistMovementConcentration } from '@artificer-toolkit/encounter-persistence/liveMovementConcentrationPersistence'
import type { MutationCtx } from '../_generated/server'
import { applyLiveConcentrationCleanup } from './concentrationCleanupCommit'
import {
  readLiveCharacterStreamVersion,
  readLiveMovementTargetState
} from './encounterMovementTargetState'
import { encounterWriteTransaction } from '../encounters/encounterPorts'

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
  return persistMovementConcentration(encounterWriteTransaction(ctx), input, {
    applyCleanup: (cleanup) => applyLiveConcentrationCleanup(ctx, cleanup),
    currentCharacterStreamVersion: (state, id) => readLiveCharacterStreamVersion(ctx, state, id),
    readTargetState: (state, actor, plannedMaximumHitPoints) =>
      readLiveMovementTargetState(ctx, state, actor, plannedMaximumHitPoints)
  })
}
