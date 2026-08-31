import {
  createActiveRuleEffectRepository,
  createEncounterRepository,
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
  executionStates: ReadonlyMap<string, { current: number; temporary: number; conditions: string[] }>
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
  | { kind: 'PENDING'; pendingSnapshot: ServerKernelRuleExecutionPendingSnapshotDto }

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
  return { kind: 'ENCOUNTER_ACTOR' as const, encounterId, targetActorId: actor.id }
}

function ownerKey(actor: EncounterActorRecord): string {
  return actor.kind === 'CHARACTER' ? `CHARACTER:${actor.sourceId}` : `ENCOUNTER_ACTOR:${actor.id}`
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

function pendingCandidateSnapshot(input: {
  ordinal: number
  candidate: TurnEffectCandidate
  state: { current: number; temporary: number; conditions: string[] }
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
  },
  right: {
    currentHitPoints: number
    temporaryHitPoints: number
    maximumHitPoints: number
    conditionIds: readonly string[]
  }
): boolean {
  return (
    left.currentHitPoints === right.currentHitPoints &&
    left.temporaryHitPoints === right.temporaryHitPoints &&
    left.maximumHitPoints === right.maximumHitPoints &&
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
  state: { current: number; temporary: number; conditions: string[] }
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
        conditionIds: input.state.conditions
      })
  )
}

function appendStoredExecution(input: {
  execution: BatchExecution
  candidate: TurnEffectCandidate
  character: LockedCharacter | null
  state: { current: number; temporary: number; conditions: string[] }
  effectInput: CharacterActiveRuleEffectExecutionInput
  pendingApplications: Map<string, readonly CharacterRuleActionApplication[]>
  pendingEncounterActorApplications: Map<string, readonly CharacterRuleActionApplication[]>
  executionStates: Map<string, { current: number; temporary: number; conditions: string[] }>
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
  if (remainingTicks === null) {
    throw new EncounterConflictError('A recurring turn effect must retain a finite lifecycle.')
  }
  const expectedAfterLifecycle =
    remainingTicks === 1 ? null : { schemaVersion: 1 as const, remainingTicks: remainingTicks - 1 }
  const lifecycleMatches =
    execution.lifecycle.kind === 'EXPIRE'
      ? remainingTicks === 1 &&
        execution.lifecycle.expectedVersion === candidate.effect.version &&
        execution.lifecycle.beforeRemainingTicks === 1 &&
        execution.lifecycle.afterRemainingTicks === 0 &&
        execution.lifecycle.beforeLifecycleChecksum === candidate.effect.lifecycleChecksum
      : expectedAfterLifecycle !== null &&
        execution.lifecycle.expectedVersion === candidate.effect.version &&
        execution.lifecycle.afterVersion === candidate.effect.version + 1 &&
        execution.lifecycle.beforeRemainingTicks === remainingTicks &&
        execution.lifecycle.afterRemainingTicks === expectedAfterLifecycle.remainingTicks &&
        execution.lifecycle.beforeLifecycleChecksum === candidate.effect.lifecycleChecksum &&
        execution.lifecycle.afterLifecycleChecksum === checksumRuleDocument(expectedAfterLifecycle)
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
    conditionIds: state.conditions,
    applications
  })
  const reconstructedFolded = foldCharacterMechanicsApplications({
    targetActorId: candidate.actor.id,
    currentHitPoints: state.current,
    temporaryHitPoints: state.temporary,
    maximumHitPoints: character?.maximumHitPoints ?? candidate.actor.maxHitPoints,
    conditionIds: state.conditions,
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
      checksumRuleDocument({ targetActorId: candidate.actor.id, ...folded.before }) ||
    JSON.stringify(execution.applications) !== JSON.stringify(folded.applications) ||
    JSON.stringify(execution.applications) !== JSON.stringify(reconstructedFolded.applications) ||
    JSON.stringify(execution.d20) !== JSON.stringify(reconstructed.d20 ?? null) ||
    !currentStateEquals(execution.targetTransition.after, reconstructedFolded.after) ||
    !currentStateEquals(execution.targetTransition.before, {
      currentHitPoints: state.current,
      temporaryHitPoints: state.temporary,
      maximumHitPoints: character?.maximumHitPoints ?? candidate.actor.maxHitPoints,
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
    conditions: [...execution.targetTransition.after.conditionIds]
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
  for (const characterId of input.batch.characterIds) {
    const applications = input.batch.pendingApplications.get(characterId)
    if (!applications) continue
    const character = input.batch.lockedCharacters.get(characterId)!
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
      applications,
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
    const applied = await applyLockedEncounterActorMechanicsBatch({
      trx: input.trx,
      targetActor: actor,
      initialConditionRows: initialConditions,
      applications
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
        lifecycle: { schemaVersion: 1, remainingTicks: execution.lifecycle.afterRemainingTicks }
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

  const targetActors = selected
    .filter(({ boundary, actor }) =>
      preliminaryEffects.get(ownerKey(actor))!.some((effect) =>
        isEligibleTurnEffect({
          effect,
          actor,
          stage: boundary.stage,
          encounterId: input.encounter.id
        })
      )
    )
    .map(({ actor }) => actor)
  const targetActorsByCharacter = new Map<string, EncounterActorRecord>()
  const targetEncounterActors = new Map<string, EncounterActorRecord>()
  for (const actor of targetActors) {
    if (actor.kind !== 'CHARACTER') {
      targetEncounterActors.set(actor.id, actor)
      continue
    }
    if (!actor.sourceId) throw new EncounterValidationError('Character effect owner is incomplete.')
    const prior = targetActorsByCharacter.get(actor.sourceId)
    if (prior && prior.id !== actor.id)
      throw new EncounterConflictError('A Character may appear only once in a turn-effect batch.')
    targetActorsByCharacter.set(actor.sourceId, actor)
  }
  const targetCharacterIds = [...targetActorsByCharacter.keys()].sort()
  const targetEncounterActorIds = [...targetEncounterActors.keys()].sort()

  const effects = activeEffects
  const effectsByCharacter = new Map<string, Awaited<ReturnType<typeof effects.lockByOwner>>>()
  for (const characterId of targetCharacterIds) {
    effectsByCharacter.set(
      characterId,
      await effects.lockByOwner({ kind: 'CHARACTER', characterId })
    )
  }
  const effectsByEncounterActor = new Map<string, Awaited<ReturnType<typeof effects.lockByOwner>>>()
  for (const targetActorId of targetEncounterActorIds) {
    effectsByEncounterActor.set(
      targetActorId,
      await effects.lockByOwner({
        kind: 'ENCOUNTER_ACTOR',
        encounterId: input.encounter.id,
        targetActorId
      })
    )
  }
  const candidates = selected
    .filter(({ actor }) =>
      actor.kind === 'CHARACTER'
        ? targetActorsByCharacter.has(actor.sourceId!)
        : targetEncounterActors.has(actor.id)
    )
    .flatMap(({ boundary, actor }) => {
      return (
        actor.kind === 'CHARACTER'
          ? effectsByCharacter.get(actor.sourceId!)!
          : effectsByEncounterActor.get(actor.id)!
      )
        .filter((effect) =>
          isEligibleTurnEffect({
            effect,
            actor,
            stage: boundary.stage,
            encounterId: input.encounter.id
          })
        )
        .map((effect) => ({ boundary, actor, effect }))
    })
    .sort(
      (left, right) =>
        left.boundary.ordinal - right.boundary.ordinal ||
        left.effect.createdOrdinal - right.effect.createdOrdinal ||
        left.effect.id.localeCompare(right.effect.id)
    )
  if (candidates.length > 128) {
    throw new EncounterValidationError('A turn may execute at most 128 active effects.')
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
  if (input.encounter.automationMode === 'MANUAL') {
    if (input.encounter.manualReminderMode === 'OFF') {
      return { kind: 'TERMINAL', result: null, selectionChecksum }
    }
    return {
      kind: 'TERMINAL',
      selectionChecksum,
      result: storedRuleExecutionResultDtoSchema.parse({
        status: 'MANUAL',
        occurrenceId: input.occurrenceId,
        occurrenceVersion: 0,
        reminder: { kind: 'MANUAL_RULE_REVIEW' }
      })
    }
  }
  if (!input.runtime) {
    throw new EncounterValidationError('A Rules runtime is required for active Character effects.')
  }
  if (input.resume && input.encounter.automationMode !== 'ASSISTED') {
    throw new EncounterConflictError(
      'Only Assisted turn-effect batches may resume a pending occurrence.'
    )
  }
  const targetState = await lockEncounterActiveEffectTargets({
    trx: input.trx,
    encounter: input.encounter,
    actors: candidates.map((candidate) => candidate.actor),
    attunementSlotOverride: input.attunementSlotOverride,
    getEncounterActorSnapshot: input.getEncounterActorSnapshot
  })
  const {
    characterIds,
    encounterActorIds,
    lockedCharacters,
    encounterActors,
    encounterActorRules
  } = targetState
  for (const candidate of candidates) {
    if (candidate.actor.kind !== 'CHARACTER') {
      candidate.actor = encounterActors.get(candidate.actor.id)!
    }
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
  const executionStates = new Map<
    string,
    { current: number; temporary: number; conditions: string[] }
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
            conditions: (character.mechanics.commandState.state.conditions ?? []).map(
              (condition) => condition.conditionTypeId
            )
          }
        : {
            current: candidate.actor.currentHitPoints,
            temporary: candidate.actor.tempHitPoints,
            conditions: actorConditions!.ids
          })
    const protections =
      actorRule?.targetProtection.status === 'NORMALIZED' ? actorRule.targetProtection : null
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
            statBlock: snapshotStatBlock(candidate.actor)
          },
      defenses: character?.overlay.rulePolicyOutput.defenses ?? protections?.defenses ?? [],
      conditionImmunityIds:
        character?.overlay.rulePolicyOutput.conditionImmunityIds ??
        protections?.conditionImmunityIds ??
        [],
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
        effectInput,
        pendingApplications,
        pendingEncounterActorApplications,
        executionStates,
        executions
      })
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
        effectInput,
        pendingApplications,
        pendingEncounterActorApplications,
        executionStates,
        executions
      })
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
        conditions: [...state.conditions]
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
                conditions: (remainingCharacter.mechanics.commandState.state.conditions ?? []).map(
                  (condition) => condition.conditionTypeId
                )
              }
            : {
                current: remaining.actor.currentHitPoints,
                temporary: remaining.actor.tempHitPoints,
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
      conditionIds: state.conditions,
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
      conditions: folded.after.conditionIds
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
        checksum: checksumRuleDocument({ targetActorId: candidate.actor.id, ...folded.before }),
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
    return { result: evaluation.result, selectionChecksum: evaluation.selectionChecksum }
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
