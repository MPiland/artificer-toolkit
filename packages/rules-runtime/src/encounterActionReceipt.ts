import type { EncounterMaintainedEffectStateRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { EncounterAttackActionTransitionDto } from '@artificer-toolkit/schema/projections/encounterAttackAction'
import {
  encounterFailedCounterReceiptDtoSchema,
  type EncounterCastReactionPinDto,
  type EncounterCounterCheckEvidenceDto,
  type EncounterFailedCounterDto
} from '@artificer-toolkit/schema/shared/ruleExecutionReactionChoice'
import type { ServerCompletedRuleExecutionDto } from '@artificer-toolkit/schema/shared/rulesExecution'
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
import type { encounterTargetLegendaryResistance } from './encounterAreaLegendaryResistance.js'
import { characterSpellConsumptionReceipt } from './encounterActionMechanicsPlan.js'
import type { encounterReactionAudit } from './encounterReactionChoice.js'

/** Recorded so a GM undo restores the allowance exactly; an override may exceed the maximum. */
export function actionEconomyReceipt(consumption: EncounterActionEconomyConsumption | null) {
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
  area?: { parentOccurrenceId: string }
  /** The target's decided Legendary Resistance and the charge it cost, when its failed save offered one. */
  resistance?: ReturnType<typeof encounterTargetLegendaryResistance> | null
  /** The target Character's decided reaction to the hit and what using it spent and created. */
  reaction?: {
    audit: ReturnType<typeof encounterReactionAudit>
    spent: {
      spellConsumption: Parameters<typeof characterSpellConsumptionReceipt>[0]
      economy: EncounterActionEconomyConsumption
      activeEffectTransitions: ReturnType<
        typeof projectNativeActionEffectTransitions
      >['activeEffectTransitions']
    } | null
  } | null
  /** The target also failed a counter against this cast, so its slot spend rides in this batch (D127). */
  targetFailedCounterSpend?: boolean
  /** The effects of reactions the target used on being chosen as this cast's target, which land with its outcome. */
  reactionEffectTransitions?: ReturnType<
    typeof projectNativeActionEffectTransitions
  >['activeEffectTransitions']
}) {
  const { prepared, execution, occurrenceId, occurrenceVersion, settled, effects } = input
  const { state, source, actor, target } = prepared
  const { mechanics, resourceReceipt, featureResourceReceipt } = settled
  const { stateEffectTransitions, activeEffectTransitions } = effects
  const actionEconomyTransition = actionEconomyReceipt(input.actionEconomy)
  const characterEffectReceipt = (
    transition: (typeof activeEffectTransitions)[number],
    maintainedEffectStateId: string | null
  ) => {
    const { targetActorId: _targetActorId, ...receipt } = transition
    return {
      ...receipt,
      characterId: target.sourceId,
      sourceEncounterId: state.id,
      maintainedEffectStateId
    }
  }
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
            sourceCharacterId: actor.kind === 'CHARACTER' ? actor.sourceId : null,
            targetActorId: target.id,
            sourceCharacterStreamVersion,
            targetCharacterStreamVersion: mechanics.characterStreamVersion,
            resourceConsumption: resourceReceipt,
            spellCastConsumption: settled.spellConsumptionReceipt,
            featureResourceConsumption: featureResourceReceipt,
            targetFeatureResourceConsumption: null,
            sourceItemUseStateTransition: settled.sourceItemUseStateTransition,
            sourceItemConsumption: settled.itemConsumptionReceipt,
            actionEconomyTransition,
            ...(input.attackAction ? { attackActionTransition: input.attackAction } : {}),
            activeEffectTransitions: [
              ...activeEffectTransitions.map((transition) =>
                characterEffectReceipt(transition, input.maintainedState?.id ?? null)
              ),
              ...(input.reactionEffectTransitions ?? []).map((transition) =>
                characterEffectReceipt(transition, null)
              )
            ],
            stateEffectTransitions,
            reaction: input.reaction
              ? {
                  selection: input.reaction.audit.selection,
                  reaction: input.reaction.audit.reaction,
                  choiceExecution: input.reaction.audit.choiceExecution,
                  originalExecutionChecksum: input.reaction.audit.originalExecutionChecksum,
                  adjustment: input.reaction.audit.adjustment,
                  spellCastConsumption: characterSpellConsumptionReceipt(
                    input.reaction.spent?.spellConsumption
                  ),
                  actionEconomyTransition: actionEconomyReceipt(
                    input.reaction.spent?.economy ?? null
                  ),
                  activeEffectTransitions: (
                    input.reaction.spent?.activeEffectTransitions ?? []
                  ).map((transition) => characterEffectReceipt(transition, null))
                }
              : null,
            targetFailedCounterSpend: input.targetFailedCounterSpend ?? false,
            ...(input.maintenanceTransition
              ? { maintenanceTransition: input.maintenanceTransition }
              : {}),
            d20: execution.d20,
            nestedD20: execution.nestedD20,
            targetTransition: mechanics.targetTransition,
            applications: mechanics.receiptApplications,
            sourceApplications: settled.sourceApplications
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
            settled.itemConsumptionReceipt ||
            settled.spellConsumptionReceipt ||
            settled.sourceApplications.length
              ? {
                  sourceCharacterId: actor.kind === 'CHARACTER' ? actor.sourceId : null
                }
              : {}),
            sourceCharacterStreamVersion,
            resourceConsumption: resourceReceipt,
            spellCastConsumption: settled.spellConsumptionReceipt,
            featureResourceConsumption: featureResourceReceipt,
            targetFeatureResourceConsumption: input.resistance?.charge ?? null,
            legendaryResistance: input.resistance?.legendaryResistance ?? null,
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
            applications: mechanics.receiptApplications,
            sourceApplications: settled.sourceApplications
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
  /** The Scene spatial effect this action placed; its undo deletes it. */
  placedSpatialEffectId: string | null
  /** The Concentration a zone-only cast opens; null when a creature outcome carries it or none opens. */
  maintenanceTransition: ReturnType<typeof maintainedEffectTransitionDtoSchema.parse> | null
  damage: ReturnType<typeof nativeConcentrationDamageApplications>
  spend: Pick<
    ReturnType<typeof planNativeEncounterAreaSourceSpend>,
    | 'sourceCharacterStreamVersion'
    | 'resourceReceipt'
    | 'featureResourceReceipt'
    | 'sourceItemUseStateTransition'
    | 'itemConsumptionReceipt'
    | 'spellConsumptionReceipt'
    | 'sourceApplications'
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
      placedSpatialEffectId: input.placedSpatialEffectId,
      ...(input.maintenanceTransition
        ? { maintenanceTransition: input.maintenanceTransition }
        : {}),
      damage: input.damage,
      sourceCharacterStreamVersion: spend.sourceCharacterStreamVersion,
      resourceConsumption: spend.resourceReceipt,
      featureResourceConsumption: spend.featureResourceReceipt,
      sourceItemUseStateTransition: spend.sourceItemUseStateTransition,
      sourceItemConsumption: spend.itemConsumptionReceipt,
      spellCastConsumption: spend.spellConsumptionReceipt,
      sourceApplications: spend.sourceApplications,
      actionEconomyTransition: actionEconomyReceipt(input.actionEconomy),
      ...(input.attackAction ? { attackActionTransition: input.attackAction } : {})
    }
  })
}

/**
 * Builds the stored root of a countered cast. The caster still spends its slot and action; nothing the
 * spell would have done is applied. The counter records what the reactor spent.
 */
export function buildEncounterCounteredCastStoredExecution(input: {
  occurrenceId: string
  occurrenceVersion: number
  actorId: string
  sourceCharacterId: string | null
  spend: Pick<
    ReturnType<typeof planNativeEncounterAreaSourceSpend>,
    | 'sourceCharacterStreamVersion'
    | 'resourceReceipt'
    | 'featureResourceReceipt'
    | 'sourceItemUseStateTransition'
    | 'itemConsumptionReceipt'
    | 'spellConsumptionReceipt'
    | 'sourceApplications'
  >
  actionEconomy: EncounterActionEconomyConsumption | null
  counter: {
    reaction: EncounterCastReactionPinDto
    choiceExecution: ServerCompletedRuleExecutionDto
    counterExecution: ServerCompletedRuleExecutionDto
    triggerLevel: number
    /** The check that earned the counter; null when the cast was not above the counter's level. */
    check: EncounterCounterCheckEvidenceDto | null
    spellConsumption: Parameters<typeof characterSpellConsumptionReceipt>[0]
    /** The reactor's conditions released by effects its cast ended. */
    applications: ReturnType<typeof planNativeEncounterAreaSourceSpend>['sourceApplications']
    /** The reactor's Character version once its slot was spent or a condition released; null when neither. */
    characterStreamVersion: number | null
    economy: EncounterActionEconomyConsumption
  }
}) {
  const { spend, counter } = input
  return storedRuleExecutionResultDtoSchema.parse({
    status: 'AGGREGATE_CHOICE_COMPLETE',
    schemaVersion: 1,
    occurrenceId: input.occurrenceId,
    occurrenceVersion: input.occurrenceVersion,
    applicationOutputs: {
      kind: 'ENCOUNTER_COUNTERED_CAST',
      schemaVersion: 1,
      occurrenceId: input.occurrenceId,
      sourceActorId: input.actorId,
      sourceCharacterId: input.sourceCharacterId,
      sourceCharacterStreamVersion: spend.sourceCharacterStreamVersion,
      resourceConsumption: spend.resourceReceipt,
      featureResourceConsumption: spend.featureResourceReceipt,
      sourceItemUseStateTransition: spend.sourceItemUseStateTransition,
      sourceItemConsumption: spend.itemConsumptionReceipt,
      spellCastConsumption: spend.spellConsumptionReceipt,
      sourceApplications: spend.sourceApplications,
      actionEconomyTransition: actionEconomyReceipt(input.actionEconomy),
      counter: {
        reaction: counter.reaction,
        choiceExecution: counter.choiceExecution,
        counterExecution: counter.counterExecution,
        triggerLevel: counter.triggerLevel,
        check: counter.check,
        spellCastConsumption: characterSpellConsumptionReceipt(counter.spellConsumption),
        applications: counter.applications,
        characterStreamVersion: counter.characterStreamVersion,
        actionEconomyTransition: actionEconomyReceipt(counter.economy)
      }
    }
  })
}

/** A failed counter with what its reactor spends for the attempt, as the cast's terminal commit applies it (D127). */
export function buildEncounterFailedCounterReceipt(input: {
  failed: EncounterFailedCounterDto
  spellConsumption: Parameters<typeof characterSpellConsumptionReceipt>[0]
  /** The reactor's Character version once its slot was spent; null when none was. */
  characterStreamVersion: number | null
  economy: EncounterActionEconomyConsumption
}) {
  return encounterFailedCounterReceiptDtoSchema.parse({
    ...input.failed,
    spellCastConsumption: characterSpellConsumptionReceipt(input.spellConsumption),
    // A failed counter does not yet end its reactor's cast-ended effects (future-enhancements: Deferred edge cases).
    applications: [],
    characterStreamVersion: input.characterStreamVersion,
    actionEconomyTransition: actionEconomyReceipt(input.economy)
  })
}
