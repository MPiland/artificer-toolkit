import { randomInt, randomUUID } from 'node:crypto'

import {
  createActiveRuleEffectRepository,
  createEncounterRepository,
  createReusableDefinitionRepository,
  createSystemVocabularySnapshotRepository,
  type DBLike,
  type EncounterActorRecord,
  type EncounterRecord,
  type Json
} from '@artificer-toolkit/db'
import type {
  ServerRuleExecutionApplicationOutputsDto,
  ServerCompletedRuleExecutionDto,
  ServerRuleExecutionNestedD20EvidenceDto,
  ServerRuleExecutionD20PolicyDto,
  ServerRuleExecutionPendingApplicationContextDto,
  ServerPublishedRuleDefinitionDto
} from '@artificer-toolkit/schema/shared/rulesExecution'
import { serverRuleExecutionD20PolicyDtoSchema } from '@artificer-toolkit/schema/shared/rulesExecution'
import { requireServerKernelRuleExecutionPendingSnapshot } from '@artificer-toolkit/schema/shared/rulesExecution'
import { rangeDtoSchema } from '@artificer-toolkit/schema/shared/range'
import { encounterProjectionEventSchema } from '@artificer-toolkit/schema/projections/encounter'
import type { OptionalCombatActionIntentDto } from '@artificer-toolkit/schema/api/encounters'
import type { CompiledActionEntryPoint } from '@artificer-toolkit/schema/projections/characterMechanics'
import type { CompiledActionTargetPolicy } from '@artificer-toolkit/schema/projections/characterMechanics'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import {
  lengthMeasurementInSceneUnits,
  measureSceneTokenFootprintDistance
} from '@artificer-toolkit/shared/vtt'
import { z } from 'zod'

import {
  createRuleExecutionOccurrenceService,
  type RuleExecutionAggregatePort,
  type StoredRuleExecutionResult
} from '../rules/ruleExecutionOccurrenceService.js'
import { resolveActionPhaseExecution } from '../rules/actionPhaseExecution.js'
import type { LiveSessionCommandAuthority } from '../campaign/liveSessionCommandAuthority.js'
import type { RulesRuntimeService } from '../rules/rulesRuntimeService.js'
import type { CharacterRuleActionApplication } from '../rules/characterRuleActionSystemAdapter.js'
import { characterRuleActionSystemAdapterRegistry } from '../rules/characterRuleActionSystemAdapterRegistry.js'
import { buildCompiledActionCompilerSource } from '../rules/characterActionEntryPointCompiler.js'
import {
  evaluateEncounterActorRuleSnapshot,
  refreshEncounterActorRuleSnapshot,
  type EncounterActorRuleEvaluationResult
} from './encounterActorRuleEvaluation.js'
import {
  lockEncounterActiveEffectTargets,
  type LockedEncounterActiveEffectTargets
} from './encounterActiveEffectTargetState.js'
import {
  prepareEncounterActionSettlementCore,
  settleEncounterActionSettlementCore,
  withTargetEncounterFeatureResourceConsumption,
  type PreparedEncounterActionSettlementCore,
  type EncounterDirectActionSource
} from './encounterActionSettlementCore.js'
import {
  maintainedDependentSnapshot,
  startEncounterConcentrationDamageChecks,
  type ConcentrationPreflight
} from './encounterConcentrationState.js'
import { findEncounterFeatureResource } from './encounterActorRuleEvaluation.js'
import {
  discoverEncounterLegendaryResistanceCandidate,
  type EncounterLegendaryResistanceCandidate
} from './encounterLegendaryResistanceDiscovery.js'
import { startEncounterLegendaryResistanceChoice } from './encounterLegendaryResistanceChoice.js'
import {
  buildEncounterActionD20Evidence,
  buildEncounterSaveD20Evidence,
  requireEncounterSaveD20EvidenceTrace,
  resolveEncounterActionD20Faces,
  selectEncounterActionD20Natural
} from './encounterMovementReactionActionExecution.js'
import type { EncounterMovementReactionActionSource } from './encounterMovementReactionSources.js'
import { EncounterConflictError, EncounterValidationError } from './encounterErrors.js'
import { lockEncounterRuleExecutionCommandContext } from './encounterRuleExecutionCommandContext.js'
import {
  createEncounterActionStartIntent,
  revalidateEncounterActionSceneDependency,
  toEncounterActionSceneDependency,
  type EncounterActionSceneDependency,
  type LockedEncounterActionSceneContext
} from './encounterActionSceneContext.js'
import { compileEncounterCurrentProjection, projectGm } from './encounterProjection.js'
import { persistEncounterCleavingChoice } from './encounterCleavingChoice.js'
import { lockEncounterActionPositionalFacts } from './encounterActionPositionalFacts.js'
import { settleEncounterActionForcedMovement } from './encounterActionForcedMovement.js'
import { discoverEncounterFeatureActionCapabilities } from '../rules/encounterFeatureActionCapabilityDiscoveryRegistry.js'
import type { EncounterFeatureActionCapabilityDescriptor } from '../rules/encounterFeatureActionCapabilityDiscovery.js'
import { DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID } from '../rules/systems/dnd5e/concentrationPolicy.js'

type CompiledCharacterActionEntry = Extract<
  CompiledActionEntryPoint,
  { kind: 'CHARACTER_ACTION'; compilation: { kind: 'COMPILED' } }
>
type CompiledCharacterSpellCastEntry = Extract<
  CompiledActionEntryPoint,
  { kind: 'CHARACTER_SPELL_CAST'; compilation: { kind: 'COMPILED' } }
>
type CharacterActorDirectPendingContext = Extract<
  ServerRuleExecutionPendingApplicationContextDto,
  { kind: 'ENCOUNTER_ACTOR_RULE_ACTION' }
>
type CharacterSpellActorDirectPendingContext = Extract<
  ServerRuleExecutionPendingApplicationContextDto,
  { kind: 'ENCOUNTER_ACTOR_SPELL_CAST' }
>
type CreatureActorDirectPendingContext = Extract<
  ServerRuleExecutionPendingApplicationContextDto,
  { kind: 'ENCOUNTER_CREATURE_RULE_ACTION' }
>
type ActorDirectPendingContext =
  | CharacterActorDirectPendingContext
  | CharacterSpellActorDirectPendingContext
  | CreatureActorDirectPendingContext

async function lockDirectActionConcentrationPreflight(input: {
  db: DBLike
  encounter: EncounterRecord
  targetActor: EncounterActorRecord
}): Promise<ConcentrationPreflight | null> {
  if (
    (input.encounter.automationMode !== 'AUTOMATIC' &&
      input.encounter.automationMode !== 'ASSISTED') ||
    input.targetActor.kind !== 'CHARACTER'
  ) {
    return null
  }
  const activeEffects = createActiveRuleEffectRepository(input.db)
  const state = await activeEffects.lockMaintainedState({
    encounterId: input.encounter.id,
    ownerActorId: input.targetActor.id,
    maintenanceDefinitionId: DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID
  })
  if (!state) return null
  const dependents = await activeEffects.lockDependentEffects({
    stateId: state.id,
    encounterId: input.encounter.id
  })
  return {
    id: state.id,
    version: state.version,
    ownerActorId: state.ownerActorId,
    maintenanceDefinitionId: state.maintenanceDefinitionId,
    descriptorChecksum: state.descriptorChecksum,
    dependents: dependents.map(maintainedDependentSnapshot)
  }
}

function isDirectActionContext(
  context: ServerRuleExecutionPendingApplicationContextDto
): context is ActorDirectPendingContext {
  return (
    context.kind === 'ENCOUNTER_ACTOR_RULE_ACTION' ||
    context.kind === 'ENCOUNTER_ACTOR_SPELL_CAST' ||
    context.kind === 'ENCOUNTER_CREATURE_RULE_ACTION'
  )
}

function initialPublishedForDirectSource(source: ResolvedDirectActionSource) {
  if (source.kind === 'CHARACTER') return initialPublishedDefinition(source.action.entry)
  if (source.kind === 'CHARACTER_SPELL_CAST') {
    const plan = source.action.entry.compilation.executionPlan
    return plan.kind === 'SINGLE_GRAPH' ? plan.published : plan.test.published
  }
  const adapter = characterRuleActionSystemAdapterRegistry.get(
    source.action.capability.gameSystemId
  )
  if (!adapter)
    throw new EncounterValidationError('The Creature Game System cannot execute this action.')
  const plan = adapter.compileExecutionPlan?.({
    action: source.action.capability,
    compilerSource: buildCompiledActionCompilerSource(source.action.capability)
  }) ?? {
    kind: 'SINGLE_GRAPH' as const,
    published: adapter.compile({ action: source.action.capability })
  }
  return plan.kind === 'SINGLE_GRAPH' ? plan.published : plan.test.published
}

function nestedOutcomeD20ForTerminal(input: {
  applicationContext: ActorDirectPendingContext
  execution: ServerCompletedRuleExecutionDto
}): ServerRuleExecutionNestedD20EvidenceDto | null {
  const twoPhase =
    input.applicationContext.twoPhase?.phase === 'OUTCOME'
      ? input.applicationContext.twoPhase
      : null
  if (!twoPhase?.nestedOutcomeD20) {
    if (twoPhase?.nestedOutcomeD20Evidence)
      throw new EncounterValidationError('The Encounter action nested save evidence has no policy.')
    return null
  }
  const evidence = twoPhase.nestedOutcomeD20Evidence
  if (!evidence)
    throw new EncounterValidationError('The Encounter action nested save evidence is unavailable.')
  requireEncounterSaveD20EvidenceTrace({
    execution: input.execution,
    policy: twoPhase.nestedOutcomeD20,
    evidence
  })
  return evidence
}

const actionResolutionSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('SYSTEM'), requestId: z.string().min(1) }),
  z.strictObject({
    kind: z.literal('PHYSICAL'),
    requestId: z.string().min(1),
    rawFaces: z.array(z.number().int().min(1).max(20)).min(1).max(2)
  }),
  z.strictObject({
    kind: z.literal('LEGENDARY_RESISTANCE'),
    selection: z.enum(['DECLINE', 'USE'])
  }),
  z.strictObject({
    kind: z.literal('SYSTEM_OUTCOME'),
    requestIds: z.array(z.string().min(1)).min(1).max(31)
  }),
  z.strictObject({
    kind: z.literal('PHYSICAL_OUTCOME'),
    values: z
      .array(z.strictObject({ requestId: z.string().min(1), value: z.number().int() }))
      .min(1)
      .max(31)
  })
])

export interface ExecuteEncounterActorDirectRuleActionInput {
  actionId: string
  actorId: string
  actorUserId: string
  commandId: string
  correlationId: string | null
  encounterId: string
  expectedEncounterVersion: number
  optionalCombatIntent?: OptionalCombatActionIntentDto | null
  sceneContext?: LockedEncounterActionSceneContext | null
  liveSessionAuthority?: LiveSessionCommandAuthority
  targetActorId: string
}

export interface ResumeEncounterActorDirectRuleActionInput {
  actorUserId: string
  commandId: string
  correlationId: string | null
  encounterId: string
  expectedEncounterVersion: number
  expectedOccurrenceVersion: number
  occurrenceId: string
  liveSessionAuthority?: LiveSessionCommandAuthority
  resolution: unknown
}

export type EncounterActorDirectRuleActionResult =
  | {
      status: 'PENDING'
      occurrenceId: string
      occurrenceVersion: number
      request: { requestId: string; min: 1; max: 20 }
      rollMode: 'NORMAL' | 'ADVANTAGE' | 'DISADVANTAGE'
      controls: readonly ['SYSTEM', 'PHYSICAL']
    }
  | {
      status: 'PENDING'
      occurrenceId: string
      occurrenceVersion: number
      phase: 'OUTCOME'
      requests: readonly { requestId: string; min: number; max: number }[]
      controls: readonly ['ENTER_INTEGER', 'SYSTEM_ROLL']
    }
  | {
      status: 'PENDING'
      occurrenceId: string
      occurrenceVersion: number
      /** Present only for the locked GM/owner; other callers receive no choice details. */
      legendaryResistance?: true
    }
  | {
      status: 'COMPLETE'
      occurrenceId: string
      occurrenceVersion: number
      application: Extract<
        ServerRuleExecutionApplicationOutputsDto,
        { kind: 'CHARACTER_MECHANICS_BATCH' | 'ENCOUNTER_ACTOR_MECHANICS_BATCH' }
      >
    }
  | { status: 'MANUAL'; occurrenceId: string; occurrenceVersion: number }

function requireCommittedAction(input: {
  actionId: string
  entries: readonly CompiledActionEntryPoint[]
}): CompiledCharacterActionEntry {
  const entry = input.entries.find((candidate) => candidate.actionId === input.actionId)
  if (
    !entry ||
    entry.compilation.kind !== 'COMPILED' ||
    entry.effectId !== initialPublishedDefinition(entry as CompiledCharacterActionEntry).id
  ) {
    throw new EncounterValidationError(
      'The selected Character action is not a committed executable rule action.'
    )
  }
  if (entry.schemaVersion === 2 && entry.compilation.activeEffectPlan !== null) {
    throw new EncounterValidationError(
      'Direct Encounter-actor actions do not support maintained or ongoing effect creation.'
    )
  }
  return entry as CompiledCharacterActionEntry
}

function requireCommittedSpellCast(input: {
  actionId: string
  entries: readonly CompiledActionEntryPoint[]
}): CompiledCharacterSpellCastEntry {
  const entry = input.entries.find(
    (candidate) =>
      candidate.kind === 'CHARACTER_SPELL_CAST' && candidate.actionId === input.actionId
  )
  if (!entry || entry.compilation.kind !== 'COMPILED')
    throw new EncounterValidationError('The selected Character spell cast is not executable.')
  if (
    !('executionPlan' in entry.compilation) ||
    entry.compilation.executionPlan.kind !== 'SINGLE_GRAPH'
  )
    throw new EncounterValidationError('The selected Character spell cast is not normalized.')
  return entry as CompiledCharacterSpellCastEntry
}

function initialPublishedDefinition(entry: CompiledCharacterActionEntry) {
  if (entry.schemaVersion === 4) {
    return entry.compilation.executionPlan.kind === 'SINGLE_GRAPH'
      ? entry.compilation.executionPlan.published
      : entry.compilation.executionPlan.test.published
  }
  return (entry as Extract<CompiledCharacterActionEntry, { schemaVersion: 1 | 2 | 3 }>).compilation
    .published
}

function actionTestOutcomePlan(entry: CompiledCharacterActionEntry) {
  return entry.schemaVersion === 4 && entry.compilation.executionPlan.kind === 'TEST_OUTCOME'
    ? entry.compilation.executionPlan
    : null
}

function targetPolicyPermitsEncounterActor(input: {
  actorId: string
  targetPolicy: CompiledActionTargetPolicy
  sceneContext: LockedEncounterActionSceneContext | null
  targetActorId: string
}): boolean {
  const policy = input.targetPolicy
  if (policy.shape !== null || policy.pathOverrides.length !== 0) return false
  if (policy.range.rangeKind === 'SELF') return input.targetActorId === input.actorId
  if (
    policy.range.rangeKind === 'DISTANCE' &&
    input.sceneContext &&
    policy.targeting?.selectionKind === 'SINGLE_TARGET' &&
    policy.targeting.dispositionKind === 'ANY' &&
    !policy.targeting.excludedCreatureTypeIds?.length &&
    input.targetActorId !== input.actorId
  ) {
    try {
      const maximumDistance = lengthMeasurementInSceneUnits(
        { amount: policy.range.amount, unit: policy.range.unit },
        input.sceneContext.grid
      )
      return (
        maximumDistance !== null &&
        measureSceneTokenFootprintDistance(
          input.sceneContext.grid,
          input.sceneContext.sourceToken,
          input.sceneContext.targetToken
        ) <= maximumDistance
      )
    } catch {
      return false
    }
  }
  return (
    policy.range.rangeKind === 'UNLIMITED' &&
    policy.targeting?.selectionKind === 'SINGLE_TARGET' &&
    policy.targeting.dispositionKind === 'ANY' &&
    !policy.targeting.excludedCreatureTypeIds?.length &&
    input.targetActorId !== input.actorId
  )
}

function sourceAction(input: {
  actionId: string
  actor: EncounterActorRecord
  targets: LockedEncounterActiveEffectTargets
}): Extract<EncounterMovementReactionActionSource, { kind: 'CHARACTER_ACTION' }> {
  if (input.actor.kind !== 'CHARACTER' || !input.actor.sourceId) {
    throw new EncounterValidationError('Direct Encounter-actor actions require a Character source.')
  }
  const character = input.targets.lockedCharacters.get(input.actor.sourceId)
  if (
    !character ||
    character.actor.id !== input.actor.id ||
    character.streamVersion !== character.mechanics.characterStreamVersion
  ) {
    throw new EncounterConflictError('The Encounter Character action source is stale.')
  }
  const entry = requireCommittedAction({
    actionId: input.actionId,
    entries: character.mechanics.compiledActionEntryPoints
  })
  const candidate = character.mechanics.rulePolicyInput.actionCandidates.find(
    (value) => value.actionId === input.actionId && value.effectId === entry.effectId
  )
  if (!candidate) throw new EncounterConflictError('The selected Character action is stale.')
  return {
    kind: 'CHARACTER_ACTION',
    actorId: input.actor.id,
    characterId: character.id,
    characterStreamVersion: character.streamVersion,
    candidate,
    entry
  }
}

function sourceSpellCast(input: {
  actionId: string
  actor: EncounterActorRecord
  targets: LockedEncounterActiveEffectTargets
}): Extract<EncounterDirectActionSource, { kind: 'CHARACTER_SPELL_CAST' }> {
  if (input.actor.kind !== 'CHARACTER' || !input.actor.sourceId)
    throw new EncounterValidationError('Direct Encounter spell casts require a Character source.')
  const character = input.targets.lockedCharacters.get(input.actor.sourceId)
  if (!character || character.actor.id !== input.actor.id)
    throw new EncounterConflictError('The Encounter Character spell source is stale.')
  const entry = requireCommittedSpellCast({
    actionId: input.actionId,
    entries: character.mechanics.compiledActionEntryPoints
  })
  const candidate = character.mechanics.rulePolicyInput.spellCastCandidates.find(
    (value) => value.candidateId === input.actionId
  )
  const decision = character.mechanics.rulePolicyOutput.spellCastDecisions.find(
    (value) => value.candidateId === input.actionId
  )
  const mechanics = character.mechanics.rulePolicyOutput.spellCastMechanics.find(
    (value) => value.candidateId === input.actionId
  )
  const mechanic = mechanics?.mechanics.find((value) => value.effectId === entry.effectId)
  if (
    !candidate ||
    !decision ||
    decision.status !== 'AVAILABLE' ||
    !mechanics ||
    !mechanic ||
    mechanics.mechanics.length !== 1 ||
    candidate.spellId !== entry.spell.spellId ||
    mechanics.spellId !== entry.spell.spellId ||
    candidate.castLevel !== entry.spell.castLevel ||
    candidate.castMode !== entry.spell.castMode ||
    decision.slotKey !== entry.spell.slotKey ||
    candidate.resourceOwnerKey !== entry.spell.resourceOwnerKey ||
    candidate.resourceOwnerKey !== null
  )
    throw new EncounterConflictError('The selected Character spell cast is stale.')
  return {
    kind: 'CHARACTER_SPELL_CAST',
    actorId: input.actor.id,
    characterId: character.id,
    characterStreamVersion: character.streamVersion,
    entry,
    mechanic
  }
}

function featureTargetPolicy(
  capability: EncounterFeatureActionCapabilityDescriptor
): CompiledActionTargetPolicy {
  const invocation = capability.compiledEffect.invocation
  return {
    range: invocation.range,
    targeting: invocation.targeting ?? null,
    shape: invocation.shape ?? null,
    pathOverrides: []
  }
}

type ResolvedDirectActionSource =
  | {
      kind: 'CHARACTER'
      action: Extract<EncounterMovementReactionActionSource, { kind: 'CHARACTER_ACTION' }>
      targetPolicy: CompiledActionTargetPolicy
    }
  | {
      kind: 'CHARACTER_SPELL_CAST'
      action: Extract<EncounterDirectActionSource, { kind: 'CHARACTER_SPELL_CAST' }>
      targetPolicy: CompiledActionTargetPolicy
    }
  | {
      kind: 'CREATURE_FEATURE'
      action: Extract<EncounterMovementReactionActionSource, { kind: 'ENCOUNTER_FEATURE' }>
      targetPolicy: CompiledActionTargetPolicy
    }

/** Resolves exact locked sources without using labels or client-provided mechanics. */
async function resolveDirectActionSource(input: {
  db: DBLike
  actionId: string
  actor: EncounterActorRecord
  targets: LockedEncounterActiveEffectTargets
}): Promise<ResolvedDirectActionSource> {
  if (input.actor.kind === 'CHARACTER') {
    const matchingEntry = input.targets.lockedCharacters
      .get(input.actor.sourceId ?? '')
      ?.mechanics.compiledActionEntryPoints.find((entry) => entry.actionId === input.actionId)
    if (matchingEntry?.kind === 'CHARACTER_SPELL_CAST') {
      const action = sourceSpellCast(input)
      return { kind: 'CHARACTER_SPELL_CAST', action, targetPolicy: action.entry.targetPolicy }
    }
    const action = sourceAction(input)
    if (!action.entry.targetPolicy) {
      throw new EncounterValidationError(
        'The selected Character action target policy is unavailable.'
      )
    }
    return { kind: 'CHARACTER', action, targetPolicy: action.entry.targetPolicy }
  }
  if (input.actor.kind !== 'CREATURE' || !input.actor.systemId) {
    throw new EncounterValidationError(
      'Direct Encounter actions require a Character or Creature source.'
    )
  }
  const vocabulary = await createSystemVocabularySnapshotRepository(input.db).findActive(
    input.actor.systemId
  )
  if (!vocabulary) throw new EncounterValidationError('Creature System vocabulary is unavailable.')
  const capability = discoverEncounterFeatureActionCapabilities({
    actor: input.actor,
    conditionDefinitionIds: vocabulary.document.conditionTypes.map((condition) => condition.id),
    abilityDefinitions:
      'abilities' in vocabulary.document
        ? vocabulary.document.abilities.map((ability) => ({ id: ability.id, code: ability.code }))
        : []
  }).find((candidate) => candidate.actionId === input.actionId)
  if (!capability) throw new EncounterConflictError('The selected Creature action source is stale.')
  const targetPolicy = featureTargetPolicy(capability)
  if (targetPolicy.shape !== null || targetPolicy.pathOverrides.length !== 0) {
    throw new EncounterValidationError('The selected Creature action target policy is unsupported.')
  }
  return {
    kind: 'CREATURE_FEATURE',
    action: { kind: 'ENCOUNTER_FEATURE', actorId: input.actor.id, capability },
    targetPolicy
  }
}

function targetCurrentnessChecksum(input: {
  target: EncounterActorRecord
  targets: LockedEncounterActiveEffectTargets
}): string {
  const rule = input.targets.encounterActorRules?.actors.find(
    (candidate) => candidate.actorId === input.target.id
  )
  if (!rule) throw new EncounterConflictError('The Encounter target rule state is stale.')
  return checksumRuleDocument({ actor: input.target, rule })
}

function actionEconomyPendingReceipt(input: PreparedEncounterActionSettlementCore) {
  const consumption = input.actionEconomyConsumption ?? null
  return consumption === null
    ? null
    : {
        definitionId: consumption.definitionId,
        definitionVersion: consumption.definitionVersion,
        definitionChecksum: consumption.definitionChecksum,
        maximum: consumption.maximum,
        beforeUsed: consumption.beforeUsed
      }
}

function actionPendingContext(input: {
  prepared: PreparedEncounterActionSettlementCore
  actionId: string
  sceneContext: EncounterActionSceneDependency | null
  positionalDependencyChecksum: string | null
  published: { id: string; checksum: string }
  d20: {
    rollMode: ServerRuleExecutionD20PolicyDto['rollMode']
    contributors: readonly ServerRuleExecutionD20PolicyDto['contributors'][number][]
    contributorChecksum: string
    modifier: number
    defenseOrDc: number
  } | null
  twoPhase?: ActorDirectPendingContext['twoPhase']
}): ActorDirectPendingContext {
  const source = input.prepared.actionSource
  const phase = {
    kind: 'ACTION_EVIDENCE' as const,
    d20: input.d20
      ? {
          rollMode: input.d20.rollMode,
          contributors: [...input.d20.contributors],
          contributorChecksum: input.d20.contributorChecksum,
          modifier: input.d20.modifier,
          defenseOrDc: input.d20.defenseOrDc
        }
      : null
  }
  if (source.kind === 'ENCOUNTER_FEATURE') {
    const capability = source.capability
    return {
      kind: 'ENCOUNTER_CREATURE_RULE_ACTION',
      schemaVersion: 1,
      actionId: input.actionId,
      sceneContext: input.sceneContext,
      positionalDependencyChecksum: input.positionalDependencyChecksum,
      sourceActorId: input.prepared.sourceActor.id,
      targetActorId: input.prepared.targetActor.id,
      creatureSourceId: capability.creatureSourceId,
      sourceRevision: capability.sourceRevision,
      sourceVersionId: capability.sourceVersionId,
      sourceChecksum: capability.sourceChecksum,
      ownerFeatureId: capability.ownerFeatureId,
      featureOptionId: capability.featureOptionId,
      effectId: capability.effectId,
      authoredEffectChecksum: capability.authoredEffectChecksum,
      compiledEffectChecksum: capability.compiledEffectChecksum,
      targetCurrentnessChecksum: checksumRuleDocument(input.prepared.action.target),
      publishedDefinitionId: input.published.id,
      publishedDefinitionChecksum: input.published.checksum,
      actionEconomy: actionEconomyPendingReceipt(input.prepared),
      twoPhase: input.twoPhase ?? null,
      phase
    }
  }
  const character = input.prepared.targets.lockedCharacters.get(source.characterId)
  if (!character)
    throw new EncounterConflictError('The Encounter Character action source is stale.')
  if (source.kind === 'CHARACTER_SPELL_CAST') {
    return {
      kind: 'ENCOUNTER_ACTOR_SPELL_CAST' as const,
      schemaVersion: 1 as const,
      actionId: input.actionId,
      sceneContext: input.sceneContext,
      positionalDependencyChecksum: input.positionalDependencyChecksum,
      sourceActorId: input.prepared.sourceActor.id,
      targetActorId: input.prepared.targetActor.id,
      sourceCharacterId: source.characterId,
      sourceCharacterStreamVersion: character.streamVersion,
      sourceProjectionChecksum: character.mechanics.projectionChecksum,
      sourceMechanicalContextChecksum: character.overlay.mechanicalContextChecksum,
      targetCurrentnessChecksum: targetCurrentnessChecksum({
        target: input.prepared.targetActor,
        targets: input.prepared.targets
      }),
      publishedDefinitionId: input.published.id,
      publishedDefinitionChecksum: input.published.checksum,
      actionEconomy: actionEconomyPendingReceipt(input.prepared),
      twoPhase: input.twoPhase ?? null,
      spell: { ...source.entry.spell, effectId: source.entry.effectId },
      phase
    }
  }
  return {
    kind: 'ENCOUNTER_ACTOR_RULE_ACTION' as const,
    schemaVersion: 1 as const,
    actionId: input.actionId,
    sceneContext: input.sceneContext,
    positionalDependencyChecksum: input.positionalDependencyChecksum,
    sourceActorId: input.prepared.sourceActor.id,
    targetActorId: input.prepared.targetActor.id,
    sourceCharacterId: source.characterId,
    sourceCharacterStreamVersion: character.streamVersion,
    sourceProjectionChecksum: character.mechanics.projectionChecksum,
    sourceMechanicalContextChecksum: character.overlay.mechanicalContextChecksum,
    targetCurrentnessChecksum: targetCurrentnessChecksum({
      target: input.prepared.targetActor,
      targets: input.prepared.targets
    }),
    publishedDefinitionId: input.published.id,
    publishedDefinitionChecksum: input.published.checksum,
    actionEconomy: actionEconomyPendingReceipt(input.prepared),
    twoPhase: input.twoPhase ?? null,
    phase
  }
}

/** Re-resolve exactly the sealed action source before applying new evidence. */
function requirePendingSourceCurrent(input: {
  context: ActorDirectPendingContext
  source: ResolvedDirectActionSource
  prepared: PreparedEncounterActionSettlementCore
}): void {
  if (
    input.context.sourceActorId !== input.prepared.sourceActor.id ||
    input.context.targetActorId !== input.prepared.targetActor.id
  ) {
    throw new EncounterConflictError('The selected Encounter action is not current.')
  }
  if (input.source.kind !== 'CREATURE_FEATURE') {
    const expectedKind =
      input.source.kind === 'CHARACTER_SPELL_CAST'
        ? 'ENCOUNTER_ACTOR_SPELL_CAST'
        : 'ENCOUNTER_ACTOR_RULE_ACTION'
    if (input.context.kind !== expectedKind) {
      throw new EncounterConflictError('The selected Encounter action source changed.')
    }
    const current = actionPendingContext({
      prepared: input.prepared,
      actionId: input.context.actionId,
      sceneContext: input.context.sceneContext,
      positionalDependencyChecksum: input.context.positionalDependencyChecksum,
      d20: null,
      published: input.prepared.action.published
    })
    if (
      current.kind !== expectedKind ||
      current.sourceCharacterId !== input.context.sourceCharacterId ||
      current.sourceCharacterStreamVersion !== input.context.sourceCharacterStreamVersion ||
      current.sourceProjectionChecksum !== input.context.sourceProjectionChecksum ||
      current.sourceMechanicalContextChecksum !== input.context.sourceMechanicalContextChecksum ||
      current.targetCurrentnessChecksum !== input.context.targetCurrentnessChecksum ||
      JSON.stringify(current.actionEconomy) !== JSON.stringify(input.context.actionEconomy) ||
      (input.context.kind === 'ENCOUNTER_ACTOR_SPELL_CAST' &&
        (current.kind !== 'ENCOUNTER_ACTOR_SPELL_CAST' ||
          JSON.stringify(current.spell) !== JSON.stringify(input.context.spell))) ||
      (input.context.twoPhase?.phase !== 'OUTCOME' &&
        (current.publishedDefinitionId !== input.context.publishedDefinitionId ||
          current.publishedDefinitionChecksum !== input.context.publishedDefinitionChecksum))
    ) {
      throw new EncounterConflictError('Direct Encounter action pending currentness changed.')
    }
    return
  }
  if (input.context.kind !== 'ENCOUNTER_CREATURE_RULE_ACTION') {
    throw new EncounterConflictError('The selected Encounter action source changed.')
  }
  const capability = input.source.action.capability
  if (
    input.context.actionId !== capability.actionId ||
    input.context.creatureSourceId !== capability.creatureSourceId ||
    input.context.sourceRevision !== capability.sourceRevision ||
    input.context.sourceVersionId !== capability.sourceVersionId ||
    input.context.sourceChecksum !== capability.sourceChecksum ||
    input.context.ownerFeatureId !== capability.ownerFeatureId ||
    input.context.featureOptionId !== capability.featureOptionId ||
    input.context.effectId !== capability.effectId ||
    input.context.authoredEffectChecksum !== capability.authoredEffectChecksum ||
    input.context.compiledEffectChecksum !== capability.compiledEffectChecksum ||
    input.context.targetCurrentnessChecksum !==
      checksumRuleDocument(input.prepared.action.target) ||
    JSON.stringify(actionEconomyPendingReceipt(input.prepared)) !==
      JSON.stringify(input.context.actionEconomy) ||
    (input.context.twoPhase?.phase !== 'OUTCOME' &&
      (input.context.publishedDefinitionId !== input.prepared.action.published.id ||
        input.context.publishedDefinitionChecksum !== input.prepared.action.published.checksum))
  ) {
    throw new EncounterConflictError('The selected Creature action source is stale.')
  }
}

function d20PolicyForRequest(input: {
  d20: NonNullable<
    Extract<ReturnType<typeof actionPendingContext>['phase'], { kind: 'ACTION_EVIDENCE' }>['d20']
  >
  request: { kind: string; min?: number; max?: number; nodeId: string }
}): ServerRuleExecutionD20PolicyDto {
  if (
    input.request.kind !== 'INTEGER_RANGE' ||
    input.request.min !== 1 ||
    input.request.max !== 20
  ) {
    throw new EncounterValidationError(
      'The selected Character action requested unsupported evidence.'
    )
  }
  return serverRuleExecutionD20PolicyDtoSchema.parse({
    requestNodeId: input.request.nodeId,
    rollMode: input.d20.rollMode,
    contributors: input.d20.contributors,
    contributorChecksum: input.d20.contributorChecksum,
    modifier: input.d20.modifier,
    dc: input.d20.defenseOrDc
  })
}

function nestedOutcomeD20Policy(input: {
  published: ServerPublishedRuleDefinitionDto
  d20: {
    rollMode: ServerRuleExecutionD20PolicyDto['rollMode']
    contributors: readonly ServerRuleExecutionD20PolicyDto['contributors'][number][]
    contributorChecksum: string
    modifier: number
    defenseOrDc: number
  } | null
}): ServerRuleExecutionD20PolicyDto | null {
  const requestNode = input.published.definition.nodes?.find(
    (node) => node.id === 'nested-save-d20'
  )
  if (!requestNode) return null
  const minimum = requestNode.inputs.min
  const maximum = requestNode.inputs.max
  if (
    requestNode.operation.key !== 'evidence.integer-range' ||
    requestNode.operation.contractVersion !== 1 ||
    minimum?.kind !== 'LITERAL' ||
    minimum.value !== 1 ||
    maximum?.kind !== 'LITERAL' ||
    maximum.value !== 20
  ) {
    throw new EncounterValidationError('The nested save request is invalid.')
  }
  if (!input.d20) throw new EncounterValidationError('The nested save policy is unavailable.')
  return serverRuleExecutionD20PolicyDtoSchema.parse({
    requestNodeId: requestNode.id,
    rollMode: input.d20.rollMode,
    contributors: [...input.d20.contributors],
    contributorChecksum: input.d20.contributorChecksum,
    modifier: input.d20.modifier,
    dc: input.d20.defenseOrDc
  })
}

function pausedD20Summary(
  d20: NonNullable<
    Extract<ReturnType<typeof actionPendingContext>['phase'], { kind: 'ACTION_EVIDENCE' }>['d20']
  >
) {
  return { kind: 'D20_EVIDENCE' as const, rollMode: d20.rollMode }
}

function validateDirectActionPause(input: {
  continuation: { request: { kind: string; min?: number; max?: number; nodeId: string } }
  applicationContext: ReturnType<typeof actionPendingContext>
}): void {
  if (
    input.applicationContext.phase.kind !== 'ACTION_EVIDENCE' ||
    input.applicationContext.phase.d20 === null
  ) {
    throw new EncounterValidationError('Direct Encounter action requested unsupported evidence.')
  }
  d20PolicyForRequest({
    d20: input.applicationContext.phase.d20,
    request: input.continuation.request
  })
}

function validateLegendaryResistanceChoicePause(input: {
  continuation: {
    request: { kind: string; min?: number; max?: number; nodeId: string }
    graph: { source: { definitionId: string; checksum: string } }
  }
  applicationContext: ServerRuleExecutionPendingApplicationContextDto
}): void {
  if (
    !isDirectActionContext(input.applicationContext) ||
    input.applicationContext.phase.kind !== 'LEGENDARY_RESISTANCE_CHOICE' ||
    input.continuation.request.kind !== 'INTEGER_RANGE' ||
    input.continuation.request.nodeId !== 'choice' ||
    input.continuation.request.min !== 0 ||
    input.continuation.request.max !== 1 ||
    input.continuation.graph.source.definitionId !==
      input.applicationContext.phase.resistance.choiceGraphDefinitionId ||
    input.continuation.graph.source.checksum !==
      input.applicationContext.phase.resistance.choiceGraphDefinitionChecksum
  )
    throw new EncounterValidationError(
      'Legendary Resistance choice requested unsupported evidence.'
    )
}

function assertLegendaryResistancePendingPhaseIntegrity(
  phase: Extract<ActorDirectPendingContext['phase'], { kind: 'LEGENDARY_RESISTANCE_CHOICE' }>
): void {
  const d20RequestTraces = phase.originalExecution.evidence.trace.filter(
    (trace) =>
      trace.operation.key === 'evidence.integer-range' &&
      trace.operation.contractVersion === 1 &&
      trace.inputs.min === 1 &&
      trace.inputs.max === 20 &&
      trace.evidence?.kind === 'INTEGER_RANGE'
  )
  const d20ResultTraces = phase.originalExecution.evidence.trace.filter(
    (trace) =>
      typeof trace.inputs.naturalD20 === 'number' &&
      typeof trace.inputs.modifier === 'number' &&
      typeof trace.inputs.threshold === 'number' &&
      typeof trace.inputs.contributorChecksum === 'string' &&
      typeof trace.outputs.contributorChecksum === 'string' &&
      typeof trace.outputs.total === 'number' &&
      typeof trace.outputs.resultPath === 'string'
  )
  const hasExactD20Evidence =
    d20RequestTraces.length === 1 &&
    d20ResultTraces.length === 1 &&
    d20RequestTraces.filter(
      (trace) =>
        trace.evidence?.requestId === phase.originalD20.requestId &&
        trace.evidence.value === phase.originalD20.selectedNatural
    ).length === 1 &&
    d20ResultTraces.filter(
      (trace) =>
        trace.inputs.naturalD20 === phase.originalD20.selectedNatural &&
        trace.inputs.modifier === phase.originalD20.modifier &&
        trace.inputs.threshold === phase.originalD20.defenseOrDc &&
        trace.inputs.contributorChecksum === phase.originalD20.contributorChecksum &&
        trace.outputs.contributorChecksum === phase.originalD20.contributorChecksum &&
        trace.outputs.total === phase.originalD20.total &&
        trace.outputs.resultPath === phase.originalD20.resultPath
    ).length === 1
  if (
    checksumRuleDocument(phase.originalExecution) !== phase.originalExecutionChecksum ||
    phase.originalExecution.outputs.resultPath !== 'ON_SAVE_FAIL' ||
    phase.originalExecution.evidence.outputs.resultPath !== 'ON_SAVE_FAIL' ||
    phase.originalD20.resultPath !== 'ON_SAVE_FAIL' ||
    !hasExactD20Evidence
  )
    throw new EncounterConflictError('Legendary Resistance pending action evidence is invalid.')
}

function legendaryResistanceSelectionChecksum(input: {
  targetActorId: string
  ownerFeatureId: string
  chargeId: string
  featureCost: number
  lifecycle: {
    definitionId: string
    definitionVersion: number
    definitionChecksum: string
    choiceGraphDefinitionId: string
    choiceGraphDefinitionVersion: number
    choiceGraphDefinitionChecksum: string
    useOutput: string
    interruptedStage: 'AFTER_FAILED_SAVE_BEFORE_OUTCOME'
    replacement: 'SAVE_SUCCESS'
  }
}): string {
  return checksumRuleDocument({
    targetActorId: input.targetActorId,
    ownerFeatureId: input.ownerFeatureId,
    chargeId: input.chargeId,
    featureCost: input.featureCost,
    ...input.lifecycle
  })
}

function legendaryResistanceUseOptionId(selectionChecksum: string): string {
  return checksumRuleDocument({ kind: 'USE', selectionChecksum })
}

function assertLegendaryResistanceActionCurrentness(input: {
  context: ActorDirectPendingContext
  prepared: PreparedEncounterActionSettlementCore
  actionId: string
}): void {
  const current = actionPendingContext({
    prepared: input.prepared,
    actionId: input.actionId,
    sceneContext: input.context.sceneContext,
    positionalDependencyChecksum: input.context.positionalDependencyChecksum,
    d20: null,
    published: input.prepared.action.published
  })
  if (
    current.kind !== input.context.kind ||
    current.publishedDefinitionId !== input.context.publishedDefinitionId ||
    current.publishedDefinitionChecksum !== input.context.publishedDefinitionChecksum ||
    current.targetCurrentnessChecksum !== input.context.targetCurrentnessChecksum ||
    (current.kind === 'ENCOUNTER_ACTOR_RULE_ACTION' &&
      input.context.kind === 'ENCOUNTER_ACTOR_RULE_ACTION' &&
      (current.sourceProjectionChecksum !== input.context.sourceProjectionChecksum ||
        current.sourceMechanicalContextChecksum !== input.context.sourceMechanicalContextChecksum))
  )
    throw new EncounterConflictError('Legendary Resistance action source is stale.')
}

function checksumStoredRuleExecutionResult(result: StoredRuleExecutionResult): string {
  return checksumRuleDocument(JSON.parse(JSON.stringify(result)))
}

async function finalizeDirectAction(input: {
  db: DBLike
  command: ExecuteEncounterActorDirectRuleActionInput | ResumeEncounterActorDirectRuleActionInput
  occurrenceId: string
  commandId: string
  correlationId: string | null
  commandFingerprint: string
  proposedAggregateVersion: number
  actorSnapshot: EncounterActorRuleEvaluationResult
  originalEncounter: EncounterRecord
  prepared: PreparedEncounterActionSettlementCore
  settled: Awaited<ReturnType<typeof settleEncounterActionSettlementCore>>
  sceneContext: LockedEncounterActionSceneContext | null
  attunementSlotOverride: number | null
  concentration: ConcentrationPreflight | null
  createChildOccurrencePort: (() => RuleExecutionAggregatePort) | null
  runtime: RulesRuntimeService
  rollD20?: () => number
}): Promise<(stored: StoredRuleExecutionResult) => Promise<void>> {
  const finalCharacterVersions = new Map(
    input.settled.characterTransitions.map((transition) => [
      transition.characterId,
      transition.afterStreamVersion
    ])
  )
  const finalActors = input.actorSnapshot.reconciledEncounter.actors.map((actor) => {
    const settledActor =
      actor.id === input.settled.targetActor.id
        ? input.settled.targetActor
        : actor.id === input.settled.sourceActor.id
          ? input.settled.sourceActor
          : actor
    const finalCharacterVersion =
      settledActor.kind === 'CHARACTER' && settledActor.sourceId
        ? finalCharacterVersions.get(settledActor.sourceId)
        : undefined
    return finalCharacterVersion === undefined
      ? settledActor
      : { ...settledActor, sourceRevision: finalCharacterVersion }
  })
  const nextEncounter: EncounterRecord = {
    ...input.actorSnapshot.reconciledEncounter,
    version: input.proposedAggregateVersion,
    actors: finalActors
  }
  const snapshot = refreshEncounterActorRuleSnapshot(input.actorSnapshot.snapshot, nextEncounter)
  if (!snapshot)
    throw new EncounterConflictError('The Encounter projection rule identity is stale.')
  const repository = createEncounterRepository(input.db)
  for (const actor of finalActors) {
    const prior = input.originalEncounter.actors.find((candidate) => candidate.id === actor.id)
    if (prior && JSON.stringify(prior) !== JSON.stringify(actor))
      await repository.updateActor(actor)
  }
  const projection = compileEncounterCurrentProjection(
    projectGm(nextEncounter, snapshot.output),
    snapshot
  )
  await repository.publishCurrentProjection(projection)
  return async (stored) => {
    let eventEncounter = nextEncounter
    let eventSnapshot = snapshot
    let eventProjection = projection
    const actionRange =
      input.prepared.actionSource.kind === 'CHARACTER_ACTION'
        ? input.prepared.actionSource.candidate.mechanicFacts?.invocation?.range
        : input.prepared.actionSource.kind === 'CHARACTER_SPELL_CAST'
          ? null
          : input.prepared.actionSource.capability.mechanicFacts?.invocation?.range
    const parsedActionRange = rangeDtoSchema.safeParse(actionRange)
    if (parsedActionRange.success) {
      const postSettlementEvaluation = await evaluateEncounterActorRuleSnapshot({
        db: input.db,
        encounter: nextEncounter
      })
      const postSettlementTargets = await lockEncounterActiveEffectTargets({
        trx: input.db,
        encounter: postSettlementEvaluation.reconciledEncounter,
        actors: postSettlementEvaluation.reconciledEncounter.actors,
        attunementSlotOverride: input.attunementSlotOverride,
        getEncounterActorSnapshot: async () => ({
          rules: postSettlementEvaluation.snapshot.output,
          encounter: postSettlementEvaluation.reconciledEncounter
        })
      })
      const settledSourceActor = postSettlementEvaluation.reconciledEncounter.actors.find(
        (actor) => actor.id === input.prepared.sourceActor.id
      )
      const settledTargetActor = postSettlementEvaluation.reconciledEncounter.actors.find(
        (actor) => actor.id === input.prepared.targetActor.id
      )
      if (!settledSourceActor)
        throw new EncounterConflictError('The Cleaving action source is unavailable.')
      if (!settledTargetActor)
        throw new EncounterConflictError('The Cleaving action target is unavailable.')
      const sourceCurrentness =
        input.prepared.actionSource.kind !== 'ENCOUNTER_FEATURE'
          ? (() => {
              const character = postSettlementTargets.lockedCharacters.get(
                input.prepared.actionSource.characterId
              )
              if (!character)
                throw new EncounterConflictError('The Cleaving Character source is unavailable.')
              return {
                kind: 'CHARACTER' as const,
                actorId: settledSourceActor.id,
                characterId: character.id,
                streamVersion: character.streamVersion,
                projectionChecksum: character.mechanics.projectionChecksum,
                mechanicalContextChecksum: character.overlay.mechanicalContextChecksum
              }
            })()
          : {
              kind: 'ENCOUNTER_ACTOR' as const,
              actorId: settledSourceActor.id,
              sourceRevision: input.prepared.actionSource.capability.sourceRevision,
              sourceVersionId: input.prepared.actionSource.capability.sourceVersionId,
              sourceChecksum: input.prepared.actionSource.capability.sourceChecksum,
              stateChecksum: checksumRuleDocument(settledSourceActor)
            }
      await persistEncounterCleavingChoice({
        db: input.db,
        encounter: postSettlementEvaluation.reconciledEncounter,
        expectedEncounterVersion: input.proposedAggregateVersion,
        parentOccurrenceId: input.occurrenceId,
        sourceActor: settledSourceActor,
        action: {
          actionId:
            input.prepared.actionSource.kind !== 'ENCOUNTER_FEATURE'
              ? input.prepared.actionSource.entry.actionId
              : input.prepared.actionSource.capability.effectId,
          publishedDefinitionId: input.prepared.action.published.id,
          publishedDefinitionChecksum: input.prepared.action.published.checksum,
          attackKind:
            input.prepared.action.actionMechanic.attackKind === 'MELEE'
              ? 'MELEE'
              : input.prepared.action.actionMechanic.attackKind === 'RANGED'
                ? 'RANGED'
                : 'OTHER',
          range: parsedActionRange.data
        },
        sourceCurrentness,
        targetActor: settledTargetActor,
        targets: postSettlementTargets,
        actionMechanic: input.prepared.action.actionMechanic,
        result: stored,
        sceneContext: input.sceneContext
      })
    }
    if (
      input.concentration &&
      input.prepared.targetActor.kind === 'CHARACTER' &&
      input.prepared.targetActor.sourceId &&
      (input.settled.application.kind === 'CHARACTER_MECHANICS_BATCH' ||
        input.settled.application.kind === 'ENCOUNTER_ACTOR_MECHANICS_BATCH')
    ) {
      const applications = input.settled.application.applications
        .filter(
          (application): application is Extract<typeof application, { kind: 'DAMAGE' }> =>
            application.kind === 'DAMAGE' && application.appliedAmount > 0
        )
        .map((application) => ({
          ordinal: application.ordinal,
          sourceNodeId: application.sourceNodeId,
          sourceOperationKey: application.sourceOperationKey,
          targetActorId: input.prepared.targetActor.id,
          appliedAmount: application.appliedAmount,
          damageTypeId: application.damageTypeId
        }))
      if (applications.length > 0) {
        const automationMode = input.originalEncounter.automationMode
        if (automationMode === 'MANUAL') {
          throw new EncounterConflictError('Manual actions cannot start concentration checks.')
        }
        const postSettlementEvaluation = await evaluateEncounterActorRuleSnapshot({
          db: input.db,
          encounter: eventEncounter
        })
        const postSettlementTargets = await lockEncounterActiveEffectTargets({
          trx: input.db,
          encounter: postSettlementEvaluation.reconciledEncounter,
          actors: postSettlementEvaluation.reconciledEncounter.actors,
          attunementSlotOverride: input.attunementSlotOverride,
          getEncounterActorSnapshot: async () => ({
            rules: postSettlementEvaluation.snapshot.output,
            encounter: postSettlementEvaluation.reconciledEncounter
          })
        })
        const targetCharacter = postSettlementTargets.lockedCharacters.get(
          input.prepared.targetActor.sourceId
        )
        if (!targetCharacter) {
          throw new EncounterConflictError('The concentration Character target is unavailable.')
        }
        const vocabulary = await createSystemVocabularySnapshotRepository(input.db).findById(
          targetCharacter.mechanics.systemVocabularySnapshotId
        )
        if (
          !vocabulary ||
          vocabulary.systemId !== targetCharacter.systemId ||
          vocabulary.snapshotVersion !==
            targetCharacter.mechanics.systemVocabularySnapshotVersion ||
          vocabulary.checksum !== targetCharacter.mechanics.systemVocabularySnapshotChecksum
        ) {
          throw new EncounterConflictError('The concentration System vocabulary is unavailable.')
        }
        if (!input.createChildOccurrencePort) {
          throw new EncounterConflictError(
            'Direct Encounter child occurrence context is unavailable.'
          )
        }
        const started = await startEncounterConcentrationDamageChecks({
          db: input.db,
          runtime: input.runtime,
          encounter: postSettlementEvaluation.reconciledEncounter,
          childOccurrencePort: input.createChildOccurrencePort(),
          parentOccurrenceId: input.occurrenceId,
          parentCommandFingerprint: input.commandFingerprint,
          expectedEncounterVersion: input.proposedAggregateVersion,
          targetCharacter: {
            streamVersion: targetCharacter.streamVersion,
            mechanics: targetCharacter.mechanics,
            overlay: targetCharacter.overlay,
            policyOutput:
              targetCharacter.effectiveRulePolicyOutput ?? targetCharacter.overlay.rulePolicyOutput,
            vocabularySnapshot: vocabulary
          },
          concentration: input.concentration,
          applications,
          automationMode,
          attunementSlotOverride: input.attunementSlotOverride,
          ...(input.rollD20 ? { rollD20: input.rollD20 } : {})
        })
        if (started.characterActorVersions.size > 0) {
          const actors = eventEncounter.actors.map((actor) => {
            if (actor.kind !== 'CHARACTER' || !actor.sourceId) return actor
            const sourceRevision = started.characterActorVersions.get(actor.sourceId)
            return sourceRevision === undefined ? actor : { ...actor, sourceRevision }
          })
          for (const actor of actors) {
            const prior = eventEncounter.actors.find((candidate) => candidate.id === actor.id)
            if (prior && JSON.stringify(prior) !== JSON.stringify(actor)) {
              await repository.updateActor(actor)
            }
          }
          eventEncounter = { ...eventEncounter, actors }
          const refreshedSnapshot = refreshEncounterActorRuleSnapshot(eventSnapshot, eventEncounter)
          if (!refreshedSnapshot) {
            throw new EncounterConflictError('The Encounter projection rule identity is stale.')
          }
          eventSnapshot = refreshedSnapshot
          eventProjection = compileEncounterCurrentProjection(
            projectGm(eventEncounter, eventSnapshot.output),
            eventSnapshot
          )
          await repository.publishCurrentProjection(eventProjection)
        }
      }
    }
    await repository.appendEvent({
      id: randomUUID(),
      encounterId: eventEncounter.id,
      campaignId: eventEncounter.campaignId,
      version: input.proposedAggregateVersion,
      commandId: input.commandId,
      commandType: 'RESOLVE_RULE_ACTION',
      commandFingerprint: input.commandFingerprint,
      commandPayload: {
        actorId: input.prepared.sourceActor.id,
        actionId:
          input.prepared.actionSource.kind !== 'ENCOUNTER_FEATURE'
            ? input.prepared.actionSource.entry.actionId
            : null,
        targetActorId: input.prepared.targetActor.id
      },
      resultPayload: encounterProjectionEventSchema.parse({
        command: {
          projection: projectGm(eventEncounter, eventSnapshot.output),
          roll: null,
          resolution: null
        },
        currentProjection: eventProjection,
        ruleReceipt: {
          occurrenceId: input.occurrenceId,
          resultChecksum: checksumStoredRuleExecutionResult(stored)
        }
      }) as unknown as Json,
      actorUserId: input.command.actorUserId,
      correlationId: input.correlationId
    })
  }
}

function summarize(input: {
  result: StoredRuleExecutionResult
  exposeLegendaryResistance?: boolean
}): EncounterActorDirectRuleActionResult {
  const { result, exposeLegendaryResistance = false } = input
  if (result.status === 'PAUSED') {
    if (result.pending?.kind === 'INTEGER_RANGE_EVIDENCE' && result.pending.phase === 'OUTCOME') {
      return {
        status: 'PENDING',
        occurrenceId: result.occurrenceId,
        occurrenceVersion: result.occurrenceVersion,
        phase: 'OUTCOME',
        requests: result.pending.requests,
        controls: ['ENTER_INTEGER', 'SYSTEM_ROLL']
      }
    }
    if (result.pending?.kind === 'LEGENDARY_RESISTANCE_CHOICE') {
      return {
        status: 'PENDING',
        occurrenceId: result.occurrenceId,
        occurrenceVersion: result.occurrenceVersion,
        ...(exposeLegendaryResistance ? { legendaryResistance: true as const } : {})
      }
    }
    if (result.pending?.kind !== 'D20_EVIDENCE') {
      throw new EncounterConflictError('Direct Encounter action occurrence is unavailable.')
    }
    return {
      status: 'PENDING',
      occurrenceId: result.occurrenceId,
      occurrenceVersion: result.occurrenceVersion,
      request: { requestId: result.request.requestId, min: 1, max: 20 },
      rollMode: result.pending.rollMode,
      controls: ['SYSTEM', 'PHYSICAL']
    }
  }
  if (result.status === 'MANUAL') {
    return {
      status: 'MANUAL',
      occurrenceId: result.occurrenceId,
      occurrenceVersion: result.occurrenceVersion
    }
  }
  if (
    result.status !== 'COMPLETE' ||
    (result.applicationOutputs.kind !== 'CHARACTER_MECHANICS_BATCH' &&
      result.applicationOutputs.kind !== 'ENCOUNTER_ACTOR_MECHANICS_BATCH')
  ) {
    throw new EncounterConflictError('Direct Encounter action occurrence did not settle.')
  }
  return {
    status: 'COMPLETE',
    occurrenceId: result.occurrenceId,
    occurrenceVersion: result.occurrenceVersion,
    application: result.applicationOutputs
  }
}

/**
 * Isolated rebaseline lane for a committed Character action targeting a
 * Creature or Custom Encounter actor. Character targets deliberately retain
 * the existing Character completion applicator.
 */
export async function executeEncounterActorDirectRuleAction(input: {
  db: DBLike
  runtime: RulesRuntimeService
  command: ExecuteEncounterActorDirectRuleActionInput
  /** Existing transaction-bound Encounter context from an owning command coordinator. */
  lockedEncounter?: Awaited<ReturnType<typeof lockEncounterRuleExecutionCommandContext>>
  rollD20?: () => number
  /** Test-only bounded integer source for a specialized OUTCOME graph. */
  rollInteger?: (min: number, max: number) => number
}): Promise<EncounterActorDirectRuleActionResult> {
  let prepared: PreparedEncounterActionSettlementCore | null = null
  let actorSnapshot: EncounterActorRuleEvaluationResult | null = null
  let originalEncounter: EncounterRecord | null = null
  let pendingD20: ServerRuleExecutionD20PolicyDto | null = null
  let nestedOutcomeD20Evidence: ServerRuleExecutionNestedD20EvidenceDto | null = null
  let rawFaces: readonly number[] | null = null
  let requestId: string | null = null
  let exposeLegendaryResistance = false
  let selectedLegendaryResistance: 'DECLINE' | 'USE' | null = null
  let lockedSceneContext: LockedEncounterActionSceneContext | null = null
  const initialLockedEncounter = input.lockedEncounter ?? null
  let lockedEncounterContext: Awaited<
    ReturnType<typeof lockEncounterRuleExecutionCommandContext>
  > | null = initialLockedEncounter
  if (
    lockedEncounterContext &&
    (lockedEncounterContext.context.encounterId !== input.command.encounterId ||
      lockedEncounterContext.context.actorUserId !== input.command.actorUserId)
  ) {
    throw new EncounterConflictError('Direct Encounter action context is stale.')
  }
  let attunementSlotOverride = lockedEncounterContext?.context.attunementSlotOverride ?? null
  let concentrationPreflight: ConcentrationPreflight | null = null
  let createChildOccurrencePort: (() => RuleExecutionAggregatePort) | null = initialLockedEncounter
    ? () => initialLockedEncounter.context.createReceiptOnlyChildOccurrencePort()
    : null
  exposeLegendaryResistance = lockedEncounterContext?.context.role === 'OWNER'
  const aggregatePort: RuleExecutionAggregatePort = initialLockedEncounter
    ? initialLockedEncounter.context.createRootOccurrencePort()
    : {
        async withLockedAuthorized(transaction, run) {
          const locked = await lockEncounterRuleExecutionCommandContext(transaction, {
            actorUserId: input.command.actorUserId,
            authority: 'ACTIVE_MEMBER',
            encounterId: input.command.encounterId,
            ...(input.command.liveSessionAuthority
              ? { liveSessionAuthority: input.command.liveSessionAuthority }
              : {})
          })
          lockedEncounterContext = locked
          exposeLegendaryResistance = locked.context.role === 'OWNER'
          attunementSlotOverride = locked.context.attunementSlotOverride
          createChildOccurrencePort = () => locked.context.createReceiptOnlyChildOccurrencePort()
          return run({
            aggregateKind: 'ENCOUNTER',
            aggregateId: locked.context.encounterId,
            campaignId: locked.context.campaignId,
            actorUserId: locked.context.actorUserId,
            currentVersion: locked.context.currentVersion,
            advanceVersion: (_db, expectedVersion) => locked.context.advanceVersion(expectedVersion)
          })
        }
      }
  const occurrences = createRuleExecutionOccurrenceService({
    db: input.db,
    runtime: input.runtime,
    completionApplicator: {
      async apply({
        db,
        occurrenceId,
        commandId,
        correlationId,
        commandFingerprint,
        pendingApplicationContext,
        execution: completedExecution,
        proposedAggregateVersion
      }) {
        if (!prepared || !actorSnapshot || !originalEncounter)
          throw new EncounterConflictError('Direct Encounter action preparation is unavailable.')
        let execution = completedExecution
        const outcomeTwoPhase =
          pendingApplicationContext &&
          isDirectActionContext(pendingApplicationContext) &&
          pendingApplicationContext.twoPhase?.phase === 'OUTCOME'
            ? pendingApplicationContext.twoPhase
            : null
        let d20 =
          !outcomeTwoPhase && pendingD20 && rawFaces && requestId
            ? buildEncounterActionD20Evidence({
                execution,
                policy: pendingD20,
                requestId,
                faces: rawFaces
              })
            : null
        const outcomeLegendaryResistance = outcomeTwoPhase?.legendaryResistance ?? null
        if (outcomeTwoPhase) {
          const testPolicy =
            outcomeLegendaryResistance?.d20 ??
            (pendingApplicationContext &&
            isDirectActionContext(pendingApplicationContext) &&
            pendingApplicationContext.phase.kind === 'ACTION_EVIDENCE'
              ? pendingApplicationContext.phase.d20
                ? {
                    requestNodeId: outcomeTwoPhase.testRollEvidence.requestId,
                    rollMode: pendingApplicationContext.phase.d20.rollMode,
                    contributors: pendingApplicationContext.phase.d20.contributors,
                    contributorChecksum: pendingApplicationContext.phase.d20.contributorChecksum,
                    modifier: pendingApplicationContext.phase.d20.modifier,
                    dc: pendingApplicationContext.phase.d20.defenseOrDc
                  }
                : null
              : null)
          if (!testPolicy)
            throw new EncounterConflictError(
              'Direct Encounter action TEST evidence is unavailable.'
            )
          d20 = buildEncounterActionD20Evidence({
            execution: outcomeTwoPhase.testExecution,
            policy: testPolicy,
            requestId: outcomeTwoPhase.testRollEvidence.requestId,
            faces: outcomeTwoPhase.testRollEvidence.rawFaces
          })
        }
        const initialApplications = prepared.action.adapter.interpret({
          execution,
          occurrenceId,
          published: prepared.action.published,
          targetActorId: prepared.targetActor.id,
          currentHitPoints: prepared.action.target.currentHitPoints,
          temporaryHitPoints: prepared.action.target.temporaryHitPoints,
          maximumHitPoints: prepared.action.target.maximumHitPoints,
          defenses: prepared.action.target.defenses,
          conditionImmunityIds: prepared.action.target.conditionImmunityIds
        })
        if (!initialApplications)
          throw new EncounterConflictError('Direct Encounter action outcome is unavailable.')
        let applications: readonly CharacterRuleActionApplication[] = initialApplications
        let settlementPrepared = prepared
        let legendaryResistance: Extract<
          ServerRuleExecutionApplicationOutputsDto,
          { kind: 'ENCOUNTER_ACTOR_MECHANICS_BATCH' }
        >['legendaryResistance'] = null
        if (outcomeLegendaryResistance) {
          const resistance = outcomeLegendaryResistance.resistance
          const use = outcomeLegendaryResistance.selection === 'USE'
          const selectionChecksum = legendaryResistanceSelectionChecksum({
            targetActorId: resistance.targetActorId,
            ownerFeatureId: resistance.ownerFeatureId,
            chargeId: resistance.chargeId,
            featureCost: resistance.featureCost,
            lifecycle: {
              definitionId: resistance.definitionId,
              definitionVersion: resistance.definitionVersion,
              definitionChecksum: resistance.definitionChecksum,
              choiceGraphDefinitionId: resistance.choiceGraphDefinitionId,
              choiceGraphDefinitionVersion: resistance.choiceGraphDefinitionVersion,
              choiceGraphDefinitionChecksum: resistance.choiceGraphDefinitionChecksum,
              useOutput: resistance.useOutput,
              interruptedStage: 'AFTER_FAILED_SAVE_BEFORE_OUTCOME',
              replacement: 'SAVE_SUCCESS'
            }
          })
          if (
            checksumRuleDocument(outcomeTwoPhase!.testExecution) !==
              outcomeLegendaryResistance.originalExecutionChecksum ||
            checksumRuleDocument(prepared.action.target) !==
              outcomeLegendaryResistance.targetStateChecksum ||
            selectionChecksum !== resistance.selectionChecksum ||
            legendaryResistanceUseOptionId(selectionChecksum) !== resistance.useOptionId ||
            outcomeLegendaryResistance.choiceExecution.outputs[resistance.useOutput] !== use
          )
            throw new EncounterConflictError('Legendary Resistance outcome evidence is stale.')
          if (use) {
            const actorRules = prepared.targets.encounterActorRules
            const resource = actorRules
              ? findEncounterFeatureResource(
                  actorRules,
                  prepared.targetActor.id,
                  resistance.ownerFeatureId
                )
              : null
            if (
              !resource ||
              resource.remaining !== resistance.poolBefore ||
              resource.used < 0 ||
              resource.maximum === null ||
              resource.used + resistance.featureCost > resource.maximum
            )
              throw new EncounterConflictError('Legendary Resistance charge is stale.')
            settlementPrepared = withTargetEncounterFeatureResourceConsumption({
              prepared,
              consumption: {
                ownerFeatureId: resistance.ownerFeatureId,
                chargeId: resistance.chargeId,
                cost: resistance.featureCost,
                beforeUsed: resource.used,
                afterUsed: resource.used + resistance.featureCost,
                beforeRemaining: resistance.poolBefore,
                afterRemaining: resistance.poolRemaining
              }
            })
          }
          if (!d20)
            throw new EncounterConflictError('Legendary Resistance TEST evidence is unavailable.')
          legendaryResistance = {
            selectedIndex: use ? 1 : 0,
            use,
            ownerFeatureId: resistance.ownerFeatureId,
            chargeId: resistance.chargeId,
            featureCost: resistance.featureCost,
            lifecycle: {
              definitionId: resistance.definitionId,
              definitionVersion: resistance.definitionVersion,
              definitionChecksum: resistance.definitionChecksum,
              choiceGraphDefinitionId: resistance.choiceGraphDefinitionId,
              choiceGraphDefinitionVersion: resistance.choiceGraphDefinitionVersion,
              choiceGraphDefinitionChecksum: resistance.choiceGraphDefinitionChecksum,
              useOutput: resistance.useOutput,
              interruptedStage: 'AFTER_FAILED_SAVE_BEFORE_OUTCOME',
              replacement: 'SAVE_SUCCESS'
            },
            execution: outcomeLegendaryResistance.choiceExecution,
            originalExecution: outcomeTwoPhase!.testExecution,
            originalExecutionChecksum: outcomeLegendaryResistance.originalExecutionChecksum,
            originalD20: d20
          }
        } else if (
          pendingApplicationContext &&
          isDirectActionContext(pendingApplicationContext) &&
          pendingApplicationContext.phase.kind === 'LEGENDARY_RESISTANCE_CHOICE'
        ) {
          const phase = pendingApplicationContext.phase
          assertLegendaryResistancePendingPhaseIntegrity(phase)
          const actorRules = prepared.targets.encounterActorRules
          const candidate = actorRules
            ? await discoverEncounterLegendaryResistanceCandidate({
                encounter: originalEncounter,
                targetActor: prepared.targetActor,
                actorRules,
                definitions: createReusableDefinitionRepository(db)
              })
            : null
          if (
            !candidate ||
            checksumRuleDocument(prepared.action.target) !== phase.targetStateChecksum
          ) {
            throw new EncounterConflictError('Legendary Resistance source is stale.')
          }
          const selectionChecksum = legendaryResistanceSelectionChecksum({
            targetActorId: candidate.targetActorId,
            ownerFeatureId: candidate.ownerFeatureId,
            chargeId: candidate.chargeId,
            featureCost: candidate.featureCost,
            lifecycle: candidate.lifecycle
          })
          if (
            selectionChecksum !== phase.resistance.selectionChecksum ||
            legendaryResistanceUseOptionId(selectionChecksum) !== phase.resistance.useOptionId ||
            checksumRuleDocument(phase.originalExecution) !== phase.originalExecutionChecksum
          )
            throw new EncounterConflictError('Legendary Resistance source is stale.')
          const use = execution.outputs[candidate.lifecycle.useOutput] === true
          if (
            selectedLegendaryResistance !== null &&
            use !== (selectedLegendaryResistance === 'USE')
          )
            throw new EncounterConflictError(
              'Legendary Resistance choice did not settle its selection.'
            )
          const replacementApplications = use
            ? prepared.action.adapter.interpretSaveSuccessReplacement?.({
                execution: phase.originalExecution,
                occurrenceId,
                published: prepared.action.published,
                targetActorId: prepared.targetActor.id,
                currentHitPoints: prepared.action.target.currentHitPoints,
                temporaryHitPoints: prepared.action.target.temporaryHitPoints,
                maximumHitPoints: prepared.action.target.maximumHitPoints,
                defenses: prepared.action.target.defenses,
                conditionImmunityIds: prepared.action.target.conditionImmunityIds,
                replacement: { lifecycle: candidate.lifecycle }
              })
            : prepared.action.adapter.interpret({
                execution: phase.originalExecution,
                occurrenceId,
                published: prepared.action.published,
                targetActorId: prepared.targetActor.id,
                currentHitPoints: prepared.action.target.currentHitPoints,
                temporaryHitPoints: prepared.action.target.temporaryHitPoints,
                maximumHitPoints: prepared.action.target.maximumHitPoints,
                defenses: prepared.action.target.defenses,
                conditionImmunityIds: prepared.action.target.conditionImmunityIds
              })
          if (!replacementApplications)
            throw new EncounterConflictError('Legendary Resistance replacement is unavailable.')
          applications = replacementApplications
          if (use) {
            const resource = findEncounterFeatureResource(
              actorRules!,
              prepared.targetActor.id,
              candidate.ownerFeatureId
            )
            if (
              !resource ||
              resource.remaining !== candidate.poolBefore ||
              resource.used < 0 ||
              resource.maximum === null ||
              resource.used + candidate.featureCost > resource.maximum
            )
              throw new EncounterConflictError('Legendary Resistance charge is stale.')
            settlementPrepared = withTargetEncounterFeatureResourceConsumption({
              prepared,
              consumption: {
                ownerFeatureId: candidate.ownerFeatureId,
                chargeId: candidate.chargeId,
                cost: candidate.featureCost,
                beforeUsed: resource.used,
                afterUsed: resource.used + candidate.featureCost,
                beforeRemaining: candidate.poolBefore,
                afterRemaining: candidate.poolRemaining
              }
            })
          }
          legendaryResistance = {
            selectedIndex: use ? 1 : 0,
            use,
            ownerFeatureId: candidate.ownerFeatureId,
            chargeId: candidate.chargeId,
            featureCost: candidate.featureCost,
            lifecycle: candidate.lifecycle,
            execution,
            originalExecution: phase.originalExecution,
            originalExecutionChecksum: phase.originalExecutionChecksum,
            originalD20: phase.originalD20
          }
          execution = phase.originalExecution
        }
        const nestedD20 =
          pendingApplicationContext && isDirectActionContext(pendingApplicationContext)
            ? nestedOutcomeD20ForTerminal({
                applicationContext: pendingApplicationContext,
                execution
              })
            : null
        const actionExecution = {
          kind: 'COMPLETE' as const,
          execution,
          applications,
          d20,
          nestedD20
        }
        const spatialDirectives = legendaryResistance?.use
          ? []
          : (settlementPrepared.action.adapter.interpretSpatial?.({
              execution,
              occurrenceId,
              published: settlementPrepared.action.published,
              targetActorId: settlementPrepared.targetActor.id
            }) ?? [])
        const settled = await settleEncounterActionSettlementCore({
          db,
          actorUserId: input.command.actorUserId,
          encounterId: input.command.encounterId,
          occurrenceId,
          commandId,
          ordinal: 0,
          eventPhases: { resource: 'DIRECT_ACTION_RESOURCE', outcome: 'DIRECT_ACTION_OUTCOME' },
          prepared: settlementPrepared,
          execution: actionExecution
        })
        await settleEncounterActionForcedMovement({
          db,
          encounter: originalEncounter,
          sceneContext: lockedSceneContext,
          actorUserId: input.command.actorUserId,
          commandId,
          commandFingerprint,
          sourceActorId: settlementPrepared.sourceActor.id,
          targetActorId: settlementPrepared.targetActor.id,
          targetStateChecksum: checksumRuleDocument(settlementPrepared.action.target),
          directives: spatialDirectives,
          ...(input.command.liveSessionAuthority
            ? { liveSessionAuthority: input.command.liveSessionAuthority }
            : {})
        })
        return {
          applicationOutputs:
            settled.application.kind === 'ENCOUNTER_ACTOR_MECHANICS_BATCH'
              ? { ...settled.application, legendaryResistance }
              : settled.application,
          ...(pendingApplicationContext &&
          isDirectActionContext(pendingApplicationContext) &&
          pendingApplicationContext.phase.kind === 'LEGENDARY_RESISTANCE_CHOICE'
            ? { terminalExecution: execution }
            : {}),
          afterResult: await finalizeDirectAction({
            db,
            command: input.command,
            occurrenceId,
            commandId,
            correlationId,
            commandFingerprint,
            proposedAggregateVersion,
            actorSnapshot,
            originalEncounter,
            prepared,
            settled,
            sceneContext: lockedSceneContext,
            attunementSlotOverride,
            concentration: concentrationPreflight,
            createChildOccurrencePort,
            runtime: input.runtime,
            ...(input.rollD20 ? { rollD20: input.rollD20 } : {})
          })
        }
      }
    }
  })
  const result = await occurrences.executeResolved(aggregatePort, {
    commandId: input.command.commandId,
    correlationId: input.command.correlationId,
    expectedAggregateVersion: input.command.expectedEncounterVersion,
    intent: createEncounterActionStartIntent({
      actionId: input.command.actionId,
      actorId: input.command.actorId,
      optionalCombatIntent: input.command.optionalCombatIntent,
      sceneContext: input.command.sceneContext ?? null,
      targetActorId: input.command.targetActorId
    }),
    allowPaused: true,
    async resolve({ db, aggregate }) {
      const locked = lockedEncounterContext
      if (!locked) throw new EncounterConflictError('Encounter command context was not locked.')
      if (locked.context.encounterId !== aggregate.aggregateId) {
        throw new EncounterConflictError('Direct Encounter action context is stale.')
      }
      originalEncounter = locked.encounter
      const sourceActor = locked.encounter.actors.find(
        (actor) => actor.id === input.command.actorId
      )
      const targetActor = locked.encounter.actors.find(
        (actor) => actor.id === input.command.targetActorId
      )
      if (
        locked.encounter.status !== 'ACTIVE' ||
        locked.encounter.currentActorId !== input.command.actorId ||
        !sourceActor ||
        !targetActor
      ) {
        throw new EncounterConflictError('The selected Encounter action is not current.')
      }
      lockedSceneContext = await revalidateEncounterActionSceneDependency({
        db,
        encounterId: locked.encounter.id,
        actorId: input.command.actorId,
        targetActorId: input.command.targetActorId,
        dependency: toEncounterActionSceneDependency(input.command.sceneContext ?? null)
      })
      const evaluatedActorSnapshot = await evaluateEncounterActorRuleSnapshot({
        db,
        encounter: locked.encounter
      })
      actorSnapshot = evaluatedActorSnapshot
      const targets = await lockEncounterActiveEffectTargets({
        trx: db,
        encounter: locked.encounter,
        actors: locked.encounter.actors,
        attunementSlotOverride: locked.context.attunementSlotOverride,
        getEncounterActorSnapshot: async () => ({
          rules: evaluatedActorSnapshot.snapshot.output,
          encounter: evaluatedActorSnapshot.reconciledEncounter
        })
      })
      const source = await resolveDirectActionSource({
        db,
        actionId: input.command.actionId,
        actor: sourceActor,
        targets
      })
      if (source.kind === 'CHARACTER' && targetActor.kind === 'CHARACTER') {
        throw new EncounterValidationError(
          'Character targets must use the established Character action lane.'
        )
      }
      if (
        (source.kind === 'CHARACTER' &&
          locked.context.role !== 'OWNER' &&
          locked.context.assignedCharacterId !== source.action.characterId) ||
        (source.kind === 'CREATURE_FEATURE' && locked.context.role !== 'OWNER')
      ) {
        throw new EncounterConflictError('The selected Encounter action source is unavailable.')
      }
      if (
        !targetPolicyPermitsEncounterActor({
          actorId: sourceActor.id,
          targetPolicy: source.targetPolicy,
          sceneContext: lockedSceneContext,
          targetActorId: targetActor.id
        })
      ) {
        throw new EncounterValidationError(
          'The selected Encounter action cannot target this actor.'
        )
      }
      concentrationPreflight = await lockDirectActionConcentrationPreflight({
        db,
        encounter: evaluatedActorSnapshot.reconciledEncounter,
        targetActor
      })
      const current = evaluatedActorSnapshot.reconciledEncounter
      if (current.automationMode === 'MANUAL') {
        return {
          published: initialPublishedForDirectSource(source),
          facts: {},
          manualReceipt: {
            reminder:
              current.manualReminderMode === 'SUBTLE' ? { kind: 'MANUAL_RULE_REVIEW' } : null
          }
        }
      }
      prepared = await prepareEncounterActionSettlementCore({
        db,
        actorUserId: input.command.actorUserId,
        automationMode: current.automationMode === 'AUTOMATIC' ? 'AUTOMATIC' : 'ASSISTED',
        encounter: current,
        actionSource: source.action,
        targetActorId: targetActor.id,
        targets,
        enforceActionEconomy: true
      })
      const testOutcomePlan =
        source.kind === 'CHARACTER'
          ? actionTestOutcomePlan(source.action.entry)
          : prepared.executionPlan?.kind === 'TEST_OUTCOME'
            ? prepared.executionPlan
            : null
      const phasePublished = prepared.action.published
      prepared.action.published = phasePublished
      const positionalFacts = await lockEncounterActionPositionalFacts({
        trx: db,
        encounter: current,
        sceneContext: lockedSceneContext,
        targets: prepared.targets,
        capabilityDefinitionIds:
          prepared.action.adapter.positionalCapabilityDefinitionIds?.({
            automationMode: current.automationMode,
            optionalCombatSnapshot: current.optionalCombatSnapshot ?? null,
            optionalCombatSnapshotChecksum: current.optionalCombatSnapshotChecksum ?? null
          }) ?? []
      })
      let bound = prepared.action.adapter.bindFacts({
        actionMechanic: prepared.action.actionMechanic,
        published: prepared.action.published,
        sourceDerivedFacts: prepared.action.sourceDerivedFacts,
        targetActorId: prepared.action.target.actorId,
        targetDerivedFacts: prepared.action.target.derivedFacts,
        targetConditionIds: prepared.action.target.conditionIds,
        currentHitPoints: prepared.action.target.currentHitPoints,
        temporaryHitPoints: prepared.action.target.temporaryHitPoints,
        maximumHitPoints: prepared.action.target.maximumHitPoints,
        targetScalarValues:
          prepared.targets.effectiveScalarValuesByActorId?.get(prepared.action.target.actorId) ??
          {},
        defenses: prepared.action.target.defenses,
        conditionImmunityIds: prepared.action.target.conditionImmunityIds,
        sceneContext: lockedSceneContext,
        positionalFacts
      })
      const d20 =
        bound.d20RollMode && bound.d20Audit
          ? {
              rollMode: bound.d20RollMode,
              contributors: [...bound.d20Audit.contributors],
              contributorChecksum: bound.d20Audit.contributorChecksum,
              modifier: bound.d20Audit.modifier,
              defenseOrDc: bound.d20Audit.defenseOrDc
            }
          : null
      return {
        published: prepared.action.published,
        facts: bound.facts,
        // Automatic action evidence may complete into one Legendary Resistance
        // choice; ordinary unexpected action pauses still fail in the validator.
        allowPaused: true,
        pendingApplicationContext: actionPendingContext({
          prepared,
          actionId: input.command.actionId,
          sceneContext: toEncounterActionSceneDependency(lockedSceneContext),
          positionalDependencyChecksum: positionalFacts?.dependencyChecksum ?? null,
          d20,
          published: phasePublished,
          twoPhase: testOutcomePlan
            ? {
                phase: 'TEST' as const,
                compilerSourceChecksum: testOutcomePlan.compilerSource.compilerSourceChecksum,
                testTemplateChecksum: testOutcomePlan.test.template.checksum,
                boundFactsChecksum: checksumRuleDocument(bound.facts)
              }
            : null
        }),
        resolveAutomaticEvidence:
          current.automationMode === 'AUTOMATIC' && d20
            ? async ({ request }) => {
                const policy = d20PolicyForRequest({ d20, request })
                const faces = resolveEncounterActionD20Faces({
                  policy,
                  resolution: { kind: 'SYSTEM_ROLL', requestId: request.requestId },
                  rollD20: input.rollD20 ?? (() => randomInt(1, 21))
                })
                pendingD20 = policy
                rawFaces = faces
                requestId = request.requestId
                return {
                  requestId: request.requestId,
                  value: selectEncounterActionD20Natural(policy.rollMode, faces)
                }
              }
            : undefined,
        pendingResult: d20 ? pausedD20Summary(d20) : undefined,
        ...(testOutcomePlan
          ? {
              phasePlan: {
                initialPhase: 'TEST' as const,
                phase: 'TEST' as const,
                template: testOutcomePlan.test.template,
                specializedChecksum: phasePublished.checksum
              }
            }
          : {}),
        validatePausedExecution: ({ continuation, applicationContext }) => {
          if (!isDirectActionContext(applicationContext)) {
            throw new EncounterConflictError('Direct Encounter action occurrence is unavailable.')
          }
          validateDirectActionPause({ continuation, applicationContext })
        },
        postCompletedExecution: async ({ execution, occurrenceId, applicationContext }) => {
          if (!prepared) {
            throw new EncounterConflictError('Direct Encounter action preparation is unavailable.')
          }
          let twoPhaseLegendaryResistanceCandidate: EncounterLegendaryResistanceCandidate | null =
            null
          if (
            testOutcomePlan &&
            isDirectActionContext(applicationContext) &&
            applicationContext.twoPhase?.phase === 'TEST' &&
            applicationContext.phase.kind === 'ACTION_EVIDENCE' &&
            execution.outputs.resultPath === 'ON_SAVE_FAIL' &&
            pendingD20 &&
            rawFaces &&
            requestId &&
            prepared.targetActor.kind === 'CREATURE'
          ) {
            const actorRules = prepared.targets.encounterActorRules
            twoPhaseLegendaryResistanceCandidate = actorRules
              ? await discoverEncounterLegendaryResistanceCandidate({
                  encounter: current,
                  targetActor: prepared.targetActor,
                  actorRules,
                  definitions: createReusableDefinitionRepository(db)
                })
              : null
          }
          if (
            testOutcomePlan &&
            isDirectActionContext(applicationContext) &&
            applicationContext.twoPhase?.phase === 'TEST' &&
            twoPhaseLegendaryResistanceCandidate === null
          ) {
            let phaseResolution
            try {
              phaseResolution = resolveActionPhaseExecution({
                plan: testOutcomePlan,
                phase: 'TEST',
                execution,
                adapter: prepared.action.adapter,
                facts: bound.facts
              })
            } catch (error) {
              throw new EncounterValidationError(
                error instanceof Error
                  ? error.message
                  : 'The Encounter action selected an unsupported outcome.'
              )
            }
            if (phaseResolution.kind === 'TEST_ONLY') return null
            if (phaseResolution.kind !== 'OUTCOME')
              throw new EncounterValidationError(
                'The Encounter action selected an unsupported outcome.'
              )
            const outcomeBound = prepared.action.adapter.bindFacts({
              actionMechanic: prepared.action.actionMechanic,
              published: phaseResolution.outcome.published,
              sourceDerivedFacts: prepared.action.sourceDerivedFacts,
              targetActorId: prepared.action.target.actorId,
              targetDerivedFacts: prepared.action.target.derivedFacts,
              targetConditionIds: prepared.action.target.conditionIds,
              currentHitPoints: prepared.action.target.currentHitPoints,
              temporaryHitPoints: prepared.action.target.temporaryHitPoints,
              maximumHitPoints: prepared.action.target.maximumHitPoints,
              targetScalarValues:
                prepared.targets.effectiveScalarValuesByActorId?.get(
                  prepared.action.target.actorId
                ) ?? {},
              defenses: prepared.action.target.defenses,
              conditionImmunityIds: prepared.action.target.conditionImmunityIds,
              sceneContext: lockedSceneContext,
              positionalFacts
            })
            const started = input.runtime.executeResolvedWithGraph
              ? await input.runtime.executeResolvedWithGraph({
                  command: {
                    definitionId: phaseResolution.outcome.published.id,
                    occurrenceId,
                    facts: outcomeBound.facts
                  },
                  published: phaseResolution.outcome.published
                })
              : {
                  result: await input.runtime.executeResolved({
                    command: {
                      definitionId: phaseResolution.outcome.published.id,
                      occurrenceId,
                      facts: outcomeBound.facts
                    },
                    published: phaseResolution.outcome.published
                  }),
                  graph: undefined
                }
            if (!pendingD20 || !rawFaces || !requestId)
              throw new EncounterValidationError(
                'The Encounter action TEST roll evidence is invalid.'
              )
            const selectedNatural = selectEncounterActionD20Natural(pendingD20.rollMode, rawFaces)
            const nestedOutcomeD20 = nestedOutcomeD20Policy({
              published: phaseResolution.outcome.published,
              d20:
                outcomeBound.d20RollMode && outcomeBound.d20Audit
                  ? {
                      rollMode: outcomeBound.d20RollMode,
                      contributors: outcomeBound.d20Audit.contributors,
                      contributorChecksum: outcomeBound.d20Audit.contributorChecksum,
                      modifier: outcomeBound.d20Audit.modifier,
                      defenseOrDc: outcomeBound.d20Audit.defenseOrDc
                    }
                  : null
            })
            const nextContext = {
              ...applicationContext,
              publishedDefinitionId: phaseResolution.outcome.published.id,
              publishedDefinitionChecksum: phaseResolution.outcome.published.checksum,
              twoPhase: {
                phase: 'OUTCOME' as const,
                compilerSourceChecksum: testOutcomePlan.compilerSource.compilerSourceChecksum,
                testTemplateChecksum: testOutcomePlan.test.template.checksum,
                outcomeTemplateChecksum: phaseResolution.outcome.templateChecksum,
                boundFactsChecksum: checksumRuleDocument(bound.facts),
                testExecution: execution,
                testExecutionChecksum: checksumRuleDocument(execution),
                nestedOutcomeD20,
                nestedOutcomeD20Evidence: null,
                legendaryResistance: null,
                testRollEvidence: {
                  requestId,
                  rollMode: pendingD20.rollMode,
                  rawFaces: [...rawFaces],
                  selectedNatural
                }
              }
            }
            prepared.action.published = phaseResolution.outcome.published
            return {
              ...(started.result.status === 'COMPLETE'
                ? { execution: started.result }
                : { continuation: started.result.continuation }),
              ...(started.graph ? { graph: started.graph } : {}),
              applicationContext: nextContext,
              ...(started.result.status === 'PAUSED'
                ? {
                    pendingResult:
                      nestedOutcomeD20 &&
                      started.result.continuation.request.nodeId === nestedOutcomeD20.requestNodeId
                        ? {
                            kind: 'D20_EVIDENCE' as const,
                            rollMode: nestedOutcomeD20.rollMode
                          }
                        : {
                            kind: 'INTEGER_RANGE_EVIDENCE' as const,
                            phase: 'OUTCOME' as const,
                            requests: [
                              {
                                requestId: started.result.continuation.request.requestId,
                                min: started.result.continuation.request.min,
                                max: started.result.continuation.request.max
                              }
                            ],
                            exactRequestSetChecksum: checksumRuleDocument([
                              {
                                requestId: started.result.continuation.request.requestId,
                                min: started.result.continuation.request.min,
                                max: started.result.continuation.request.max
                              }
                            ])
                          },
                    ...(current.automationMode === 'AUTOMATIC'
                      ? {
                          resolveAutomaticEvidence: async ({ request }) => {
                            if (
                              nestedOutcomeD20 &&
                              request.nodeId === nestedOutcomeD20.requestNodeId
                            ) {
                              const faces = resolveEncounterActionD20Faces({
                                policy: nestedOutcomeD20,
                                resolution: { kind: 'SYSTEM_ROLL', requestId: request.requestId },
                                rollD20: input.rollD20 ?? (() => randomInt(1, 21))
                              })
                              nestedOutcomeD20Evidence = buildEncounterSaveD20Evidence({
                                policy: nestedOutcomeD20,
                                requestId: request.requestId,
                                faces
                              })
                              return {
                                requestId: request.requestId,
                                value: selectEncounterActionD20Natural(
                                  nestedOutcomeD20.rollMode,
                                  faces
                                )
                              }
                            }
                            if (request.kind !== 'INTEGER_RANGE' || request.min >= request.max) {
                              throw new EncounterValidationError(
                                'The Encounter action outcome requested unsupported evidence.'
                              )
                            }
                            const value = input.rollInteger
                              ? input.rollInteger(request.min, request.max)
                              : randomInt(request.min, request.max + 1)
                            if (
                              !Number.isSafeInteger(value) ||
                              value < request.min ||
                              value > request.max
                            ) {
                              throw new EncounterValidationError(
                                'The Encounter action outcome roll is invalid.'
                              )
                            }
                            return { requestId: request.requestId, value }
                          },
                          captureAutomaticEvidence: async ({ request, response }) => {
                            const evidence = nestedOutcomeD20Evidence
                            if (!evidence || request.requestId !== evidence.requestId) return null
                            if (
                              response.requestId !== evidence.requestId ||
                              response.value !== evidence.selectedNatural
                            ) {
                              throw new EncounterValidationError(
                                'The Encounter action nested save evidence is invalid.'
                              )
                            }
                            return evidence
                          }
                        }
                      : {})
                  }
                : {}),
              phase: 'OUTCOME' as const,
              phaseReceiptPlan: {
                phase: 'OUTCOME' as const,
                template: phaseResolution.template,
                specializedChecksum: phaseResolution.outcome.published.checksum
              }
            }
          }
          if (
            !isDirectActionContext(applicationContext) ||
            applicationContext.phase.kind !== 'ACTION_EVIDENCE' ||
            execution.outputs.resultPath !== 'ON_SAVE_FAIL' ||
            !pendingD20 ||
            !rawFaces ||
            !requestId ||
            !prepared ||
            prepared.targetActor.kind !== 'CREATURE'
          )
            return null
          const originalD20 = buildEncounterActionD20Evidence({
            execution,
            policy: pendingD20,
            requestId,
            faces: rawFaces
          })
          const actorRules = prepared.targets.encounterActorRules
          const candidate =
            twoPhaseLegendaryResistanceCandidate ??
            (actorRules
              ? await discoverEncounterLegendaryResistanceCandidate({
                  encounter: current,
                  targetActor: prepared.targetActor,
                  actorRules,
                  definitions: createReusableDefinitionRepository(db)
                })
              : null)
          if (!candidate) return null
          const continuation = await startEncounterLegendaryResistanceChoice({
            runtime: input.runtime,
            occurrenceId,
            candidate
          })
          const selectionChecksum = legendaryResistanceSelectionChecksum({
            targetActorId: candidate.targetActorId,
            ownerFeatureId: candidate.ownerFeatureId,
            chargeId: candidate.chargeId,
            featureCost: candidate.featureCost,
            lifecycle: candidate.lifecycle
          })
          return {
            continuation,
            applicationContext: {
              ...applicationContext,
              phase: {
                kind: 'LEGENDARY_RESISTANCE_CHOICE' as const,
                originalExecution: execution,
                originalD20,
                d20: pendingD20,
                originalExecutionChecksum: checksumRuleDocument(execution),
                targetStateChecksum: checksumRuleDocument(prepared.action.target),
                resistance: {
                  targetActorId: candidate.targetActorId,
                  ownerFeatureId: candidate.ownerFeatureId,
                  chargeId: candidate.chargeId,
                  featureCost: candidate.featureCost,
                  poolBefore: candidate.poolBefore,
                  poolRemaining: candidate.poolRemaining,
                  definitionId: candidate.lifecycle.definitionId,
                  definitionVersion: candidate.lifecycle.definitionVersion,
                  definitionChecksum: candidate.lifecycle.definitionChecksum,
                  choiceGraphDefinitionId: candidate.lifecycle.choiceGraphDefinitionId,
                  choiceGraphDefinitionVersion: candidate.lifecycle.choiceGraphDefinitionVersion,
                  choiceGraphDefinitionChecksum: candidate.lifecycle.choiceGraphDefinitionChecksum,
                  useOutput: candidate.lifecycle.useOutput,
                  useOptionId: legendaryResistanceUseOptionId(selectionChecksum),
                  selectionChecksum
                }
              }
            },
            pendingResult: {
              kind: 'LEGENDARY_RESISTANCE_CHOICE' as const,
              targetActorId: candidate.targetActorId,
              useOptionId: legendaryResistanceUseOptionId(selectionChecksum)
            },
            validatePausedExecution: validateLegendaryResistanceChoicePause
          }
        }
      }
    }
  })
  return summarize({ result, exposeLegendaryResistance })
}

export async function resumeEncounterActorDirectRuleAction(input: {
  db: DBLike
  runtime: RulesRuntimeService
  command: ResumeEncounterActorDirectRuleActionInput
  rollD20?: () => number
  /** Test-only bounded integer source for a specialized OUTCOME graph. */
  rollInteger?: (min: number, max: number) => number
}): Promise<EncounterActorDirectRuleActionResult> {
  const resolution = actionResolutionSchema.parse(input.command.resolution)
  let prepared: PreparedEncounterActionSettlementCore | null = null
  let actorSnapshot: EncounterActorRuleEvaluationResult | null = null
  let originalEncounter: EncounterRecord | null = null
  let pendingD20: ServerRuleExecutionD20PolicyDto | null = null
  let nestedOutcomeD20Evidence: ServerRuleExecutionNestedD20EvidenceDto | null = null
  let rawFaces: readonly number[] | null = null
  let requestId: string | null = null
  let exposeLegendaryResistance = false
  let selectedLegendaryResistance: 'DECLINE' | 'USE' | null = null
  let currentLegendaryResistanceCandidate: EncounterLegendaryResistanceCandidate | null = null
  let lockedSceneContext: LockedEncounterActionSceneContext | null = null
  let attunementSlotOverride: number | null = null
  let concentrationPreflight: ConcentrationPreflight | null = null
  let createChildOccurrencePort: (() => RuleExecutionAggregatePort) | null = null
  const aggregatePort: RuleExecutionAggregatePort = {
    async withLockedAuthorized(transaction, run) {
      const locked = await lockEncounterRuleExecutionCommandContext(transaction, {
        actorUserId: input.command.actorUserId,
        authority: 'ACTIVE_MEMBER',
        encounterId: input.command.encounterId,
        ...(input.command.liveSessionAuthority
          ? { liveSessionAuthority: input.command.liveSessionAuthority }
          : {})
      })
      exposeLegendaryResistance = locked.context.role === 'OWNER'
      attunementSlotOverride = locked.context.attunementSlotOverride
      createChildOccurrencePort = () => locked.context.createReceiptOnlyChildOccurrencePort()
      return run({
        aggregateKind: 'ENCOUNTER',
        aggregateId: locked.context.encounterId,
        campaignId: locked.context.campaignId,
        actorUserId: locked.context.actorUserId,
        currentVersion: locked.context.currentVersion,
        advanceVersion: (_db, expectedVersion) => locked.context.advanceVersion(expectedVersion)
      })
    }
  }
  const occurrences = createRuleExecutionOccurrenceService({
    db: input.db,
    runtime: input.runtime,
    completionApplicator: {
      async apply({
        db,
        occurrenceId,
        commandId,
        correlationId,
        commandFingerprint,
        pendingApplicationContext,
        execution: choiceExecution,
        proposedAggregateVersion
      }) {
        if (!prepared || !actorSnapshot || !originalEncounter)
          throw new EncounterConflictError('Direct Encounter action preparation is unavailable.')
        const outcomeTwoPhase =
          pendingApplicationContext &&
          isDirectActionContext(pendingApplicationContext) &&
          pendingApplicationContext.twoPhase?.phase === 'OUTCOME'
            ? pendingApplicationContext.twoPhase
            : null
        const outcomeLegendaryResistance = outcomeTwoPhase?.legendaryResistance ?? null
        const outcomeOriginalD20 = (() => {
          if (!outcomeTwoPhase) return null
          const testPolicy =
            outcomeLegendaryResistance?.d20 ??
            (pendingApplicationContext &&
            isDirectActionContext(pendingApplicationContext) &&
            pendingApplicationContext.phase.kind === 'ACTION_EVIDENCE' &&
            pendingApplicationContext.phase.d20
              ? {
                  requestNodeId: outcomeTwoPhase.testRollEvidence.requestId,
                  rollMode: pendingApplicationContext.phase.d20.rollMode,
                  contributors: pendingApplicationContext.phase.d20.contributors,
                  contributorChecksum: pendingApplicationContext.phase.d20.contributorChecksum,
                  modifier: pendingApplicationContext.phase.d20.modifier,
                  dc: pendingApplicationContext.phase.d20.defenseOrDc
                }
              : null)
          if (!testPolicy)
            throw new EncounterConflictError(
              'Direct Encounter action TEST evidence is unavailable.'
            )
          return buildEncounterActionD20Evidence({
            execution: outcomeTwoPhase.testExecution,
            policy: testPolicy,
            requestId: outcomeTwoPhase.testRollEvidence.requestId,
            faces: outcomeTwoPhase.testRollEvidence.rawFaces
          })
        })()
        let actionExecution = choiceExecution
        let applications = prepared.action.adapter.interpret({
          execution: actionExecution,
          occurrenceId,
          published: prepared.action.published,
          targetActorId: prepared.targetActor.id,
          currentHitPoints: prepared.action.target.currentHitPoints,
          temporaryHitPoints: prepared.action.target.temporaryHitPoints,
          maximumHitPoints: prepared.action.target.maximumHitPoints,
          defenses: prepared.action.target.defenses,
          conditionImmunityIds: prepared.action.target.conditionImmunityIds
        })
        if (!applications)
          throw new EncounterConflictError('Direct Encounter action outcome is unavailable.')
        let settlementPrepared = prepared
        let legendaryResistance: Extract<
          ServerRuleExecutionApplicationOutputsDto,
          { kind: 'ENCOUNTER_ACTOR_MECHANICS_BATCH' }
        >['legendaryResistance'] = null
        if (outcomeLegendaryResistance) {
          const resistance = outcomeLegendaryResistance.resistance
          const use = outcomeLegendaryResistance.selection === 'USE'
          const selectionChecksum = legendaryResistanceSelectionChecksum({
            targetActorId: resistance.targetActorId,
            ownerFeatureId: resistance.ownerFeatureId,
            chargeId: resistance.chargeId,
            featureCost: resistance.featureCost,
            lifecycle: {
              definitionId: resistance.definitionId,
              definitionVersion: resistance.definitionVersion,
              definitionChecksum: resistance.definitionChecksum,
              choiceGraphDefinitionId: resistance.choiceGraphDefinitionId,
              choiceGraphDefinitionVersion: resistance.choiceGraphDefinitionVersion,
              choiceGraphDefinitionChecksum: resistance.choiceGraphDefinitionChecksum,
              useOutput: resistance.useOutput,
              interruptedStage: 'AFTER_FAILED_SAVE_BEFORE_OUTCOME',
              replacement: 'SAVE_SUCCESS'
            }
          })
          if (
            !outcomeOriginalD20 ||
            checksumRuleDocument(outcomeTwoPhase!.testExecution) !==
              outcomeLegendaryResistance.originalExecutionChecksum ||
            checksumRuleDocument(prepared.action.target) !==
              outcomeLegendaryResistance.targetStateChecksum ||
            selectionChecksum !== resistance.selectionChecksum ||
            legendaryResistanceUseOptionId(selectionChecksum) !== resistance.useOptionId ||
            outcomeLegendaryResistance.choiceExecution.outputs[resistance.useOutput] !== use
          )
            throw new EncounterConflictError('Legendary Resistance outcome evidence is stale.')
          if (use) {
            const actorRules = prepared.targets.encounterActorRules
            const resource = actorRules
              ? findEncounterFeatureResource(
                  actorRules,
                  prepared.targetActor.id,
                  resistance.ownerFeatureId
                )
              : null
            if (
              !resource ||
              resource.remaining !== resistance.poolBefore ||
              resource.used < 0 ||
              resource.maximum === null ||
              resource.used + resistance.featureCost > resource.maximum
            )
              throw new EncounterConflictError('Legendary Resistance charge is stale.')
            settlementPrepared = withTargetEncounterFeatureResourceConsumption({
              prepared,
              consumption: {
                ownerFeatureId: resistance.ownerFeatureId,
                chargeId: resistance.chargeId,
                cost: resistance.featureCost,
                beforeUsed: resource.used,
                afterUsed: resource.used + resistance.featureCost,
                beforeRemaining: resistance.poolBefore,
                afterRemaining: resistance.poolRemaining
              }
            })
          }
          legendaryResistance = {
            selectedIndex: use ? 1 : 0,
            use,
            ownerFeatureId: resistance.ownerFeatureId,
            chargeId: resistance.chargeId,
            featureCost: resistance.featureCost,
            lifecycle: {
              definitionId: resistance.definitionId,
              definitionVersion: resistance.definitionVersion,
              definitionChecksum: resistance.definitionChecksum,
              choiceGraphDefinitionId: resistance.choiceGraphDefinitionId,
              choiceGraphDefinitionVersion: resistance.choiceGraphDefinitionVersion,
              choiceGraphDefinitionChecksum: resistance.choiceGraphDefinitionChecksum,
              useOutput: resistance.useOutput,
              interruptedStage: 'AFTER_FAILED_SAVE_BEFORE_OUTCOME',
              replacement: 'SAVE_SUCCESS'
            },
            execution: outcomeLegendaryResistance.choiceExecution,
            originalExecution: outcomeTwoPhase!.testExecution,
            originalExecutionChecksum: outcomeLegendaryResistance.originalExecutionChecksum,
            originalD20: outcomeOriginalD20
          }
        } else if (
          pendingApplicationContext &&
          isDirectActionContext(pendingApplicationContext) &&
          pendingApplicationContext.phase.kind === 'LEGENDARY_RESISTANCE_CHOICE'
        ) {
          const phase = pendingApplicationContext.phase
          assertLegendaryResistancePendingPhaseIntegrity(phase)
          const use = choiceExecution.outputs[phase.resistance.useOutput] === true
          if (
            selectedLegendaryResistance === null ||
            use !== (selectedLegendaryResistance === 'USE')
          )
            throw new EncounterConflictError(
              'Legendary Resistance choice did not settle its selection.'
            )
          const replacement = use
            ? prepared.action.adapter.interpretSaveSuccessReplacement?.({
                execution: phase.originalExecution,
                occurrenceId,
                published: prepared.action.published,
                targetActorId: prepared.targetActor.id,
                currentHitPoints: prepared.action.target.currentHitPoints,
                temporaryHitPoints: prepared.action.target.temporaryHitPoints,
                maximumHitPoints: prepared.action.target.maximumHitPoints,
                defenses: prepared.action.target.defenses,
                conditionImmunityIds: prepared.action.target.conditionImmunityIds,
                replacement: {
                  lifecycle: {
                    definitionId: phase.resistance.definitionId,
                    definitionVersion: phase.resistance.definitionVersion,
                    definitionChecksum: phase.resistance.definitionChecksum,
                    choiceGraphDefinitionId: phase.resistance.choiceGraphDefinitionId,
                    choiceGraphDefinitionVersion: phase.resistance.choiceGraphDefinitionVersion,
                    choiceGraphDefinitionChecksum: phase.resistance.choiceGraphDefinitionChecksum,
                    useOutput: phase.resistance.useOutput,
                    interruptedStage: 'AFTER_FAILED_SAVE_BEFORE_OUTCOME',
                    replacement: 'SAVE_SUCCESS'
                  }
                }
              })
            : prepared.action.adapter.interpret({
                execution: phase.originalExecution,
                occurrenceId,
                published: prepared.action.published,
                targetActorId: prepared.targetActor.id,
                currentHitPoints: prepared.action.target.currentHitPoints,
                temporaryHitPoints: prepared.action.target.temporaryHitPoints,
                maximumHitPoints: prepared.action.target.maximumHitPoints,
                defenses: prepared.action.target.defenses,
                conditionImmunityIds: prepared.action.target.conditionImmunityIds
              })
          if (!replacement)
            throw new EncounterConflictError('Legendary Resistance replacement is unavailable.')
          applications = replacement
          actionExecution = phase.originalExecution
          if (use) {
            const actorRules = prepared.targets.encounterActorRules
            const resource = actorRules
              ? findEncounterFeatureResource(
                  actorRules,
                  prepared.targetActor.id,
                  phase.resistance.ownerFeatureId
                )
              : null
            if (
              !resource ||
              resource.remaining !== phase.resistance.poolBefore ||
              resource.used < 0 ||
              resource.maximum === null ||
              resource.used + phase.resistance.featureCost > resource.maximum
            )
              throw new EncounterConflictError('Legendary Resistance charge is stale.')
            settlementPrepared = withTargetEncounterFeatureResourceConsumption({
              prepared,
              consumption: {
                ownerFeatureId: phase.resistance.ownerFeatureId,
                chargeId: phase.resistance.chargeId,
                cost: phase.resistance.featureCost,
                beforeUsed: resource.used,
                afterUsed: resource.used + phase.resistance.featureCost,
                beforeRemaining: phase.resistance.poolBefore,
                afterRemaining: phase.resistance.poolRemaining
              }
            })
          }
          legendaryResistance = {
            selectedIndex: use ? 1 : 0,
            use,
            ownerFeatureId: phase.resistance.ownerFeatureId,
            chargeId: phase.resistance.chargeId,
            featureCost: phase.resistance.featureCost,
            lifecycle: {
              ...phase.resistance,
              interruptedStage: 'AFTER_FAILED_SAVE_BEFORE_OUTCOME',
              replacement: 'SAVE_SUCCESS'
            },
            execution: choiceExecution,
            originalExecution: phase.originalExecution,
            originalExecutionChecksum: phase.originalExecutionChecksum,
            originalD20: phase.originalD20
          }
        }
        const d20 =
          outcomeOriginalD20 ??
          (pendingD20 && rawFaces && requestId
            ? buildEncounterActionD20Evidence({
                execution: actionExecution,
                policy: pendingD20,
                requestId,
                faces: rawFaces
              })
            : pendingApplicationContext &&
                isDirectActionContext(pendingApplicationContext) &&
                pendingApplicationContext.phase.kind === 'LEGENDARY_RESISTANCE_CHOICE'
              ? pendingApplicationContext.phase.originalD20
              : null)
        const nestedD20 =
          pendingApplicationContext && isDirectActionContext(pendingApplicationContext)
            ? nestedOutcomeD20ForTerminal({
                applicationContext: pendingApplicationContext,
                execution: actionExecution
              })
            : null
        const spatialDirectives = legendaryResistance?.use
          ? []
          : (settlementPrepared.action.adapter.interpretSpatial?.({
              execution: actionExecution,
              occurrenceId,
              published: settlementPrepared.action.published,
              targetActorId: settlementPrepared.targetActor.id
            }) ?? [])
        const settled = await settleEncounterActionSettlementCore({
          db,
          actorUserId: input.command.actorUserId,
          encounterId: input.command.encounterId,
          occurrenceId,
          commandId,
          ordinal: 0,
          eventPhases: { resource: 'DIRECT_ACTION_RESOURCE', outcome: 'DIRECT_ACTION_OUTCOME' },
          prepared: settlementPrepared,
          execution: {
            kind: 'COMPLETE',
            execution: actionExecution,
            applications,
            d20,
            nestedD20
          }
        })
        await settleEncounterActionForcedMovement({
          db,
          encounter: originalEncounter,
          sceneContext: lockedSceneContext,
          actorUserId: input.command.actorUserId,
          commandId,
          commandFingerprint,
          sourceActorId: settlementPrepared.sourceActor.id,
          targetActorId: settlementPrepared.targetActor.id,
          targetStateChecksum: checksumRuleDocument(settlementPrepared.action.target),
          directives: spatialDirectives,
          ...(input.command.liveSessionAuthority
            ? { liveSessionAuthority: input.command.liveSessionAuthority }
            : {})
        })
        return {
          applicationOutputs:
            settled.application.kind === 'ENCOUNTER_ACTOR_MECHANICS_BATCH'
              ? { ...settled.application, legendaryResistance }
              : settled.application,
          ...(pendingApplicationContext &&
          isDirectActionContext(pendingApplicationContext) &&
          pendingApplicationContext.phase.kind === 'LEGENDARY_RESISTANCE_CHOICE'
            ? { terminalExecution: actionExecution }
            : {}),
          afterResult: await finalizeDirectAction({
            db,
            command: input.command,
            occurrenceId,
            commandId,
            correlationId,
            commandFingerprint,
            proposedAggregateVersion,
            actorSnapshot,
            originalEncounter,
            prepared,
            settled,
            sceneContext: lockedSceneContext,
            attunementSlotOverride,
            concentration: concentrationPreflight,
            createChildOccurrencePort,
            runtime: input.runtime,
            ...(input.rollD20 ? { rollD20: input.rollD20 } : {})
          })
        }
      }
    }
  })
  const result = await occurrences.resume(aggregatePort, {
    commandId: input.command.commandId,
    correlationId: input.command.correlationId,
    expectedAggregateVersion: input.command.expectedEncounterVersion,
    expectedOccurrenceVersion: input.command.expectedOccurrenceVersion,
    occurrenceId: input.command.occurrenceId,
    resolutionIntent: resolution,
    async resolve({ db, aggregate, applicationContext }) {
      if (!isDirectActionContext(applicationContext)) {
        throw new EncounterConflictError('Direct Encounter action occurrence is unavailable.')
      }
      const locked = await lockEncounterRuleExecutionCommandContext(db, {
        actorUserId: input.command.actorUserId,
        authority: 'ACTIVE_MEMBER',
        encounterId: input.command.encounterId,
        ...(input.command.liveSessionAuthority
          ? { liveSessionAuthority: input.command.liveSessionAuthority }
          : {})
      })
      if (locked.context.encounterId !== aggregate.aggregateId) {
        throw new EncounterConflictError('Direct Encounter action context is stale.')
      }
      originalEncounter = locked.encounter
      const sourceActor = locked.encounter.actors.find(
        (actor) => actor.id === applicationContext.sourceActorId
      )
      const targetActor = locked.encounter.actors.find(
        (actor) => actor.id === applicationContext.targetActorId
      )
      if (
        locked.encounter.status !== 'ACTIVE' ||
        locked.encounter.currentActorId !== applicationContext.sourceActorId ||
        !sourceActor ||
        !targetActor
      ) {
        throw new EncounterConflictError('The selected Encounter action is not current.')
      }
      lockedSceneContext = await revalidateEncounterActionSceneDependency({
        db,
        encounterId: locked.encounter.id,
        actorId: applicationContext.sourceActorId,
        targetActorId: applicationContext.targetActorId,
        dependency: applicationContext.sceneContext
      })
      const evaluatedActorSnapshot = await evaluateEncounterActorRuleSnapshot({
        db,
        encounter: locked.encounter
      })
      actorSnapshot = evaluatedActorSnapshot
      const targets = await lockEncounterActiveEffectTargets({
        trx: db,
        encounter: locked.encounter,
        actors: locked.encounter.actors,
        attunementSlotOverride: locked.context.attunementSlotOverride,
        getEncounterActorSnapshot: async () => ({
          rules: evaluatedActorSnapshot.snapshot.output,
          encounter: evaluatedActorSnapshot.reconciledEncounter
        })
      })
      const source = await resolveDirectActionSource({
        db,
        actionId: applicationContext.actionId,
        actor: sourceActor,
        targets
      })
      let resumingLegendaryResistance = false
      if (
        (source.kind === 'CHARACTER' && targetActor.kind === 'CHARACTER') ||
        (source.kind === 'CHARACTER' &&
          locked.context.role !== 'OWNER' &&
          locked.context.assignedCharacterId !== source.action.characterId) ||
        (source.kind === 'CREATURE_FEATURE' && locked.context.role !== 'OWNER') ||
        !targetPolicyPermitsEncounterActor({
          actorId: sourceActor.id,
          targetPolicy: source.targetPolicy,
          sceneContext: lockedSceneContext,
          targetActorId: targetActor.id
        })
      ) {
        throw new EncounterConflictError('The selected Encounter action is not current.')
      }
      concentrationPreflight = await lockDirectActionConcentrationPreflight({
        db,
        encounter: evaluatedActorSnapshot.reconciledEncounter,
        targetActor
      })
      prepared = await prepareEncounterActionSettlementCore({
        db,
        actorUserId: input.command.actorUserId,
        automationMode: 'ASSISTED',
        encounter: evaluatedActorSnapshot.reconciledEncounter,
        actionSource: source.action,
        targetActorId: targetActor.id,
        targets,
        enforceActionEconomy: true
      })
      requirePendingSourceCurrent({ context: applicationContext, source, prepared })
      if (applicationContext.phase.kind === 'LEGENDARY_RESISTANCE_CHOICE') {
        if (locked.context.role !== 'OWNER')
          throw new EncounterConflictError('Legendary Resistance choice is unavailable.')
        assertLegendaryResistancePendingPhaseIntegrity(applicationContext.phase)
        const actorRules = prepared.targets.encounterActorRules
        const candidate = actorRules
          ? await discoverEncounterLegendaryResistanceCandidate({
              encounter: evaluatedActorSnapshot.reconciledEncounter,
              targetActor: prepared.targetActor,
              actorRules,
              definitions: createReusableDefinitionRepository(db)
            })
          : null
        const resistance = applicationContext.phase.resistance
        assertLegendaryResistanceActionCurrentness({
          context: applicationContext,
          prepared,
          actionId: applicationContext.actionId
        })
        if (
          !candidate ||
          checksumRuleDocument(prepared.action.target) !==
            applicationContext.phase.targetStateChecksum ||
          candidate.targetActorId !== resistance.targetActorId ||
          candidate.ownerFeatureId !== resistance.ownerFeatureId ||
          candidate.chargeId !== resistance.chargeId ||
          candidate.featureCost !== resistance.featureCost ||
          candidate.poolBefore !== resistance.poolBefore ||
          candidate.poolRemaining !== resistance.poolRemaining ||
          candidate.lifecycle.definitionId !== resistance.definitionId ||
          candidate.lifecycle.definitionVersion !== resistance.definitionVersion ||
          candidate.lifecycle.definitionChecksum !== resistance.definitionChecksum ||
          candidate.lifecycle.choiceGraphDefinitionId !== resistance.choiceGraphDefinitionId ||
          candidate.lifecycle.choiceGraphDefinitionVersion !==
            resistance.choiceGraphDefinitionVersion ||
          candidate.lifecycle.choiceGraphDefinitionChecksum !==
            resistance.choiceGraphDefinitionChecksum ||
          candidate.lifecycle.useOutput !== resistance.useOutput ||
          legendaryResistanceUseOptionId(resistance.selectionChecksum) !== resistance.useOptionId ||
          legendaryResistanceSelectionChecksum({
            targetActorId: candidate.targetActorId,
            ownerFeatureId: candidate.ownerFeatureId,
            chargeId: candidate.chargeId,
            featureCost: candidate.featureCost,
            lifecycle: candidate.lifecycle
          }) !== resistance.selectionChecksum
        )
          throw new EncounterConflictError('Legendary Resistance source is stale.')
        currentLegendaryResistanceCandidate = candidate
        resumingLegendaryResistance = true
      }
      const positionalFacts = await lockEncounterActionPositionalFacts({
        trx: db,
        encounter: evaluatedActorSnapshot.reconciledEncounter,
        sceneContext: lockedSceneContext,
        targets: prepared.targets,
        capabilityDefinitionIds:
          prepared.action.adapter.positionalCapabilityDefinitionIds?.({
            automationMode: evaluatedActorSnapshot.reconciledEncounter.automationMode,
            optionalCombatSnapshot:
              evaluatedActorSnapshot.reconciledEncounter.optionalCombatSnapshot ?? null,
            optionalCombatSnapshotChecksum:
              evaluatedActorSnapshot.reconciledEncounter.optionalCombatSnapshotChecksum ?? null
          }) ?? []
      })
      if (
        (positionalFacts?.dependencyChecksum ?? null) !==
        (applicationContext.positionalDependencyChecksum ?? null)
      ) {
        throw new EncounterConflictError('Action positional facts changed before evidence resumed.')
      }
      let bound = prepared.action.adapter.bindFacts({
        actionMechanic: prepared.action.actionMechanic,
        published: prepared.action.published,
        sourceDerivedFacts: prepared.action.sourceDerivedFacts,
        targetActorId: prepared.action.target.actorId,
        targetDerivedFacts: prepared.action.target.derivedFacts,
        targetConditionIds: prepared.action.target.conditionIds,
        currentHitPoints: prepared.action.target.currentHitPoints,
        temporaryHitPoints: prepared.action.target.temporaryHitPoints,
        maximumHitPoints: prepared.action.target.maximumHitPoints,
        targetScalarValues:
          prepared.targets.effectiveScalarValuesByActorId?.get(prepared.action.target.actorId) ??
          {},
        defenses: prepared.action.target.defenses,
        conditionImmunityIds: prepared.action.target.conditionImmunityIds,
        sceneContext: lockedSceneContext,
        positionalFacts
      })
      const d20 =
        bound.d20RollMode && bound.d20Audit
          ? {
              rollMode: bound.d20RollMode,
              contributors: [...bound.d20Audit.contributors],
              contributorChecksum: bound.d20Audit.contributorChecksum,
              modifier: bound.d20Audit.modifier,
              defenseOrDc: bound.d20Audit.defenseOrDc
            }
          : null
      const testOutcomePlan =
        source.kind === 'CHARACTER'
          ? actionTestOutcomePlan(source.action.entry)
          : prepared.executionPlan?.kind === 'TEST_OUTCOME'
            ? prepared.executionPlan
            : null
      const outcomeResumeTwoPhase =
        applicationContext.twoPhase?.phase === 'OUTCOME' ? applicationContext.twoPhase : null
      const outcomeResume = outcomeResumeTwoPhase !== null
      let phasePublished = prepared.action.published
      const resumedTestPhasePlan =
        !outcomeResume &&
        !resumingLegendaryResistance &&
        applicationContext.phase.kind === 'ACTION_EVIDENCE' &&
        applicationContext.twoPhase?.phase === 'TEST' &&
        testOutcomePlan
          ? {
              initialPhase: 'TEST' as const,
              phase: 'TEST' as const,
              template: testOutcomePlan.test.template,
              specializedChecksum: phasePublished.checksum
            }
          : null
      let resumedOutcomePhasePlan: {
        initialPhase: 'OUTCOME'
        phase: 'OUTCOME'
        template: {
          definitionId: string
          gameSystemId: string
          definitionFamilyKey: string
          checksum: string
        }
        specializedChecksum: string
      } | null = null
      if (outcomeResume) {
        const twoPhase = outcomeResumeTwoPhase
        if (!testOutcomePlan || !prepared.action.adapter.specializeOutcomeTemplate) {
          throw new EncounterConflictError(
            'The pending Encounter action no longer has its exact outcome plan.'
          )
        }
        if (
          twoPhase.compilerSourceChecksum !==
            testOutcomePlan.compilerSource.compilerSourceChecksum ||
          twoPhase.testTemplateChecksum !== testOutcomePlan.test.template.checksum ||
          twoPhase.testExecutionChecksum !== checksumRuleDocument(twoPhase.testExecution) ||
          twoPhase.boundFactsChecksum !== checksumRuleDocument(bound.facts)
        ) {
          throw new EncounterConflictError(
            'The pending Encounter action phase identity changed before resume.'
          )
        }
        let resolution
        try {
          resolution = resolveActionPhaseExecution({
            plan: testOutcomePlan,
            phase: 'TEST',
            execution: twoPhase.testExecution,
            adapter: prepared.action.adapter,
            facts: bound.facts
          })
        } catch (error) {
          throw new EncounterConflictError(
            error instanceof Error
              ? error.message
              : 'The pending Encounter action outcome is invalid.'
          )
        }
        if (
          resolution.kind !== 'OUTCOME' ||
          resolution.outcome.templateChecksum !== twoPhase.outcomeTemplateChecksum ||
          resolution.outcome.published.id !== applicationContext.publishedDefinitionId ||
          resolution.outcome.published.checksum !== applicationContext.publishedDefinitionChecksum
        ) {
          throw new EncounterConflictError(
            'The pending Encounter action outcome specialization changed.'
          )
        }
        phasePublished = resolution.outcome.published
        prepared.action.published = phasePublished
        bound = prepared.action.adapter.bindFacts({
          actionMechanic: prepared.action.actionMechanic,
          published: phasePublished,
          sourceDerivedFacts: prepared.action.sourceDerivedFacts,
          targetActorId: prepared.action.target.actorId,
          targetDerivedFacts: prepared.action.target.derivedFacts,
          targetConditionIds: prepared.action.target.conditionIds,
          currentHitPoints: prepared.action.target.currentHitPoints,
          temporaryHitPoints: prepared.action.target.temporaryHitPoints,
          maximumHitPoints: prepared.action.target.maximumHitPoints,
          targetScalarValues:
            prepared.targets.effectiveScalarValuesByActorId?.get(prepared.action.target.actorId) ??
            {},
          defenses: prepared.action.target.defenses,
          conditionImmunityIds: prepared.action.target.conditionImmunityIds,
          sceneContext: lockedSceneContext,
          positionalFacts
        })
        const currentNestedOutcomeD20 = nestedOutcomeD20Policy({
          published: phasePublished,
          d20:
            bound.d20RollMode && bound.d20Audit
              ? {
                  rollMode: bound.d20RollMode,
                  contributors: bound.d20Audit.contributors,
                  contributorChecksum: bound.d20Audit.contributorChecksum,
                  modifier: bound.d20Audit.modifier,
                  defenseOrDc: bound.d20Audit.defenseOrDc
                }
              : null
        })
        if (
          checksumRuleDocument(currentNestedOutcomeD20) !==
          checksumRuleDocument(twoPhase.nestedOutcomeD20)
        ) {
          throw new EncounterConflictError(
            'The pending Encounter action nested save policy changed before resume.'
          )
        }
        resumedOutcomePhasePlan = {
          initialPhase: 'OUTCOME',
          phase: 'OUTCOME',
          template: resolution.template,
          specializedChecksum: phasePublished.checksum
        }
      }
      return {
        published: resumingLegendaryResistance
          ? currentLegendaryResistanceCandidate!.choiceGraph
          : phasePublished,
        facts: resumingLegendaryResistance ? {} : bound.facts,
        pendingApplicationContext:
          outcomeResume || resumingLegendaryResistance
            ? applicationContext
            : actionPendingContext({
                prepared,
                actionId: applicationContext.actionId,
                sceneContext: toEncounterActionSceneDependency(lockedSceneContext),
                positionalDependencyChecksum: positionalFacts?.dependencyChecksum ?? null,
                d20,
                published: phasePublished,
                twoPhase: testOutcomePlan
                  ? {
                      phase: 'TEST' as const,
                      compilerSourceChecksum: testOutcomePlan.compilerSource.compilerSourceChecksum,
                      testTemplateChecksum: testOutcomePlan.test.template.checksum,
                      boundFactsChecksum: checksumRuleDocument(bound.facts)
                    }
                  : null
              }),
        ...(resumedOutcomePhasePlan || resumedTestPhasePlan
          ? { phasePlan: resumedOutcomePhasePlan ?? resumedTestPhasePlan! }
          : {}),
        validatePausedExecution: ({ continuation, applicationContext: nextContext }) => {
          if (isDirectActionContext(nextContext) && nextContext.twoPhase?.phase === 'OUTCOME') {
            if (
              continuation.request.kind !== 'INTEGER_RANGE' ||
              continuation.request.min === undefined ||
              continuation.request.max === undefined ||
              continuation.request.min >= continuation.request.max
            ) {
              throw new EncounterValidationError(
                'The Encounter action outcome requested unsupported evidence.'
              )
            }
            return
          }
          void continuation
          void nextContext
          throw new EncounterValidationError(
            'Direct Encounter actions support only one evidence stage.'
          )
        },
        postCompletedExecution: async ({
          execution,
          occurrenceId,
          applicationContext: nextContext
        }) => {
          if (
            testOutcomePlan &&
            prepared &&
            isDirectActionContext(nextContext) &&
            nextContext.phase.kind === 'LEGENDARY_RESISTANCE_CHOICE' &&
            nextContext.twoPhase?.phase === 'TEST'
          ) {
            const phase = nextContext.phase
            const use = execution.outputs[phase.resistance.useOutput] === true
            const originalPath = phase.originalExecution.outputs.resultPath
            if (
              selectedLegendaryResistance === null ||
              use !== (selectedLegendaryResistance === 'USE') ||
              typeof originalPath !== 'string'
            )
              throw new EncounterConflictError(
                'Legendary Resistance choice did not settle its selection.'
              )
            let phaseResolution
            try {
              phaseResolution = resolveActionPhaseExecution({
                plan: testOutcomePlan,
                phase: 'TEST',
                execution: phase.originalExecution,
                adapter: prepared.action.adapter,
                facts: bound.facts,
                effectivePath: use ? 'ON_SAVE_SUCCESS' : originalPath
              })
            } catch (error) {
              throw new EncounterValidationError(
                error instanceof Error
                  ? error.message
                  : 'The Encounter action selected an unsupported outcome.'
              )
            }
            if (phaseResolution.kind === 'TEST_ONLY') return null
            if (phaseResolution.kind !== 'OUTCOME')
              throw new EncounterValidationError(
                'The Encounter action selected an unsupported outcome.'
              )
            const outcomeBound = prepared.action.adapter.bindFacts({
              actionMechanic: prepared.action.actionMechanic,
              published: phaseResolution.outcome.published,
              sourceDerivedFacts: prepared.action.sourceDerivedFacts,
              targetActorId: prepared.action.target.actorId,
              targetDerivedFacts: prepared.action.target.derivedFacts,
              targetConditionIds: prepared.action.target.conditionIds,
              currentHitPoints: prepared.action.target.currentHitPoints,
              temporaryHitPoints: prepared.action.target.temporaryHitPoints,
              maximumHitPoints: prepared.action.target.maximumHitPoints,
              targetScalarValues:
                prepared.targets.effectiveScalarValuesByActorId?.get(
                  prepared.action.target.actorId
                ) ?? {},
              defenses: prepared.action.target.defenses,
              conditionImmunityIds: prepared.action.target.conditionImmunityIds,
              sceneContext: lockedSceneContext,
              positionalFacts
            })
            const started = input.runtime.executeResolvedWithGraph
              ? await input.runtime.executeResolvedWithGraph({
                  command: {
                    definitionId: phaseResolution.outcome.published.id,
                    occurrenceId,
                    facts: outcomeBound.facts
                  },
                  published: phaseResolution.outcome.published
                })
              : {
                  result: await input.runtime.executeResolved({
                    command: {
                      definitionId: phaseResolution.outcome.published.id,
                      occurrenceId,
                      facts: outcomeBound.facts
                    },
                    published: phaseResolution.outcome.published
                  }),
                  graph: undefined
                }
            const nestedOutcomeD20 = nestedOutcomeD20Policy({
              published: phaseResolution.outcome.published,
              d20:
                outcomeBound.d20RollMode && outcomeBound.d20Audit
                  ? {
                      rollMode: outcomeBound.d20RollMode,
                      contributors: outcomeBound.d20Audit.contributors,
                      contributorChecksum: outcomeBound.d20Audit.contributorChecksum,
                      modifier: outcomeBound.d20Audit.modifier,
                      defenseOrDc: outcomeBound.d20Audit.defenseOrDc
                    }
                  : null
            })
            const nextApplicationContext = {
              ...nextContext,
              phase: {
                kind: 'ACTION_EVIDENCE' as const,
                d20: {
                  rollMode: phase.d20.rollMode,
                  contributors: [...phase.d20.contributors],
                  contributorChecksum: phase.d20.contributorChecksum,
                  modifier: phase.d20.modifier,
                  defenseOrDc: phase.d20.dc
                }
              },
              publishedDefinitionId: phaseResolution.outcome.published.id,
              publishedDefinitionChecksum: phaseResolution.outcome.published.checksum,
              twoPhase: {
                phase: 'OUTCOME' as const,
                compilerSourceChecksum: testOutcomePlan.compilerSource.compilerSourceChecksum,
                testTemplateChecksum: testOutcomePlan.test.template.checksum,
                outcomeTemplateChecksum: phaseResolution.outcome.templateChecksum,
                boundFactsChecksum: checksumRuleDocument(bound.facts),
                testExecution: phase.originalExecution,
                testExecutionChecksum: phase.originalExecutionChecksum,
                nestedOutcomeD20,
                nestedOutcomeD20Evidence: null,
                legendaryResistance: {
                  choiceExecution: execution,
                  selection: use ? ('USE' as const) : ('DECLINE' as const),
                  originalExecutionChecksum: phase.originalExecutionChecksum,
                  targetStateChecksum: phase.targetStateChecksum,
                  resistance: phase.resistance,
                  d20: phase.d20
                },
                testRollEvidence: {
                  requestId: phase.originalD20.requestId,
                  rollMode: phase.originalD20.rollMode,
                  rawFaces: [...phase.originalD20.rawFaces],
                  selectedNatural: phase.originalD20.selectedNatural
                }
              }
            }
            prepared.action.published = phaseResolution.outcome.published
            return {
              ...(started.result.status === 'COMPLETE'
                ? { execution: started.result }
                : { continuation: started.result.continuation }),
              ...(started.graph ? { graph: started.graph } : {}),
              applicationContext: nextApplicationContext,
              ...(started.result.status === 'PAUSED'
                ? {
                    pendingResult: {
                      kind: 'INTEGER_RANGE_EVIDENCE' as const,
                      phase: 'OUTCOME' as const,
                      requests: [
                        {
                          requestId: started.result.continuation.request.requestId,
                          min: started.result.continuation.request.min,
                          max: started.result.continuation.request.max
                        }
                      ],
                      exactRequestSetChecksum: checksumRuleDocument([
                        {
                          requestId: started.result.continuation.request.requestId,
                          min: started.result.continuation.request.min,
                          max: started.result.continuation.request.max
                        }
                      ])
                    }
                  }
                : {}),
              phase: 'OUTCOME' as const,
              phaseReceiptPlan: {
                phase: 'OUTCOME' as const,
                template: phaseResolution.template,
                specializedChecksum: phaseResolution.outcome.published.checksum
              }
            }
          }
          let twoPhaseLegendaryResistanceCandidate: EncounterLegendaryResistanceCandidate | null =
            null
          if (
            testOutcomePlan &&
            prepared &&
            isDirectActionContext(nextContext) &&
            nextContext.phase.kind === 'ACTION_EVIDENCE' &&
            nextContext.twoPhase?.phase === 'TEST' &&
            execution.outputs.resultPath === 'ON_SAVE_FAIL' &&
            pendingD20 &&
            rawFaces &&
            requestId &&
            prepared.targetActor.kind === 'CREATURE'
          ) {
            const actorRules = prepared.targets.encounterActorRules
            twoPhaseLegendaryResistanceCandidate = actorRules
              ? await discoverEncounterLegendaryResistanceCandidate({
                  encounter: evaluatedActorSnapshot.reconciledEncounter,
                  targetActor: prepared.targetActor,
                  actorRules,
                  definitions: createReusableDefinitionRepository(db)
                })
              : null
          }
          if (
            testOutcomePlan &&
            prepared &&
            isDirectActionContext(nextContext) &&
            nextContext.twoPhase?.phase === 'TEST' &&
            twoPhaseLegendaryResistanceCandidate === null
          ) {
            let phaseResolution
            try {
              phaseResolution = resolveActionPhaseExecution({
                plan: testOutcomePlan,
                phase: 'TEST',
                execution,
                adapter: prepared.action.adapter,
                facts: bound.facts
              })
            } catch (error) {
              throw new EncounterValidationError(
                error instanceof Error
                  ? error.message
                  : 'The Encounter action selected an unsupported outcome.'
              )
            }
            if (phaseResolution.kind === 'TEST_ONLY') return null
            if (phaseResolution.kind !== 'OUTCOME')
              throw new EncounterValidationError(
                'The Encounter action selected an unsupported outcome.'
              )
            if (!pendingD20 || !rawFaces || !requestId)
              throw new EncounterValidationError(
                'The Encounter action TEST roll evidence is invalid.'
              )
            const outcomeBound = prepared.action.adapter.bindFacts({
              actionMechanic: prepared.action.actionMechanic,
              published: phaseResolution.outcome.published,
              sourceDerivedFacts: prepared.action.sourceDerivedFacts,
              targetActorId: prepared.action.target.actorId,
              targetDerivedFacts: prepared.action.target.derivedFacts,
              targetConditionIds: prepared.action.target.conditionIds,
              currentHitPoints: prepared.action.target.currentHitPoints,
              temporaryHitPoints: prepared.action.target.temporaryHitPoints,
              maximumHitPoints: prepared.action.target.maximumHitPoints,
              targetScalarValues:
                prepared.targets.effectiveScalarValuesByActorId?.get(
                  prepared.action.target.actorId
                ) ?? {},
              defenses: prepared.action.target.defenses,
              conditionImmunityIds: prepared.action.target.conditionImmunityIds,
              sceneContext: lockedSceneContext,
              positionalFacts
            })
            const started = input.runtime.executeResolvedWithGraph
              ? await input.runtime.executeResolvedWithGraph({
                  command: {
                    definitionId: phaseResolution.outcome.published.id,
                    occurrenceId,
                    facts: outcomeBound.facts
                  },
                  published: phaseResolution.outcome.published
                })
              : {
                  result: await input.runtime.executeResolved({
                    command: {
                      definitionId: phaseResolution.outcome.published.id,
                      occurrenceId,
                      facts: outcomeBound.facts
                    },
                    published: phaseResolution.outcome.published
                  }),
                  graph: undefined
                }
            const selectedNatural = selectEncounterActionD20Natural(pendingD20.rollMode, rawFaces)
            const nestedOutcomeD20 = nestedOutcomeD20Policy({
              published: phaseResolution.outcome.published,
              d20:
                outcomeBound.d20RollMode && outcomeBound.d20Audit
                  ? {
                      rollMode: outcomeBound.d20RollMode,
                      contributors: outcomeBound.d20Audit.contributors,
                      contributorChecksum: outcomeBound.d20Audit.contributorChecksum,
                      modifier: outcomeBound.d20Audit.modifier,
                      defenseOrDc: outcomeBound.d20Audit.defenseOrDc
                    }
                  : null
            })
            const nextApplicationContext = {
              ...nextContext,
              publishedDefinitionId: phaseResolution.outcome.published.id,
              publishedDefinitionChecksum: phaseResolution.outcome.published.checksum,
              twoPhase: {
                phase: 'OUTCOME' as const,
                compilerSourceChecksum: testOutcomePlan.compilerSource.compilerSourceChecksum,
                testTemplateChecksum: testOutcomePlan.test.template.checksum,
                outcomeTemplateChecksum: phaseResolution.outcome.templateChecksum,
                boundFactsChecksum: checksumRuleDocument(bound.facts),
                testExecution: execution,
                testExecutionChecksum: checksumRuleDocument(execution),
                nestedOutcomeD20,
                nestedOutcomeD20Evidence: null,
                legendaryResistance: null,
                testRollEvidence: {
                  requestId,
                  rollMode: pendingD20.rollMode,
                  rawFaces: [...rawFaces],
                  selectedNatural
                }
              }
            }
            prepared.action.published = phaseResolution.outcome.published
            return {
              ...(started.result.status === 'COMPLETE'
                ? { execution: started.result }
                : { continuation: started.result.continuation }),
              ...(started.graph ? { graph: started.graph } : {}),
              applicationContext: nextApplicationContext,
              ...(started.result.status === 'PAUSED'
                ? {
                    pendingResult: {
                      kind: 'INTEGER_RANGE_EVIDENCE' as const,
                      phase: 'OUTCOME' as const,
                      requests: [
                        {
                          requestId: started.result.continuation.request.requestId,
                          min: started.result.continuation.request.min,
                          max: started.result.continuation.request.max
                        }
                      ],
                      exactRequestSetChecksum: checksumRuleDocument([
                        {
                          requestId: started.result.continuation.request.requestId,
                          min: started.result.continuation.request.min,
                          max: started.result.continuation.request.max
                        }
                      ])
                    }
                  }
                : {}),
              phase: 'OUTCOME' as const,
              phaseReceiptPlan: {
                phase: 'OUTCOME' as const,
                template: phaseResolution.template,
                specializedChecksum: phaseResolution.outcome.published.checksum
              }
            }
          }
          if (
            !isDirectActionContext(nextContext) ||
            nextContext.phase.kind !== 'ACTION_EVIDENCE' ||
            execution.outputs.resultPath !== 'ON_SAVE_FAIL' ||
            !pendingD20 ||
            !rawFaces ||
            !requestId ||
            !prepared ||
            prepared.targetActor.kind !== 'CREATURE'
          )
            return null
          const originalD20 = buildEncounterActionD20Evidence({
            execution,
            policy: pendingD20,
            requestId,
            faces: rawFaces
          })
          const actorRules = prepared.targets.encounterActorRules
          const candidate =
            twoPhaseLegendaryResistanceCandidate ??
            (actorRules
              ? await discoverEncounterLegendaryResistanceCandidate({
                  encounter: evaluatedActorSnapshot.reconciledEncounter,
                  targetActor: prepared.targetActor,
                  actorRules,
                  definitions: createReusableDefinitionRepository(db)
                })
              : null)
          if (!candidate) return null
          const continuation = await startEncounterLegendaryResistanceChoice({
            runtime: input.runtime,
            occurrenceId,
            candidate
          })
          const selectionChecksum = legendaryResistanceSelectionChecksum({
            targetActorId: candidate.targetActorId,
            ownerFeatureId: candidate.ownerFeatureId,
            chargeId: candidate.chargeId,
            featureCost: candidate.featureCost,
            lifecycle: candidate.lifecycle
          })
          return {
            continuation,
            applicationContext: {
              ...nextContext,
              phase: {
                kind: 'LEGENDARY_RESISTANCE_CHOICE' as const,
                originalExecution: execution,
                originalD20,
                d20: pendingD20,
                originalExecutionChecksum: checksumRuleDocument(execution),
                targetStateChecksum: checksumRuleDocument(prepared.action.target),
                resistance: {
                  targetActorId: candidate.targetActorId,
                  ownerFeatureId: candidate.ownerFeatureId,
                  chargeId: candidate.chargeId,
                  featureCost: candidate.featureCost,
                  poolBefore: candidate.poolBefore,
                  poolRemaining: candidate.poolRemaining,
                  definitionId: candidate.lifecycle.definitionId,
                  definitionVersion: candidate.lifecycle.definitionVersion,
                  definitionChecksum: candidate.lifecycle.definitionChecksum,
                  choiceGraphDefinitionId: candidate.lifecycle.choiceGraphDefinitionId,
                  choiceGraphDefinitionVersion: candidate.lifecycle.choiceGraphDefinitionVersion,
                  choiceGraphDefinitionChecksum: candidate.lifecycle.choiceGraphDefinitionChecksum,
                  useOutput: candidate.lifecycle.useOutput,
                  useOptionId: legendaryResistanceUseOptionId(selectionChecksum),
                  selectionChecksum
                }
              }
            },
            pendingResult: {
              kind: 'LEGENDARY_RESISTANCE_CHOICE' as const,
              targetActorId: candidate.targetActorId,
              useOptionId: legendaryResistanceUseOptionId(selectionChecksum)
            },
            validatePausedExecution: validateLegendaryResistanceChoicePause
          }
        }
      }
    },
    async deriveResponse({ applicationContext, request }) {
      if (
        isDirectActionContext(applicationContext) &&
        applicationContext.phase.kind === 'LEGENDARY_RESISTANCE_CHOICE'
      ) {
        if (resolution.kind !== 'LEGENDARY_RESISTANCE')
          throw new EncounterConflictError('Legendary Resistance choice is unavailable.')
        selectedLegendaryResistance = resolution.selection
        return {
          requestId: request.requestId,
          value: resolution.selection === 'USE' ? 1 : 0
        }
      }
      if (
        isDirectActionContext(applicationContext) &&
        applicationContext.twoPhase?.phase === 'OUTCOME'
      ) {
        if (request.kind !== 'INTEGER_RANGE' || request.min >= request.max) {
          throw new EncounterConflictError('The pending Encounter action outcome is invalid.')
        }
        const nestedOutcomeD20 = applicationContext.twoPhase.nestedOutcomeD20
        if (nestedOutcomeD20 && request.nodeId === nestedOutcomeD20.requestNodeId) {
          if (
            (resolution.kind !== 'SYSTEM' && resolution.kind !== 'PHYSICAL') ||
            resolution.requestId !== request.requestId
          ) {
            throw new EncounterConflictError(
              'The Encounter action nested save request does not match.'
            )
          }
          const faces = resolveEncounterActionD20Faces({
            policy: nestedOutcomeD20,
            resolution:
              resolution.kind === 'SYSTEM'
                ? { kind: 'SYSTEM_ROLL', requestId: resolution.requestId }
                : {
                    kind: 'ENTER_DICE',
                    requestId: resolution.requestId,
                    rawFaces: resolution.rawFaces
                  },
            rollD20: input.rollD20 ?? (() => randomInt(1, 21))
          })
          nestedOutcomeD20Evidence = buildEncounterSaveD20Evidence({
            policy: nestedOutcomeD20,
            requestId: request.requestId,
            faces
          })
          return {
            requestId: request.requestId,
            value: selectEncounterActionD20Natural(nestedOutcomeD20.rollMode, faces)
          }
        }
        if (resolution.kind === 'SYSTEM' || resolution.kind === 'SYSTEM_OUTCOME') {
          if (
            resolution.kind === 'SYSTEM'
              ? resolution.requestId !== request.requestId
              : resolution.requestIds.length !== 1 || resolution.requestIds[0] !== request.requestId
          ) {
            throw new EncounterConflictError(
              'The Encounter action outcome roll request set does not match.'
            )
          }
          const value = input.rollInteger
            ? input.rollInteger(request.min, request.max)
            : randomInt(request.min, request.max + 1)
          if (!Number.isSafeInteger(value) || value < request.min || value > request.max) {
            throw new EncounterConflictError('The Encounter action outcome roll is invalid.')
          }
          return { requestId: request.requestId, value }
        }
        if (resolution.kind === 'PHYSICAL_OUTCOME') {
          if (
            resolution.values.length !== 1 ||
            resolution.values[0]?.requestId !== request.requestId ||
            resolution.values[0].value < request.min ||
            resolution.values[0].value > request.max
          ) {
            throw new EncounterConflictError(
              'The Encounter action outcome roll request set does not match.'
            )
          }
          return resolution.values[0]
        }
        throw new EncounterConflictError(
          'The pending Encounter action roll does not match its phase.'
        )
      }
      if (
        !isDirectActionContext(applicationContext) ||
        applicationContext.phase.kind !== 'ACTION_EVIDENCE' ||
        applicationContext.phase.d20 === null
      ) {
        throw new EncounterConflictError('Direct Encounter action occurrence is unavailable.')
      }
      if (
        (resolution.kind !== 'SYSTEM' && resolution.kind !== 'PHYSICAL') ||
        resolution.requestId !== request.requestId
      ) {
        throw new EncounterConflictError('Direct Encounter action roll request is unavailable.')
      }
      const policy = d20PolicyForRequest({ d20: applicationContext.phase.d20, request })
      const faces = resolveEncounterActionD20Faces({
        policy,
        resolution:
          resolution.kind === 'SYSTEM'
            ? { kind: 'SYSTEM_ROLL', requestId: resolution.requestId }
            : resolution.kind === 'PHYSICAL'
              ? {
                  kind: 'ENTER_DICE',
                  requestId: resolution.requestId,
                  rawFaces: resolution.rawFaces
                }
              : (() => {
                  throw new EncounterConflictError(
                    'Direct Encounter action occurrence is unavailable.'
                  )
                })(),
        rollD20: input.rollD20 ?? (() => randomInt(1, 21))
      })
      pendingD20 = policy
      rawFaces = faces
      requestId = request.requestId
      return {
        requestId: request.requestId,
        value: selectEncounterActionD20Natural(policy.rollMode, faces)
      }
    },
    async captureDerivedResponseEvidence({ request, response }) {
      const evidence = nestedOutcomeD20Evidence
      if (!evidence || request.requestId !== evidence.requestId) return null
      if (
        response.requestId !== evidence.requestId ||
        response.value !== evidence.selectedNatural
      ) {
        throw new EncounterValidationError('The Encounter action nested save evidence is invalid.')
      }
      return evidence
    },
    async resumePreflight({ occurrence, applicationContext, response }) {
      if (
        !isDirectActionContext(applicationContext) ||
        applicationContext.phase.kind !== 'LEGENDARY_RESISTANCE_CHOICE'
      )
        return
      const candidate = currentLegendaryResistanceCandidate
      if (!candidate || selectedLegendaryResistance === null)
        throw new EncounterConflictError('Legendary Resistance choice is unavailable.')
      if (!occurrence.pendingSnapshot)
        throw new EncounterConflictError('Legendary Resistance choice continuation is unavailable.')
      const snapshot = requireServerKernelRuleExecutionPendingSnapshot(occurrence.pendingSnapshot)
      const source = snapshot.graph.source
      if (
        source.definitionId !== candidate.choiceGraph.id ||
        source.gameSystemId !== candidate.choiceGraph.gameSystemId ||
        source.definitionFamilyKey !== candidate.choiceGraph.definitionFamilyKey ||
        source.checksum !== candidate.choiceGraph.checksum ||
        response.requestId !== snapshot.request.requestId ||
        response.value !== (selectedLegendaryResistance === 'USE' ? 1 : 0)
      )
        throw new EncounterConflictError('Legendary Resistance choice continuation is stale.')
    }
  })
  return summarize({ result, exposeLegendaryResistance })
}
