import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { SceneSpatialPreparation } from '@artificer-toolkit/schema/projections/sceneSpatialPreparation'
import type {
  ServerKernelRuleExecutionPendingSnapshotDto,
  ServerRuleExecutionPendingApplicationContextDto,
  ServerRuleExecutionPendingSnapshotDto
} from '@artificer-toolkit/schema/shared/rulesExecution'
import { requireServerKernelRuleExecutionPendingSnapshot } from '@artificer-toolkit/schema/shared/rulesExecution'
import type { SceneGrid, SceneToken } from '@artificer-toolkit/shared/vtt/scene'
import type { ProjectableCharacterFacts } from './encounterActionProjection.js'
import type {
  MovementCharacterRow,
  MovementMaintenanceProjection
} from './encounterMovementMaintenance.js'
import type { RulesRuntimeService } from './rulesRuntimeService.js'
import type {
  MovementConcentrationExecutionDto,
  MovementMassiveDamageSaveExecutionDto,
  MovementRepeatSaveExecutionDto
} from '@artificer-toolkit/schema/shared/ruleExecutionMovementConcentration'
import {
  appendEncounterMovementConcentrationEvidenceCommand,
  appendEncounterMovementReactionResolutionCommand,
  movementReactionRemainderAfterCurrentChoice,
  resolveEncounterMovementReactionChoice
} from './encounterMovementReactionContinuation.js'
import type { FrozenMovementReactionRemainder } from './encounterSpatialMovementRuleService.js'
import { planNativeSpatialMovementPrefix } from './encounterSpatialMovementPlan.js'
import type { MovementTarget } from './encounterMovementTargets.js'
import { terminalMovementDamageEnds } from './encounterSpatialDamageEnds.js'
import { retainedMovementSpatialExecutions } from './encounterMovementContinuation.js'
import {
  stopSceneMovementResult,
  type MovementContinuationInput
} from './encounterMovementContinuation.js'
import type { EncounterAutoRollByActorId } from './encounterEvidenceMode.js'
import type { EncounterResponseAnswer } from './encounterEvidenceAnswer.js'

type Outcome = Exclude<SceneSpatialPreparation['outcome'], { kind: 'UNINTERRUPTED' }>
type ReactionContext = Extract<
  ServerKernelRuleExecutionPendingSnapshotDto['applicationContext'],
  { kind: 'ENCOUNTER_MOVEMENT_REACTION' }
>
type ResponseSettlement<TConcentrationPlan, TContinuationSettlement> =
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

/** Resumes a move paused on a reaction choice, spatial evidence or Concentration evidence. */
export async function evaluateEncounterMovementActionResponse<
  TCharacterFacts extends ProjectableCharacterFacts,
  TRow extends MovementCharacterRow,
  TConcentrationPlan,
  TContinuationSettlement
>(
  input: {
    state: EncounterRunState
    snapshot: ServerRuleExecutionPendingSnapshotDto
    context: ServerRuleExecutionPendingApplicationContextDto
    resolution: EncounterResponseAnswer
    occurrenceId: string
    occurrenceVersion: number
    userId: string
    /** The roller's auto-roll preference; the responding user rolls in this slice. */
    autoRoll: EncounterAutoRollByActorId
    responseCommand: ReactionContext['root']['resolutionCommands'][number]
    occurredAt: string
    runtime: RulesRuntimeService
    sceneTokens: readonly SceneToken[]
    sceneGrid: SceneGrid
    actorIdByTokenId: ReadonlyMap<string, string>
    targets: ReadonlyMap<string, MovementTarget<TCharacterFacts>>
    /** The committed children of the choice this response resumes, each with what it does to the move. */
    reactionChildren: readonly { commandId: string; stopsTriggeringMovement: boolean }[]
    retained?: Outcome
  },
  callbacks: {
    prepareConcentration(input: {
      autoRoll: EncounterAutoRollByActorId
      state: EncounterRunState
      occurrenceId: string
      sourceCommandId: string
      userId: string
      occurredAt: string
      remainder: FrozenMovementReactionRemainder
      targets: ReadonlyMap<string, MovementTarget<TCharacterFacts>>
      projection?: MovementMaintenanceProjection<TRow>
      source: { executionOrdinal: number }
      retainedSaves?: {
        concentrationChecks?: readonly MovementConcentrationExecutionDto[]
        repeatSaves?: readonly MovementRepeatSaveExecutionDto[]
        massiveDamageSaves?: readonly MovementMassiveDamageSaveExecutionDto[]
      }
      resume?: {
        snapshot: ServerKernelRuleExecutionPendingSnapshotDto
        resolution: Extract<EncounterResponseAnswer, { kind: 'ENTER_DICE' | 'SYSTEM_ROLL' }>
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
      targets: ReadonlyMap<string, MovementTarget<TCharacterFacts>>
    }>
  }
): Promise<{
  outcome: Outcome
  settlements: ResponseSettlement<TConcentrationPlan, TContinuationSettlement>[]
  /** Every target as the move's settled children left it. */
  targets: ReadonlyMap<string, MovementTarget<TCharacterFacts>>
  resolutionCommands: ReactionContext['root']['resolutionCommands']
}> {
  const { responseCommand, occurredAt } = input
  if (input.context.kind !== 'ENCOUNTER_MOVEMENT_REACTION')
    throw new Error('Movement action response requires an issued reaction.')
  const context = input.context
  const snapshot = requireServerKernelRuleExecutionPendingSnapshot(input.snapshot)
  const root = context.root
  const { runtime, resolution } = input
  const settlements: ResponseSettlement<TConcentrationPlan, TContinuationSettlement>[] = []
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
  let concentrationSource: { executionOrdinal: number } | null = null
  let stopAfterReaction = false
  if (context.phase.kind === 'CHOICE' && resolution.kind === 'REACTION_CHILD_RESUME') {
    // The reaction the choice took ran as its own child action (D219). The option that child came
    // from settles the Kernel choice; the child's commit is the reaction's record, so the move keeps
    // no execution of it.
    const child = input.reactionChildren.find(
      ({ commandId }) => commandId === resolution.childCommandId
    )
    const chosenOptionId = root.resolutionCommands
      .flatMap((entry) => (entry.kind === 'OPTION' ? [entry.optionId] : []))
      .at(-1)
    if (
      !child ||
      !chosenOptionId ||
      !context.phase.reactionChildren?.some(({ commandId }) => commandId === child.commandId) ||
      responseCommand.kind !== 'REACTION_CHILD_RESUME' ||
      responseCommand.childCommandId !== child.commandId ||
      responseCommand.actorUserId !== input.userId ||
      responseCommand.expectedOccurrenceVersion !== input.occurrenceVersion ||
      root.resolutionCommands.length !== input.occurrenceVersion
    )
      throw new Error('Movement response does not match the recorded reaction child.')
    resolutionCommands = [...root.resolutionCommands, responseCommand]
    await resolveEncounterMovementReactionChoice({
      runtime,
      pendingSnapshot: snapshot,
      selection: { kind: 'OPTION', optionId: chosenOptionId }
    })
    const prefix = context.appliedSpatialPrefix
    remainder = {
      ...movementReactionRemainderAfterCurrentChoice({ context, resolutionCommands }),
      // The child's receipt proves what it changed, so the spatial receipt marks where it committed.
      appliedSpatialPrefix:
        prefix?.status === 'BATCH_COMPLETE' && prefix.batchKind === 'ENCOUNTER_SPATIAL_MOVEMENT'
          ? {
              ...prefix,
              reactionChildBoundaries: [
                ...new Set([...(prefix.reactionChildBoundaries ?? []), prefix.executions.length])
              ]
            }
          : prefix,
      resumedFromReactionChild: true
    }
    const moverActorId = input.actorIdByTokenId.get(root.tokenId)
    stopAfterReaction =
      child.stopsTriggeringMovement ||
      (moverActorId !== undefined && targets.get(moverActorId)?.state.current === 0)
  } else if (context.phase.kind === 'CHOICE') {
    // A taken option never arrives here: the room records it and raises its child action (D219).
    if (resolution.kind !== 'DECLINE')
      throw new Error('Movement response does not match the issued reaction choice.')
    resolutionCommands = appendEncounterMovementReactionResolutionCommand({
      history: root.resolutionCommands,
      command: responseCommand,
      selection: resolution,
      actorUserId: input.userId,
      proposedOccurrenceVersion: input.occurrenceVersion + 1
    })
    await resolveEncounterMovementReactionChoice({
      runtime,
      pendingSnapshot: snapshot,
      selection: resolution
    })
    remainder = movementReactionRemainderAfterCurrentChoice({
      context,
      resolutionCommands
    })
  } else if (
    context.phase.kind === 'CONCENTRATION_EVIDENCE' ||
    context.phase.kind === 'REPEAT_SAVE_EVIDENCE' ||
    context.phase.kind === 'MASSIVE_DAMAGE_SAVE_EVIDENCE'
  ) {
    if (resolution.kind !== 'ENTER_DICE' && resolution.kind !== 'SYSTEM_ROLL')
      throw new Error('Movement response does not match the issued damage-save evidence.')
    resolutionCommands = appendEncounterMovementConcentrationEvidenceCommand({
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
      currentSpatialCandidate: null,
      remainingSpatialCandidates: [...context.remainingSpatialCandidates],
      reactionTimeline: context.reactionTimeline
    }
    concentrationSource = context.phase.damageSource
  } else if (context.phase.kind === 'SPATIAL_EVIDENCE') {
    if (
      resolution.kind !== 'ENTER_DICE' &&
      resolution.kind !== 'ENTER_INTEGER' &&
      resolution.kind !== 'SYSTEM_ROLL'
    )
      throw new Error('Movement response does not match the issued spatial evidence.')
    // The spatial evaluator verifies this command against the issued request and history.
    resolutionCommands = [...root.resolutionCommands, responseCommand]
    remainder = {
      root: { ...root, resolutionCommands },
      spatialSelectionChecksum: context.spatialSelectionChecksum,
      spatialCurrentnessChecksum: context.spatialCurrentnessChecksum,
      completedSpatialExecutions: [...context.completedSpatialExecutions],
      appliedSpatialPrefix: context.appliedSpatialPrefix,
      currentSpatialCandidate: context.phase.currentCandidate,
      remainingSpatialCandidates: [...context.remainingSpatialCandidates],
      reactionTimeline: context.reactionTimeline
    }
  } else throw new Error('Movement action response does not match the issued phase.')

  if (concentrationSource) {
    const retainedSource = input.retained
      ? retainedMovementSpatialExecutions(input.retained).find(
          (entry) => entry.ordinal === concentrationSource.executionOrdinal
        )
      : undefined
    const concentration = await callbacks.prepareConcentration({
      autoRoll: input.autoRoll,
      state: input.state,
      occurrenceId: input.occurrenceId,
      sourceCommandId: responseCommand.commandId,
      userId: input.userId,
      occurredAt,
      remainder,
      targets,
      projection: maintenanceProjection,
      source: concentrationSource,
      ...(input.retained ? { retainedSaves: retainedSource ?? {} } : {}),
      ...((context.phase.kind === 'CONCENTRATION_EVIDENCE' ||
        context.phase.kind === 'REPEAT_SAVE_EVIDENCE' ||
        context.phase.kind === 'MASSIVE_DAMAGE_SAVE_EVIDENCE') &&
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
        targets,
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
      terminalPosition: root.currentPosition,
      remainder
    })
    return {
      outcome: {
        kind: 'TERMINAL',
        result,
        selectionChecksum: context.spatialSelectionChecksum,
        currentnessChecksum: context.spatialCurrentnessChecksum,
        // A child's stop leaves the move no execution to read the stop distance from (D219).
        terminalPathDistance: root.pathStartDistance,
        ...terminalMovementDamageEnds({
          result,
          targets,
          occurrenceId: input.occurrenceId,
          turnActorId: input.state.currentActorId
        })
      },
      settlements,
      targets,
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
    sceneGrid: input.sceneGrid,
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
    (resolution.kind === 'ENTER_DICE' ||
      resolution.kind === 'ENTER_INTEGER' ||
      resolution.kind === 'SYSTEM_ROLL')
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
    targets: continued.targets,
    resolutionCommands
  }
}
