import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounters'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { SceneSpatialPreparation } from '@artificer-toolkit/schema/projections/sceneSpatialPreparation'
import type {
  ServerKernelRuleExecutionPendingSnapshotDto,
  ServerRuleExecutionPendingApplicationContextDto,
  ServerRuleExecutionPendingSnapshotDto
} from '@artificer-toolkit/schema/shared/rulesExecution'
import { requireServerKernelRuleExecutionPendingSnapshot } from '@artificer-toolkit/schema/shared/rulesExecution'
import type { SceneToken } from '@artificer-toolkit/shared/vtt/scene'
import type { ProjectableCharacterFacts } from './encounterActionProjection.js'
import type {
  MovementCharacterRow,
  MovementMaintenanceProjection
} from './encounterMovementMaintenance.js'
import { bindEncounterMovementMaintenancePending } from './encounterMovementMaintenance.js'
import type { MovementReactionSettlementInput } from './encounterMovementReactionPlan.js'
import type { RulesRuntimeService } from './rulesRuntimeService.js'
import type { EncounterMovementReactionContact } from './encounterMovementReactionContacts.js'
import type { EncounterMovementReactionSource } from './encounterMovementReactionSources.js'
import type { executeEncounterMovementReactionAction } from './encounterMovementReactionExecution.js'
import { retainNativeMovementLegendaryResistance } from './encounterMovementLegendaryResistance.js'
import type { revalidateEncounterMovementReactionOption } from './encounterMovementReactionDiscovery.js'
import type { MovementConcentrationExecutionDto } from '@artificer-toolkit/schema/shared/ruleExecutionMovementConcentration'
import {
  appendEncounterMovementReactionActionEvidenceCommand,
  appendEncounterMovementReactionResolutionCommand,
  movementReactionRemainderAfterCompletedAction,
  movementReactionRemainderAfterCurrentChoice,
  resolveEncounterMovementReactionChoice,
  retainEncounterMovementReactionActionEvidence
} from './encounterMovementReactionContinuation.js'
import {
  checksumSpatialCurrentness,
  type FrozenMovementReactionRemainder
} from './encounterSpatialMovementRuleService.js'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { projectSpatialMovementCandidates } from './encounterSpatialMovementCurrentness.js'
import { planNativeSpatialMovementPrefix } from './encounterSpatialMovementPlan.js'
import type { MovementTarget } from './encounterMovementTargets.js'
import { movementDamageEnvelope } from './encounterMovementConcentration.js'
import {
  retainedMovementReactionExecutions,
  retainedMovementSpatialExecutions
} from './encounterMovementContinuation.js'
import {
  stopSceneMovementResult,
  type MovementContinuationInput
} from './encounterMovementContinuation.js'

type Outcome = Exclude<SceneSpatialPreparation['outcome'], { kind: 'UNINTERRUPTED' }>
type ReactionContext = Extract<
  ServerKernelRuleExecutionPendingSnapshotDto['applicationContext'],
  { kind: 'ENCOUNTER_MOVEMENT_REACTION' }
>
type ReactionExecution = Awaited<ReturnType<typeof executeEncounterMovementReactionAction>>
type CompletedReaction = Extract<ReactionExecution, { kind: 'COMPLETE' }>
type ReactionSettlement<TPrepared> = {
  prepared: TPrepared
  occurrenceId: string
  commandId: string
  ordinal: number
  occurredAt: string
  execution: CompletedReaction
}
type ResponseSettlement<TPrepared, TConcentrationPlan, TContinuationSettlement> =
  | { kind: 'REACTION'; plan: ReactionSettlement<TPrepared> }
  | { kind: 'CONCENTRATION'; plan: TConcentrationPlan }
  | TContinuationSettlement

function projectedTargetsAfterSpatialPrefix<
  TCharacterFacts extends ProjectableCharacterFacts
>(input: {
  context: ReactionContext
  targets: ReadonlyMap<string, MovementTarget<TCharacterFacts>>
  state: EncounterRunState
  occurrenceId: string
  userId: string
  occurredAt: string
}) {
  const appliedCount =
    input.context.appliedSpatialPrefix?.status === 'BATCH_COMPLETE' &&
    input.context.appliedSpatialPrefix.batchKind === 'ENCOUNTER_SPATIAL_MOVEMENT'
      ? input.context.appliedSpatialPrefix.executions.length
      : 0
  const executions = input.context.completedSpatialExecutions.slice(appliedCount)
  if (!executions.length) return input.targets
  return planNativeSpatialMovementPrefix({
    targets: input.targets,
    executions,
    encounterId: input.state.id,
    expectedEncounterVersion: input.state.version,
    campaignId: input.state.campaignId,
    gameSystemId: input.state.gameSystemId,
    occurrenceId: input.occurrenceId,
    sourceCommandId: input.context.root.commandId,
    occurredAt: input.occurredAt,
    userId: input.userId
  }).projectedTargets
}

/** Reconstructs the selected action before the enclosing Scene transaction publishes its plan. */
export async function evaluateEncounterMovementActionResponse<
  TCharacterFacts extends ProjectableCharacterFacts,
  TRow extends MovementCharacterRow,
  TPrepared extends MovementReactionSettlementInput<TCharacterFacts, TRow>['prepared'],
  TPlan extends {
    reactionExecution: FrozenMovementReactionRemainder['completedReactionExecutions'][number]
    projectedTargets: ReadonlyMap<string, MovementTarget<TCharacterFacts>>
    maintenanceProjection?: MovementMaintenanceProjection<TRow>
  },
  TConcentrationPlan,
  TContinuationSettlement
>(
  input: {
    state: EncounterRunState
    snapshot: ServerRuleExecutionPendingSnapshotDto
    context: ServerRuleExecutionPendingApplicationContextDto
    resolution: ResolveRuleOccurrenceInputDto['resolution']
    occurrenceId: string
    occurrenceVersion: number
    userId: string
    /** The roller's auto-roll preference; the responding user rolls in this slice. */
    autoRoll: boolean
    responseCommand: ReactionContext['root']['resolutionCommands'][number]
    occurredAt: string
    runtime: RulesRuntimeService
    sceneTokens: readonly SceneToken[]
    actorIdByTokenId: ReadonlyMap<string, string>
    resolvePerception: (
      contact: EncounterMovementReactionContact<EncounterMovementReactionSource>
    ) => Promise<boolean>
    targets: ReadonlyMap<string, MovementTarget<TCharacterFacts>>
    retained?: Outcome
  },
  callbacks: {
    prepareReaction(input: {
      encounterId: string
      expectedEncounterVersion: number
      movementKind: ReactionContext['root']['movementKind']
      occurrenceId: string
      option: Parameters<typeof revalidateEncounterMovementReactionOption>[0]['option']
      actorIdByTokenId: ReadonlyMap<string, string>
      tokens: readonly SceneToken[]
      resolvePerception: Parameters<
        typeof revalidateEncounterMovementReactionOption
      >[0]['resolvePerception']
      targets: ReadonlyMap<string, MovementTarget<TCharacterFacts>>
      maintenanceProjection?: MovementMaintenanceProjection<TRow>
    }): Promise<TPrepared>
    replayReaction(input: {
      runtime: RulesRuntimeService
      occurrenceId: string
      prepared: TPrepared
      retained:
        | { kind: 'PENDING'; snapshot: ServerKernelRuleExecutionPendingSnapshotDto }
        | {
            kind: 'COMPLETE'
            receipt: FrozenMovementReactionRemainder['completedReactionExecutions'][number]
          }
      issuedSnapshot?: ServerKernelRuleExecutionPendingSnapshotDto
    }): Promise<ReactionExecution>
    executeReaction(input: {
      runtime: RulesRuntimeService
      occurrenceId: string
      prepared: TPrepared
      autoRoll: boolean
      resume?: {
        pending: Extract<ReactionExecution, { kind: 'PENDING' }>
        resolution: Extract<
          ResolveRuleOccurrenceInputDto['resolution'],
          { kind: 'ENTER_DICE' | 'ENTER_INTEGER' | 'SYSTEM_ROLL' }
        >
      }
    }): Promise<ReactionExecution>
    resumeResistance(input: {
      runtime: RulesRuntimeService
      occurrenceId: string
      prepared: TPrepared
      autoRoll: boolean
      snapshot: ServerKernelRuleExecutionPendingSnapshotDto
      selection: Extract<
        ResolveRuleOccurrenceInputDto['resolution'],
        { kind: 'OPTION' | 'DECLINE' }
      >
      retainedExecution?: ReactionExecution
    }): Promise<Exclude<ReactionExecution, { kind: 'LEGENDARY_RESISTANCE' }>>
    planReaction(input: ReactionSettlement<TPrepared>, userId: string): TPlan
    prepareConcentration(input: {
      state: EncounterRunState
      occurrenceId: string
      sourceCommandId: string
      userId: string
      occurredAt: string
      remainder: FrozenMovementReactionRemainder
      targets: ReadonlyMap<string, MovementTarget<TCharacterFacts>>
      projection?: MovementMaintenanceProjection<TRow>
      source: { kind: 'SPATIAL' | 'REACTION'; executionOrdinal: number }
      retainedChecks?: readonly MovementConcentrationExecutionDto[]
      resume?: {
        snapshot: ServerKernelRuleExecutionPendingSnapshotDto
        resolution: Extract<
          ResolveRuleOccurrenceInputDto['resolution'],
          { kind: 'ENTER_DICE' | 'SYSTEM_ROLL' }
        >
      }
    }): Promise<{
      remainder: FrozenMovementReactionRemainder
      targets: ReadonlyMap<string, MovementTarget<TCharacterFacts>>
      projection?: MovementMaintenanceProjection<TRow>
      settlements: readonly TConcentrationPlan[]
      pendingSnapshot: ServerRuleExecutionPendingSnapshotDto | null
    }>
    continueMovement(
      input: MovementContinuationInput<TCharacterFacts, MovementMaintenanceProjection<TRow>>
    ): Promise<{
      outcome: SceneSpatialPreparation['outcome']
      settlements: readonly TContinuationSettlement[]
    }>
  }
): Promise<{
  outcome: Outcome
  settlements: ResponseSettlement<TPrepared, TConcentrationPlan, TContinuationSettlement>[]
  resolutionCommands: ReactionContext['root']['resolutionCommands']
}> {
  const { responseCommand, occurredAt } = input
  if (input.context.kind !== 'ENCOUNTER_MOVEMENT_REACTION')
    throw new Error('Movement action response requires an issued reaction.')
  const context = input.context
  const snapshot = requireServerKernelRuleExecutionPendingSnapshot(input.snapshot)
  const root = context.root
  const { runtime, resolution } = input
  const settlements: ResponseSettlement<TPrepared, TConcentrationPlan, TContinuationSettlement>[] =
    []
  let maintenanceProjection: MovementMaintenanceProjection<TRow> | undefined
  const token = input.sceneTokens.find((entry) => entry.id === root.tokenId)
  if (!token) throw new Error('Movement reaction token is unavailable.')
  let targets =
    context.phase.kind === 'SPATIAL_EVIDENCE'
      ? input.targets
      : projectedTargetsAfterSpatialPrefix({
          context,
          targets: input.targets,
          state: input.state,
          occurrenceId: input.occurrenceId,
          userId: input.userId,
          occurredAt
        })
  let remainder: FrozenMovementReactionRemainder
  let resolutionCommands: ReactionContext['root']['resolutionCommands']
  let selectedOptionId: string | null = null
  let concentrationSource: { kind: 'SPATIAL' | 'REACTION'; executionOrdinal: number } | null = null
  let stopAfterReaction = false
  if (context.phase.kind === 'CHOICE') {
    if (resolution.kind !== 'OPTION' && resolution.kind !== 'DECLINE')
      throw new Error('Movement response does not match the issued reaction choice.')
    resolutionCommands = appendEncounterMovementReactionResolutionCommand({
      history: root.resolutionCommands,
      command: responseCommand,
      selection: resolution,
      actorUserId: input.userId,
      proposedOccurrenceVersion: input.occurrenceVersion + 1
    })
    const selected = await resolveEncounterMovementReactionChoice({
      runtime,
      pendingSnapshot: snapshot,
      selection: resolution
    })
    if (selected.kind === 'SELECTED') selectedOptionId = selected.option.optionId
    remainder = movementReactionRemainderAfterCurrentChoice({
      context,
      resolutionCommands
    })
  } else if (context.phase.kind === 'ACTION_EVIDENCE') {
    if (
      resolution.kind !== 'ENTER_DICE' &&
      resolution.kind !== 'ENTER_INTEGER' &&
      resolution.kind !== 'SYSTEM_ROLL'
    )
      throw new Error('Movement response does not match the issued action evidence.')
    resolutionCommands = appendEncounterMovementReactionActionEvidenceCommand({
      history: root.resolutionCommands,
      command: responseCommand,
      actorUserId: input.userId,
      proposedOccurrenceVersion: input.occurrenceVersion + 1
    })
    selectedOptionId = context.phase.selectedOptionId
    remainder = {
      root: { ...root, resolutionCommands },
      spatialSelectionChecksum: context.spatialSelectionChecksum,
      spatialCurrentnessChecksum: context.spatialCurrentnessChecksum,
      completedSpatialExecutions: [...context.completedSpatialExecutions],
      appliedSpatialPrefix: context.appliedSpatialPrefix,
      completedReactionExecutions: context.completedReactionExecutions,
      currentSpatialCandidate: null,
      remainingSpatialCandidates: [...context.remainingSpatialCandidates],
      reactionTimeline: context.reactionTimeline
    }
  } else if (context.phase.kind === 'CONCENTRATION_EVIDENCE') {
    if (resolution.kind !== 'ENTER_DICE' && resolution.kind !== 'SYSTEM_ROLL')
      throw new Error('Movement response does not match the issued Concentration evidence.')
    resolutionCommands = appendEncounterMovementReactionActionEvidenceCommand({
      history: root.resolutionCommands,
      command: responseCommand,
      actorUserId: input.userId,
      proposedOccurrenceVersion: input.occurrenceVersion + 1
    })
    remainder = {
      root: { ...root, resolutionCommands },
      spatialSelectionChecksum: context.spatialSelectionChecksum,
      spatialCurrentnessChecksum: context.spatialCurrentnessChecksum,
      completedSpatialExecutions: [...context.completedSpatialExecutions],
      appliedSpatialPrefix: context.appliedSpatialPrefix,
      completedReactionExecutions: [...context.completedReactionExecutions],
      currentSpatialCandidate: null,
      remainingSpatialCandidates: [...context.remainingSpatialCandidates],
      reactionTimeline: context.reactionTimeline
    }
    concentrationSource = context.phase.damageSource
    stopAfterReaction =
      concentrationSource.kind === 'REACTION' &&
      context.completedReactionExecutions.at(-1)?.execution.movementInterruption?.kind === 'STOP'
  } else if (context.phase.kind === 'LEGENDARY_RESISTANCE_CHOICE') {
    if (resolution.kind !== 'OPTION' && resolution.kind !== 'DECLINE')
      throw new Error('Movement response does not match the issued Legendary Resistance choice.')
    resolutionCommands = appendEncounterMovementReactionResolutionCommand({
      history: root.resolutionCommands,
      command: responseCommand,
      selection: resolution,
      actorUserId: input.userId,
      proposedOccurrenceVersion: input.occurrenceVersion + 1
    })
    selectedOptionId = context.phase.selectedOptionId
    remainder = {
      root: { ...root, resolutionCommands },
      spatialSelectionChecksum: context.spatialSelectionChecksum,
      spatialCurrentnessChecksum: context.spatialCurrentnessChecksum,
      completedSpatialExecutions: [...context.completedSpatialExecutions],
      appliedSpatialPrefix: context.appliedSpatialPrefix,
      completedReactionExecutions: context.completedReactionExecutions,
      currentSpatialCandidate: null,
      remainingSpatialCandidates: [...context.remainingSpatialCandidates],
      reactionTimeline: context.reactionTimeline
    }
  } else if (context.phase.kind === 'SPATIAL_EVIDENCE') {
    if (resolution.kind !== 'ENTER_DICE' && resolution.kind !== 'SYSTEM_ROLL')
      throw new Error('Movement response does not match the issued spatial evidence.')
    // The spatial evaluator verifies this command against the issued request and history.
    resolutionCommands = [...root.resolutionCommands, responseCommand]
    remainder = {
      root: { ...root, resolutionCommands },
      spatialSelectionChecksum: context.spatialSelectionChecksum,
      spatialCurrentnessChecksum: context.spatialCurrentnessChecksum,
      completedSpatialExecutions: [...context.completedSpatialExecutions],
      appliedSpatialPrefix: context.appliedSpatialPrefix,
      completedReactionExecutions: context.completedReactionExecutions,
      currentSpatialCandidate: context.phase.currentCandidate,
      remainingSpatialCandidates: [...context.remainingSpatialCandidates],
      reactionTimeline: context.reactionTimeline
    }
  } else throw new Error('Movement action response does not match the issued phase.')

  if (selectedOptionId !== null) {
    const entry = context.reactionTimeline[0]
    const option = (
      entry?.kind === 'AUTOMATIC_ACTION' ? [entry.option] : (entry?.group.options ?? [])
    ).find((value) => value.optionId === selectedOptionId)
    if (!option) throw new Error('The selected movement reaction was not issued.')
    const prepared = await callbacks.prepareReaction({
      encounterId: input.state.id,
      expectedEncounterVersion: input.state.version,
      movementKind: root.movementKind,
      occurrenceId: input.occurrenceId,
      option,
      actorIdByTokenId: input.actorIdByTokenId,
      tokens: input.sceneTokens,
      resolvePerception: input.resolvePerception,
      targets,
      maintenanceProjection
    })
    const prior =
      context.phase.kind === 'ACTION_EVIDENCE' && !input.retained
        ? await callbacks.replayReaction({
            runtime,
            occurrenceId: input.occurrenceId,
            prepared,
            retained: { kind: 'PENDING', snapshot }
          })
        : null
    if (prior && prior.kind !== 'PENDING') throw new Error('The issued action is already complete.')
    const retainedContext =
      input.retained?.kind === 'PENDING' ? input.retained.pendingSnapshot.applicationContext : null
    const retainedExecutions = input.retained
      ? retainedMovementReactionExecutions(input.retained)
      : []
    const retainedReceipt = retainedExecutions?.find(
      (entry) =>
        entry.sourceCommandId === responseCommand.commandId &&
        entry.option.optionId === option.optionId
    )
    const retainedPending =
      input.retained?.kind === 'PENDING' &&
      retainedContext?.kind === 'ENCOUNTER_MOVEMENT_REACTION' &&
      (retainedContext.phase.kind === 'ACTION_EVIDENCE' ||
        retainedContext.phase.kind === 'LEGENDARY_RESISTANCE_CHOICE') &&
      retainedContext.phase.selectedOptionId === option.optionId
        ? requireServerKernelRuleExecutionPendingSnapshot(input.retained.pendingSnapshot)
        : null
    if (input.retained && !retainedReceipt && !retainedPending)
      throw new Error('Prepared movement action evidence is unavailable.')
    const actionContext = { ...context, root: { ...root, resolutionCommands } }
    const legendarySelection =
      context.phase.kind === 'LEGENDARY_RESISTANCE_CHOICE'
        ? resolution.kind === 'OPTION' || resolution.kind === 'DECLINE'
          ? resolution
          : (() => {
              throw new Error(
                'Movement response does not match the issued Legendary Resistance choice.'
              )
            })()
        : null
    const replayed = input.retained
      ? await callbacks.replayReaction({
          runtime,
          occurrenceId: input.occurrenceId,
          prepared,
          retained: retainedPending
            ? { kind: 'PENDING', snapshot: retainedPending }
            : { kind: 'COMPLETE', receipt: retainedReceipt! },
          ...(context.phase.kind === 'ACTION_EVIDENCE' ? { issuedSnapshot: snapshot } : {})
        })
      : null
    const execution = legendarySelection
      ? await callbacks.resumeResistance({
          runtime,
          occurrenceId: input.occurrenceId,
          autoRoll: input.autoRoll,
          prepared,
          snapshot: { ...snapshot, applicationContext: actionContext },
          selection: legendarySelection,
          ...(replayed ? { retainedExecution: replayed } : {})
        })
      : (replayed ??
        (await callbacks.executeReaction({
          runtime,
          occurrenceId: input.occurrenceId,
          prepared,
          autoRoll: input.autoRoll,
          ...(prior?.kind === 'PENDING' &&
          (resolution.kind === 'ENTER_DICE' ||
            resolution.kind === 'ENTER_INTEGER' ||
            resolution.kind === 'SYSTEM_ROLL')
            ? { resume: { pending: prior, resolution } }
            : {})
        })))
    if (execution.kind === 'LEGENDARY_RESISTANCE') {
      const pendingSnapshot = await retainNativeMovementLegendaryResistance({
        runtime,
        occurrenceId: input.occurrenceId,
        prepared,
        context: actionContext,
        execution: execution.boundary.execution,
        d20: execution.boundary.d20,
        candidate: execution.candidate
      })
      return {
        outcome: {
          kind: 'PENDING',
          pendingSnapshot: withPolicy(pendingSnapshot, input.state),
          movementIntent: null
        },
        settlements,
        resolutionCommands
      }
    }
    if (execution.kind === 'PENDING') {
      const pendingSnapshot = bindEncounterMovementMaintenancePending(
        retainEncounterMovementReactionActionEvidence({
          continuation: execution.continuation,
          context: actionContext,
          selectedOptionId,
          d20Policy: execution.d20Policy,
          ...(execution.twoPhase ? { twoPhase: execution.twoPhase } : {}),
          ...(execution.phaseReceipts ? { phaseReceipts: execution.phaseReceipts } : {})
        }),
        prepared.maintenance
      )
      return {
        outcome: {
          kind: 'PENDING',
          pendingSnapshot: withPolicy(pendingSnapshot, input.state),
          movementIntent: null
        },
        settlements,
        resolutionCommands
      }
    }
    const settlement = {
      prepared,
      occurrenceId: input.occurrenceId,
      commandId: responseCommand.commandId,
      ordinal: context.completedReactionExecutions.length,
      occurredAt,
      execution
    }
    const plan = callbacks.planReaction(settlement, input.userId)
    if (
      retainedReceipt &&
      checksumCanonicalJson(plan.reactionExecution) !==
        checksumCanonicalJson(movementDamageEnvelope(retainedReceipt))
    )
      throw new Error('Prepared movement action receipt does not match current mechanics.')
    const remainingSpatialCandidates = projectSpatialMovementCandidates({
      candidates: remainder.remainingSpatialCandidates,
      beforeTargets: targets,
      afterTargets: plan.projectedTargets
    })
    targets = plan.projectedTargets
    maintenanceProjection = plan.maintenanceProjection
    settlements.push({ kind: 'REACTION', plan: settlement })
    remainder = movementReactionRemainderAfterCompletedAction({
      context,
      selectedOptionId,
      resolutionCommands,
      execution: plan.reactionExecution
    })
    remainder = {
      ...remainder,
      remainingSpatialCandidates,
      spatialCurrentnessChecksum: checksumSpatialCurrentness({
        encounter: { id: input.state.id, version: input.state.version },
        candidates: remainingSpatialCandidates
      })
    }
    concentrationSource = { kind: 'REACTION', executionOrdinal: plan.reactionExecution.ordinal }
    stopAfterReaction = execution.execution.movementInterruption?.kind === 'STOP'
  }
  if (concentrationSource) {
    const retainedSource = input.retained
      ? (concentrationSource.kind === 'SPATIAL'
          ? retainedMovementSpatialExecutions(input.retained)
          : retainedMovementReactionExecutions(input.retained)
        ).find((entry) => entry.ordinal === concentrationSource.executionOrdinal)
      : undefined
    const concentration = await callbacks.prepareConcentration({
      state: input.state,
      occurrenceId: input.occurrenceId,
      sourceCommandId: responseCommand.commandId,
      userId: input.userId,
      occurredAt,
      remainder,
      targets,
      projection: maintenanceProjection,
      source: concentrationSource,
      ...(input.retained ? { retainedChecks: retainedSource?.concentrationChecks ?? [] } : {}),
      ...(context.phase.kind === 'CONCENTRATION_EVIDENCE' &&
      (resolution.kind === 'ENTER_DICE' || resolution.kind === 'SYSTEM_ROLL')
        ? { resume: { snapshot, resolution } }
        : {})
    })
    remainder = concentration.remainder
    targets = concentration.targets
    maintenanceProjection = concentration.projection
    settlements.push(
      ...concentration.settlements.map((plan) => ({ kind: 'CONCENTRATION' as const, plan }))
    )
    if (concentration.pendingSnapshot)
      return {
        outcome: {
          kind: 'PENDING',
          pendingSnapshot: concentration.pendingSnapshot,
          movementIntent: null
        },
        settlements,
        resolutionCommands
      }
  }
  if (stopAfterReaction) {
    const result = stopSceneMovementResult({
      occurrenceId: input.occurrenceId,
      occurrenceVersion: input.occurrenceVersion + 1,
      encounterId: input.state.id,
      encounterVersion: input.state.version + 1,
      sceneId: root.sceneId,
      sceneVersion: root.currentSceneVersion,
      tokenId: root.tokenId,
      movementKind: root.movementKind,
      reactionExecutions: remainder.completedReactionExecutions,
      terminalPosition: root.currentPosition,
      remainder
    })
    return {
      outcome: {
        kind: 'TERMINAL',
        result,
        selectionChecksum: context.spatialSelectionChecksum,
        currentnessChecksum: context.spatialCurrentnessChecksum
      },
      settlements,
      resolutionCommands
    }
  }
  const continued = await callbacks.continueMovement({
    state: input.state,
    userId: input.userId,
    autoRoll: input.autoRoll,
    root: context.phase.kind === 'SPATIAL_EVIDENCE' ? root : remainder.root,
    sceneVersion: root.currentSceneVersion,
    sceneTokens: input.sceneTokens,
    actorIdByTokenId: input.actorIdByTokenId,
    currentPosition: token.position,
    occurrenceId: input.occurrenceId,
    occurrenceVersion: input.occurrenceVersion + 1,
    executionCommandId: responseCommand.commandId,
    occurredAt,
    reactionTimeline: remainder.reactionTimeline,
    targets,
    maintenanceProjection,
    remainder,
    ...(context.phase.kind === 'SPATIAL_EVIDENCE' &&
    (resolution.kind === 'ENTER_DICE' || resolution.kind === 'SYSTEM_ROLL')
      ? {
          evidence: {
            pendingSnapshot: snapshot,
            resolution,
            resolutionCommand: {
              ...responseCommand,
              requestId: resolution.requestId,
              kind: resolution.kind
            }
          }
        }
      : {}),
    ...(input.retained ? { retained: input.retained } : {})
  })
  if (continued.outcome.kind === 'UNINTERRUPTED')
    throw new Error('Movement action response did not retain its completed history.')
  return {
    outcome: continued.outcome,
    settlements: [...settlements, ...continued.settlements],
    resolutionCommands
  }
}

function withPolicy(
  snapshot: ServerKernelRuleExecutionPendingSnapshotDto,
  state: EncounterRunState
) {
  return {
    ...snapshot,
    optionalCombatSnapshotChecksum: state.optionalCombatSnapshotChecksum
  }
}
