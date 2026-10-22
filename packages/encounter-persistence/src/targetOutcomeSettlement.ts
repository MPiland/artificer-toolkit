import type { LiveSessionForcedMovement } from '@artificer-toolkit/schema/api/liveSessionEncounterAction'
import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { TargetOutcomeTransitionDto } from '@artificer-toolkit/schema/shared/ruleExecutionMechanics'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { deriveEncounterCharacterMechanicsEventCommandId } from '@artificer-toolkit/rules-runtime/encounterCharacterMechanicsBatch'
import type { EncounterMechanicsBatchInput } from '@artificer-toolkit/rules-runtime/encounterMechanicsBatchPlan'
import type { EncounterMechanicsBatchResult } from './mechanicsBatchPersistence.js'

type TargetOutcomeSettlementInput = {
  state: { id: string; version: number }
  target: EncounterRunActorState
  occurrenceId: string
  sourceCommandId: string
  occurredAt: string
  applyMechanics(
    batch: Omit<EncounterMechanicsBatchInput, 'expectedCharacterStreamVersion'>
  ): Promise<EncounterMechanicsBatchResult>
}

/** The command id of the one mechanics batch a won check applies to its target. */
export function targetOutcomeCommandId(
  input: Pick<TargetOutcomeSettlementInput, 'target' | 'occurrenceId' | 'sourceCommandId'>
) {
  const { target, occurrenceId, sourceCommandId } = input
  return deriveEncounterCharacterMechanicsEventCommandId({
    occurrenceId,
    sourceCommandId,
    phase: 'DIRECT_ACTION_OUTCOME',
    ordinal: 0,
    targetCharacterId: target.kind === 'CHARACTER' ? target.sourceId : target.id
  })
}

/**
 * A won check whose success runs its outcome on its target, a contest's (Shove, D105) or a fixed
 * DC's (D173), re-applies the one mechanics batch the room planned on the target, as an action's
 * outcome does, and lands its pushes on the Scene in the commit (D157). It refuses an outcome whose
 * pushes or mechanics receipt differ from the plan.
 */
export async function settleTargetOutcome(
  input: TargetOutcomeSettlementInput & {
    planned: TargetOutcomeTransitionDto
    forcedMovements: readonly LiveSessionForcedMovement[]
  }
) {
  const { planned, state, target, occurrenceId, sourceCommandId, occurredAt } = input
  if (
    checksumCanonicalJson(planned.forcedMovements) !==
      checksumCanonicalJson(
        input.forcedMovements.map(({ direction, feet, upTo }) => ({ direction, feet, upTo }))
      ) ||
    input.forcedMovements.some(({ targetActorId }) => targetActorId !== target.id)
  )
    throw new Error('The won outcome does not match its target.')
  if (!planned.mechanics) return { target, stateTransition: planned }
  const { targetTransition, applications } = planned.mechanics
  const mechanics = await input.applyMechanics({
    encounterId: state.id,
    targetActorId: target.id,
    expectedEncounterVersion: state.version,
    occurrenceId,
    sourceCommandId,
    commandId: targetOutcomeCommandId(input),
    occurredAt,
    applications: applications.map((application) => ({ ...application, targetActorId: target.id })),
    effectiveMaximumHitPoints: targetTransition.before.maximumHitPoints,
    effectiveScalarValues: targetTransition.before.scalarValues,
    forceVersionAdvance: false
  })
  if (
    checksumCanonicalJson(mechanics.receiptApplications) !== checksumCanonicalJson(applications) ||
    checksumCanonicalJson(mechanics.targetTransition) !== checksumCanonicalJson(targetTransition)
  )
    throw new Error('The won outcome mechanics receipt mismatch.')
  return { target: mechanics.updatedActor, stateTransition: planned }
}
