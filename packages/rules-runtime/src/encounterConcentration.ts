import type { EncounterMaintainedEffectStateRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { EncounterActorDispositionDto } from '@artificer-toolkit/schema/api/encounterData'
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
import type { MovementTarget } from './encounterMovementTargets.js'
import type { RulesRuntimeService } from './rulesRuntimeService.js'
import {
  concentrationDamageSourceLabel,
  type ConcentrationDamageApplicationDto
} from '@artificer-toolkit/schema/shared/ruleExecutionConcentration'
import { maintenanceLinkCapabilityRegistry } from './platformPolicyModules.js'
import { discoverEncounterEventHooks } from './events/encounterEventHooks.js'
import { concentrationOccurrenceId } from './encounterConcentrationIdentity.js'

export type NativeConcentrationContext = ReturnType<
  typeof encounterConcentrationDamageCheckPendingContextDtoSchema.parse
>

/** A pending damage-triggered save of any source: Concentration, an effect's repeat save or massive damage. */
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
      maintenanceLinkCapabilityRegistry.require(input.state.gameSystemId).maintenanceDefinitionId
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
    bindings[0].definitionId !==
      maintenanceLinkCapabilityRegistry.require(input.state.gameSystemId).saveAbilityDefinitionId ||
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
  gameSystemId: string
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
  const link = maintenanceLinkCapabilityRegistry.require(input.gameSystemId)
  const facts = link.saveFacts({
    appliedDamage: application.appliedAmount,
    targetActorId: application.targetActorId,
    target: current.target
  })
  const { addedDice } = facts
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
      dc: link.saveDc(application.appliedAmount)
    },
    maintainedState,
    ...current.pins,
    save: {
      savingThrowAbilityDefinitionId: link.saveAbilityDefinitionId,
      modifier: facts.modifier,
      rollMode: facts.rollMode,
      keep: facts.keep,
      contributors: [...facts.contributors],
      contributorChecksum: facts.contributorChecksum,
      ...saveAddedDice
    },
    contextChecksum: checksumRuleDocument({
      ...current.pins,
      savingThrowAbilityDefinitionId: link.saveAbilityDefinitionId,
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

/**
 * The Concentration checks a finalized damage envelope owes: one per application whose holder
 * holds a maintenance link (`maintainedStateIds`, by holder) and whose damage meets the System's
 * save hook in the event table.
 */
export function concentrationSaveApplications<
  Application extends ConcentrationDamageApplicationDto
>(input: {
  gameSystemId: string
  applications: readonly Application[]
  maintainedStateIds: ReadonlyMap<string, string>
  damagerActorId: string | null
  dispositions: ReadonlyMap<string, EncounterActorDispositionDto>
}) {
  const { hooks } = maintenanceLinkCapabilityRegistry.require(input.gameSystemId)
  return input.applications.flatMap((application) => {
    const maintainedStateId = input.maintainedStateIds.get(application.targetActorId)
    if (!maintainedStateId) return []
    const { maintenanceSave } = discoverEncounterEventHooks({
      maintenanceHooks: hooks,
      events: [
        {
          kind: 'DAMAGED',
          phase: 'AFTER',
          damagerActorId: application.damagerActorId ?? input.damagerActorId,
          damageTypeIds: [application.damageTypeId],
          dispositions: input.dispositions
        }
      ]
    })
    return maintenanceSave ? [{ ...application, maintainedStateId }] : []
  })
}

/** Names a pending damage-triggered save for its roller: its source, the damage behind it and its DC. */
export function damageSaveRollTrigger(
  context: NativeDamageSaveContext
): EncounterRuleRollTriggerDto {
  return {
    kind: context.source,
    damage: {
      amount: context.application.appliedAmount,
      typeLabel: context.trigger.damageTypeLabel
    },
    sourceLabel: context.trigger.sourceLabel,
    dc: context.trigger.dc
  }
}

/** A kernel-built damage save's frozen holder save: its ability, modifier, mode and added dice. */
type DamageSaveFacts = NativeConcentrationContext['save']

/**
 * Settles a kernel-built damage save's d20 (Concentration, massive damage): the paused request must
 * be the chain item's own 1..20 roll, and the holder's frozen save mode decides the faces.
 */
export async function settleDamageSaveD20(input: {
  gameSystemId: string
  runtime: RulesRuntimeService
  random: (maximum: number) => number
  save: DamageSaveFacts
  continuation: ServerRuleExecutionContinuationDto
  resolution: Exclude<EncounterEvidenceAnswer, { kind: 'ENTER_INTEGER' }>
  expectedOccurrenceId: string
  /** Names the source: its paused request is not this roll, or its result is not the frozen one. */
  refusals: { request: string; result: string }
}) {
  const { continuation, resolution } = input
  const refusal = () => new Error(input.refusals.result)
  if (
    continuation.request.kind !== 'INTEGER_RANGE' ||
    continuation.request.min !== 1 ||
    continuation.request.max !== 20 ||
    resolution.requestId !== continuation.request.requestId ||
    continuation.occurrenceId !== input.expectedOccurrenceId
  )
    throw new Error(input.refusals.request)
  requireDerivedD20Mode({ gameSystemId: input.gameSystemId, ...input.save })
  const roll = settleEncounterD20Answer({
    gameSystemId: input.gameSystemId,
    d20: input.save,
    answer: resolution,
    rollD20: () => input.random(20) + 1,
    random: input.random
  })
  const execution = await settleEncounterD20Test({
    continuation,
    roll,
    resume: (step) => input.runtime.resume(step),
    outputs: { rawDie: 'naturalD20', total: { port: 'total', modifier: input.save.modifier } },
    refusal
  })
  if (
    execution.outputs.contributorChecksum !== input.save.contributorChecksum ||
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

export type DamageSaveD20Evidence = Awaited<ReturnType<typeof settleDamageSaveD20>>

/** The settled d20 a kernel-built damage save's receipt keeps. */
export function damageSaveD20Record(input: {
  requestId: string
  save: DamageSaveFacts
  evidence: DamageSaveD20Evidence
}) {
  const { evidence, save } = input
  return {
    requestId: input.requestId,
    rollMode: evidence.rollMode,
    keep: evidence.keep,
    derivedRollMode: save.rollMode,
    rawFaces: evidence.rawFaces,
    selectedNatural: evidence.selectedNatural,
    modifier: save.modifier,
    total: evidence.execution.outputs.total,
    dc: evidence.execution.outputs.dc,
    contributors: save.contributors,
    contributorChecksum: save.contributorChecksum,
    ...(evidence.addedDice.length > 0 ? { addedDice: evidence.addedDice } : {})
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
  const { context } = input
  const result = 'The concentration result does not match its frozen evidence.'
  const evidence = await settleDamageSaveD20({
    ...input,
    save: context.save,
    refusals: { request: 'The concentration evidence request is unavailable.', result }
  })
  const { outputs, evidence: source } = evidence.execution
  if (
    source.source.definitionId !== context.concentrationDefinition.id ||
    source.source.checksum !== context.concentrationDefinition.checksum ||
    outputs.targetActorId !== context.application.targetActorId ||
    outputs.appliedDamage !== context.application.appliedAmount
  )
    throw new Error(result)
  return evidence
}

export function completeNativeConcentrationResult(input: {
  context: NativeConcentrationContext
  continuation: ServerRuleExecutionContinuationDto
  execution: DamageSaveD20Evidence['execution']
  rawFaces: DamageSaveD20Evidence['rawFaces']
  rollMode: DamageSaveD20Evidence['rollMode']
  keep: DamageSaveD20Evidence['keep']
  selectedNatural: DamageSaveD20Evidence['selectedNatural']
  addedDice: DamageSaveD20Evidence['addedDice']
  failed: DamageSaveD20Evidence['failed']
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
    d20: damageSaveD20Record({
      requestId: continuation.request.requestId,
      save: context.save,
      evidence: { execution, rawFaces, rollMode, keep, selectedNatural, addedDice, failed }
    }),
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
