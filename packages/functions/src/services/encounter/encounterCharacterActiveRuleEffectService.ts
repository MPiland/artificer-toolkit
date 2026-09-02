import {
  createActiveRuleEffectRepository,
  createEncounterRepository,
  createSpatialRuleEffectRepository,
  createReusableDefinitionRepository,
  createVttSceneRepository,
  checksumCanonicalJson,
  type DBLike,
  type EncounterActorRecord,
  type EncounterRecord,
  type Json
} from '@artificer-toolkit/db'
import { randomInt } from 'node:crypto'
import type {
  InitiativeBeforePinDto,
  EncounterInitiativeAdvancePlanDto,
  EncounterInitiativeSettlementDto,
  PendingCompletedTurnPhaseDto,
  StagedInitiativeRoundStateDto,
  ServerRuleExecutionPendingApplicationContextDto,
  ServerKernelRuleExecutionPendingSnapshotDto,
  StagedTurnEffectPlanDto,
  StoredRuleExecutionResultDto,
  TurnResolutionCommandDto
} from '@artificer-toolkit/schema/shared/rulesExecution'
import type { EncounterActorRuleOutput } from '@artificer-toolkit/schema/api/encounterActorRules'
import {
  serverKernelRuleExecutionPendingSnapshotDtoSchema,
  storedRuleExecutionResultDtoSchema
} from '@artificer-toolkit/schema/shared/rulesExecution'
import { z } from 'zod'

import { characterRuleActionSystemAdapterRegistry } from '../rules/characterRuleActionSystemAdapterRegistry.js'
import type { CharacterRuleActionApplication } from '../rules/characterRuleActionSystemAdapter.js'
import type { CharacterActiveRuleEffectExecutionInput } from '../rules/characterActiveRuleEffectExecutor.js'
import {
  executeCharacterActiveRuleEffect,
  executeCharacterActiveRuleEffectWithPause,
  reconstructCharacterActiveRuleEffectCompletion,
  resumeCharacterActiveRuleEffectWithPause
} from '../rules/characterActiveRuleEffectExecutor.js'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import {
  effectiveSpatialGeometry,
  spatialGeometryIntersectsTokenFootprint
} from '@artificer-toolkit/shared/vtt'
import type { RulesRuntimeService } from '../rules/rulesRuntimeService.js'
import {
  applyLockedEncounterActorMechanicsBatch,
  applyLockedEncounterCharacterMechanicsBatch,
  foldCharacterMechanicsApplications,
  readEncounterActorConditionState
} from './encounterCharacterMechanicsBatch.js'
import { EncounterConflictError, EncounterValidationError } from './encounterErrors.js'
import { requireEncounterActorRuleResult } from './encounterActorRuleEvaluation.js'
import { snapshotStatBlock } from './encounterProjection.js'
import {
  lockEncounterActiveEffectTargets,
  type LockedEncounterActiveEffectCharacter
} from './encounterActiveEffectTargetState.js'
import { resolveEncounterCombatPerception } from './encounterCombatPerception.js'
import {
  deriveConditionCombatPerceptionContributions,
  type LockedCombatPerceptionEffect
} from './encounterCombatPerceptionContributions.js'
import { resolveRuleCapabilityState } from '../rules/ruleCapabilityStateService.js'

type TurnBoundary = {
  ordinal: 0 | 1
  stage: 'START_OF_TURN' | 'END_OF_TURN'
  actorId: string | null
}

type BatchResult = Extract<
  StoredRuleExecutionResultDto,
  { status: 'BATCH_COMPLETE'; batchKind: 'ENCOUNTER_TURN_ACTIVE_EFFECTS' }
>
type BatchExecution = BatchResult['executions'][number]
type CompletedTurnRechargePlan = NonNullable<
  Extract<
    ServerRuleExecutionPendingApplicationContextDto,
    { kind: 'ENCOUNTER_TURN_ACTIVE_EFFECTS' }
  >['root']['completedRechargePlan']
>
type CompletedLegendaryActions = NonNullable<
  Extract<
    ServerRuleExecutionPendingApplicationContextDto,
    { kind: 'ENCOUNTER_TURN_ACTIVE_EFFECTS' }
  >['root']['completedLegendaryActions']
>
type StagedLegendaryActionRefreshes = NonNullable<
  Extract<
    ServerRuleExecutionPendingApplicationContextDto,
    { kind: 'ENCOUNTER_TURN_ACTIVE_EFFECTS' }
  >['root']['stagedLegendaryActionRefreshes']
>

type LockedCharacter = LockedEncounterActiveEffectCharacter

type TurnEffectCandidate = {
  boundary: TurnBoundary
  actor: EncounterActorRecord
  effect: Awaited<
    ReturnType<ReturnType<typeof createActiveRuleEffectRepository>['lockByOwner']>
  >[number]
}

export type EvaluatedTurnEffectBatch = {
  candidates: readonly TurnEffectCandidate[]
  lockedCharacters: ReadonlyMap<string, LockedCharacter>
  characterIds: readonly string[]
  encounterActorIds: readonly string[]
  encounterActors: ReadonlyMap<string, EncounterActorRecord>
  effects: ReturnType<typeof createActiveRuleEffectRepository>
  pendingApplications: ReadonlyMap<string, readonly CharacterRuleActionApplication[]>
  pendingEncounterActorApplications: ReadonlyMap<string, readonly CharacterRuleActionApplication[]>
  retainedConditionIdsByActorId: ReadonlyMap<string, readonly string[]>
  executionStates: ReadonlyMap<
    string,
    {
      current: number
      temporary: number
      conditions: string[]
      scalarValues: Record<string, number>
    }
  >
  initialEncounterActorConditions: ReadonlyMap<string, unknown[]>
  executions: readonly BatchExecution[]
  selectionChecksum: string
}

/**
 * Projects the already-folded turn-effect state without applying it.  This is
 * intentionally a pure read-model helper: callers that need to evaluate a
 * later rule in the same transaction can use the cumulative staged state
 * while the terminal batch writer remains the only persistence path.
 */
export function projectEncounterAfterEvaluatedTurnEffectBatch(
  encounter: EncounterRecord,
  batch: Pick<EvaluatedTurnEffectBatch, 'executionStates'>
): EncounterRecord {
  const projectConditions = (
    actor: EncounterActorRecord,
    conditionIds: readonly string[]
  ): Json => {
    const existingById = new Map<string, Json>()
    if (Array.isArray(actor.conditions)) {
      for (const condition of actor.conditions) {
        const conditionId =
          typeof condition === 'string'
            ? condition
            : typeof condition === 'object' && condition !== null && !Array.isArray(condition)
              ? (condition as Record<string, unknown>).conditionTypeId
              : null
        if (typeof conditionId === 'string' && !existingById.has(conditionId)) {
          existingById.set(conditionId, condition as Json)
        }
      }
    }
    return conditionIds.map(
      (conditionId) => existingById.get(conditionId) ?? ({ conditionTypeId: conditionId } as Json)
    ) as Json
  }

  const actors = encounter.actors.map((actor) => {
    const key = ownerKey(actor)
    const staged = batch.executionStates.get(key)
    if (!staged) return actor
    return {
      ...actor,
      currentHitPoints: staged.current,
      tempHitPoints: staged.temporary,
      conditions: projectConditions(actor, staged.conditions)
    }
  })
  return { ...encounter, actors }
}

export type TurnEffectBatchEvaluation =
  | {
      kind: 'TERMINAL'
      result: StoredRuleExecutionResultDto | null
      selectionChecksum: string | null
    }
  | { kind: 'READY'; batch: EvaluatedTurnEffectBatch }
  | {
      kind: 'PENDING'
      pendingSnapshot: ServerKernelRuleExecutionPendingSnapshotDto
    }

export type TurnEffectCoordinatorRoot = {
  rootCommandId: string
  commandFingerprint: string
  initiatorUserId: string
  correlationId: string | null
  expectedEncounterVersion: number
  startSystemId?: string | null
  frozenActorRuleRevisionId?: string | null
  frozenActorRuleRevisionChecksum?: string | null
  frozenActorRuleSnapshotChecksum?: string | null
  initiative?: EncounterInitiativeSettlementDto | null
  initiativeAdvance?: EncounterInitiativeAdvancePlanDto | null
  stagedInitiative?: {
    beforePin: InitiativeBeforePinDto
    stagedRoundState: StagedInitiativeRoundStateDto
  }
  outgoingTurn?: PendingCompletedTurnPhaseDto
  completedLegendaryActions?: CompletedLegendaryActions
  stagedLegendaryActionRefreshes?: StagedLegendaryActionRefreshes
  completedRechargePlan?: CompletedTurnRechargePlan | null
  resolutionCommands?: readonly TurnResolutionCommandDto[]
  proposedTerminalTransition: {
    status: 'ACTIVE' | 'COMPLETED'
    round: number
    currentActorId: string | null
  }
}

export type TurnEffectResume = {
  pendingSnapshot: ServerKernelRuleExecutionPendingSnapshotDto
  resolution: z.infer<typeof turnEffectRawFaceResolutionDtoSchema>
}

const turnEffectRawFaceResolutionDtoSchema = z.strictObject({
  requestId: z.string().min(1).max(256),
  rawFaces: z.array(z.number().int().min(1).max(20)).min(1).max(2)
})

function eligibleBoundaryActors(encounter: EncounterRecord, boundaries: readonly TurnBoundary[]) {
  const selected: { boundary: TurnBoundary; actor: EncounterActorRecord }[] = []
  for (const boundary of boundaries) {
    if (!boundary.actorId) continue
    const actor = encounter.actors.find((candidate) => candidate.id === boundary.actorId)
    if (!actor || (actor.kind === 'CHARACTER' && !actor.sourceId)) continue
    selected.push({ boundary, actor })
  }
  return selected
}

function ownerForActor(actor: EncounterActorRecord, encounterId: string) {
  if (actor.kind === 'CHARACTER') {
    if (!actor.sourceId) throw new EncounterValidationError('Character effect owner is incomplete.')
    return { kind: 'CHARACTER' as const, characterId: actor.sourceId }
  }
  return {
    kind: 'ENCOUNTER_ACTOR' as const,
    encounterId,
    targetActorId: actor.id
  }
}

function ownerKey(actor: EncounterActorRecord): string {
  return actor.kind === 'CHARACTER' ? `CHARACTER:${actor.sourceId}` : `ENCOUNTER_ACTOR:${actor.id}`
}

/**
 * An expiring effect may remove only the condition state it owns.  A prior
 * manual condition (the baseline) or another locked contribution retains the
 * flat projection and turns the removal into a receipt-visible no-op.
 */
function retainedConditionIdsForEffect(input: {
  effect: TurnEffectCandidate['effect']
  ownerEffects: readonly TurnEffectCandidate['effect'][]
  excludedEffectIds?: ReadonlySet<string>
}): readonly string[] {
  if (input.effect.definition.schemaVersion !== 2) return []
  const retained = new Set<string>()
  for (const contribution of input.effect.definition.stateContributions) {
    if (contribution.kind !== 'CONDITION_OWNERSHIP') continue
    if (contribution.baselinePresent) retained.add(contribution.conditionId)
    if (
      input.ownerEffects.some(
        (other) =>
          other.id !== input.effect.id &&
          !input.excludedEffectIds?.has(other.id) &&
          other.definition.schemaVersion === 2 &&
          other.definition.stateContributions.some(
            (candidate) =>
              candidate.kind === 'CONDITION_OWNERSHIP' &&
              candidate.conditionId === contribution.conditionId
          )
      )
    ) {
      retained.add(contribution.conditionId)
    }
  }
  return [...retained].sort()
}

function isEligibleTurnEffect(input: {
  effect: {
    definition: {
      recurrence: { recurrenceStage: string; lifetimeScope: string }
      origin: { kind: string; sourceAggregateId: string }
    }
    sourceEncounterId: string | null
  }
  actor: EncounterActorRecord
  stage: TurnBoundary['stage']
  encounterId: string
}): boolean {
  if (input.effect.definition.recurrence.recurrenceStage !== input.stage) return false
  if (input.effect.definition.recurrence.lifetimeScope === 'OWNER') return true
  if (input.actor.kind === 'CHARACTER') return input.effect.sourceEncounterId === input.encounterId
  return (
    input.effect.definition.origin.kind === 'ENCOUNTER' &&
    input.effect.definition.origin.sourceAggregateId === input.encounterId
  )
}

function perceptionDependency(effect: TurnEffectCandidate['effect']) {
  // Compatibility fixtures and legacy rows are validated by the executor;
  // they cannot declare a System-owned perception dependency here.
  if (!effect.definition?.frozenGraph) return null
  return characterRuleActionSystemAdapterRegistry
    .get(effect.definition.frozenGraph.source.gameSystemId)
    ?.activeEffectPerceptionRequirement?.({
      definition: effect.definition,
      lifecycle: effect.lifecycle
    })
}

function perceptionSourceActor(input: {
  encounter: EncounterRecord
  effect: TurnEffectCandidate['effect']
}): EncounterActorRecord | null {
  const { origin } = input.effect.definition
  if (origin.kind === 'ENCOUNTER') {
    return origin.sourceActorId
      ? (input.encounter.actors.find((actor) => actor.id === origin.sourceActorId) ?? null)
      : null
  }
  return (
    input.encounter.actors.find(
      (actor) => actor.kind === 'CHARACTER' && actor.sourceId === origin.sourceAggregateId
    ) ?? null
  )
}

function combatPerceptionEffect(
  input: TurnEffectCandidate['effect']
): LockedCombatPerceptionEffect {
  return {
    id: input.id,
    version: input.version,
    createdOrdinal: input.createdOrdinal,
    definitionChecksum: input.definitionChecksum,
    definition: input.definition
  }
}

function lockedConditionDefinitionIds(input: {
  actor: EncounterActorRecord
  lockedCharacters: ReadonlyMap<string, LockedEncounterActiveEffectCharacter>
  encounterActors: ReadonlyMap<string, EncounterActorRecord>
}): readonly string[] {
  if (input.actor.kind === 'CHARACTER') {
    if (!input.actor.sourceId) {
      throw new EncounterConflictError('Encounter Character perception observer is incomplete.')
    }
    const character = input.lockedCharacters.get(input.actor.sourceId)
    if (!character || character.actor.id !== input.actor.id) {
      throw new EncounterConflictError('Encounter Character perception observer was not locked.')
    }
    return character.activeConditionDefinitionIds
  }
  const actor = input.encounterActors.get(input.actor.id)
  if (!actor || actor.kind === 'CHARACTER') {
    throw new EncounterConflictError('Encounter actor perception observer was not locked.')
  }
  return readEncounterActorConditionState(actor.conditions ?? []).ids
}

function pendingCandidateSnapshot(input: {
  ordinal: number
  candidate: TurnEffectCandidate
  state: {
    current: number
    temporary: number
    conditions: string[]
    scalarValues: Record<string, number>
  }
  character: LockedCharacter | null
  d20Policy?: Extract<
    Awaited<ReturnType<typeof executeCharacterActiveRuleEffectWithPause>>,
    { continuation: unknown }
  >['evidencePolicy']
}): Record<string, unknown> {
  const owner = input.character
    ? {
        kind: 'CHARACTER',
        characterId: input.character.id,
        streamVersion: input.character.streamVersion,
        projectionChecksum: input.character.overlay.projectionChecksum,
        mechanicalContextChecksum: input.character.overlay.mechanicalContextChecksum
      }
    : { kind: 'ENCOUNTER_ACTOR' }
  return {
    ordinal: input.ordinal,
    boundaryOrdinal: input.candidate.boundary.ordinal,
    stage: input.candidate.boundary.stage,
    targetActorId: input.candidate.actor.id,
    owner,
    activeEffectId: input.candidate.effect.id,
    createdOrdinal: input.candidate.effect.createdOrdinal,
    effectVersion: input.candidate.effect.version,
    definitionChecksum: input.candidate.effect.definitionChecksum,
    lifecycleChecksum: input.candidate.effect.lifecycleChecksum,
    targetStateChecksum: checksumRuleDocument({
      targetActorId: input.candidate.actor.id,
      currentHitPoints: input.state.current,
      temporaryHitPoints: input.state.temporary,
      maximumHitPoints: input.character?.maximumHitPoints ?? input.candidate.actor.maxHitPoints,
      scalarValues: input.state.scalarValues,
      conditionIds: input.state.conditions
    }),
    d20Policy: input.d20Policy ?? null
  }
}

function currentStateEquals(
  left: {
    currentHitPoints: number
    temporaryHitPoints: number
    maximumHitPoints: number
    conditionIds: readonly string[]
    scalarValues: Readonly<Record<string, number>>
  },
  right: {
    currentHitPoints: number
    temporaryHitPoints: number
    maximumHitPoints: number
    conditionIds: readonly string[]
    scalarValues: Readonly<Record<string, number>>
  }
): boolean {
  return (
    left.currentHitPoints === right.currentHitPoints &&
    left.temporaryHitPoints === right.temporaryHitPoints &&
    left.maximumHitPoints === right.maximumHitPoints &&
    checksumRuleDocument(left.scalarValues) === checksumRuleDocument(right.scalarValues) &&
    left.conditionIds.length === right.conditionIds.length &&
    left.conditionIds.every((conditionId, index) => conditionId === right.conditionIds[index])
  )
}

function matchesPendingCandidate(input: {
  expected: Extract<
    ServerRuleExecutionPendingApplicationContextDto,
    { kind: 'ENCOUNTER_TURN_ACTIVE_EFFECTS' }
  >['currentCandidate']
  ordinal: number
  candidate: TurnEffectCandidate
  character: LockedCharacter | null
  state: {
    current: number
    temporary: number
    conditions: string[]
    scalarValues: Record<string, number>
  }
  requireTargetState: boolean
}): boolean {
  const { expected, candidate, character } = input
  if (
    expected.ordinal !== input.ordinal ||
    expected.boundaryOrdinal !== candidate.boundary.ordinal ||
    expected.stage !== candidate.boundary.stage ||
    expected.targetActorId !== candidate.actor.id ||
    expected.activeEffectId !== candidate.effect.id ||
    expected.createdOrdinal !== candidate.effect.createdOrdinal ||
    expected.effectVersion !== candidate.effect.version ||
    expected.definitionChecksum !== candidate.effect.definitionChecksum ||
    expected.lifecycleChecksum !== candidate.effect.lifecycleChecksum
  ) {
    return false
  }
  if (character) {
    if (
      expected.owner.kind !== 'CHARACTER' ||
      expected.owner.characterId !== character.id ||
      expected.owner.streamVersion !== character.streamVersion ||
      expected.owner.projectionChecksum !== character.overlay.projectionChecksum ||
      expected.owner.mechanicalContextChecksum !== character.overlay.mechanicalContextChecksum
    ) {
      return false
    }
  } else if (expected.owner.kind !== 'ENCOUNTER_ACTOR') {
    return false
  }
  return (
    !input.requireTargetState ||
    expected.targetStateChecksum ===
      checksumRuleDocument({
        targetActorId: candidate.actor.id,
        currentHitPoints: input.state.current,
        temporaryHitPoints: input.state.temporary,
        maximumHitPoints: character?.maximumHitPoints ?? candidate.actor.maxHitPoints,
        scalarValues: input.state.scalarValues,
        conditionIds: input.state.conditions
      })
  )
}

function appendStoredExecution(input: {
  execution: BatchExecution
  candidate: TurnEffectCandidate
  character: LockedCharacter | null
  state: {
    current: number
    temporary: number
    conditions: string[]
    scalarValues: Record<string, number>
  }
  retainedConditionIds: readonly string[]
  effectInput: CharacterActiveRuleEffectExecutionInput
  pendingApplications: Map<string, readonly CharacterRuleActionApplication[]>
  pendingEncounterActorApplications: Map<string, readonly CharacterRuleActionApplication[]>
  executionStates: Map<
    string,
    {
      current: number
      temporary: number
      conditions: string[]
      scalarValues: Record<string, number>
    }
  >
  executions: BatchExecution[]
}): void {
  const { execution, candidate, character, state } = input
  const expectedOwner = character
    ? { kind: 'CHARACTER' as const, characterId: character.id }
    : { kind: 'ENCOUNTER_ACTOR' as const }
  const reconstructed = reconstructCharacterActiveRuleEffectCompletion({
    executionInput: input.effectInput,
    execution: execution.execution,
    d20Evidence: execution.d20
  })
  const expectedBindings = candidate.effect.definition.frozenGraph.sourceEntryBindings ?? []
  const actualBindings = execution.execution.evidence.sourceEntryBindings ?? []
  const bindingsMatch =
    actualBindings.length === expectedBindings.length &&
    actualBindings.every(
      (binding, index) =>
        binding.sourceEntryId === expectedBindings[index]?.sourceEntryId &&
        binding.nodeId === expectedBindings[index]?.nodeId
    )
  const remainingTicks = candidate.effect.lifecycle.remainingTicks
  const lifecycleMatches =
    remainingTicks === null
      ? execution.lifecycle.kind === 'EXPIRE'
        ? execution.lifecycle.expectedVersion === candidate.effect.version &&
          execution.lifecycle.beforeRemainingTicks === null &&
          execution.lifecycle.afterRemainingTicks === null &&
          execution.lifecycle.beforeLifecycleChecksum === candidate.effect.lifecycleChecksum
        : execution.lifecycle.expectedVersion === candidate.effect.version &&
          execution.lifecycle.afterVersion === candidate.effect.version + 1 &&
          execution.lifecycle.beforeRemainingTicks === null &&
          execution.lifecycle.afterRemainingTicks === null &&
          execution.lifecycle.beforeLifecycleChecksum === candidate.effect.lifecycleChecksum &&
          execution.lifecycle.afterLifecycleChecksum ===
            checksumRuleDocument({ schemaVersion: 1, remainingTicks: null })
      : execution.lifecycle.kind === 'EXPIRE'
        ? execution.lifecycle.expectedVersion === candidate.effect.version &&
          execution.lifecycle.beforeRemainingTicks === remainingTicks &&
          execution.lifecycle.afterRemainingTicks === 0 &&
          execution.lifecycle.beforeLifecycleChecksum === candidate.effect.lifecycleChecksum
        : execution.lifecycle.expectedVersion === candidate.effect.version &&
          execution.lifecycle.afterVersion === candidate.effect.version + 1 &&
          execution.lifecycle.beforeRemainingTicks === remainingTicks &&
          execution.lifecycle.afterRemainingTicks === remainingTicks - 1 &&
          execution.lifecycle.beforeLifecycleChecksum === candidate.effect.lifecycleChecksum &&
          execution.lifecycle.afterLifecycleChecksum ===
            checksumRuleDocument({
              schemaVersion: 1,
              remainingTicks: remainingTicks - 1
            })
  const applications: CharacterRuleActionApplication[] = execution.applications.map(
    (application): CharacterRuleActionApplication => ({
      ...application,
      targetActorId: candidate.actor.id
    })
  )
  const folded = foldCharacterMechanicsApplications({
    targetActorId: candidate.actor.id,
    currentHitPoints: state.current,
    temporaryHitPoints: state.temporary,
    maximumHitPoints: character?.maximumHitPoints ?? candidate.actor.maxHitPoints,
    scalarValues: state.scalarValues,
    conditionIds: state.conditions,
    retainedConditionIds: input.retainedConditionIds,
    applications
  })
  const reconstructedFolded = foldCharacterMechanicsApplications({
    targetActorId: candidate.actor.id,
    currentHitPoints: state.current,
    temporaryHitPoints: state.temporary,
    maximumHitPoints: character?.maximumHitPoints ?? candidate.actor.maxHitPoints,
    scalarValues: state.scalarValues,
    conditionIds: state.conditions,
    retainedConditionIds: input.retainedConditionIds,
    applications: reconstructed.applications
  })
  const reconstructedLifecycleMatches =
    execution.lifecycle.kind === reconstructed.lifecycle.kind &&
    execution.lifecycle.expectedVersion === reconstructed.lifecycle.expectedVersion &&
    execution.lifecycle.beforeRemainingTicks === reconstructed.lifecycle.beforeRemainingTicks &&
    execution.lifecycle.afterRemainingTicks === reconstructed.lifecycle.afterRemainingTicks &&
    execution.lifecycle.beforeLifecycleChecksum ===
      reconstructed.lifecycle.beforeLifecycleChecksum &&
    (execution.lifecycle.kind === 'EXPIRE' ||
      (reconstructed.lifecycle.kind === 'UPDATE' &&
        execution.lifecycle.afterVersion === reconstructed.lifecycle.proposedAfterVersion &&
        execution.lifecycle.afterLifecycleChecksum ===
          reconstructed.lifecycle.afterLifecycleChecksum))
  if (
    execution.ordinal !== input.executions.length ||
    execution.targetActorId !== candidate.actor.id ||
    execution.activeEffectId !== candidate.effect.id ||
    execution.boundaryOrdinal !== candidate.boundary.ordinal ||
    execution.stage !== candidate.boundary.stage ||
    execution.createdOrdinal !== candidate.effect.createdOrdinal ||
    execution.beforeVersion !== candidate.effect.version ||
    execution.definition.authoredEffectId !== candidate.effect.definition.authoredEffectId ||
    execution.definition.compiledEntryId !== candidate.effect.definition.compiledEntryId ||
    execution.definition.frozenGraphNodeId !== candidate.effect.definition.frozenGraphNodeId ||
    execution.definition.definitionChecksum !== candidate.effect.definitionChecksum ||
    execution.definition.frozenSourceChecksum !==
      candidate.effect.definition.frozenGraph.source.checksum ||
    execution.definition.capabilityContractVersion !==
      candidate.effect.definition.frozenGraph.capabilityContractVersion ||
    execution.execution.evidence.source.definitionId !==
      candidate.effect.definition.frozenGraph.source.definitionId ||
    execution.execution.evidence.source.gameSystemId !==
      candidate.effect.definition.frozenGraph.source.gameSystemId ||
    execution.execution.evidence.source.definitionFamilyKey !==
      candidate.effect.definition.frozenGraph.source.definitionFamilyKey ||
    execution.execution.evidence.source.checksum !==
      candidate.effect.definition.frozenGraph.source.checksum ||
    execution.execution.evidence.capabilityContractVersion !==
      candidate.effect.definition.frozenGraph.capabilityContractVersion ||
    !bindingsMatch ||
    !lifecycleMatches ||
    !reconstructedLifecycleMatches ||
    execution.owner.kind !== expectedOwner.kind ||
    (execution.owner.kind === 'CHARACTER' &&
      expectedOwner.kind === 'CHARACTER' &&
      execution.owner.characterId !== expectedOwner.characterId) ||
    !currentStateEquals(execution.targetTransition.before, folded.before) ||
    !currentStateEquals(execution.targetTransition.after, folded.after) ||
    execution.targetTransition.checksum !==
      checksumRuleDocument({
        targetActorId: candidate.actor.id,
        ...folded.before
      }) ||
    JSON.stringify(execution.applications) !== JSON.stringify(folded.applications) ||
    JSON.stringify(execution.applications) !== JSON.stringify(reconstructedFolded.applications) ||
    JSON.stringify(execution.d20) !== JSON.stringify(reconstructed.d20 ?? null) ||
    !currentStateEquals(execution.targetTransition.after, reconstructedFolded.after) ||
    !currentStateEquals(execution.targetTransition.before, {
      currentHitPoints: state.current,
      temporaryHitPoints: state.temporary,
      maximumHitPoints: character?.maximumHitPoints ?? candidate.actor.maxHitPoints,
      scalarValues: state.scalarValues,
      conditionIds: state.conditions
    })
  ) {
    throw new EncounterConflictError(
      'The paused turn-effect batch no longer matches its completed prefix.'
    )
  }
  const key = ownerKey(candidate.actor)
  input.executionStates.set(key, {
    current: execution.targetTransition.after.currentHitPoints,
    temporary: execution.targetTransition.after.temporaryHitPoints,
    conditions: [...execution.targetTransition.after.conditionIds],
    scalarValues: { ...execution.targetTransition.after.scalarValues }
  })
  if (character) {
    input.pendingApplications.set(character.id, [
      ...(input.pendingApplications.get(character.id) ?? []),
      ...applications
    ])
  } else {
    input.pendingEncounterActorApplications.set(candidate.actor.id, [
      ...(input.pendingEncounterActorApplications.get(candidate.actor.id) ?? []),
      ...applications
    ])
  }
  input.executions.push(execution)
}

export async function applyEvaluatedTurnEffectBatch(input: {
  trx: DBLike
  actorUserId: string
  encounter: EncounterRecord
  commandType: 'START' | 'ADVANCE_TURN'
  occurrenceId: string
  occurrenceVersion?: number
  batch: EvaluatedTurnEffectBatch
  beforeApply?: () => Promise<void>
}): Promise<StoredRuleExecutionResultDto> {
  await input.beforeApply?.()
  const transitions: BatchResult['characterTransitions'] = []
  const encounterActorTransitions: BatchResult['encounterActorTransitions'] = []
  const encounterRepository = createEncounterRepository(input.trx)
  const evaluatedForActor = (targetActorId: string) => {
    const executions = input.batch.executions.filter(
      (execution) => execution.targetActorId === targetActorId
    )
    const first = executions[0]
    const last = executions.at(-1)
    if (!first || !last)
      throw new EncounterConflictError('Turn effect evaluated mechanics are unavailable.')
    return {
      applications: executions.flatMap((execution) => execution.applications),
      targetTransition: {
        checksum: first.targetTransition.checksum,
        before: first.targetTransition.before,
        after: last.targetTransition.after
      }
    }
  }
  for (const characterId of input.batch.characterIds) {
    const applications = input.batch.pendingApplications.get(characterId)
    if (!applications) continue
    const character = input.batch.lockedCharacters.get(characterId)!
    const evaluated = evaluatedForActor(character.actor.id)
    const applied = await applyLockedEncounterCharacterMechanicsBatch({
      trx: input.trx,
      actorUserId: input.actorUserId,
      encounterId: input.encounter.id,
      occurrenceId: input.occurrenceId,
      commandId: input.occurrenceId,
      sourceCommandId: input.occurrenceId,
      targetActor: character.actor,
      targetCharacterId: character.id,
      mechanics: character.mechanics,
      overlay: character.overlay,
      effectiveMaximumHitPoints: character.maximumHitPoints,
      conditionDefinitions: character.conditionDefinitions,
      retainedConditionIds: input.batch.retainedConditionIdsByActorId.get(character.actor.id),
      effectiveScalarValues: evaluated.targetTransition.before.scalarValues,
      applications,
      evaluated,
      forceVersionAdvance: true
    })
    if (applied.streamVersion === null)
      throw new EncounterConflictError('Turn effects must advance Character state.')
    await encounterRepository.updateActor(applied.updatedActor)
    transitions.push({
      characterId,
      targetActorId: character.actor.id,
      beforeStreamVersion: character.streamVersion,
      afterStreamVersion: applied.streamVersion,
      before: input.batch.executions.find(
        (value) => value.owner.kind === 'CHARACTER' && value.owner.characterId === characterId
      )!.targetTransition.before,
      after: applied.finalState
    })
  }
  for (const targetActorId of input.batch.encounterActorIds) {
    const applications = input.batch.pendingEncounterActorApplications.get(targetActorId)
    if (!applications) continue
    const actor = input.batch.encounterActors.get(targetActorId)!
    const initialConditions = input.batch.initialEncounterActorConditions.get(targetActorId)
    if (!initialConditions)
      throw new EncounterConflictError('Encounter actor conditions are unavailable.')
    const evaluated = evaluatedForActor(targetActorId)
    const applied = await applyLockedEncounterActorMechanicsBatch({
      trx: input.trx,
      targetActor: actor,
      initialConditionRows: initialConditions,
      retainedConditionIds: input.batch.retainedConditionIdsByActorId.get(targetActorId),
      effectiveScalarValues: evaluated.targetTransition.before.scalarValues,
      applications,
      evaluated
    })
    encounterActorTransitions.push({
      targetActorId,
      before: applied.targetTransition.before,
      after: applied.targetTransition.after
    })
  }
  for (const candidate of input.batch.candidates) {
    const execution = input.batch.executions.find(
      (value) => value.activeEffectId === candidate.effect.id
    )!
    if (execution.lifecycle.kind === 'UPDATE') {
      await input.batch.effects.updateLifecycleCas({
        id: candidate.effect.id,
        owner: ownerForActor(candidate.actor, input.encounter.id),
        expectedVersion: candidate.effect.version,
        lifecycle: {
          schemaVersion: 1,
          remainingTicks: execution.lifecycle.afterRemainingTicks
        }
      })
    } else {
      await input.batch.effects.deleteCas({
        id: candidate.effect.id,
        owner: ownerForActor(candidate.actor, input.encounter.id),
        expectedVersion: candidate.effect.version
      })
    }
  }
  return storedRuleExecutionResultDtoSchema.parse({
    status: 'BATCH_COMPLETE',
    batchKind: 'ENCOUNTER_TURN_ACTIVE_EFFECTS',
    schemaVersion: 1,
    occurrenceId: input.occurrenceId,
    occurrenceVersion: input.occurrenceVersion ?? 0,
    encounterId: input.encounter.id,
    commandType: input.commandType,
    executions: input.batch.executions,
    characterTransitions: transitions,
    encounterActorTransitions
  })
}

/**
 * Executes the first fixed Character active-effect tracer under the already
 * locked Encounter context. Upstream Campaign/Session/lease/Encounter locks
 * are deliberately owned by the command coordinator.
 */
export async function evaluateEncounterTurnCharacterActiveEffects(input: {
  trx: DBLike
  actorUserId: string
  encounter: EncounterRecord
  commandType: 'START' | 'ADVANCE_TURN'
  boundaries: readonly TurnBoundary[]
  occurrenceId: string
  runtime?: RulesRuntimeService
  attunementSlotOverride: number | null
  getEncounterActorSnapshot?: () => Promise<{
    rules: EncounterActorRuleOutput
    encounter: EncounterRecord
  }>
  /** Server-only coordinator root; omitted by the compatibility wrapper. */
  coordinatorRoot?: TurnEffectCoordinatorRoot
  /** Server-only resume input for the dedicated turn-batch occurrence coordinator. */
  resume?: TurnEffectResume
  /**
   * A prior each-round outgoing phase. Its exact executions are revalidated
   * under this fresh lock set and rebuilt into the terminal application batch.
   */
  stagedPlan?: StagedTurnEffectPlanDto
  /** Test-only terminal boundary; production callers omit it. */
  beforeTerminalApply?: () => Promise<void>
  /** Trusted server d20 seam for Automatic execution. */
  rollD20?: () => number
}): Promise<TurnEffectBatchEvaluation> {
  const selected = eligibleBoundaryActors(input.encounter, input.boundaries)
  if (selected.length === 0) return { kind: 'TERMINAL', result: null, selectionChecksum: null }

  // A no-effect turn must retain the existing command path. This is only a
  // preflight; eligible rows are re-read under Character/effect locks below.
  const activeEffects = createActiveRuleEffectRepository(input.trx)
  const preliminaryEffects = new Map<string, Awaited<ReturnType<typeof activeEffects.list>>>()
  const owners = [...new Map(selected.map(({ actor }) => [ownerKey(actor), actor])).values()]
  for (const actor of owners) {
    preliminaryEffects.set(
      ownerKey(actor),
      await activeEffects.list(ownerForActor(actor, input.encounter.id))
    )
  }
  const hasRecognizedCandidate = selected.some(({ boundary, actor }) =>
    preliminaryEffects.get(ownerKey(actor))!.some((effect) =>
      isEligibleTurnEffect({
        effect,
        actor,
        stage: boundary.stage,
        encounterId: input.encounter.id
      })
    )
  )
  if (!hasRecognizedCandidate) return { kind: 'TERMINAL', result: null, selectionChecksum: null }

  const preliminaryCandidates = selected.flatMap(({ boundary, actor }) =>
    preliminaryEffects
      .get(ownerKey(actor))!
      .filter((effect) =>
        isEligibleTurnEffect({
          effect,
          actor,
          stage: boundary.stage,
          encounterId: input.encounter.id
        })
      )
      .map((effect) => ({ boundary, actor, effect }))
  )
  const preliminarySelectionChecksum = checksumCanonicalJson({
    commandType: input.commandType,
    boundaries: preliminaryCandidates
      .sort(
        (left, right) =>
          left.boundary.ordinal - right.boundary.ordinal ||
          left.effect.createdOrdinal - right.effect.createdOrdinal ||
          left.effect.id.localeCompare(right.effect.id)
      )
      .map(({ boundary, actor, effect }) => ({
        boundaryOrdinal: boundary.ordinal,
        stage: boundary.stage,
        targetActorId: actor.id,
        owner: ownerForActor(actor, input.encounter.id),
        activeEffectId: effect.id,
        createdOrdinal: effect.createdOrdinal
      }))
  })
  if (input.encounter.automationMode === 'MANUAL') {
    return input.encounter.manualReminderMode === 'OFF'
      ? { kind: 'TERMINAL', result: null, selectionChecksum: preliminarySelectionChecksum }
      : {
          kind: 'TERMINAL',
          selectionChecksum: preliminarySelectionChecksum,
          result: storedRuleExecutionResultDtoSchema.parse({
            status: 'MANUAL',
            occurrenceId: input.occurrenceId,
            occurrenceVersion: 0,
            reminder: { kind: 'MANUAL_RULE_REVIEW' }
          })
        }
  }
  const actorsToLock = new Map<string, EncounterActorRecord>()
  for (const candidate of preliminaryCandidates) {
    actorsToLock.set(candidate.actor.id, candidate.actor)
    if (!perceptionDependency(candidate.effect)) continue
    const source = perceptionSourceActor({ encounter: input.encounter, effect: candidate.effect })
    if (source) actorsToLock.set(source.id, source)
  }
  const perceptionRequired = preliminaryCandidates.some((candidate) =>
    perceptionDependency(candidate.effect)
  )
  const sceneRepository = perceptionRequired ? createVttSceneRepository(input.trx) : null
  const sceneBinding = sceneRepository
    ? await sceneRepository.findEncounterBinding(input.encounter.id)
    : null
  const lockedScene = sceneBinding
    ? await sceneRepository!.lockLiveScene(sceneBinding.sceneId)
    : null
  const actorIdByTokenId = new Map<string, string>()
  if (lockedScene && sceneRepository) {
    for (const binding of await sceneRepository.listActorTokenBindings(input.encounter.id)) {
      if (actorIdByTokenId.has(binding.tokenId))
        throw new EncounterConflictError('Encounter perception token binding is ambiguous.')
      actorIdByTokenId.set(binding.tokenId, binding.actorId)
    }
  }
  const targetState = await lockEncounterActiveEffectTargets({
    trx: input.trx,
    encounter: input.encounter,
    actors: [...actorsToLock.values()],
    attunementSlotOverride: input.attunementSlotOverride,
    getEncounterActorSnapshot: input.getEncounterActorSnapshot
  })
  const effects = activeEffects
  const {
    characterIds,
    encounterActorIds,
    lockedCharacters,
    encounterActors,
    effectiveScalarValuesByActorId,
    activeEffectsByActorId,
    encounterActorRules
  } = targetState
  const candidates = selected
    .flatMap(({ boundary, actor }) =>
      (activeEffectsByActorId?.get(actor.id) ?? [])
        .filter((effect) =>
          isEligibleTurnEffect({
            effect,
            actor,
            stage: boundary.stage,
            encounterId: input.encounter.id
          })
        )
        .map((effect) => ({
          boundary,
          actor: actor.kind === 'CHARACTER' ? actor : (encounterActors.get(actor.id) ?? actor),
          effect
        }))
    )
    .sort(
      (left, right) =>
        left.boundary.ordinal - right.boundary.ordinal ||
        left.effect.createdOrdinal - right.effect.createdOrdinal ||
        left.effect.id.localeCompare(right.effect.id)
    )
  if (candidates.length > 128)
    throw new EncounterValidationError('A turn may execute at most 128 active effects.')
  for (const candidate of candidates) {
    if (!perceptionDependency(candidate.effect)) continue
    const source = perceptionSourceActor({ encounter: input.encounter, effect: candidate.effect })
    if (source && !actorsToLock.has(source.id)) {
      throw new EncounterConflictError('Active-effect perception source changed before execution.')
    }
  }
  const selectionChecksum = checksumCanonicalJson({
    commandType: input.commandType,
    boundaries: candidates.map(({ boundary, actor, effect }) => ({
      boundaryOrdinal: boundary.ordinal,
      stage: boundary.stage,
      targetActorId: actor.id,
      owner: ownerForActor(actor, input.encounter.id),
      activeEffectId: effect.id,
      createdOrdinal: effect.createdOrdinal
    }))
  })
  if (candidates.length === 0) return { kind: 'TERMINAL', result: null, selectionChecksum }
  if (!input.runtime) {
    throw new EncounterValidationError('A Rules runtime is required for active Character effects.')
  }
  const perceptionByEffectId = new Map<
    string,
    { requirement: 'DETECT' | 'LOCATE' | 'PRECISE' | 'SEE'; satisfied: boolean; checksum: string }
  >()
  const lockedSpatialEffects =
    lockedScene && perceptionRequired
      ? await createSpatialRuleEffectRepository(input.trx).lockScope({
          encounterId: input.encounter.id,
          sceneId: lockedScene.state.id
        })
      : null
  const spatialEffects = lockedSpatialEffects ? await lockedSpatialEffects.list() : []
  const currentDefinitionsById = new Map<
    string,
    ReturnType<ReturnType<typeof createReusableDefinitionRepository>['requireCurrent']>
  >()
  const conditionStateByActorId = new Map<string, ReturnType<typeof resolveRuleCapabilityState>>()
  const conditionDefinitions = {
    requireCurrent(definitionId: string) {
      let current = currentDefinitionsById.get(definitionId)
      if (!current) {
        current = createReusableDefinitionRepository(input.trx).requireCurrent(definitionId)
        currentDefinitionsById.set(definitionId, current)
      }
      return current
    }
  }
  const conditionStateForActor = (actor: EncounterActorRecord) => {
    if (!actor.systemId) {
      throw new EncounterConflictError('Encounter actor System identity is unavailable.')
    }
    let state = conditionStateByActorId.get(actor.id)
    if (!state) {
      state = resolveRuleCapabilityState({
        definitions: conditionDefinitions,
        gameSystemId: actor.systemId,
        activeConditionDefinitionIds: lockedConditionDefinitionIds({
          actor,
          lockedCharacters,
          encounterActors
        }),
        capabilityDefinitionIds: []
      })
      conditionStateByActorId.set(actor.id, state)
    }
    return state
  }
  for (const candidate of candidates) {
    const dependency = perceptionDependency(candidate.effect)
    if (!dependency) continue
    const source = perceptionSourceActor({ encounter: input.encounter, effect: candidate.effect })
    const targetToken = lockedScene?.state.tokens.find(
      (token) => actorIdByTokenId.get(token.id) === candidate.actor.id
    )
    const sourceToken = source
      ? lockedScene?.state.tokens.find((token) => actorIdByTokenId.get(token.id) === source.id)
      : undefined
    if (!lockedScene || !source || !targetToken || !sourceToken) {
      perceptionByEffectId.set(candidate.effect.id, {
        requirement: dependency.requirement,
        satisfied: false,
        checksum: checksumRuleDocument({
          requirement: dependency.requirement,
          targetActorId: candidate.actor.id,
          sourceActorId: source?.id ?? null,
          reason: 'UNAVAILABLE'
        })
      })
      continue
    }
    const localAreaEffects = spatialEffects
      .filter((effect) => {
        const geometry = effectiveSpatialGeometry(
          {
            anchorKind: effect.placement.anchorKind,
            geometry: effect.placement.geometry,
            sourceTokenId: effect.placement.sourceTokenId
          },
          lockedScene.state.tokens
        )
        return (
          geometry !== null &&
          (spatialGeometryIntersectsTokenFootprint({ geometry, token: targetToken }) ||
            spatialGeometryIntersectsTokenFootprint({ geometry, token: sourceToken }))
        )
      })
      .map((effect) => ({
        id: effect.id,
        version: effect.version,
        createdOrdinal: effect.createdOrdinal,
        definitionChecksum: effect.definitionChecksum,
        definition: effect.definition
      }))
    const targetCharacter =
      candidate.actor.kind === 'CHARACTER' && candidate.actor.sourceId
        ? lockedCharacters.get(candidate.actor.sourceId)
        : null
    const baselineCapabilities = candidate.actor.systemId
      ? (characterRuleActionSystemAdapterRegistry
          .get(candidate.actor.systemId)
          ?.combatPerceptionBaselineCapabilities?.({ observerActorId: candidate.actor.id }) ?? [])
      : []
    const [observerConditionState, subjectConditionState] = await Promise.all([
      conditionStateForActor(candidate.actor),
      conditionStateForActor(source)
    ])
    const result = resolveEncounterCombatPerception({
      requirement: dependency.requirement,
      observerActorId: candidate.actor.id,
      scene: lockedScene.state,
      sceneGrid: lockedScene.state.grid,
      observerToken: targetToken,
      subjectToken: sourceToken,
      baselineCapabilities,
      pinnedSenseDefinitions: targetCharacter?.mechanics.pinnedSenseDefinitions ?? [],
      observerEffects: (activeEffectsByActorId?.get(candidate.actor.id) ?? []).map(
        combatPerceptionEffect
      ),
      subjectEffects: (activeEffectsByActorId?.get(source.id) ?? []).map(combatPerceptionEffect),
      localAreaEffects,
      observerConditionContributions: deriveConditionCombatPerceptionContributions({
        conditionDefinitions: observerConditionState.conditionDefinitions,
        relation: 'OBSERVER',
        sceneGrid: lockedScene.state.grid
      }),
      subjectConditionContributions: deriveConditionCombatPerceptionContributions({
        conditionDefinitions: subjectConditionState.conditionDefinitions,
        relation: 'SUBJECT',
        sceneGrid: lockedScene.state.grid
      }),
      sharedSurface: true,
      invisibleChannels: [],
      suppressedChannels: []
    })
    perceptionByEffectId.set(candidate.effect.id, {
      requirement: dependency.requirement,
      satisfied: result.satisfied,
      checksum: checksumRuleDocument({
        requirement: dependency.requirement,
        targetActorId: candidate.actor.id,
        sourceActorId: source.id,
        sceneId: lockedScene.state.id,
        sceneVersion: lockedScene.state.version,
        result
      })
    })
  }
  if (input.resume && input.encounter.automationMode !== 'ASSISTED') {
    throw new EncounterConflictError(
      'Only Assisted turn-effect batches may resume a pending occurrence.'
    )
  }
  const resumeContext = input.resume?.pendingSnapshot.applicationContext
  if (resumeContext && resumeContext.kind !== 'ENCOUNTER_TURN_ACTIVE_EFFECTS') {
    throw new EncounterValidationError('The pending rule occurrence is not a turn-effect batch.')
  }
  if (input.resume && !input.coordinatorRoot) {
    throw new EncounterConflictError(
      'Turn-effect resume requires independently verified coordinator identity.'
    )
  }
  const coordinatorRoot = input.coordinatorRoot
  if (
    input.stagedPlan &&
    (input.stagedPlan.selectionChecksum !== selectionChecksum ||
      input.stagedPlan.executions.length !== candidates.length)
  ) {
    throw new EncounterConflictError('The staged turn-effect plan is stale.')
  }
  if (resumeContext) {
    if (
      resumeContext.root.commandType !== input.commandType ||
      resumeContext.root.expectedEncounterVersion !== input.encounter.version ||
      resumeContext.selectionChecksum !== selectionChecksum ||
      resumeContext.root.rootCommandId !== coordinatorRoot!.rootCommandId ||
      resumeContext.root.commandFingerprint !== coordinatorRoot!.commandFingerprint ||
      resumeContext.root.initiatorUserId !== coordinatorRoot!.initiatorUserId ||
      resumeContext.root.correlationId !== coordinatorRoot!.correlationId ||
      resumeContext.root.expectedEncounterVersion !== coordinatorRoot!.expectedEncounterVersion ||
      resumeContext.root.frozenActorRuleRevisionId !==
        (coordinatorRoot!.frozenActorRuleRevisionId ?? null) ||
      resumeContext.root.frozenActorRuleRevisionChecksum !==
        (coordinatorRoot!.frozenActorRuleRevisionChecksum ?? null) ||
      resumeContext.root.frozenActorRuleSnapshotChecksum !==
        (coordinatorRoot!.frozenActorRuleSnapshotChecksum ?? null) ||
      checksumCanonicalJson(resumeContext.root.initiative) !==
        checksumCanonicalJson(coordinatorRoot!.initiative ?? null) ||
      checksumCanonicalJson(resumeContext.root.initiativeAdvance) !==
        checksumCanonicalJson(coordinatorRoot!.initiativeAdvance ?? null) ||
      checksumCanonicalJson(resumeContext.root.outgoingTurn ?? null) !==
        checksumCanonicalJson(coordinatorRoot!.outgoingTurn ?? null) ||
      resumeContext.root.proposedTerminalTransition.status !==
        coordinatorRoot!.proposedTerminalTransition.status ||
      resumeContext.root.proposedTerminalTransition.round !==
        coordinatorRoot!.proposedTerminalTransition.round ||
      resumeContext.root.proposedTerminalTransition.currentActorId !==
        coordinatorRoot!.proposedTerminalTransition.currentActorId
    ) {
      throw new EncounterConflictError('The paused turn-effect batch is stale.')
    }
    if (
      resumeContext.completedExecutions.length + 1 + resumeContext.remainingCandidates.length !==
      candidates.length
    ) {
      throw new EncounterConflictError('The paused turn-effect batch candidate set changed.')
    }
  }

  const pendingApplications = new Map<string, readonly CharacterRuleActionApplication[]>()
  const pendingEncounterActorApplications = new Map<
    string,
    readonly CharacterRuleActionApplication[]
  >()
  const retainedConditionIdsByActorId = new Map<string, readonly string[]>()
  const stagedExpiredEffectIds = new Set<string>()
  const executionStates = new Map<
    string,
    {
      current: number
      temporary: number
      conditions: string[]
      scalarValues: Record<string, number>
    }
  >()
  const initialEncounterActorConditions = new Map<string, unknown[]>()
  const executions: BatchExecution[] = []
  for (const [ordinal, candidate] of candidates.entries()) {
    const character =
      candidate.actor.kind === 'CHARACTER' ? lockedCharacters.get(candidate.actor.sourceId!)! : null
    const actorConditions =
      candidate.actor.kind === 'CHARACTER'
        ? null
        : readEncounterActorConditionState(candidate.actor.conditions ?? [])
    if (actorConditions) {
      initialEncounterActorConditions.set(candidate.actor.id, actorConditions.values)
    }
    const targetKey = ownerKey(candidate.actor)
    const actorRule =
      candidate.actor.kind === 'CHARACTER'
        ? null
        : requireEncounterActorRuleResult(encounterActorRules!, candidate.actor.id)
    if (candidate.effect.definition.frozenGraph.source.gameSystemId !== candidate.actor.systemId) {
      throw new EncounterValidationError(
        'The active effect and Encounter actor Game Systems do not match.'
      )
    }
    const state =
      executionStates.get(targetKey) ??
      (character
        ? {
            current: character.mechanics.commandState.state.hitpoints.current,
            temporary: character.mechanics.commandState.state.hitpoints.temp ?? 0,
            scalarValues: {
              ...(effectiveScalarValuesByActorId?.get(candidate.actor.id) ??
                (() => {
                  throw new EncounterConflictError(
                    'The active-effect scalar target state is unavailable.'
                  )
                })())
            },
            conditions: (character.mechanics.commandState.state.conditions ?? []).map(
              (condition) => condition.conditionTypeId
            )
          }
        : {
            current: candidate.actor.currentHitPoints,
            temporary: candidate.actor.tempHitPoints,
            scalarValues: {
              ...(effectiveScalarValuesByActorId?.get(candidate.actor.id) ??
                (() => {
                  throw new EncounterConflictError(
                    'The active-effect scalar target state is unavailable.'
                  )
                })())
            },
            conditions: actorConditions!.ids
          })
    const protections =
      actorRule?.targetProtection.status === 'NORMALIZED' ? actorRule.targetProtection : null
    const retainedConditionIds = retainedConditionIdsForEffect({
      effect: candidate.effect,
      ownerEffects: activeEffectsByActorId?.get(candidate.actor.id) ?? [],
      excludedEffectIds: stagedExpiredEffectIds
    })
    const effectInput = {
      activeEffectId: candidate.effect.id,
      activeEffectVersion: candidate.effect.version,
      definition: candidate.effect.definition,
      lifecycle: candidate.effect.lifecycle,
      lifecycleChecksum: candidate.effect.lifecycleChecksum,
      occurrenceId: input.occurrenceId,
      stage: candidate.boundary.stage,
      targetActorId: candidate.actor.id,
      currentHitPoints: state.current,
      temporaryHitPoints: state.temporary,
      maximumHitPoints: character?.maximumHitPoints ?? candidate.actor.maxHitPoints,
      targetScalarValues: state.scalarValues,
      targetConditionIds: state.conditions,
      targetDerivedFacts: character
        ? {
            ...character.overlay.rulePolicyOutput,
            targetProtection: {
              status: 'NORMALIZED' as const,
              defenses: character.overlay.rulePolicyOutput.defenses,
              conditionImmunityIds: character.overlay.rulePolicyOutput.conditionImmunityIds
            }
          }
        : {
            targetProtection: actorRule!.targetProtection,
            savingThrowDefinitions: actorRule!.savingThrowDefinitions ?? [],
            statBlock: snapshotStatBlock(candidate.actor)
          },
      defenses: character?.overlay.rulePolicyOutput.defenses ?? protections?.defenses ?? [],
      conditionImmunityIds:
        character?.overlay.rulePolicyOutput.conditionImmunityIds ??
        protections?.conditionImmunityIds ??
        [],
      perception: perceptionByEffectId.get(candidate.effect.id) ?? null,
      runtime: input.runtime,
      adapters: characterRuleActionSystemAdapterRegistry
    }
    const stagedExecution = input.stagedPlan?.executions[ordinal]
    if (stagedExecution) {
      appendStoredExecution({
        execution: stagedExecution,
        candidate,
        character,
        state,
        retainedConditionIds,
        effectInput,
        pendingApplications,
        pendingEncounterActorApplications,
        executionStates,
        executions
      })
      if (stagedExecution.lifecycle.kind === 'EXPIRE')
        stagedExpiredEffectIds.add(candidate.effect.id)
      continue
    }
    if (resumeContext && ordinal < resumeContext.currentCandidate.ordinal) {
      const storedExecution = resumeContext.completedExecutions[ordinal]
      if (!storedExecution) {
        throw new EncounterConflictError(
          'The paused turn-effect batch completed prefix is incomplete.'
        )
      }
      appendStoredExecution({
        execution: storedExecution,
        candidate,
        character,
        state,
        retainedConditionIds,
        effectInput,
        pendingApplications,
        pendingEncounterActorApplications,
        executionStates,
        executions
      })
      if (storedExecution.lifecycle.kind === 'EXPIRE')
        stagedExpiredEffectIds.add(candidate.effect.id)
      continue
    }
    if (resumeContext && ordinal > resumeContext.currentCandidate.ordinal) {
      const expected =
        resumeContext.remainingCandidates[ordinal - resumeContext.currentCandidate.ordinal - 1]
      if (
        !expected ||
        !matchesPendingCandidate({
          expected,
          ordinal,
          candidate,
          character,
          state,
          requireTargetState: false
        })
      ) {
        throw new EncounterConflictError(
          'The paused turn-effect batch remaining candidates changed.'
        )
      }
    }
    if (
      resumeContext &&
      ordinal === resumeContext.currentCandidate.ordinal &&
      !matchesPendingCandidate({
        expected: resumeContext.currentCandidate,
        ordinal,
        candidate,
        character,
        state,
        requireTargetState: true
      })
    ) {
      throw new EncounterConflictError('The paused turn-effect current candidate is stale.')
    }
    const effectResult =
      input.resume && resumeContext && ordinal === resumeContext.currentCandidate.ordinal
        ? await resumeCharacterActiveRuleEffectWithPause({
            ...effectInput,
            continuation: input.resume.pendingSnapshot,
            resolution: turnEffectRawFaceResolutionDtoSchema.parse(input.resume.resolution),
            expectedEvidencePolicy: resumeContext.currentCandidate.d20Policy
          })
        : coordinatorRoot && input.encounter.automationMode === 'ASSISTED'
          ? await executeCharacterActiveRuleEffectWithPause(effectInput)
          : input.encounter.automationMode === 'AUTOMATIC'
            ? await (async () => {
                const started = await executeCharacterActiveRuleEffectWithPause(effectInput)
                if (!('continuation' in started)) return started
                if (!started.evidencePolicy) {
                  throw new EncounterConflictError(
                    'Automatic turn effect requested unsupported evidence.'
                  )
                }
                const count = started.evidencePolicy.rollMode === 'NORMAL' ? 1 : 2
                const roll = input.rollD20 ?? (() => randomInt(1, 21))
                return resumeCharacterActiveRuleEffectWithPause({
                  ...effectInput,
                  continuation: started.continuation,
                  resolution: {
                    requestId: started.continuation.request.requestId,
                    rawFaces: Array.from({ length: count }, () => roll())
                  },
                  expectedEvidencePolicy: started.evidencePolicy
                })
              })()
            : await executeCharacterActiveRuleEffect(effectInput)
    if ('continuation' in effectResult) {
      const stateForCandidate = {
        current: state.current,
        temporary: state.temporary,
        conditions: [...state.conditions],
        scalarValues: { ...state.scalarValues }
      }
      const remainingCandidates = candidates.slice(ordinal + 1).map((remaining, offset) => {
        const remainingCharacter =
          remaining.actor.kind === 'CHARACTER'
            ? lockedCharacters.get(remaining.actor.sourceId!)!
            : null
        const remainingState =
          executionStates.get(ownerKey(remaining.actor)) ??
          (remainingCharacter
            ? {
                current: remainingCharacter.mechanics.commandState.state.hitpoints.current,
                temporary: remainingCharacter.mechanics.commandState.state.hitpoints.temp ?? 0,
                scalarValues: {
                  ...(effectiveScalarValuesByActorId?.get(remaining.actor.id) ??
                    (() => {
                      throw new EncounterConflictError(
                        'The active-effect scalar target state is unavailable.'
                      )
                    })())
                },
                conditions: (remainingCharacter.mechanics.commandState.state.conditions ?? []).map(
                  (condition) => condition.conditionTypeId
                )
              }
            : {
                current: remaining.actor.currentHitPoints,
                temporary: remaining.actor.tempHitPoints,
                scalarValues: {
                  ...(effectiveScalarValuesByActorId?.get(remaining.actor.id) ??
                    (() => {
                      throw new EncounterConflictError(
                        'The active-effect scalar target state is unavailable.'
                      )
                    })())
                },
                conditions: readEncounterActorConditionState(remaining.actor.conditions ?? []).ids
              })
        return pendingCandidateSnapshot({
          ordinal: ordinal + offset + 1,
          candidate: remaining,
          state: remainingState,
          character: remainingCharacter
        })
      })
      return {
        kind: 'PENDING',
        pendingSnapshot: serverKernelRuleExecutionPendingSnapshotDtoSchema.parse({
          snapshotKind: 'KERNEL_EVIDENCE',
          ...effectResult.continuation,
          applicationContext: {
            kind: 'ENCOUNTER_TURN_ACTIVE_EFFECTS',
            schemaVersion: 1,
            root: { ...coordinatorRoot, commandType: input.commandType },
            selectionChecksum,
            currentCandidate: pendingCandidateSnapshot({
              ordinal,
              candidate,
              state: stateForCandidate,
              character,
              d20Policy: effectResult.evidencePolicy
            }),
            completedExecutions: executions,
            remainingCandidates
          }
        })
      }
    }
    const folded = foldCharacterMechanicsApplications({
      targetActorId: candidate.actor.id,
      currentHitPoints: state.current,
      temporaryHitPoints: state.temporary,
      maximumHitPoints: character?.maximumHitPoints ?? candidate.actor.maxHitPoints,
      scalarValues: state.scalarValues,
      conditionIds: state.conditions,
      retainedConditionIds,
      applications: effectResult.applications
    })
    if (
      actorRule?.targetProtection.status === 'NOT_NORMALIZED' &&
      effectResult.applications.some(
        (application) => application.kind === 'DAMAGE' || application.kind === 'CONDITION_APPLY'
      )
    ) {
      throw new EncounterValidationError(
        'Encounter actor target protections are not normalized for automatic damage or conditions.'
      )
    }
    executionStates.set(targetKey, {
      current: folded.after.currentHitPoints,
      temporary: folded.after.temporaryHitPoints,
      conditions: folded.after.conditionIds,
      scalarValues: { ...folded.after.scalarValues }
    })
    if (character) {
      pendingApplications.set(character.id, [
        ...(pendingApplications.get(character.id) ?? []),
        ...effectResult.applications
      ])
    } else {
      pendingEncounterActorApplications.set(candidate.actor.id, [
        ...(pendingEncounterActorApplications.get(candidate.actor.id) ?? []),
        ...effectResult.applications
      ])
    }
    executions.push({
      ordinal,
      boundaryOrdinal: candidate.boundary.ordinal,
      stage: candidate.boundary.stage,
      targetActorId: candidate.actor.id,
      owner: character
        ? { kind: 'CHARACTER', characterId: character.id }
        : { kind: 'ENCOUNTER_ACTOR' },
      activeEffectId: candidate.effect.id,
      createdOrdinal: candidate.effect.createdOrdinal,
      beforeVersion: candidate.effect.version,
      definition: {
        authoredEffectId: candidate.effect.definition.authoredEffectId,
        compiledEntryId: candidate.effect.definition.compiledEntryId,
        frozenGraphNodeId: candidate.effect.definition.frozenGraphNodeId,
        frozenSourceChecksum: candidate.effect.definition.frozenGraph.source.checksum,
        capabilityContractVersion:
          candidate.effect.definition.frozenGraph.capabilityContractVersion,
        definitionChecksum: candidate.effect.definitionChecksum
      },
      execution: effectResult.execution,
      d20: effectResult.d20 ?? null,
      targetTransition: {
        checksum: checksumRuleDocument({
          targetActorId: candidate.actor.id,
          ...folded.before
        }),
        before: folded.before,
        after: folded.after
      },
      applications: folded.applications,
      lifecycle:
        effectResult.lifecycle.kind === 'UPDATE'
          ? {
              kind: 'UPDATE',
              expectedVersion: effectResult.lifecycle.expectedVersion,
              afterVersion: effectResult.lifecycle.proposedAfterVersion,
              beforeRemainingTicks: effectResult.lifecycle.beforeRemainingTicks,
              afterRemainingTicks: effectResult.lifecycle.afterRemainingTicks,
              beforeLifecycleChecksum: effectResult.lifecycle.beforeLifecycleChecksum,
              afterLifecycleChecksum: effectResult.lifecycle.afterLifecycleChecksum
            }
          : {
              kind: 'EXPIRE',
              expectedVersion: effectResult.lifecycle.expectedVersion,
              beforeRemainingTicks: effectResult.lifecycle.beforeRemainingTicks,
              afterRemainingTicks: 0,
              beforeLifecycleChecksum: effectResult.lifecycle.beforeLifecycleChecksum
            }
    })
    if (effectResult.lifecycle.kind === 'EXPIRE') stagedExpiredEffectIds.add(candidate.effect.id)
  }

  for (const candidate of candidates) {
    const retainedConditionIds = retainedConditionIdsForEffect({
      effect: candidate.effect,
      ownerEffects: activeEffectsByActorId?.get(candidate.actor.id) ?? [],
      excludedEffectIds: stagedExpiredEffectIds
    })
    if (retainedConditionIds.length === 0) continue
    const current = new Set(retainedConditionIdsByActorId.get(candidate.actor.id) ?? [])
    retainedConditionIds.forEach((conditionId) => current.add(conditionId))
    retainedConditionIdsByActorId.set(candidate.actor.id, [...current].sort())
  }

  return {
    kind: 'READY',
    batch: {
      candidates,
      lockedCharacters,
      characterIds,
      encounterActorIds,
      encounterActors,
      effects,
      pendingApplications,
      pendingEncounterActorApplications,
      retainedConditionIdsByActorId,
      executionStates,
      initialEncounterActorConditions,
      executions,
      selectionChecksum
    }
  }
}

/**
 * Compatibility wrapper for the existing terminal-only turn path. The
 * dedicated Assisted coordinator consumes the evaluator directly instead.
 */
export async function executeEncounterTurnCharacterActiveEffects(
  input: Parameters<typeof evaluateEncounterTurnCharacterActiveEffects>[0]
): Promise<{
  result: StoredRuleExecutionResultDto | null
  selectionChecksum: string | null
}> {
  const evaluation = await evaluateEncounterTurnCharacterActiveEffects(input)
  if (evaluation.kind === 'TERMINAL')
    return {
      result: evaluation.result,
      selectionChecksum: evaluation.selectionChecksum
    }
  if (evaluation.kind === 'PENDING') {
    throw new EncounterConflictError(
      'Assisted turn-effect execution requires the dedicated occurrence coordinator.'
    )
  }
  return {
    selectionChecksum: evaluation.batch.selectionChecksum,
    result: await applyEvaluatedTurnEffectBatch({
      trx: input.trx,
      actorUserId: input.actorUserId,
      encounter: input.encounter,
      commandType: input.commandType,
      occurrenceId: input.occurrenceId,
      beforeApply: input.beforeTerminalApply,
      batch: evaluation.batch
    })
  }
}

/**
 * Re-locks and reconstructs a persisted staged turn phase immediately before
 * terminal application. Any changed candidate, source, lifecycle, or target
 * state is rejected by the same completed-execution validation used for an
 * Assisted resume.
 */
export async function restoreEvaluatedEncounterTurnEffectBatch(
  input: Parameters<typeof evaluateEncounterTurnCharacterActiveEffects>[0] & {
    stagedPlan: StagedTurnEffectPlanDto
  }
): Promise<EvaluatedTurnEffectBatch> {
  const evaluation = await evaluateEncounterTurnCharacterActiveEffects(input)
  if (evaluation.kind !== 'READY') {
    throw new EncounterConflictError('The staged turn-effect plan cannot be restored.')
  }
  return evaluation.batch
}

/** Test-only evaluator exposure; production command paths use the compatibility wrapper. */
export const __testOnlyTurnEffectEvaluator = {
  evaluate: evaluateEncounterTurnCharacterActiveEffects
}
