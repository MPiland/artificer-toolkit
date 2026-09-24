import {
  MAX_CONCENTRATION_DAMAGE_APPLICATIONS,
  concentrationDamageApplicationDtoSchema,
  type ConcentrationDamageApplicationDto
} from '@artificer-toolkit/schema/shared/ruleExecutionConcentration'
import type { characterMechanicsApplicationDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionMechanics'
import type { StoredRuleExecutionResultDto } from '@artificer-toolkit/schema/shared/ruleExecutionResults'

/** Turn receipts order outgoing before incoming; ordinals distinguish repeated graph applications. */
export function nativeConcentrationDamageApplications(
  batches: readonly {
    targetActorId: string
    applications: readonly ReturnType<typeof characterMechanicsApplicationDtoSchema.parse>[]
  }[],
  preserveOrdinals = false
): ConcentrationDamageApplicationDto[] {
  const damage = batches.flatMap((batch) =>
    batch.applications.flatMap((application) =>
      application.kind === 'DAMAGE' && application.appliedAmount > 0
        ? [
            {
              ordinal: application.ordinal,
              sourceNodeId: application.sourceNodeId,
              sourceOperationKey: application.sourceOperationKey,
              targetActorId: batch.targetActorId,
              appliedAmount: application.appliedAmount,
              damageTypeId: application.damageTypeId
            }
          ]
        : []
    )
  )
  if (damage.length > MAX_CONCENTRATION_DAMAGE_APPLICATIONS)
    throw new Error('Finalized concentration damage exceeds the turn bound.')
  return damage.map((application, index) =>
    concentrationDamageApplicationDtoSchema.parse({
      ...application,
      ordinal: preserveOrdinals ? application.ordinal : index
    })
  )
}

export function nativeConcentrationParentDamage(
  result: StoredRuleExecutionResultDto
): ConcentrationDamageApplicationDto[] {
  if (
    result.status === 'COMPLETE' &&
    (result.applicationOutputs.kind === 'CHARACTER_MECHANICS_BATCH' ||
      result.applicationOutputs.kind === 'ENCOUNTER_ACTOR_MECHANICS_BATCH')
  )
    return nativeConcentrationDamageApplications([result.applicationOutputs], true)
  if (
    result.status === 'AGGREGATE_CHOICE_COMPLETE' &&
    result.applicationOutputs.kind === 'CLEAVING_DAMAGE' &&
    result.applicationOutputs.outcome === 'APPLIED' &&
    result.applicationOutputs.damage.appliedAmount > 0
  )
    return [
      concentrationDamageApplicationDtoSchema.parse({
        ordinal: 0,
        sourceNodeId: result.applicationOutputs.damage.sourceNodeId,
        sourceOperationKey: result.applicationOutputs.damage.sourceOperationKey,
        targetActorId: result.applicationOutputs.targetActorId,
        appliedAmount: result.applicationOutputs.damage.appliedAmount,
        damageTypeId: result.applicationOutputs.damage.damageTypeId
      })
    ]
  if (result.status === 'BATCH_COMPLETE' && result.batchKind === 'ENCOUNTER_TURN_ACTIVE_EFFECTS')
    return nativeConcentrationDamageApplications(result.executions)
  if (result.status === 'TURN_LIFECYCLE_COMPLETE')
    return nativeConcentrationDamageApplications(
      [result.outgoingTurn, result.incomingTurn].flatMap((phase) =>
        phase.kind === 'EXECUTED' ? phase.executions : []
      )
    )
  return []
}
