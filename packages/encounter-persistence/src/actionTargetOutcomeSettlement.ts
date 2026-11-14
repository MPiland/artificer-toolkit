import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { ServerRuleExecutionApplicationOutputsDto } from '@artificer-toolkit/schema/shared/ruleExecutionApplicationOutputs'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { EncounterMechanicsBatchInput } from '@artificer-toolkit/rules-runtime/encounterMechanicsBatchPlan'
import { settleActionSourceSpend, type SpendMutation } from './actionSourceSpend.js'
import type { EncounterMechanicsBatchResult } from './mechanicsBatchPersistence.js'
import type { EncounterWriteContext } from './store.js'

/**
 * Settles one target's outcome of an action, a single-target action's or one creature an area caught:
 * the one mechanics batch the room planned on the target, with every spend that rides it, checked
 * against the room's receipt, and then what the target spent of its own against the outcome (a
 * Legendary Resistance charge). `label` names the committing action in the charge error. Returns the
 * batch result and the target as settled.
 *
 * The caller checks what only it plans on the batch: the receipts of `extra` and `sourceMutation`.
 */
export async function settleActionTargetOutcome(
  ctx: EncounterWriteContext,
  input: {
    state: EncounterRunState
    target: EncounterRunActorState
    batch: Extract<
      ServerRuleExecutionApplicationOutputsDto,
      { kind: 'CHARACTER_MECHANICS_BATCH' | 'ENCOUNTER_ACTOR_MECHANICS_BATCH' }
    >
    label: 'action' | 'area'
    occurrenceId: string
    sourceCommandId: string
    commandId: string
    occurredAt: string
    forceVersionAdvance: boolean
    /** The source's own spend, when the source is this target. */
    sourceMutation: SpendMutation
    /** What else the outcome does to the target in the same batch. */
    extra: Pick<
      EncounterMechanicsBatchInput,
      'releaseHeldItemInstanceId' | 'degradeItem' | 'enterForm'
    >
    applyMechanics(
      batch: Omit<EncounterMechanicsBatchInput, 'expectedCharacterStreamVersion'>
    ): Promise<EncounterMechanicsBatchResult>
  }
) {
  const { state, target, batch } = input
  const mechanics = await input.applyMechanics({
    encounterId: state.id,
    expectedEncounterVersion: state.version,
    occurrenceId: input.occurrenceId,
    sourceCommandId: input.sourceCommandId,
    occurredAt: input.occurredAt,
    targetActorId: target.id,
    commandId: input.commandId,
    ...input.extra,
    applications: batch.applications.map((application) => ({
      ...application,
      targetActorId: target.id
    })),
    effectiveMaximumHitPoints: batch.targetTransition.before.maximumHitPoints,
    grantedMaximumHitPoints: batch.targetTransition.grantedMaximumHitPoints,
    effectiveScalarValues: batch.targetTransition.before.scalarValues,
    forceVersionAdvance: input.forceVersionAdvance,
    ...input.sourceMutation
  })
  if (
    checksumCanonicalJson(mechanics.receiptApplications) !==
      checksumCanonicalJson(batch.applications) ||
    checksumCanonicalJson(mechanics.targetTransition) !==
      checksumCanonicalJson(batch.targetTransition) ||
    (batch.kind === 'CHARACTER_MECHANICS_BATCH' &&
      batch.targetCharacterStreamVersion !== mechanics.characterStreamVersion)
  )
    throw new Error('Live Session mechanics receipt mismatch.')
  // A Legendary Resistance the target used spends one of its own charges with the outcome.
  const charge =
    batch.kind === 'ENCOUNTER_ACTOR_MECHANICS_BATCH' ? batch.targetFeatureResourceConsumption : null
  if (charge && charge.ownerActorId !== target.id)
    throw new Error(`Live Session ${input.label} charge scope mismatch.`)
  return {
    mechanics,
    target: charge
      ? await settleActionSourceSpend(ctx, {
          encounterId: state.id,
          source: mechanics.updatedActor,
          spend: {
            featureResourceConsumption: charge,
            actionEconomyTransition: null,
            attackActionTransition: undefined
          },
          economyOverridden: false
        })
      : mechanics.updatedActor
  }
}
