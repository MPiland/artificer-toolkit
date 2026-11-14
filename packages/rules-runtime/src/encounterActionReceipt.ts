import type { EncounterMaintainedEffectStateRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { EncounterAttackActionTransitionDto } from '@artificer-toolkit/schema/projections/encounterAttackAction'
import {
  encounterWindowReactionReceiptDtoSchema,
  type EncounterReactionPinDto,
  type EncounterSettledIncomingGateDto,
  type EncounterGatedActionApplicationOutputDto
} from '@artificer-toolkit/schema/shared/ruleExecutionReactionChoice'
import type { MeleeRetaliationEvidenceDto } from '@artificer-toolkit/schema/shared/ruleExecutionEffectEvidence'
import { damageAddedDiceDtoSchema } from '@artificer-toolkit/schema/shared/d20AddedDice'
import type { maintainedEffectTransitionDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionMechanics'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import type { projectNativeActionEffectTransitions } from './encounterActionEffectReceipts.js'
import type { EncounterActionEconomyConsumption } from './encounterActionEconomyConsumption.js'
import type { nativeConcentrationDamageApplications } from './encounterConcentrationDamage.js'
import type { advanceNativeActionGraphs } from './encounterActionAdvance.js'
import type {
  finishNativeActionMechanicsSettlement,
  NativeEncounterActionMechanicsInput,
  planNativeEncounterAreaSourceSpend
} from './encounterActionMechanicsPlan.js'
import type { encounterTargetLegendaryResistance } from './encounterAreaLegendaryResistance.js'

/** Recorded so a GM undo restores the allowance exactly; an override may exceed the maximum. */
export function actionEconomyReceipt(consumption: EncounterActionEconomyConsumption | null) {
  return consumption
    ? {
        definitionId: consumption.definitionId,
        definitionVersion: consumption.definitionVersion,
        definitionChecksum: consumption.definitionChecksum,
        maximum: consumption.maximum,
        beforeUsed: consumption.beforeUsed,
        afterUsed: consumption.afterUsed,
        ...(consumption.turnSequence !== undefined && { turnSequence: consumption.turnSequence }),
        ...(consumption.spellCasting && { spellCasting: consumption.spellCasting })
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
  effects: ReturnType<typeof projectNativeActionEffectTransitions>
  maintainedState: EncounterMaintainedEffectStateRecord | null
  maintenanceTransition: ReturnType<typeof maintainedEffectTransitionDtoSchema.parse> | null
  actionEconomy: EncounterActionEconomyConsumption | null
  attackAction: EncounterAttackActionTransitionDto | null
  /** The commanding actor's spend on a delegated attack (DELEGATED_ATTACK): undone with the action. */
  delegation?: {
    actorId: string
    consumption: EncounterActionEconomyConsumption | null
    attackAction: EncounterAttackActionTransitionDto
  } | null
  /** Set when the batch is one creature's outcome of a point-area action rooted at `parentOccurrenceId`. */
  area?: { parentOccurrenceId: string }
  /** The target's decided Legendary Resistance and the charge it cost, when its failed save offered one. */
  resistance?: ReturnType<typeof encounterTargetLegendaryResistance> | null
  /** The target also spent a reaction another way (a failed counter, D127, or a die against the attack roll, D207), so its spend rides in this batch. */
  targetReactorSpend?: boolean
  /** The zones the melee hit set off against the attacker (D153); its commit applies them after the hit. */
  meleeRetaliation?: MeleeRetaliationEvidenceDto | null
  /** The timed effects the target's own rules made from this action: damage-trigger grants, a passed ward's immunity. */
  grantEffectTransitions?: ReturnType<
    typeof projectNativeActionEffectTransitions
  >['activeEffectTransitions']
  /** The check the source's reaction trigger asked and it passed before the action ran (D219). */
  passedGate?: EncounterSettledIncomingGateDto | null
}) {
  const { prepared, execution, occurrenceId, occurrenceVersion, settled, effects } = input
  const { state, source, actor, target } = prepared
  const { mechanics, resourceReceipt, featureResourceReceipt } = settled
  const { stateEffectTransitions, activeEffectTransitions } = effects
  const actionEconomyTransition = actionEconomyReceipt(input.actionEconomy)
  const delegatingActorSpend = input.delegation
    ? {
        delegatingActorSpend: {
          actorId: input.delegation.actorId,
          actionEconomyTransition: actionEconomyReceipt(input.delegation.consumption),
          attackActionTransition: input.delegation.attackAction
        }
      }
    : {}
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
            sourceItemDraw: settled.sourceItemDraw,
            sourceItemDegradation: settled.sourceItemDegradation,
            sourceItemConsumption: settled.itemConsumptionReceipt,
            targetItemUseStateTransition: settled.targetItemUseStateTransition,
            targetItemDegradation: settled.targetItemDegradation,
            actionEconomyTransition,
            ...(input.attackAction ? { attackActionTransition: input.attackAction } : {}),
            ...delegatingActorSpend,
            activeEffectTransitions: activeEffectTransitions.map((transition) =>
              characterEffectReceipt(transition, input.maintainedState?.id ?? null)
            ),
            grantEffectTransitions: (input.grantEffectTransitions ?? []).map((transition) =>
              characterEffectReceipt(transition, null)
            ),
            stateEffectTransitions,
            targetReactorSpend: input.targetReactorSpend ?? false,
            ...(input.maintenanceTransition
              ? { maintenanceTransition: input.maintenanceTransition }
              : {}),
            d20: execution.d20,
            nestedD20: execution.nestedD20,
            targetTransition: mechanics.targetTransition,
            applications: mechanics.receiptApplications,
            sourceApplications: settled.sourceApplications,
            ...addedDice,
            ...(input.meleeRetaliation ? { meleeRetaliation: input.meleeRetaliation } : {}),
            ...(input.passedGate ? { passedGate: input.passedGate } : {})
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
            settled.spellConsumptionReceipt?.owner.kind === 'CHARACTER' ||
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
            sourceItemDraw: settled.sourceItemDraw,
            sourceItemDegradation: settled.sourceItemDegradation,
            sourceItemConsumption: settled.itemConsumptionReceipt,
            targetItemUseStateTransition: settled.targetItemUseStateTransition,
            actionEconomyTransition,
            ...(input.attackAction ? { attackActionTransition: input.attackAction } : {}),
            ...delegatingActorSpend,
            activeEffectTransitions,
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
            ...(input.meleeRetaliation ? { meleeRetaliation: input.meleeRetaliation } : {}),
            ...(input.passedGate ? { passedGate: input.passedGate } : {})
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
 * spell would have done is applied. The counter ran as its holder's own action, which recorded what
 * the reactor spent (D219).
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
}) {
  const { spend } = input
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
      actionEconomyTransition: actionEconomyReceipt(input.actionEconomy)
    }
  })
}

/**
 * Builds the stored root of an action its incoming gate stopped. The source still spends its slot,
 * resource, item and action; nothing the attack or spell would have done is applied. The gate records the
 * failed roll.
 */
export function buildEncounterGatedActionStoredExecution(input: {
  occurrenceId: string
  /** The chosen list this is one lost ray of. */
  parentOccurrenceId?: string
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
      ...(input.parentOccurrenceId && { parentOccurrenceId: input.parentOccurrenceId }),
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

/**
 * Builds the child receipt of one ray of a chosen list that its creature's incoming gate stopped: the
 * failed gate alone. The list's root holds the cast's one spend, so the ray spends and applies nothing.
 */
export function buildEncounterLostRayStoredExecution(
  input: Pick<
    Parameters<typeof buildEncounterGatedActionStoredExecution>[0],
    'occurrenceId' | 'actorId' | 'sourceCharacterId' | 'lost' | 'gate'
  > & { parentOccurrenceId: string }
) {
  return buildEncounterGatedActionStoredExecution({
    ...input,
    occurrenceVersion: 0,
    spend: {
      sourceCharacterStreamVersion: null,
      resourceReceipt: null,
      featureResourceReceipt: null,
      sourceItemUseStateTransition: null,
      itemConsumptionReceipt: null,
      spellConsumptionReceipt: null,
      sourceApplications: []
    },
    actionEconomy: null
  })
}

/** What a reactor spends for the die it rolled against the attack roll (D207): its reaction and the charge it costs. */
export function buildEncounterWindowReactionReceipt(input: {
  reaction: EncounterReactionPinDto
  spend: Pick<
    ReturnType<typeof planNativeEncounterAreaSourceSpend>,
    'resourceReceipt' | 'sourceCharacterStreamVersion'
  >
  economy: EncounterActionEconomyConsumption
}) {
  return encounterWindowReactionReceiptDtoSchema.parse({
    reaction: input.reaction,
    resourceConsumption: input.spend.resourceReceipt,
    characterStreamVersion: input.spend.sourceCharacterStreamVersion,
    actionEconomyTransition: actionEconomyReceipt(input.economy)
  })
}
