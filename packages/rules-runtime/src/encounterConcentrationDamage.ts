import {
  MAX_CONCENTRATION_DAMAGE_APPLICATIONS,
  concentrationDamageApplicationDtoSchema,
  concentrationDamageSourceLabelsDtoSchema,
  type ConcentrationDamageApplicationDto,
  type ConcentrationDamageSourceLabelsDto
} from '@artificer-toolkit/schema/shared/ruleExecutionConcentration'
import type { characterMechanicsApplicationDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionMechanics'
import type { StoredRuleExecutionResultDto } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import type { TurnCoordinatorRootDto } from '@artificer-toolkit/schema/shared/ruleExecutionTurnPending'
import type { StagedTurnZonePlanDto } from '@artificer-toolkit/schema/shared/ruleExecutionTurnPhaseEvidence'
import type { MeleeRetaliationEvidenceDto } from '@artificer-toolkit/schema/shared/ruleExecutionEffectEvidence'

type DamageBatch = {
  targetActorId: string
  applications: readonly ReturnType<typeof characterMechanicsApplicationDtoSchema.parse>[]
  /** The spell, action or turn effect that dealt this batch's damage, when it has a name. */
  sourceLabel?: string | null
  /** The actor that dealt this batch's damage, when its source names one. */
  damagerActorId?: string
}

/**
 * Each batch is one damage source (an action, spell or turn effect against one target), so it makes
 * one Concentration check at the DC of its total applied damage (SRD 5.1), identified by its first
 * damage row.
 */
function collectConcentrationDamage(batches: readonly DamageBatch[], preserveOrdinals: boolean) {
  const damage = batches.flatMap((batch) => {
    const rows = batch.applications.flatMap((application) =>
      application.kind === 'DAMAGE' && application.appliedAmount > 0 ? [application] : []
    )
    const [first] = rows
    if (!first) return []
    return [
      {
        application: {
          ordinal: first.ordinal,
          sourceNodeId: first.sourceNodeId,
          sourceOperationKey: first.sourceOperationKey,
          targetActorId: batch.targetActorId,
          appliedAmount: rows.reduce((total, row) => total + row.appliedAmount, 0),
          damageTypeId: rows.every((row) => row.damageTypeId === first.damageTypeId)
            ? first.damageTypeId
            : null,
          ...(batch.damagerActorId ? { damagerActorId: batch.damagerActorId } : {})
        },
        sourceLabel: batch.sourceLabel ?? null
      }
    ]
  })
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
/**
 * Each executed Legendary Action of a turn as one damage source against its target, named after
 * its option, then the zones its melee hit set off against the owner. A turn orders them between
 * its outgoing and incoming turn effects.
 */
export function legendaryActionDamage(
  actions: TurnCoordinatorRootDto['completedLegendaryActions']
): DamageBatch[] {
  return (actions ?? []).flatMap(({ choice, resolution }) => {
    if (
      resolution.kind !== 'EXECUTED' ||
      (resolution.application.kind !== 'CHARACTER_MECHANICS_BATCH' &&
        resolution.application.kind !== 'ENCOUNTER_ACTOR_MECHANICS_BATCH')
    )
      return []
    return nativeActionDamage({
      targetActorId: resolution.application.targetActorId,
      applications: resolution.application.applications,
      sourceLabel:
        choice.options.find((option) => option.optionId === resolution.selectedOptionId)?.label ??
        null,
      damagerActorId: choice.ownerActorId,
      ...(resolution.application.meleeRetaliation
        ? { meleeRetaliation: resolution.application.meleeRetaliation }
        : {})
    })
  })
}

/** A turn's zone phase, staged or executed, as damage sources against the creature whose boundary it is. */
export function zoneEffectDamage(phase: StagedTurnZonePlanDto | undefined): DamageBatch[] {
  return (phase?.executions ?? []).map(({ candidate, applications }) => ({
    targetActorId: candidate.candidate.targetActorId,
    applications,
    ...(candidate.candidate.sourceActorId
      ? { damagerActorId: candidate.candidate.sourceActorId }
      : {})
  }))
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

/** Each zone a melee hit set off (D153) as its own damage source against the attacker. */
export function meleeRetaliationDamage(
  evidence: MeleeRetaliationEvidenceDto | undefined
): DamageBatch[] {
  return (evidence?.executions ?? []).map(({ candidate, applications }) => ({
    targetActorId: candidate.candidate.targetActorId,
    applications
  }))
}

/** An action's damage: its target's batch, then the zones its melee hit set off against the attacker. */
export function nativeActionDamage(
  batch: DamageBatch & { meleeRetaliation?: MeleeRetaliationEvidenceDto }
): DamageBatch[] {
  return [batch, ...meleeRetaliationDamage(batch.meleeRetaliation)]
}

export function nativeConcentrationParentDamage(
  result: StoredRuleExecutionResultDto
): ConcentrationDamageApplicationDto[] {
  if (
    result.status === 'COMPLETE' &&
    (result.applicationOutputs.kind === 'CHARACTER_MECHANICS_BATCH' ||
      result.applicationOutputs.kind === 'ENCOUNTER_ACTOR_MECHANICS_BATCH')
  )
    return nativeConcentrationDamageApplications(
      nativeActionDamage(result.applicationOutputs),
      true
    )
  if (
    result.status === 'AGGREGATE_CHOICE_COMPLETE' &&
    result.applicationOutputs.kind === 'ENCOUNTER_AREA_ACTION'
  )
    return result.applicationOutputs.damage
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
  // A turn deals its outgoing effects, then its Legendary Actions, then its incoming effects.
  if (result.status === 'BATCH_COMPLETE' && result.batchKind === 'ENCOUNTER_TURN_ACTIVE_EFFECTS')
    return nativeConcentrationDamageApplications([
      ...legendaryActionDamage(result.legendaryActions),
      ...result.executions
    ])
  if (result.status === 'TURN_LIFECYCLE_COMPLETE')
    return nativeConcentrationDamageApplications([
      ...(result.outgoingTurn.kind === 'EXECUTED' ? result.outgoingTurn.executions : []),
      ...zoneEffectDamage(result.outgoingZoneEffects),
      ...legendaryActionDamage(result.legendaryActions),
      ...(result.incomingTurn.kind === 'EXECUTED' ? result.incomingTurn.executions : []),
      ...zoneEffectDamage(result.incomingZoneEffects)
    ])
  if (result.status === 'INITIATIVE_COMPLETE')
    return nativeConcentrationDamageApplications(legendaryActionDamage(result.legendaryActions))
  return []
}
