import type { EncounterMaintainedEffectStateRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { SystemVocabularySnapshot } from '@artificer-toolkit/schema/projections/systemVocabulary'
import { encounterConcentrationDamageCheckPendingContextDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionDirectActionPendingContexts'
import { concentrationCheckApplicationOutputDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionEncounterApplications'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import { serverPublishedRuleDefinitionDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionCore'
import { ruleMaintenanceReusableDefinitionDocumentDtoSchema } from '@artificer-toolkit/schema/shared/ruleMaintenance'
import type { ServerRuleExecutionContinuationDto } from '@artificer-toolkit/schema/shared/rulesExecution'
import type { ReusableDefinitionCurrentDto } from '@artificer-toolkit/schema/shared/reusableDefinitions'
import type { EncounterRuleRollTriggerDto } from '@artificer-toolkit/schema/shared/encounterRuleOccurrence'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import {
  resolveEncounterD20Answer,
  type EncounterEvidenceAnswer
} from './encounterEvidenceAnswer.js'
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
    maintenancePolicy.emptyDependentPolicy !==
      (maintained.descriptor.schemaVersion === 1
        ? 'TERMINATE_WHEN_EMPTY'
        : maintained.descriptor.emptyDependentPolicy)
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
  const character = target.characterFacts
  const vocabulary = await input.readVocabulary()
  const characterPins =
    target.actor.kind === 'CHARACTER'
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
}) {
  const { current, application } = input
  const facts = resolveDnd5eConcentrationSaveFacts({
    appliedDamage: application.appliedAmount,
    targetActorId: application.targetActorId,
    rulePolicyOutput: dnd5eConcentrationHolderSaves(current.target)
  })
  const maintainedState = {
    id: current.maintained.id,
    version: current.maintained.version,
    maintenanceDefinitionId: current.maintained.maintenanceDefinitionId,
    descriptorChecksum: current.maintained.descriptorChecksum
  }
  const context = encounterConcentrationDamageCheckPendingContextDtoSchema.parse({
    kind: 'ENCOUNTER_CONCENTRATION_DAMAGE_CHECK',
    schemaVersion: 1,
    parentOccurrenceId: input.parentOccurrenceId,
    parentCommandFingerprint: input.parentCommandFingerprint,
    finalizedDamageEnvelopeChecksum: input.finalizedDamageEnvelopeChecksum,
    application,
    sourceLabels: input.sourceLabels,
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
      contributors: [...facts.contributors],
      contributorChecksum: facts.contributorChecksum
    },
    contextChecksum: checksumRuleDocument({
      ...current.pins,
      savingThrowAbilityDefinitionId: DND5E_CONSTITUTION_ABILITY_DEFINITION_ID,
      modifier: facts.modifier,
      rollMode: facts.rollMode,
      contributors: [...facts.contributors],
      contributorChecksum: facts.contributorChecksum,
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
  const {
    faces: rawFaces,
    rollMode,
    natural: selectedNatural
  } = resolveEncounterD20Answer({
    derivedRollMode: context.save.rollMode,
    answer: resolution,
    rollD20: () => input.random(20) + 1
  })
  const execution = await input.runtime.resume({
    continuation,
    response: { requestId: resolution.requestId, value: selectedNatural }
  })
  if (
    execution.status !== 'COMPLETE' ||
    execution.evidence.source.definitionId !== context.concentrationDefinition.id ||
    execution.evidence.source.checksum !== context.concentrationDefinition.checksum ||
    execution.outputs.targetActorId !== context.application.targetActorId ||
    execution.outputs.appliedDamage !== context.application.appliedAmount ||
    execution.outputs.contributorChecksum !== context.save.contributorChecksum ||
    execution.outputs.naturalD20 !== selectedNatural ||
    execution.outputs.total !== selectedNatural + context.save.modifier ||
    (execution.outputs.resultPath !== 'ON_SAVE_SUCCESS' &&
      execution.outputs.resultPath !== 'ON_SAVE_FAIL')
  )
    throw new Error('The concentration result does not match its frozen evidence.')
  return {
    execution,
    rawFaces,
    rollMode,
    selectedNatural,
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
  selectedNatural: NativeConcentrationEvidence['selectedNatural']
  failed: NativeConcentrationEvidence['failed']
  cleanup: ReturnType<typeof concentrationCheckApplicationOutputDtoSchema.parse>['cleanup']
  occurrenceVersion: number
  initialFactsChecksum: string
}) {
  const { context, continuation, execution, rawFaces, rollMode, selectedNatural, failed } = input
  const nextApplication = context.remaining.find(
    (entry) => !failed || entry.maintainedStateId !== context.maintainedState.id
  )
  const applicationOutputs = concentrationCheckApplicationOutputDtoSchema.parse({
    kind: 'CONCENTRATION_CHECK',
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
      derivedRollMode: context.save.rollMode,
      rawFaces,
      selectedNatural,
      modifier: context.save.modifier,
      total: execution.outputs.total,
      dc: execution.outputs.dc,
      contributors: context.save.contributors,
      contributorChecksum: context.save.contributorChecksum
    },
    contextChecksum: context.contextChecksum,
    cleanup: input.cleanup,
    nextOccurrenceId: nextApplication
      ? concentrationOccurrenceId(context.parentOccurrenceId, nextApplication)
      : null,
    skipped: failed
      ? context.remaining
          .filter((entry) => entry.maintainedStateId === context.maintainedState.id)
          .map((application) => ({
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
