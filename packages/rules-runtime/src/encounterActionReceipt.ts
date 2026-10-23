import type { EncounterMaintainedEffectStateRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { EncounterAttackActionTransitionDto } from '@artificer-toolkit/schema/projections/encounterAttackAction'
import {
  encounterFailedCounterReceiptDtoSchema,
  type EncounterCastReactionPinDto,
  type EncounterCounterCheckEvidenceDto,
  type EncounterFailedCounterDto,
  type EncounterGatedActionApplicationOutputDto
} from '@artificer-toolkit/schema/shared/ruleExecutionReactionChoice'
import type { MeleeRetaliationEvidenceDto } from '@artificer-toolkit/schema/shared/ruleExecutionEffectEvidence'
import { damageAddedDiceDtoSchema } from '@artificer-toolkit/schema/shared/d20AddedDice'
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
    'state' | 'source' | 'actor' | 'target' | 'binding'
  >
  execution: Extract<Awaited<ReturnType<typeof advanceNativeActionGraphs>>, { kind: 'COMPLETE' }>
  occurrenceId: string
  occurrenceVersion: number
  settled: ReturnType<typeof finishNativeActionMechanicsSettlement>
  effects: ReturnType<typeof projectNativeActionEffectTransitions> & {
    /** The carrier the acting creature holds for the cast's Concentration, when the action planned one. */
    sourceEffectTransition?:
      | ReturnType<typeof projectNativeActionEffectTransitions>['activeEffectTransitions'][number]
      | null
  }
  maintainedState: EncounterMaintainedEffectStateRecord | null
  maintenanceTransition: ReturnType<typeof maintainedEffectTransitionDtoSchema.parse> | null
  actionEconomy: EncounterActionEconomyConsumption | null
  attackAction: EncounterAttackActionTransitionDto | null
  /** Set when the batch is one creature's outcome of a point-area action rooted at `parentOccurrenceId`. */
  area?: { parentOccurrenceId: string }
  /** The target's decided Legendary Resistance and the charge it cost, when its failed save offered one. */
  resistance?: ReturnType<typeof encounterTargetLegendaryResistance> | null
  /** The target's decided reaction to the hit and what using it spent and created. */
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
  /** The zones the melee hit set off against the attacker (D153); its commit applies them after the hit. */
  meleeRetaliation?: MeleeRetaliationEvidenceDto | null
  /** The timed effects the target's own rules made from this action: damage-trigger grants, a passed ward's immunity. */
  grantEffectTransitions?: ReturnType<
    typeof projectNativeActionEffectTransitions
  >['activeEffectTransitions']
}) {
  const { prepared, execution, occurrenceId, occurrenceVersion, settled, effects } = input
  const { state, source, actor, target } = prepared
  const { mechanics, resourceReceipt, featureResourceReceipt } = settled
  const { stateEffectTransitions, activeEffectTransitions } = effects
  const actionEconomyTransition = actionEconomyReceipt(input.actionEconomy)
  const boundDice = prepared.binding.sourceDerivedFacts.damageAddedDice
  const damageAddedDice = boundDice === undefined ? [] : damageAddedDiceDtoSchema.parse(boundDice)
  const addedDice = damageAddedDice.length ? { damageAddedDice } : {}
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
  const reactionReceipt = <Receipt>(
    effectReceipt: (transition: (typeof activeEffectTransitions)[number]) => Receipt
  ) =>
    input.reaction
      ? {
          selection: input.reaction.audit.selection,
          reaction: input.reaction.audit.reaction,
          choiceExecution: input.reaction.audit.choiceExecution,
          originalExecutionChecksum: input.reaction.audit.originalExecutionChecksum,
          adjustment: input.reaction.audit.adjustment,
          spellCastConsumption: characterSpellConsumptionReceipt(
            input.reaction.spent?.spellConsumption
          ),
          actionEconomyTransition: actionEconomyReceipt(input.reaction.spent?.economy ?? null),
          activeEffectTransitions: (input.reaction.spent?.activeEffectTransitions ?? []).map(
            effectReceipt
          )
        }
      : null
  const parentOccurrenceId = input.area ? { parentOccurrenceId: input.area.parentOccurrenceId } : {}
  const sourceEffect = input.effects.sourceEffectTransition
    ? { sourceEffectTransition: input.effects.sourceEffectTransition }
    : {}
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
            sourceItemDraw: settled.sourceItemDraw,
            sourceItemDegradation: settled.sourceItemDegradation,
            sourceItemConsumption: settled.itemConsumptionReceipt,
            targetItemUseStateTransition: settled.targetItemUseStateTransition,
            targetItemDegradation: settled.targetItemDegradation,
            actionEconomyTransition,
            ...(input.attackAction ? { attackActionTransition: input.attackAction } : {}),
            activeEffectTransitions: activeEffectTransitions.map((transition) =>
              characterEffectReceipt(transition, input.maintainedState?.id ?? null)
            ),
            ...sourceEffect,
            reactionEffectTransitions: (input.reactionEffectTransitions ?? []).map((transition) =>
              characterEffectReceipt(transition, null)
            ),
            grantEffectTransitions: (input.grantEffectTransitions ?? []).map((transition) =>
              characterEffectReceipt(transition, null)
            ),
            stateEffectTransitions,
            reaction: reactionReceipt((transition) => characterEffectReceipt(transition, null)),
            targetFailedCounterSpend: input.targetFailedCounterSpend ?? false,
            ...(input.maintenanceTransition
              ? { maintenanceTransition: input.maintenanceTransition }
              : {}),
            d20: execution.d20,
            nestedD20: execution.nestedD20,
            targetTransition: mechanics.targetTransition,
            applications: mechanics.receiptApplications,
            sourceApplications: settled.sourceApplications,
            ...addedDice,
            ...(input.meleeRetaliation ? { meleeRetaliation: input.meleeRetaliation } : {})
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
            settled.sourceItemDraw?.kind === 'CHARACTER_ITEM_DRAW' ||
            settled.sourceItemDegradation ||
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
            reaction: reactionReceipt((transition) => transition),
            sourceItemUseStateTransition: settled.sourceItemUseStateTransition,
            sourceItemDraw: settled.sourceItemDraw,
            sourceItemDegradation: settled.sourceItemDegradation,
            sourceItemConsumption: settled.itemConsumptionReceipt,
            targetItemUseStateTransition: settled.targetItemUseStateTransition,
            actionEconomyTransition,
            ...(input.attackAction ? { attackActionTransition: input.attackAction } : {}),
            activeEffectTransitions,
            ...sourceEffect,
            grantEffectTransitions: input.grantEffectTransitions ?? [],
            stateEffectTransitions,
            ...(input.maintenanceTransition
              ? { maintenanceTransition: input.maintenanceTransition }
              : {}),
            d20: execution.d20,
            nestedD20: execution.nestedD20,
            targetTransition: mechanics.targetTransition,
            applications: mechanics.receiptApplications,
            sourceApplications: settled.sourceApplications,
            ...addedDice,
            ...(input.meleeRetaliation ? { meleeRetaliation: input.meleeRetaliation } : {})
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
  /** The Scene spatial effects this action placed (a zone's own and its bands); undo deletes them. */
  placedSpatialEffectIds: readonly string[]
  /** The Concentration a zone-only cast opens; null when a creature outcome carries it or none opens. */
  maintenanceTransition: ReturnType<typeof maintainedEffectTransitionDtoSchema.parse> | null
  /** The timed grant the placed zone gave the source; its undo deletes it. */
  sourceGrantTransition:
    | ReturnType<typeof projectNativeActionEffectTransitions>['activeEffectTransitions'][number]
    | null
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
      placedSpatialEffectIds: input.placedSpatialEffectIds,
      ...(input.maintenanceTransition
        ? { maintenanceTransition: input.maintenanceTransition }
        : {}),
      ...(input.sourceGrantTransition
        ? { sourceGrantTransition: input.sourceGrantTransition }
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

/**
 * Builds the stored root of an action a warded creature's gate stopped. The source still spends its slot,
 * resource, item and action; nothing the attack or spell would have done is applied. The gate records the
 * failed save.
 */
export function buildEncounterGatedActionStoredExecution(input: {
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
  /** What the failed save cost the source. */
  lost: 'ATTACK' | 'SPELL'
  gate: EncounterGatedActionApplicationOutputDto['gate']
}) {
  const { spend } = input
  return storedRuleExecutionResultDtoSchema.parse({
    status: 'AGGREGATE_CHOICE_COMPLETE',
    schemaVersion: 1,
    occurrenceId: input.occurrenceId,
    occurrenceVersion: input.occurrenceVersion,
    applicationOutputs: {
      kind: 'ENCOUNTER_GATED_ACTION',
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
      lost: input.lost,
      gate: input.gate
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
