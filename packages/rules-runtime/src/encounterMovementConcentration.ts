import { RULE_GRAPH_LIMITS, checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounters'
import {
  serverKernelRuleExecutionPendingSnapshotDtoSchema,
  type ServerKernelRuleExecutionPendingSnapshotDto
} from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import {
  movementConcentrationExecutionDtoSchema,
  type MovementConcentrationExecutionDto
} from '@artificer-toolkit/schema/shared/ruleExecutionMovementConcentration'
import {
  checksumSpatialCurrentness,
  type FrozenMovementReactionRemainder
} from './encounterSpatialMovementRuleService.js'
import { nativeConcentrationDamageApplications } from './encounterConcentrationDamage.js'
import {
  createNativeConcentrationContext,
  completeNativeConcentrationResult,
  evaluateNativeConcentrationEvidence,
  type NativeConcentrationContext,
  type prepareEncounterConcentrationState
} from './encounterConcentration.js'
import { concentrationOccurrenceId } from './encounterConcentrationIdentity.js'
import { projectSpatialMovementCandidates } from './encounterSpatialMovementCurrentness.js'
import type { MovementTarget } from './encounterMovementTargets.js'
import type { ProjectableCharacterFacts } from './encounterActionProjection.js'
import type { RulesRuntimeService } from './rulesRuntimeService.js'

type DamageSource = { kind: 'SPATIAL' | 'REACTION'; executionOrdinal: number }
type DiceResolution = Extract<
  ResolveRuleOccurrenceInputDto['resolution'],
  { kind: 'ENTER_DICE' | 'SYSTEM_ROLL' }
>

/** Child receipts do not change the identity of the damage that caused them. */
export function movementDamageEnvelope<
  T extends { concentrationChecks?: MovementConcentrationExecutionDto[] }
>(execution: T) {
  const { concentrationChecks: _checks, ...envelope } = execution
  return envelope
}

export function movementConcentrationDamageSource(
  remainder: FrozenMovementReactionRemainder,
  source: DamageSource
) {
  const spatial = source.kind === 'SPATIAL' ? remainder.completedSpatialExecutions.at(-1) : null
  const reaction = source.kind === 'REACTION' ? remainder.completedReactionExecutions.at(-1) : null
  const execution = spatial ?? reaction
  if (!execution || execution.ordinal !== source.executionOrdinal)
    throw new Error('Movement Concentration requires the latest damaging contact.')
  const reactionApplication = reaction?.application
  const damage = nativeConcentrationDamageApplications(
    spatial
      ? [
          {
            targetActorId: spatial.candidate.candidate.targetActorId,
            applications: spatial.applications
          }
        ]
      : reactionApplication?.kind === 'CHARACTER_MECHANICS_BATCH' ||
          reactionApplication?.kind === 'ENCOUNTER_ACTOR_MECHANICS_BATCH'
        ? [reactionApplication]
        : [],
    true
  )
  const offset =
    (remainder.completedSpatialExecutions.length +
      remainder.completedReactionExecutions.length -
      1) *
    RULE_GRAPH_LIMITS.NODES
  return {
    execution,
    envelopeChecksum: checksumRuleDocument(movementDamageEnvelope(execution)),
    applications: damage.map((application) => ({
      ...application,
      ordinal: offset + application.ordinal
    }))
  }
}

export type MovementConcentrationSettlement = {
  state: EncounterRunState
  context: NativeConcentrationContext
  continuation: Parameters<typeof evaluateNativeConcentrationEvidence>[0]['continuation']
  execution: MovementConcentrationExecutionDto
  userId: string
  occurredAt: string
}

/** Forecast checks between contacts; only the Scene finish mutation applies these plans. */
export async function prepareEncounterMovementConcentration<
  TCharacterFacts extends ProjectableCharacterFacts,
  TProjection
>(
  input: {
    state: EncounterRunState
    occurrenceId: string
    sourceCommandId: string
    userId: string
    occurredAt: string
    remainder: FrozenMovementReactionRemainder
    source: DamageSource
    targets: ReadonlyMap<string, MovementTarget<TCharacterFacts>>
    projection?: TProjection
    retainedChecks?: readonly MovementConcentrationExecutionDto[]
    resume?: { snapshot: ServerKernelRuleExecutionPendingSnapshotDto; resolution: DiceResolution }
  },
  callbacks: {
    loadState(
      targetActorId: string,
      targets: ReadonlyMap<string, MovementTarget<TCharacterFacts>>,
      projection?: TProjection
    ): ReturnType<typeof prepareEncounterConcentrationState<MovementTarget<TCharacterFacts>>>
    runtime(): Promise<RulesRuntimeService>
    random(max: number): number
    projectEnd(
      context: NativeConcentrationContext,
      targets: ReadonlyMap<string, MovementTarget<TCharacterFacts>>,
      projection?: TProjection
    ): Promise<{
      targets: ReadonlyMap<string, MovementTarget<TCharacterFacts>>
      projection: TProjection
      cleanup: NonNullable<
        MovementConcentrationExecutionDto['result']['applicationOutputs']['cleanup']
      >
      ownerTransitions: MovementConcentrationExecutionDto['ownerTransitions']
    }>
  }
) {
  const source = movementConcentrationDamageSource(input.remainder, input.source)
  let remainder = input.remainder
  let targets = input.targets
  let projection = input.projection
  const settlements: MovementConcentrationSettlement[] = []
  const checks = [...(source.execution.concentrationChecks ?? [])]
  const phase = input.resume?.snapshot.applicationContext
  const frozen =
    phase?.kind === 'ENCOUNTER_MOVEMENT_REACTION' && phase.phase.kind === 'CONCENTRATION_EVIDENCE'
      ? phase.phase.concentration
      : null
  if (
    input.resume &&
    (!frozen ||
      phase?.kind !== 'ENCOUNTER_MOVEMENT_REACTION' ||
      phase.phase.kind !== 'CONCENTRATION_EVIDENCE' ||
      checksumRuleDocument(phase.phase.damageSource) !== checksumRuleDocument(input.source))
  )
    throw new Error('The issued movement Concentration phase is unavailable.')
  let remaining: NativeConcentrationContext['remaining'] = []
  if (frozen) {
    if (
      frozen.parentOccurrenceId !== input.occurrenceId ||
      frozen.parentCommandFingerprint !== remainder.root.commandFingerprint ||
      frozen.finalizedDamageEnvelopeChecksum !== source.envelopeChecksum
    )
      throw new Error('Movement Concentration damage evidence is stale.')
    remaining = [
      { ...frozen.application, maintainedStateId: frozen.maintainedState.id },
      ...frozen.remaining
    ]
    for (const { maintainedStateId: _stateId, ...application } of remaining)
      if (
        !source.applications.some(
          (value) => checksumRuleDocument(value) === checksumRuleDocument(application)
        )
      )
        throw new Error('Movement Concentration retained damage is unavailable.')
  } else if (input.state.automationMode !== 'MANUAL') {
    for (const application of source.applications) {
      const current = await callbacks.loadState(application.targetActorId, targets, projection)
      if (current) remaining.push({ ...application, maintainedStateId: current.maintained.id })
    }
  }
  const runtime = remaining.length ? await callbacks.runtime() : null
  let resume = input.resume
  while (remaining.length) {
    const { maintainedStateId, ...application } = remaining[0]!
    remaining = remaining.slice(1)
    const current = await callbacks.loadState(application.targetActorId, targets, projection)
    if (!current || current.maintained.id !== maintainedStateId)
      throw new Error('The movement Concentration state changed before its check.')
    const { context, facts } = createNativeConcentrationContext({
      current,
      parentOccurrenceId: input.occurrenceId,
      parentCommandFingerprint: remainder.root.commandFingerprint,
      application,
      remaining,
      finalizedDamageEnvelopeChecksum: source.envelopeChecksum
    })
    const occurrenceId = concentrationOccurrenceId(input.occurrenceId, application)
    const started = await runtime!.executeResolved({
      command: { definitionId: current.published.id, occurrenceId, facts },
      published: current.published
    })
    if (started.status !== 'PAUSED')
      throw new Error('Movement Concentration did not request bounded d20 evidence.')
    if (resume) {
      const {
        snapshotKind: _kind,
        applicationContext: _context,
        optionalCombatSnapshotChecksum: _policy,
        phaseReceipts: _receipts,
        deferredCleaving: _cleaving,
        ...continuation
      } = resume.snapshot
      if (
        checksumRuleDocument(context) !== checksumRuleDocument(frozen) ||
        checksumRuleDocument(continuation) !== checksumRuleDocument(started.continuation)
      )
        throw new Error('The movement Concentration facts or sealed check changed.')
    }
    const retained = input.retainedChecks?.find(
      (check) =>
        check.result.occurrenceId === occurrenceId &&
        check.sourceCommandId === input.sourceCommandId
    )
    if (input.state.automationMode === 'ASSISTED' && !resume) {
      if (retained)
        throw new Error('Movement Concentration cannot consume unissued player evidence.')
      const { currentSpatialCandidate: _candidate, ...movement } = remainder
      return {
        remainder,
        targets,
        projection,
        settlements,
        pendingSnapshot: serverKernelRuleExecutionPendingSnapshotDtoSchema.parse({
          ...started.continuation,
          snapshotKind: 'KERNEL_EVIDENCE',
          optionalCombatSnapshotChecksum: input.state.optionalCombatSnapshotChecksum,
          applicationContext: {
            kind: 'ENCOUNTER_MOVEMENT_REACTION',
            schemaVersion: 1,
            ...movement,
            reactionSelectionChecksum: checksumRuleDocument(movement.reactionTimeline),
            phase: {
              kind: 'CONCENTRATION_EVIDENCE',
              damageSource: input.source,
              concentration: context
            }
          }
        })
      }
    }
    if (input.retainedChecks && !retained)
      throw new Error('Prepared movement Concentration evidence is missing.')
    const resolution: DiceResolution = retained
      ? {
          kind: 'ENTER_DICE',
          requestId: started.continuation.request.requestId,
          rawFaces: retained.result.applicationOutputs.d20.rawFaces
        }
      : (resume?.resolution ?? {
          kind: 'SYSTEM_ROLL',
          requestId: started.continuation.request.requestId
        })
    const evidence = await evaluateNativeConcentrationEvidence({
      context,
      continuation: started.continuation,
      resolution,
      expectedOccurrenceId: occurrenceId,
      runtime: runtime!,
      random: callbacks.random
    })
    const ended = evidence.failed ? await callbacks.projectEnd(context, targets, projection) : null
    const execution = movementConcentrationExecutionDtoSchema.parse({
      sourceCommandId: input.sourceCommandId,
      result: completeNativeConcentrationResult({
        context,
        continuation: started.continuation,
        ...evidence,
        cleanup: ended?.cleanup ?? null,
        occurrenceVersion: 1,
        initialFactsChecksum: checksumRuleDocument(facts)
      }),
      ownerTransitions: ended?.ownerTransitions ?? []
    })
    if (retained && checksumRuleDocument(execution) !== checksumRuleDocument(retained))
      throw new Error('Prepared movement Concentration does not match current mechanics.')
    checks.push(execution)
    settlements.push({
      state: input.state,
      context,
      continuation: started.continuation,
      execution,
      userId: input.userId,
      occurredAt: input.occurredAt
    })
    if (ended) {
      const candidates = projectSpatialMovementCandidates({
        candidates: remainder.remainingSpatialCandidates,
        beforeTargets: targets,
        afterTargets: ended.targets
      })
      targets = ended.targets
      projection = ended.projection
      remaining = remaining.filter((entry) => entry.maintainedStateId !== maintainedStateId)
      remainder = {
        ...remainder,
        remainingSpatialCandidates: candidates,
        spatialCurrentnessChecksum: checksumSpatialCurrentness({
          encounter: input.state,
          candidates
        })
      }
    }
    const completedSpatialExecutions = remainder.completedSpatialExecutions.map((entry) =>
      input.source.kind === 'SPATIAL' && entry.ordinal === input.source.executionOrdinal
        ? { ...entry, concentrationChecks: [...checks] }
        : entry
    )
    remainder = {
      ...remainder,
      completedSpatialExecutions,
      completedReactionExecutions: remainder.completedReactionExecutions.map((entry) =>
        input.source.kind === 'REACTION' && entry.ordinal === input.source.executionOrdinal
          ? { ...entry, concentrationChecks: [...checks] }
          : entry
      ),
      appliedSpatialPrefix:
        remainder.appliedSpatialPrefix?.status === 'BATCH_COMPLETE' &&
        remainder.appliedSpatialPrefix.batchKind === 'ENCOUNTER_SPATIAL_MOVEMENT'
          ? { ...remainder.appliedSpatialPrefix, executions: completedSpatialExecutions }
          : remainder.appliedSpatialPrefix
    }
    resume = undefined
  }
  if (
    input.retainedChecks
      ?.filter((check) => check.sourceCommandId === input.sourceCommandId)
      .some(
        (check) => !checks.some((value) => value.result.occurrenceId === check.result.occurrenceId)
      )
  )
    throw new Error('Prepared movement Concentration contains unused check evidence.')
  return { remainder, targets, projection, settlements, pendingSnapshot: null }
}
