import {
  MAX_CONCENTRATION_DAMAGE_APPLICATIONS,
  concentrationDamageApplicationDtoSchema,
  concentrationDamageSourceLabelsDtoSchema,
  type ConcentrationDamageApplicationDto,
  type ConcentrationDamageSourceLabelsDto
} from '@artificer-toolkit/schema/shared/ruleExecutionConcentration'
import type { characterMechanicsApplicationDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionMechanics'
import type { StoredRuleExecutionResultDto } from '@artificer-toolkit/schema/shared/ruleExecutionResults'

type DamageBatch = {
  targetActorId: string
  applications: readonly ReturnType<typeof characterMechanicsApplicationDtoSchema.parse>[]
  /** The spell, action or turn effect that dealt this batch's damage, when it has a name. */
  sourceLabel?: string | null
}

function collectConcentrationDamage(batches: readonly DamageBatch[], preserveOrdinals: boolean) {
  const damage = batches.flatMap((batch) =>
    batch.applications.flatMap((application) =>
      application.kind === 'DAMAGE' && application.appliedAmount > 0
        ? [
            {
              application: {
                ordinal: application.ordinal,
                sourceNodeId: application.sourceNodeId,
                sourceOperationKey: application.sourceOperationKey,
                targetActorId: batch.targetActorId,
                appliedAmount: application.appliedAmount,
                damageTypeId: application.damageTypeId
              },
              sourceLabel: batch.sourceLabel ?? null
            }
          ]
        : []
    )
  )
  if (damage.length > MAX_CONCENTRATION_DAMAGE_APPLICATIONS)
    throw new Error('Finalized concentration damage exceeds the turn bound.')
  return damage.map(({ application, sourceLabel }, index) => ({
    application: concentrationDamageApplicationDtoSchema.parse({
      ...application,
      ordinal: preserveOrdinals ? application.ordinal : index
    }),
    sourceLabel
  }))
}

/** Turn receipts order outgoing before incoming; ordinals distinguish repeated graph applications. */
export function nativeConcentrationDamageApplications(
  batches: readonly DamageBatch[],
  preserveOrdinals = false
): ConcentrationDamageApplicationDto[] {
  return collectConcentrationDamage(batches, preserveOrdinals).map(({ application }) => application)
}

/** The display names of the same damage envelope, keyed like its applications. */
export function nativeConcentrationDamageSourceLabels(
  batches: readonly DamageBatch[],
  preserveOrdinals = false
): ConcentrationDamageSourceLabelsDto {
  return concentrationDamageSourceLabelsDtoSchema.parse(
    collectConcentrationDamage(batches, preserveOrdinals).flatMap(
      ({ application, sourceLabel }) => {
        const label = sourceLabel?.trim().slice(0, 160).trim()
        return label
          ? [
              {
                ordinal: application.ordinal,
                sourceNodeId: application.sourceNodeId,
                sourceOperationKey: application.sourceOperationKey,
                label
              }
            ]
          : []
      }
    )
  )
}
/** Names each turn-effect execution's damage after its authored effect definition. */
export async function labelTurnEffectDamage<
  TExecution extends DamageBatch & { definition: { authoredEffectId: string } }
>(
  executions: readonly TExecution[],
  readLabel: (definitionId: string) => Promise<string | null>
): Promise<(TExecution & { sourceLabel: string | null })[]> {
  const labels = new Map<string, Promise<string | null>>()
  return Promise.all(
    executions.map(async (execution) => {
      const definitionId = execution.definition.authoredEffectId
      let label = labels.get(definitionId)
      if (!label) {
        label = readLabel(definitionId)
        labels.set(definitionId, label)
      }
      return { ...execution, sourceLabel: await label }
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
