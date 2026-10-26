import { encounterMassiveDamageSavePendingContextDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionDirectActionPendingContexts'
import { massiveDamageSaveApplicationOutputDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionEncounterApplications'
import {
  concentrationDamageSourceLabel,
  type ConcentrationDamageApplicationDto
} from '@artificer-toolkit/schema/shared/ruleExecutionConcentration'
import type { ServerRuleExecutionContinuationDto } from '@artificer-toolkit/schema/shared/rulesExecution'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import {
  damageSaveD20Record,
  damageSaveTargetCharacterPins,
  settleDamageSaveD20,
  type DamageSaveD20Evidence
} from './encounterConcentration.js'
import { concentrationOccurrenceId } from './encounterConcentrationIdentity.js'
import type { EncounterEvidenceAnswer } from './encounterEvidenceAnswer.js'
import type { MovementTarget } from './encounterMovementTargets.js'
import type {
  MassiveDamageRule,
  OptionalCombatPolicyInput
} from './optionalCombatPolicyCapability.js'
import { optionalCombatPolicyCapabilityRegistry } from './platformEncounterPolicy.js'
import type { RulesRuntimeService } from './rulesRuntimeService.js'

export type NativeMassiveDamageSaveContext = ReturnType<
  typeof encounterMassiveDamageSavePendingContextDtoSchema.parse
>

/** The Encounter's active massive-damage rule; null when it is off or the System has none. */
export function encounterMassiveDamageRule(input: OptionalCombatPolicyInput) {
  return (
    optionalCombatPolicyCapabilityRegistry.find(input.gameSystemId)?.massiveDamageRule(input) ??
    null
  )
}

/**
 * The massive-damage saves a finalized damage envelope owes (ATTACK-16): one per damage source
 * whose own total is at least the rule's share of its undefeated holder's maximum hit points. Each
 * source is measured alone; several smaller sources never add up.
 */
export function massiveDamageSaveApplications(input: {
  rule: Pick<MassiveDamageRule, 'pin' | 'threshold'> | null
  applications: readonly ConcentrationDamageApplicationDto[]
  holders: ReadonlyMap<string, { defeated: boolean; maximumHitPoints: number }>
}) {
  const { rule } = input
  if (!rule) return []
  return input.applications.flatMap((application) => {
    const holder = input.holders.get(application.targetActorId)
    return holder &&
      !holder.defeated &&
      holder.maximumHitPoints > 0 &&
      application.appliedAmount * rule.threshold.denominator >=
        holder.maximumHitPoints * rule.threshold.numerator
      ? [{ ...application, optionalCombatDefinitionId: rule.pin.definitionId }]
      : []
  })
}

export function createMassiveDamageSaveContext(input: {
  gameSystemId: string
  rule: MassiveDamageRule
  target: Pick<
    MovementTarget,
    | 'actor'
    | 'characterFacts'
    | 'characterCurrentness'
    | 'effectiveRulePolicyOutput'
    | 'targetDerivedFacts'
  >
  maximumHitPoints: number
  systemVocabularySnapshot: NativeMassiveDamageSaveContext['systemVocabularySnapshot']
  damageTypes: readonly { id: string; label: string }[]
  parentOccurrenceId: string
  parentCommandFingerprint: string
  application: NativeMassiveDamageSaveContext['application']
  remaining: NativeMassiveDamageSaveContext['remaining']
  finalizedDamageEnvelopeChecksum: string
  sourceLabels: NativeMassiveDamageSaveContext['sourceLabels']
  damagerActorId: string | null
}) {
  const { application, rule } = input
  const targetCharacter = damageSaveTargetCharacterPins(input.target)
  if (targetCharacter === null)
    throw new Error('The massive-damage save Character facts are unavailable.')
  const facts = optionalCombatPolicyCapabilityRegistry
    .require(input.gameSystemId)
    .massiveDamageSaveFacts({
      rule,
      targetActorId: application.targetActorId,
      target: input.target
    })
  const save = {
    savingThrowAbilityDefinitionId: rule.savingThrowAbilityDefinitionId,
    modifier: facts.modifier,
    rollMode: facts.rollMode,
    keep: facts.keep,
    contributors: [...facts.contributors],
    contributorChecksum: facts.contributorChecksum,
    ...(facts.addedDice.length > 0 ? { addedDice: facts.addedDice } : {})
  }
  const optionalCombatDefinition = {
    id: rule.pin.definitionId,
    version: rule.pin.definitionVersion,
    checksum: rule.pin.definitionChecksum
  }
  const context = encounterMassiveDamageSavePendingContextDtoSchema.parse({
    kind: 'ENCOUNTER_DAMAGE_SAVE_CHECK',
    source: 'MASSIVE_DAMAGE',
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
      dc: rule.difficultyClass
    },
    targetCharacter: targetCharacter ?? null,
    systemVocabularySnapshot: input.systemVocabularySnapshot,
    optionalCombatDefinition,
    maximumHitPoints: input.maximumHitPoints,
    save,
    contextChecksum: checksumRuleDocument({
      optionalCombatDefinition,
      saveDefinitionChecksum: rule.published.checksum,
      maximumHitPoints: input.maximumHitPoints,
      targetCharacter: targetCharacter ?? null,
      systemVocabularySnapshot: input.systemVocabularySnapshot,
      ...save,
      finalizedDamageApplication: {
        ...application,
        optionalCombatDefinitionId: optionalCombatDefinition.id
      },
      finalizedDamageEnvelopeChecksum: input.finalizedDamageEnvelopeChecksum
    }),
    remaining: input.remaining
  })
  return { context, facts: facts.facts }
}

/** Whether the Encounter's current rule is still the exact definition the save was offered under. */
export function massiveDamageRulePinned(
  rule: MassiveDamageRule | null,
  context: Pick<NativeMassiveDamageSaveContext, 'optionalCombatDefinition'>
): rule is MassiveDamageRule {
  return (
    rule !== null &&
    rule.pin.definitionId === context.optionalCombatDefinition.id &&
    rule.pin.definitionVersion === context.optionalCombatDefinition.version &&
    rule.pin.definitionChecksum === context.optionalCombatDefinition.checksum
  )
}

/** Answers a paused massive-damage save with its roller's d20 against the rule's own save graph. */
export async function evaluateMassiveDamageSaveEvidence(input: {
  gameSystemId: string
  runtime: RulesRuntimeService
  random: (maximum: number) => number
  context: NativeMassiveDamageSaveContext
  rule: MassiveDamageRule | null
  continuation: ServerRuleExecutionContinuationDto
  resolution: Exclude<EncounterEvidenceAnswer, { kind: 'ENTER_INTEGER' }>
  expectedOccurrenceId: string
}) {
  const { context, rule } = input
  if (!massiveDamageRulePinned(rule, context))
    throw new Error('The massive-damage rule changed since the save was offered.')
  const result = 'The massive-damage save result does not match its frozen evidence.'
  const evidence = await settleDamageSaveD20({
    ...input,
    save: context.save,
    refusals: { request: 'The massive-damage save request is unavailable.', result }
  })
  const { outputs, evidence: source } = evidence.execution
  if (
    source.source.definitionId !== rule.published.id ||
    source.source.checksum !== rule.published.checksum ||
    outputs.targetActorId !== context.application.targetActorId ||
    outputs.dc !== context.trigger.dc
  )
    throw new Error(result)
  return evidence
}

export function completeMassiveDamageSaveResult(input: {
  context: NativeMassiveDamageSaveContext
  continuation: ServerRuleExecutionContinuationDto
  evidence: DamageSaveD20Evidence
  occurrenceVersion: number
  initialFactsChecksum: string
}) {
  const { context, continuation, evidence } = input
  const nextApplication = context.remaining[0]
  const applicationOutputs = massiveDamageSaveApplicationOutputDtoSchema.parse({
    kind: 'DAMAGE_SAVE_CHECK',
    source: 'MASSIVE_DAMAGE',
    schemaVersion: 1,
    occurrenceId: continuation.occurrenceId,
    parentOccurrenceId: context.parentOccurrenceId,
    optionalCombatDefinition: context.optionalCombatDefinition,
    savingThrowAbilityDefinitionId: context.save.savingThrowAbilityDefinitionId,
    systemVocabularySnapshot: context.systemVocabularySnapshot,
    targetCharacter: context.targetCharacter,
    application: {
      ...context.application,
      optionalCombatDefinitionId: context.optionalCombatDefinition.id
    },
    trigger: context.trigger,
    outcome: evidence.failed ? 'SAVE_FAILURE' : 'SAVE_SUCCESS',
    d20: damageSaveD20Record({
      requestId: continuation.request.requestId,
      save: context.save,
      evidence
    }),
    contextChecksum: context.contextChecksum,
    nextOccurrenceId: nextApplication
      ? concentrationOccurrenceId(context.parentOccurrenceId, nextApplication)
      : null
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
  if (result.status !== 'COMPLETE') throw new Error('The massive-damage save did not complete.')
  return result
}
