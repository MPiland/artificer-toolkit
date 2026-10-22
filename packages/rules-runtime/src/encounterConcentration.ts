import type { EncounterMaintainedEffectStateRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { SystemVocabularySnapshot } from '@artificer-toolkit/schema/projections/systemVocabulary'
import {
  encounterConcentrationDamageCheckPendingContextDtoSchema,
  encounterDamageSaveCheckPendingContextDtoSchema
} from '@artificer-toolkit/schema/shared/ruleExecutionDirectActionPendingContexts'
import { concentrationCheckApplicationOutputDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionEncounterApplications'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import { serverPublishedRuleDefinitionDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionCore'
import { ruleMaintenanceReusableDefinitionDocumentDtoSchema } from '@artificer-toolkit/schema/shared/ruleMaintenance'
import type { ServerRuleExecutionContinuationDto } from '@artificer-toolkit/schema/shared/rulesExecution'
import type { ReusableDefinitionCurrentDto } from '@artificer-toolkit/schema/shared/reusableDefinitions'
import type { EncounterRuleRollTriggerDto } from '@artificer-toolkit/schema/shared/encounterRuleOccurrence'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { EncounterEvidenceAnswer } from './encounterEvidenceAnswer.js'
import { requireDerivedD20Mode } from './encounterD20ModeValidation.js'
import { settleEncounterD20Answer, settleEncounterD20Test } from './encounterD20Settlement.js'
import { derivedAddedDice } from './systems/dnd5e/d20AddedDiceGraph.js'
import type { MovementTarget } from './encounterMovementTargets.js'
import type { RulesRuntimeService } from './rulesRuntimeService.js'
import { concentrationDamageSourceLabel } from '@artificer-toolkit/schema/shared/ruleExecutionConcentration'
import {
  DND5E_CONSTITUTION_ABILITY_DEFINITION_ID,
  dnd5eConcentrationDamageDc,
  dnd5eConcentrationHolderSaves,
  resolveDnd5eConcentrationSaveFacts
} from './systems/dnd5e/concentrationPolicy.js'
import { requireInstalledConcentrationMaintenanceDefinitionId } from './platformRulesRuntime.js'
import { concentrationOccurrenceId } from './encounterConcentrationIdentity.js'

export type NativeConcentrationContext = ReturnType<
  typeof encounterConcentrationDamageCheckPendingContextDtoSchema.parse
>

/** A pending damage-triggered save of either source: Concentration or an effect's repeat save. */
export type NativeDamageSaveContext = ReturnType<
  typeof encounterDamageSaveCheckPendingContextDtoSchema.parse
>

/**
 * The Character stream a damage-triggered save pins: undefined for a Creature or custom actor, null
 * when a Character's facts are unavailable, else the stream and projection checksums.
 */
export function damageSaveTargetCharacterPins(
  target: Pick<
    MovementTarget,
    'actor' | 'characterFacts' | 'characterCurrentness' | 'effectiveRulePolicyOutput'
  >
) {
  const character = target.characterFacts
  return target.actor.kind === 'CHARACTER'
    ? character && target.characterCurrentness && target.effectiveRulePolicyOutput
      ? {
          streamVersion: character.active.play.streamVersion,
          baseProjectionChecksum: target.characterCurrentness.projectionChecksum,
          campaignOverlayChecksum: checksumRuleDocument({
            base: target.characterCurrentness.projectionChecksum,
            context: target.characterCurrentness.mechanicalContextChecksum,
            output: target.effectiveRulePolicyOutput
          }),
          mechanicalContextChecksum: target.characterCurrentness.mechanicalContextChecksum
        }
      : null
    : undefined
}

/** Validates current concentration inputs before dice or cleanup, preserving the native read order. */
export async function prepareEncounterConcentrationState<TTarget extends MovementTarget>(input: {
  state: EncounterRunState
  targetActorId: string
  maintained: EncounterMaintainedEffectStateRecord | null
  readDefinition: (id: string) => Promise<ReusableDefinitionCurrentDto | null>
  loadTarget: () => TTarget | undefined | Promise<TTarget | undefined>
  readVocabulary: () => Promise<SystemVocabularySnapshot | null>
}) {
  const { maintained } = input
  if (!maintained) return null
  if (
    maintained.encounterId !== input.state.id ||
    maintained.ownerActorId !== input.targetActorId ||
    maintained.maintenanceDefinitionId !==
      requireInstalledConcentrationMaintenanceDefinitionId(input.state.gameSystemId)
  )
    throw new Error('The concentration state does not match its Encounter owner.')
  const maintenance = await input.readDefinition(maintained.maintenanceDefinitionId)
  if (
    !maintenance ||
    maintenance.gameSystemId !== input.state.gameSystemId ||
    maintenance.definitionFamilyKey !== 'rule-maintenance' ||
    maintenance.checksum !== maintained.descriptor.definitionChecksum
  )
    throw new Error('The concentration maintenance definition is stale.')
  const maintenancePolicy = ruleMaintenanceReusableDefinitionDocumentDtoSchema.parse(
    maintenance.document
  )
  if (
    !maintenancePolicy.damageCheckDefinitionId ||
    maintenancePolicy.replacementPolicy !== maintained.descriptor.replacementPolicy ||
    maintenancePolicy.emptyDependentPolicy !== maintained.descriptor.emptyDependentPolicy
  )
    throw new Error('The concentration maintenance policy is stale.')
  const target = await input.loadTarget()
  if (
    !target ||
    target.actor.id !== input.targetActorId ||
    target.actor.encounterId !== input.state.id ||
    target.actor.systemId !== input.state.gameSystemId ||
    !input.state.actorIds.includes(input.targetActorId)
  )
    throw new Error('The concentration target does not match its Encounter owner.')
  const vocabulary = await input.readVocabulary()
  const characterPins = damageSaveTargetCharacterPins(target)
  if (!vocabulary || characterPins === null)
    throw new Error('The concentration Character facts are unavailable.')
  const current = await input.readDefinition(maintenancePolicy.damageCheckDefinitionId)
  if (!current || current.gameSystemId !== input.state.gameSystemId)
    throw new Error('The concentration check definition is unavailable.')
  const published = serverPublishedRuleDefinitionDtoSchema.parse({
    id: current.id,
    gameSystemId: current.gameSystemId,
    definitionFamilyKey: current.definitionFamilyKey,
    checksum: current.checksum,
    definition: current.document
  })
  const bindings = published.definition.vocabularyBindings ?? []
  if (
    bindings.length !== 1 ||
    bindings[0]?.kind !== 'ABILITY' ||
    bindings[0].definitionId !== DND5E_CONSTITUTION_ABILITY_DEFINITION_ID ||
    vocabulary.systemId !== input.state.gameSystemId ||
    !('abilities' in vocabulary.document) ||
    !vocabulary.document.abilities.some((ability) => ability.id === bindings[0]!.definitionId)
  )
    throw new Error('The concentration saving throw vocabulary is unavailable.')
  return {
    maintained,
    published,
    target,
    damageTypes: vocabulary.document.damageTypes,
    pins: {
      concentrationDefinition: { id: published.id, checksum: published.checksum },
      systemVocabularySnapshot: {
        id: vocabulary.snapshotId,
        version: vocabulary.snapshotVersion,
        checksum: vocabulary.checksum
      },
      targetCharacter: characterPins ?? null
    }
  }
}

export function createNativeConcentrationContext(input: {
  current: {
    maintained: EncounterMaintainedEffectStateRecord
    pins: Pick<
      NativeConcentrationContext,
      'concentrationDefinition' | 'systemVocabularySnapshot' | 'targetCharacter'
    >
    target: Pick<MovementTarget, 'effectiveRulePolicyOutput' | 'targetDerivedFacts'>
    damageTypes: readonly { id: string; label: string }[]
  }
  parentOccurrenceId: string
  parentCommandFingerprint: string
  application: NativeConcentrationContext['application']
  remaining: NativeConcentrationContext['remaining']
  finalizedDamageEnvelopeChecksum: string
  sourceLabels: NativeConcentrationContext['sourceLabels']
  /** Set when the chain can hold effect repeat saves; see the pending context. */
  repeatSaveDamagerActorId?: string | null
}) {
  const { current, application } = input
  const addedDice = derivedAddedDice(
    current.target.targetDerivedFacts.savingThrowAddedDice,
    DND5E_CONSTITUTION_ABILITY_DEFINITION_ID
  )
  const facts = resolveDnd5eConcentrationSaveFacts({
    appliedDamage: application.appliedAmount,
    targetActorId: application.targetActorId,
    rulePolicyOutput: dnd5eConcentrationHolderSaves(current.target),
    addedDice
  })
  const saveAddedDice = addedDice.length > 0 ? { addedDice } : {}
  const maintainedState = {
    id: current.maintained.id,
    version: current.maintained.version,
    maintenanceDefinitionId: current.maintained.maintenanceDefinitionId,
    descriptorChecksum: current.maintained.descriptorChecksum
  }
  const context = encounterConcentrationDamageCheckPendingContextDtoSchema.parse({
    kind: 'ENCOUNTER_DAMAGE_SAVE_CHECK',
    source: 'CONCENTRATION',
    schemaVersion: 1,
    parentOccurrenceId: input.parentOccurrenceId,
    parentCommandFingerprint: input.parentCommandFingerprint,
    finalizedDamageEnvelopeChecksum: input.finalizedDamageEnvelopeChecksum,
    application,
    sourceLabels: input.sourceLabels,
    ...(input.repeatSaveDamagerActorId === undefined
      ? {}
      : { repeatSaveDamagerActorId: input.repeatSaveDamagerActorId }),
    trigger: {
      sourceLabel: concentrationDamageSourceLabel(input.sourceLabels, application),
      damageTypeLabel:
        current.damageTypes.find((damageType) => damageType.id === application.damageTypeId)
          ?.label ?? null,
      dc: dnd5eConcentrationDamageDc(application.appliedAmount)
    },
    maintainedState,
    ...current.pins,
    save: {
      savingThrowAbilityDefinitionId: DND5E_CONSTITUTION_ABILITY_DEFINITION_ID,
      modifier: facts.modifier,
      rollMode: facts.rollMode,
      keep: facts.keep,
      contributors: [...facts.contributors],
      contributorChecksum: facts.contributorChecksum,
      ...saveAddedDice
    },
    contextChecksum: checksumRuleDocument({
      ...current.pins,
      savingThrowAbilityDefinitionId: DND5E_CONSTITUTION_ABILITY_DEFINITION_ID,
      modifier: facts.modifier,
      rollMode: facts.rollMode,
      keep: facts.keep,
      contributors: [...facts.contributors],
      contributorChecksum: facts.contributorChecksum,
      ...saveAddedDice,
      maintainedState,
      finalizedDamageApplication: { ...application, maintainedStateId: maintainedState.id },
      finalizedDamageEnvelopeChecksum: input.finalizedDamageEnvelopeChecksum
    }),
    remaining: input.remaining
  })
  return { context, facts: facts.facts }
}

/** Names a pending Concentration check for its roller: the damage behind it and its DC. */
export function concentrationRollTrigger(
  context: NativeConcentrationContext
): EncounterRuleRollTriggerDto {
  return {
    kind: 'CONCENTRATION',
    damage: {
      amount: context.application.appliedAmount,
      typeLabel: context.trigger.damageTypeLabel
    },
    sourceLabel: context.trigger.sourceLabel,
    dc: context.trigger.dc
  }
}

export async function evaluateNativeConcentrationEvidence(input: {
  gameSystemId: string
  runtime: RulesRuntimeService
  random: (maximum: number) => number
  context: NativeConcentrationContext
  continuation: ServerRuleExecutionContinuationDto
  resolution: Exclude<EncounterEvidenceAnswer, { kind: 'ENTER_INTEGER' }>
  expectedOccurrenceId: string
}) {
  const { context, continuation, resolution } = input
  if (
    continuation.request.kind !== 'INTEGER_RANGE' ||
    continuation.request.min !== 1 ||
    continuation.request.max !== 20 ||
    resolution.requestId !== continuation.request.requestId ||
    continuation.occurrenceId !== input.expectedOccurrenceId
  )
    throw new Error('The concentration evidence request is unavailable.')
  requireDerivedD20Mode({ gameSystemId: input.gameSystemId, ...context.save })
  const roll = settleEncounterD20Answer({
    gameSystemId: input.gameSystemId,
    d20: context.save,
    answer: resolution,
    rollD20: () => input.random(20) + 1,
    random: input.random
  })
  const refusal = () => new Error('The concentration result does not match its frozen evidence.')
  const execution = await settleEncounterD20Test({
    continuation,
    roll,
    resume: (step) => input.runtime.resume(step),
    outputs: { rawDie: 'naturalD20', total: { port: 'total', modifier: context.save.modifier } },
    refusal
  })
  if (
    execution.evidence.source.definitionId !== context.concentrationDefinition.id ||
    execution.evidence.source.checksum !== context.concentrationDefinition.checksum ||
    execution.outputs.targetActorId !== context.application.targetActorId ||
    execution.outputs.appliedDamage !== context.application.appliedAmount ||
    execution.outputs.contributorChecksum !== context.save.contributorChecksum ||
    (execution.outputs.resultPath !== 'ON_SAVE_SUCCESS' &&
      execution.outputs.resultPath !== 'ON_SAVE_FAIL')
  )
    throw refusal()
  return {
    execution,
    rawFaces: roll.rawFaces,
    rollMode: roll.rollMode,
    keep: roll.keep,
    selectedNatural: roll.natural,
    addedDice: roll.addedDice,
    failed: execution.outputs.resultPath === 'ON_SAVE_FAIL'
  }
}

type NativeConcentrationEvidence = Awaited<ReturnType<typeof evaluateNativeConcentrationEvidence>>

export function completeNativeConcentrationResult(input: {
  context: NativeConcentrationContext
  continuation: ServerRuleExecutionContinuationDto
  execution: NativeConcentrationEvidence['execution']
  rawFaces: NativeConcentrationEvidence['rawFaces']
  rollMode: NativeConcentrationEvidence['rollMode']
  keep: NativeConcentrationEvidence['keep']
  selectedNatural: NativeConcentrationEvidence['selectedNatural']
  addedDice: NativeConcentrationEvidence['addedDice']
  failed: NativeConcentrationEvidence['failed']
  cleanup: ReturnType<typeof concentrationCheckApplicationOutputDtoSchema.parse>['cleanup']
  occurrenceVersion: number
  initialFactsChecksum: string
}) {
  const {
    context,
    continuation,
    execution,
    rawFaces,
    rollMode,
    keep,
    selectedNatural,
    addedDice,
    failed
  } = input
  const endsThisState = (
    entry: NativeConcentrationContext['remaining'][number]
  ): entry is Extract<typeof entry, { maintainedStateId: string }> =>
    'maintainedStateId' in entry && entry.maintainedStateId === context.maintainedState.id
  const nextApplication = context.remaining.find((entry) => !failed || !endsThisState(entry))
  const applicationOutputs = concentrationCheckApplicationOutputDtoSchema.parse({
    kind: 'DAMAGE_SAVE_CHECK',
    source: 'CONCENTRATION',
    schemaVersion: 1,
    occurrenceId: continuation.occurrenceId,
    parentOccurrenceId: context.parentOccurrenceId,
    concentrationDefinition: context.concentrationDefinition,
    savingThrowAbilityDefinitionId: context.save.savingThrowAbilityDefinitionId,
    systemVocabularySnapshot: context.systemVocabularySnapshot,
    targetCharacter: context.targetCharacter,
    application: { ...context.application, maintainedStateId: context.maintainedState.id },
    trigger: context.trigger,
    outcome: failed ? 'SAVE_FAILURE' : 'SAVE_SUCCESS',
    d20: {
      requestId: continuation.request.requestId,
      rollMode,
      keep,
      derivedRollMode: context.save.rollMode,
      rawFaces,
      selectedNatural,
      modifier: context.save.modifier,
      total: execution.outputs.total,
      dc: execution.outputs.dc,
      contributors: context.save.contributors,
      contributorChecksum: context.save.contributorChecksum,
      ...(addedDice.length > 0 ? { addedDice } : {})
    },
    contextChecksum: context.contextChecksum,
    cleanup: input.cleanup,
    nextOccurrenceId: nextApplication
      ? concentrationOccurrenceId(context.parentOccurrenceId, nextApplication)
      : null,
    skipped: failed
      ? context.remaining.filter(endsThisState).map((application) => ({
          ...application,
          reason: 'MAINTAINED_STATE_ENDED'
        }))
      : []
  })
  const result = storedRuleExecutionResultDtoSchema.parse({
    status: 'COMPLETE',
    occurrenceId: continuation.occurrenceId,
    occurrenceVersion: input.occurrenceVersion,
    initialFactsChecksum: input.initialFactsChecksum,
    outputs: execution.outputs,
    evidence: execution.evidence,
    applicationOutputs
  })
  if (result.status !== 'COMPLETE') throw new Error('Concentration did not complete.')
  return result
}
