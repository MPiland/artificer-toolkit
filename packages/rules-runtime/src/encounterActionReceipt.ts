import type { EncounterMaintainedEffectStateRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { maintainedEffectTransitionDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionMechanics'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import type { projectNativeActionEffectTransitions } from './encounterActionEffectReceipts.js'
import type { EncounterActionEconomyConsumption } from './encounterActionEconomyConsumption.js'
import type { advanceNativeActionGraphs } from './encounterActionExecution.js'
import type {
  finishNativeActionMechanicsSettlement,
  NativeEncounterActionMechanicsInput
} from './encounterActionMechanicsPlan.js'

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
}) {
  const { prepared, execution, occurrenceId, occurrenceVersion, settled, effects } = input
  const { state, source, actor, target } = prepared
  const { mechanics, resourceReceipt, featureResourceReceipt } = settled
  const { stateEffectTransitions, activeEffectTransitions } = effects
  // Recorded so a GM undo restores the allowance exactly; an override may exceed the maximum.
  const actionEconomyTransition = input.actionEconomy
    ? {
        definitionId: input.actionEconomy.definitionId,
        definitionVersion: input.actionEconomy.definitionVersion,
        definitionChecksum: input.actionEconomy.definitionChecksum,
        maximum: input.actionEconomy.maximum,
        beforeUsed: input.actionEconomy.beforeUsed,
        afterUsed: input.actionEconomy.afterUsed
      }
    : null
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
            actionEconomyTransition,
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
            sourceActorId: actor.id,
            targetActorId: target.id,
            ...(input.maintenanceTransition || settled.sourceItemUseStateTransition
              ? {
                  sourceCharacterId: source.kind === 'CHARACTER_ACTION' ? source.characterId : null
                }
              : {}),
            sourceCharacterStreamVersion,
            resourceConsumption: resourceReceipt,
            featureResourceConsumption: featureResourceReceipt,
            sourceItemUseStateTransition: settled.sourceItemUseStateTransition,
            actionEconomyTransition,
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
