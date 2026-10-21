import { RULE_GRAPH_LIMITS, checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import {
  requireMaintainedDamageApplications,
  type ConcentrationMaintainedDamageApplicationDto
} from '@artificer-toolkit/schema/shared/ruleExecutionConcentration'
import type { EncounterEvidenceAnswer } from './encounterEvidenceAnswer.js'
import {
  serverKernelRuleExecutionPendingSnapshotDtoSchema,
  type ServerKernelRuleExecutionPendingSnapshotDto
} from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import {
  movementConcentrationEndDtoSchema,
  movementConcentrationExecutionDtoSchema,
  type MovementConcentrationEndDto,
  type MovementConcentrationExecutionDto
} from '@artificer-toolkit/schema/shared/ruleExecutionMovementConcentration'
import {
  checksumSpatialCurrentness,
  type FrozenMovementReactionRemainder
} from './encounterSpatialMovementRuleService.js'
import {
  nativeActionDamage,
  nativeConcentrationDamageApplications
} from './encounterConcentrationDamage.js'
import {
  concentrationSaveApplications,
  createNativeConcentrationContext,
  completeNativeConcentrationResult,
  evaluateNativeConcentrationEvidence,
  type NativeConcentrationContext,
  type prepareEncounterConcentrationState
} from './encounterConcentration.js'
import {
  concentrationEndOccurrenceId,
  concentrationOccurrenceId
} from './encounterConcentrationIdentity.js'
import { projectSpatialMovementCandidates } from './encounterSpatialMovementCurrentness.js'
import type { MovementTarget } from './encounterMovementTargets.js'
import type { ProjectableCharacterFacts } from './encounterActionProjection.js'
import type { RulesRuntimeService } from './rulesRuntimeService.js'
import type { EncounterAutoRollByActorId } from './encounterEvidenceMode.js'

type DamageSource = { kind: 'SPATIAL' | 'REACTION'; executionOrdinal: number }
type DiceResolution = Exclude<EncounterEvidenceAnswer, { kind: 'ENTER_INTEGER' }>

/** Child receipts do not change the identity of the damage that caused them. */
export function movementDamageEnvelope<
  T extends {
    concentrationChecks?: MovementConcentrationExecutionDto[]
    concentrationEnds?: MovementConcentrationEndDto[]
  }
>(execution: T) {
  const { concentrationChecks: _checks, concentrationEnds: _ends, ...envelope } = execution
  return envelope
}

function movementConcentrationDamageSource(
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
        ? nativeActionDamage(reactionApplication)
        : [],
    true
  )
  const holderActorId = spatial
    ? spatial.candidate.candidate.targetActorId
    : reactionApplication?.kind === 'CHARACTER_MECHANICS_BATCH' ||
        reactionApplication?.kind === 'ENCOUNTER_ACTOR_MECHANICS_BATCH'
      ? reactionApplication.targetActorId
      : null
  const offset =
    (remainder.completedSpatialExecutions.length +
      remainder.completedReactionExecutions.length -
      1) *
    RULE_GRAPH_LIMITS.NODES
  return {
    execution,
    holderActorId,
    envelopeChecksum: checksumRuleDocument(movementDamageEnvelope(execution)),
    applications: damage.map((application) => ({
      ...application,
      ordinal: offset + application.ordinal
    }))
  }
}

/** One contact's Concentration children settle in order: its end first, then each check. */
export type MovementConcentrationSettlement =
  | { kind: 'END'; execution: MovementConcentrationEndDto }
  | {
      kind: 'CHECK'
      state: EncounterRunState
      context: NativeConcentrationContext
      continuation: Parameters<typeof evaluateNativeConcentrationEvidence>[0]['continuation']
      execution: MovementConcentrationExecutionDto
      userId: string
      occurredAt: string
    }

type MovementMaintainedStateRef = NativeConcentrationContext['maintainedState']
type MovementConcentrationProjectedEnd<
  TCharacterFacts extends ProjectableCharacterFacts,
  TProjection
> = {
  targets: ReadonlyMap<string, MovementTarget<TCharacterFacts>>
  projection: TProjection
  cleanup: NonNullable<MovementConcentrationExecutionDto['result']['applicationOutputs']['cleanup']>
  ownerTransitions: MovementConcentrationExecutionDto['ownerTransitions']
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
    /** The roller's auto-roll preference; the initiator rolls Concentration in this slice. */
    autoRoll: EncounterAutoRollByActorId
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
    /** The holder's slot when the contact left it defeated or unable to act (D95), else null. */
    findEnd(
      actorId: string,
      targets: ReadonlyMap<string, MovementTarget<TCharacterFacts>>,
      projection?: TProjection
    ): Promise<{
      maintainedState: MovementMaintainedStateRef
      reason: MovementConcentrationEndDto['result']['applicationOutputs']['reason']
    } | null>
    projectEnd(
      end: { actorId: string; maintainedState: MovementMaintainedStateRef },
      targets: ReadonlyMap<string, MovementTarget<TCharacterFacts>>,
      projection?: TProjection
    ): Promise<MovementConcentrationProjectedEnd<TCharacterFacts, TProjection>>
  }
) {
  const source = movementConcentrationDamageSource(input.remainder, input.source)
  let remainder = input.remainder
  let targets = input.targets
  let projection = input.projection
  const settlements: MovementConcentrationSettlement[] = []
  const checks = [...(source.execution.concentrationChecks ?? [])]
  let end = source.execution.concentrationEnd
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
  let remaining: ConcentrationMaintainedDamageApplicationDto[] = []
  /** The projection after a Concentration slot is lost: later checks and contacts observe it. */
  const adoptEnd = (
    ended: { targets: typeof targets; projection: TProjection },
    maintainedStateId: string
  ) => {
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
  /** The source contact retains its end and checks beside its (unchanged) damage envelope. */
  const retainChildren = () => {
    const children = {
      ...(end ? { concentrationEnd: end } : {}),
      ...(checks.length ? { concentrationChecks: [...checks] } : {})
    }
    const completedSpatialExecutions = remainder.completedSpatialExecutions.map((entry) =>
      input.source.kind === 'SPATIAL' && entry.ordinal === input.source.executionOrdinal
        ? { ...entry, ...children }
        : entry
    )
    remainder = {
      ...remainder,
      completedSpatialExecutions,
      completedReactionExecutions: remainder.completedReactionExecutions.map((entry) =>
        input.source.kind === 'REACTION' && entry.ordinal === input.source.executionOrdinal
          ? { ...entry, ...children }
          : entry
      ),
      appliedSpatialPrefix:
        remainder.appliedSpatialPrefix?.status === 'BATCH_COMPLETE' &&
        remainder.appliedSpatialPrefix.batchKind === 'ENCOUNTER_SPATIAL_MOVEMENT'
          ? { ...remainder.appliedSpatialPrefix, executions: completedSpatialExecutions }
          : remainder.appliedSpatialPrefix
    }
  }
  if (frozen) {
    if (
      frozen.parentOccurrenceId !== input.occurrenceId ||
      frozen.parentCommandFingerprint !== remainder.root.commandFingerprint ||
      frozen.finalizedDamageEnvelopeChecksum !== source.envelopeChecksum
    )
      throw new Error('Movement Concentration damage evidence is stale.')
    remaining = [
      { ...frozen.application, maintainedStateId: frozen.maintainedState.id },
      ...requireMaintainedDamageApplications(frozen.remaining)
    ]
    for (const { maintainedStateId: _stateId, ...application } of remaining)
      if (
        !source.applications.some(
          (value) => checksumRuleDocument(value) === checksumRuleDocument(application)
        )
      )
        throw new Error('Movement Concentration retained damage is unavailable.')
  } else if (input.state.automationMode !== 'MANUAL') {
    // D95: a holder the contact defeated or left unable to act loses Concentration with no check,
    // so the checks below observe the lost slot and roll none for it.
    const found = source.holderActorId
      ? await callbacks.findEnd(source.holderActorId, targets, projection)
      : null
    if (source.holderActorId && found) {
      const ended = await callbacks.projectEnd(
        { actorId: source.holderActorId, maintainedState: found.maintainedState },
        targets,
        projection
      )
      const occurrenceId = concentrationEndOccurrenceId(
        input.occurrenceId,
        found.maintainedState.id
      )
      end = movementConcentrationEndDtoSchema.parse({
        sourceCommandId: input.sourceCommandId,
        result: {
          occurrenceId,
          applicationOutputs: {
            kind: 'CONCENTRATION_END',
            schemaVersion: 1,
            occurrenceId,
            parentOccurrenceId: input.occurrenceId,
            ownerActorId: source.holderActorId,
            maintainedStateId: found.maintainedState.id,
            reason: found.reason,
            cleanup: ended.cleanup
          }
        },
        ownerTransitions: ended.ownerTransitions
      })
      settlements.push({ kind: 'END', execution: end })
      adoptEnd(ended, found.maintainedState.id)
      retainChildren()
    }
    const maintainedStateIds = new Map<string, string>()
    for (const { targetActorId } of source.applications) {
      const current = await callbacks.loadState(targetActorId, targets, projection)
      if (current) maintainedStateIds.set(targetActorId, current.maintained.id)
    }
    remaining.push(
      ...concentrationSaveApplications({
        gameSystemId: input.state.gameSystemId,
        applications: source.applications,
        maintainedStateIds,
        damagerActorId: null,
        dispositions: new Map()
      })
    )
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
      gameSystemId: input.state.gameSystemId,
      current,
      parentOccurrenceId: input.occurrenceId,
      parentCommandFingerprint: remainder.root.commandFingerprint,
      application,
      remaining,
      finalizedDamageEnvelopeChecksum: source.envelopeChecksum,
      // Movement contacts carry no display name yet; their checks name only the damage.
      sourceLabels: []
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
    if (input.autoRoll[context.application.targetActorId] !== true && !resume) {
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
          rawFaces: retained.result.applicationOutputs.d20.rawFaces,
          rollMode: retained.result.applicationOutputs.d20.rollMode
        }
      : (resume?.resolution ?? {
          kind: 'AUTO_ROLL',
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
    const ended = evidence.failed
      ? await callbacks.projectEnd(
          { actorId: application.targetActorId, maintainedState: context.maintainedState },
          targets,
          projection
        )
      : null
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
      kind: 'CHECK',
      state: input.state,
      context,
      continuation: started.continuation,
      execution,
      userId: input.userId,
      occurredAt: input.occurredAt
    })
    if (ended) adoptEnd(ended, maintainedStateId)
    retainChildren()
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
