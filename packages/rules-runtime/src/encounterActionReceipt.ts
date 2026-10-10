import type { EncounterMaintainedEffectStateRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { EncounterAttackActionTransitionDto } from '@artificer-toolkit/schema/projections/encounterAttackAction'
import type { maintainedEffectTransitionDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionMechanics'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import type { projectNativeActionEffectTransitions } from './encounterActionEffectReceipts.js'
import type { EncounterActionEconomyConsumption } from './encounterActionEconomyConsumption.js'
import type { nativeConcentrationDamageApplications } from './encounterConcentrationDamage.js'
import type { advanceNativeActionGraphs } from './encounterActionExecution.js'
import type {
  finishNativeActionMechanicsSettlement,
  NativeEncounterActionMechanicsInput,
  planNativeEncounterAreaSourceSpend
} from './encounterActionMechanicsPlan.js'
import type { encounterAreaTargetLegendaryResistance } from './encounterAreaLegendaryResistance.js'

/** Recorded so a GM undo restores the allowance exactly; an override may exceed the maximum. */
function actionEconomyReceipt(consumption: EncounterActionEconomyConsumption | null) {
  return consumption
    ? {
        definitionId: consumption.definitionId,
        definitionVersion: consumption.definitionVersion,
        definitionChecksum: consumption.definitionChecksum,
        maximum: consumption.maximum,
        beforeUsed: consumption.beforeUsed,
        afterUsed: consumption.afterUsed
      }
    : null
}

/** Builds the stored completed receipt from already-settled action facts. */
export function buildEncounterActionStoredExecution(input: {
  prepared: Pick<
    NativeEncounterActionMechanicsInput['prepared'],
    'state' | 'source' | 'actor' | 'target'
  >
  execution: Extract<Awaited<ReturnType<typeof advanceNativeActionGraphs>>, { kind: 'COMPLETE' }>
  occurrenceId: string
  occurrenceVersion: number
  settled: ReturnType<typeof finishNativeActionMechanicsSettlement>
  effects: ReturnType<typeof projectNativeActionEffectTransitions>
  maintainedState: EncounterMaintainedEffectStateRecord | null
  maintenanceTransition: ReturnType<typeof maintainedEffectTransitionDtoSchema.parse> | null
  actionEconomy: EncounterActionEconomyConsumption | null
  attackAction: EncounterAttackActionTransitionDto | null
  /** Set when the batch is one creature's outcome of a point-area action rooted at `parentOccurrenceId`. */
  area?: {
    parentOccurrenceId: string
    resistance: ReturnType<typeof encounterAreaTargetLegendaryResistance> | null
  }
}) {
  const { prepared, execution, occurrenceId, occurrenceVersion, settled, effects } = input
  const { state, source, actor, target } = prepared
  const { mechanics, resourceReceipt, featureResourceReceipt } = settled
  const { stateEffectTransitions, activeEffectTransitions } = effects
  const actionEconomyTransition = actionEconomyReceipt(input.actionEconomy)
  const parentOccurrenceId = input.area ? { parentOccurrenceId: input.area.parentOccurrenceId } : {}
  const sourceCharacterStreamVersion =
    settled.sourceCharacterStreamVersion ??
    (source.kind === 'CHARACTER_ACTION' && actor.id !== target.id
      ? (input.maintenanceTransition?.characterOwnerTransitions.find(
          (transition) => transition.characterId === source.characterId
        )?.afterStreamVersion ?? null)
      : null)
  return storedRuleExecutionResultDtoSchema.parse({
    status: 'COMPLETE',
    occurrenceId,
    occurrenceVersion,
    initialFactsChecksum: execution.initialFactsChecksum,
    outputs: execution.execution.outputs,
    evidence: execution.execution.evidence,
    ...(execution.phaseReceipts ? { phaseReceipts: execution.phaseReceipts } : {}),
    applicationOutputs:
      target.kind === 'CHARACTER'
        ? {
            kind: 'CHARACTER_MECHANICS_BATCH',
            schemaVersion: 1,
            occurrenceId,
            ...parentOccurrenceId,
            sourceActorId: actor.id,
            sourceCharacterId: source.kind === 'CHARACTER_ACTION' ? source.characterId : null,
            targetActorId: target.id,
            sourceCharacterStreamVersion,
            targetCharacterStreamVersion: mechanics.characterStreamVersion,
            resourceConsumption: resourceReceipt,
            spellCastConsumption: null,
            featureResourceConsumption: featureResourceReceipt,
            targetFeatureResourceConsumption: null,
            sourceItemUseStateTransition: settled.sourceItemUseStateTransition,
            sourceItemConsumption: settled.itemConsumptionReceipt,
            actionEconomyTransition,
            ...(input.attackAction ? { attackActionTransition: input.attackAction } : {}),
            activeEffectTransitions: activeEffectTransitions.map(
              ({ targetActorId: _targetActorId, ...transition }) => ({
                ...transition,
                characterId: target.sourceId,
                sourceEncounterId: state.id,
                maintainedEffectStateId: input.maintainedState?.id ?? null
              })
            ),
            stateEffectTransitions,
            ...(input.maintenanceTransition
              ? { maintenanceTransition: input.maintenanceTransition }
              : {}),
            d20: execution.d20,
            nestedD20: execution.nestedD20,
            targetTransition: mechanics.targetTransition,
            applications: mechanics.receiptApplications
          }
        : {
            kind: 'ENCOUNTER_ACTOR_MECHANICS_BATCH',
            schemaVersion: 1,
            occurrenceId,
            ...parentOccurrenceId,
            sourceActorId: actor.id,
            targetActorId: target.id,
            ...(input.maintenanceTransition ||
            settled.sourceItemUseStateTransition ||
            settled.itemConsumptionReceipt
              ? {
                  sourceCharacterId: source.kind === 'CHARACTER_ACTION' ? source.characterId : null
                }
              : {}),
            sourceCharacterStreamVersion,
            resourceConsumption: resourceReceipt,
            featureResourceConsumption: featureResourceReceipt,
            targetFeatureResourceConsumption: input.area?.resistance?.charge ?? null,
            legendaryResistance: input.area?.resistance?.legendaryResistance ?? null,
            sourceItemUseStateTransition: settled.sourceItemUseStateTransition,
            sourceItemConsumption: settled.itemConsumptionReceipt,
            actionEconomyTransition,
            ...(input.attackAction ? { attackActionTransition: input.attackAction } : {}),
            activeEffectTransitions,
            stateEffectTransitions,
            ...(input.maintenanceTransition
              ? { maintenanceTransition: input.maintenanceTransition }
              : {}),
            d20: execution.d20,
            nestedD20: execution.nestedD20,
            targetTransition: mechanics.targetTransition,
            applications: mechanics.receiptApplications
          }
  })
}

/**
 * Builds the stored root of a committed point-area action. It holds the caster's one spend and
 * names the creatures settled under it; each creature's outcome is its own child receipt.
 */
export function buildEncounterAreaStoredExecution(input: {
  occurrenceId: string
  occurrenceVersion: number
  actorId: string
  sourceCharacterId: string | null
  caughtChecksum: string
  removedActorIds: readonly string[]
  targetOccurrenceIds: readonly string[]
  damage: ReturnType<typeof nativeConcentrationDamageApplications>
  spend: Pick<
    ReturnType<typeof planNativeEncounterAreaSourceSpend>,
    | 'sourceCharacterStreamVersion'
    | 'resourceReceipt'
    | 'featureResourceReceipt'
    | 'sourceItemUseStateTransition'
    | 'itemConsumptionReceipt'
  >
  actionEconomy: EncounterActionEconomyConsumption | null
  attackAction: EncounterAttackActionTransitionDto | null
}) {
  const { spend } = input
  return storedRuleExecutionResultDtoSchema.parse({
    status: 'AGGREGATE_CHOICE_COMPLETE',
    schemaVersion: 1,
    occurrenceId: input.occurrenceId,
    occurrenceVersion: input.occurrenceVersion,
    applicationOutputs: {
      kind: 'ENCOUNTER_AREA_ACTION',
      schemaVersion: 1,
      occurrenceId: input.occurrenceId,
      sourceActorId: input.actorId,
      sourceCharacterId: input.sourceCharacterId,
      caughtChecksum: input.caughtChecksum,
      removedActorIds: input.removedActorIds,
      targetOccurrenceIds: input.targetOccurrenceIds,
      damage: input.damage,
      sourceCharacterStreamVersion: spend.sourceCharacterStreamVersion,
      resourceConsumption: spend.resourceReceipt,
      featureResourceConsumption: spend.featureResourceReceipt,
      sourceItemUseStateTransition: spend.sourceItemUseStateTransition,
      sourceItemConsumption: spend.itemConsumptionReceipt,
      actionEconomyTransition: actionEconomyReceipt(input.actionEconomy),
      ...(input.attackAction ? { attackActionTransition: input.attackAction } : {})
    }
  })
}
