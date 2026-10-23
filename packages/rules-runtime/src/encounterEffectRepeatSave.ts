import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { EncounterActorDispositionDto } from '@artificer-toolkit/schema/api/encounterData'
import type { EncounterRuleRollTriggerDto } from '@artificer-toolkit/schema/shared/encounterRuleOccurrence'
import { encounterEffectRepeatSavePendingContextDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionDirectActionPendingContexts'
import { effectRepeatSaveApplicationOutputDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionEncounterApplications'
import {
  concentrationDamageSourceLabel,
  damageSaveApplicationsAfterRelease,
  type ConcentrationDamageApplicationDto
} from '@artificer-toolkit/schema/shared/ruleExecutionConcentration'
import type { ServerRuleExecutionContinuationDto } from '@artificer-toolkit/schema/shared/rulesExecution'
import type { ServerRuleExecutionD20PolicyDto } from '@artificer-toolkit/schema/shared/ruleExecutionEvidence'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { damageSaveTargetCharacterPins } from './encounterConcentration.js'
import { concentrationOccurrenceId } from './encounterConcentrationIdentity.js'
import type { EncounterEvidenceAnswer } from './encounterEvidenceAnswer.js'
import type { MovementTarget } from './encounterMovementTargets.js'
import { activeEffectTargetFacts } from './encounterTurnEffects.js'
import { discoverEncounterEventHooks } from './events/encounterEventHooks.js'
import type { RulesRuntimeService } from './rulesRuntimeService.js'
import {
  resumeTargetBoundActiveRuleEffectWithAnswer,
  type TargetBoundActiveRuleEffectExecutionInput
} from './targetBoundActiveRuleEffectExecutor.js'

export type NativeEffectRepeatSaveContext = ReturnType<
  typeof encounterEffectRepeatSavePendingContextDtoSchema.parse
>

type RepeatTrigger = NonNullable<
  Extract<
    ActiveRuleEffectRecord['definition'],
    { schemaVersion: 2 }
  >['recurrence']['repeatTriggers']
>[number]

/** The first repeat trigger of this effect that damage to its holder from this side and type meets. */
export function effectRepeatTrigger(
  effect: ActiveRuleEffectRecord,
  input: {
    damagerActorId: string | null
    dispositions: ReadonlyMap<string, EncounterActorDispositionDto>
    damageTypeId: string | null
  }
): RepeatTrigger | undefined {
  return discoverEncounterEventHooks({
    effects: [effect],
    events: [
      {
        kind: 'DAMAGED',
        phase: 'AFTER',
        damagerActorId: input.damagerActorId,
        damageTypeIds: [input.damageTypeId],
        dispositions: input.dispositions
      }
    ]
  }).repeatSaves[0]?.trigger
}

/**
 * The repeat saves a finalized damage envelope owes (D167): one per damaged, undefeated holder
 * effect whose repeat trigger the damage meets. An effect the damaging command itself placed never
 * repeats against that command's damage. A source that dealt several damage types
 * (`damageTypeId: null`) meets only an untyped trigger.
 */
export function effectRepeatSaveApplications(input: {
  applications: readonly ConcentrationDamageApplicationDto[]
  parentOccurrenceId: string
  damagerActorId: string | null
  dispositions: ReadonlyMap<string, EncounterActorDispositionDto>
  holders: ReadonlyMap<string, { defeated: boolean; effects: readonly ActiveRuleEffectRecord[] }>
}) {
  return input.applications.flatMap((application) => {
    const holder = input.holders.get(application.targetActorId)
    if (!holder || holder.defeated) return []
    return holder.effects
      .filter(
        (effect) =>
          !(
            effect.definition.origin.kind === 'ENCOUNTER' &&
            effect.definition.origin.sourceOccurrenceId === input.parentOccurrenceId
          ) && effectRepeatTrigger(effect, { ...input, damageTypeId: application.damageTypeId })
      )
      .map((effect) => ({ ...application, activeEffectId: effect.id }))
  })
}

/** The kernel input that runs one effect's frozen save against its damaged holder. */
export function effectRepeatSaveExecutionInput(input: {
  effect: ActiveRuleEffectRecord
  target: Parameters<typeof activeEffectTargetFacts>[0]
  occurrenceId: string
  rollInfluence: RepeatTrigger['rollInfluence']
  runtime: RulesRuntimeService
}): TargetBoundActiveRuleEffectExecutionInput {
  const { effect } = input
  return {
    activeEffectId: effect.id,
    activeEffectVersion: effect.version,
    definition: effect.definition,
    lifecycle: effect.lifecycle,
    lifecycleChecksum: effect.lifecycleChecksum,
    occurrenceId: input.occurrenceId,
    ...activeEffectTargetFacts(input.target),
    perception: null,
    rollInfluence: input.rollInfluence,
    onTrigger: true,
    runtime: input.runtime
  }
}

export function createEffectRepeatSaveContext(input: {
  effect: Pick<ActiveRuleEffectRecord, 'id' | 'version' | 'lifecycleChecksum'>
  target: Pick<
    MovementTarget,
    'actor' | 'characterFacts' | 'characterCurrentness' | 'effectiveRulePolicyOutput'
  >
  systemVocabularySnapshot: NativeEffectRepeatSaveContext['systemVocabularySnapshot']
  damageTypes: readonly { id: string; label: string }[]
  d20Policy: ServerRuleExecutionD20PolicyDto
  rollInfluence: NativeEffectRepeatSaveContext['rollInfluence']
  parentOccurrenceId: string
  parentCommandFingerprint: string
  application: NativeEffectRepeatSaveContext['application']
  remaining: NativeEffectRepeatSaveContext['remaining']
  finalizedDamageEnvelopeChecksum: string
  sourceLabels: NativeEffectRepeatSaveContext['sourceLabels']
  damagerActorId: string | null
}) {
  const targetCharacter = damageSaveTargetCharacterPins(input.target)
  if (targetCharacter === null) throw new Error('The repeat save Character facts are unavailable.')
  const { application, d20Policy } = input
  if (d20Policy.savingThrowAbilityDefinitionId === undefined)
    throw new Error('The repeat save does not name a saving throw ability.')
  const activeEffect = {
    id: input.effect.id,
    version: input.effect.version,
    lifecycleChecksum: input.effect.lifecycleChecksum
  }
  return encounterEffectRepeatSavePendingContextDtoSchema.parse({
    kind: 'ENCOUNTER_DAMAGE_SAVE_CHECK',
    source: 'EFFECT_REPEAT_SAVE',
    schemaVersion: 1,
    parentOccurrenceId: input.parentOccurrenceId,
    parentCommandFingerprint: input.parentCommandFingerprint,
    finalizedDamageEnvelopeChecksum: input.finalizedDamageEnvelopeChecksum,
    application,
    sourceLabels: input.sourceLabels,
    repeatSaveDamagerActorId: input.damagerActorId,
    trigger: {
      sourceLabel: concentrationDamageSourceLabel(input.sourceLabels, application),
      damageTypeLabel:
        input.damageTypes.find((damageType) => damageType.id === application.damageTypeId)?.label ??
        null,
      dc: d20Policy.dc
    },
    targetCharacter: targetCharacter ?? null,
    systemVocabularySnapshot: input.systemVocabularySnapshot,
    activeEffect,
    rollInfluence: input.rollInfluence,
    d20Policy,
    contextChecksum: checksumRuleDocument({
      activeEffect,
      targetCharacter: targetCharacter ?? null,
      systemVocabularySnapshot: input.systemVocabularySnapshot,
      rollInfluence: input.rollInfluence,
      d20Policy,
      finalizedDamageApplication: { ...application, activeEffectId: activeEffect.id },
      finalizedDamageEnvelopeChecksum: input.finalizedDamageEnvelopeChecksum
    }),
    remaining: input.remaining
  })
}

/** Names a pending repeat save for its roller: the damage behind it and its DC. */
export function effectRepeatSaveRollTrigger(
  context: NativeEffectRepeatSaveContext
): EncounterRuleRollTriggerDto {
  return {
    kind: 'EFFECT_REPEAT_SAVE',
    damage: {
      amount: context.application.appliedAmount,
      typeLabel: context.trigger.damageTypeLabel
    },
    sourceLabel: context.trigger.sourceLabel,
    dc: context.trigger.dc
  }
}

/**
 * Answers a paused repeat save with its roller's d20 and settles it. The effect's save is a single
 * d20 with no damage die, so any further pause is a mismatch with its frozen policy.
 */
export async function evaluateEffectRepeatSaveEvidence(input: {
  effectInput: TargetBoundActiveRuleEffectExecutionInput
  context: NativeEffectRepeatSaveContext
  continuation: ServerRuleExecutionContinuationDto
  resolution: Exclude<EncounterEvidenceAnswer, { kind: 'ENTER_INTEGER' }>
  expectedOccurrenceId: string
  random: (maximum: number) => number
}) {
  const { context, continuation, effectInput } = input
  if (
    continuation.occurrenceId !== input.expectedOccurrenceId ||
    effectInput.activeEffectId !== context.activeEffect.id ||
    effectInput.activeEffectVersion !== context.activeEffect.version ||
    effectInput.lifecycleChecksum !== context.activeEffect.lifecycleChecksum
  )
    throw new Error('The repeat save evidence request is unavailable.')
  const { result } = await resumeTargetBoundActiveRuleEffectWithAnswer({
    effectInput,
    continuation,
    policy: context.d20Policy,
    diceStage: null,
    answer: input.resolution,
    random: input.random
  })
  if ('continuation' in result || !result.d20)
    throw new Error('The repeat save result does not match its frozen evidence.')
  return { ...result, d20: result.d20 }
}

export type NativeEffectRepeatSaveEvidence = Awaited<
  ReturnType<typeof evaluateEffectRepeatSaveEvidence>
>

/** Whether a settled repeat save was made, which ends the effect. */
export const effectRepeatSaveMade = (evidence: Pick<NativeEffectRepeatSaveEvidence, 'd20'>) =>
  evidence.d20.resultPath === 'ON_SAVE_SUCCESS'

export function completeEffectRepeatSaveResult(input: {
  context: NativeEffectRepeatSaveContext
  continuation: ServerRuleExecutionContinuationDto
  evidence: NativeEffectRepeatSaveEvidence
  /** The conditions the ended effect released from its holder; null when the save failed. */
  removedConditionIds: readonly string[] | null
  occurrenceVersion: number
  initialFactsChecksum: string
}) {
  const { context, continuation, evidence } = input
  const made = effectRepeatSaveMade(evidence)
  if (made !== (input.removedConditionIds !== null))
    throw new Error('A repeat save releases its effect exactly when it is made.')
  const { d20 } = evidence
  // A made save releases the effect, so its later saves in the chain have nothing left to check.
  const next = (
    made
      ? damageSaveApplicationsAfterRelease(context.remaining, context.activeEffect.id)
      : context.remaining
  )[0]
  const applicationOutputs = effectRepeatSaveApplicationOutputDtoSchema.parse({
    kind: 'DAMAGE_SAVE_CHECK',
    source: 'EFFECT_REPEAT_SAVE',
    schemaVersion: 1,
    occurrenceId: continuation.occurrenceId,
    parentOccurrenceId: context.parentOccurrenceId,
    activeEffect: context.activeEffect,
    savingThrowAbilityDefinitionId: context.d20Policy.savingThrowAbilityDefinitionId,
    systemVocabularySnapshot: context.systemVocabularySnapshot,
    targetCharacter: context.targetCharacter,
    application: context.application,
    trigger: context.trigger,
    outcome: made ? 'SAVE_SUCCESS' : 'SAVE_FAILURE',
    d20: {
      requestId: d20.requestId,
      rollMode: d20.rollMode,
      keep: d20.keep,
      derivedRollMode: d20.derivedRollMode,
      rawFaces: d20.rawFaces,
      selectedNatural: d20.selectedNatural,
      modifier: d20.modifier,
      total: d20.total,
      dc: d20.defenseOrDc,
      contributors: d20.contributors,
      contributorChecksum: d20.contributorChecksum,
      ...(d20.addedDice?.length ? { addedDice: d20.addedDice } : {})
    },
    contextChecksum: context.contextChecksum,
    released: input.removedConditionIds && {
      activeEffectId: context.activeEffect.id,
      removedConditionIds: [...input.removedConditionIds]
    },
    nextOccurrenceId: next ? concentrationOccurrenceId(context.parentOccurrenceId, next) : null
  })
  const result = storedRuleExecutionResultDtoSchema.parse({
    status: 'COMPLETE',
    occurrenceId: continuation.occurrenceId,
    occurrenceVersion: input.occurrenceVersion,
    initialFactsChecksum: input.initialFactsChecksum,
    outputs: evidence.execution.outputs,
    evidence: evidence.execution.evidence,
    applicationOutputs
  })
  if (result.status !== 'COMPLETE') throw new Error('The repeat save did not complete.')
  return result
}
