import { requireServerKernelRuleExecutionPendingSnapshot } from '@artificer-toolkit/schema/shared/rulesExecution'
import type { MutationCtx } from '../_generated/server'
import type { MovementTarget } from '../encounters/movementTargets'
import { evaluateSceneMovementActionResponse } from './movementActionResponse.helper'
import { evaluateSceneMovementPassageResponse } from './movementPassageResponse.helper'
import { evaluateSceneMovementContinuation } from './movementContinuation.helper'
import {
  readSceneMovementReactionPerception,
  discoverSceneMovementReactions
} from './movementPerceptionValidation'

/** Dispatches the issued movement phase through the same read-only coordinator at prepare and finish. */
export async function evaluateSceneMovementResponse(
  ctx: MutationCtx,
  input: Parameters<typeof evaluateSceneMovementActionResponse>[1]
): Promise<
  Awaited<ReturnType<typeof evaluateSceneMovementActionResponse>> & {
    currentTargets?: ReadonlyMap<string, MovementTarget>
  }
> {
  const { current, request, responseCommand, occurredAt } = input
  if (current.context.kind === 'ENCOUNTER_MOVEMENT_REACTION')
    return evaluateSceneMovementActionResponse(ctx, input)
  if (
    current.context.kind === 'ENCOUNTER_MOVEMENT_PASSAGE_CHOICE' ||
    current.context.kind === 'ENCOUNTER_OPTIONAL_COMBAT_CONTEST'
  )
    return evaluateSceneMovementPassageResponse(ctx, input)
  const resolution = current.command.resolution
  if (resolution.kind !== 'ENTER_DICE' && resolution.kind !== 'SYSTEM_ROLL')
    throw new Error('Movement response does not match the issued spatial evidence.')
  const reactions = await discoverSceneMovementReactions(
    ctx,
    request,
    current.occurrence.id,
    request.perceptionEnvironments ?? []
  )
  if (reactions.firstBoundaryDistance !== null)
    throw new Error('Spatial movement reaction selection changed before response.')
  const perception = await readSceneMovementReactionPerception(
    ctx,
    request,
    request.perceptionEnvironments ?? []
  )
  if (!perception) throw new Error('Movement response facts are unavailable.')
  const root = current.root
  const evaluated = await evaluateSceneMovementContinuation(ctx, {
    request,
    state: current.state,
    userId: current.userId,
    root,
    sceneVersion: root.currentSceneVersion,
    sceneTokens: perception.geometry.sceneTokens,
    actorIdByTokenId: perception.geometry.actorIdByTokenId,
    currentPosition: root.currentPosition,
    occurrenceId: current.occurrence.id,
    occurrenceVersion: current.occurrence.version + 1,
    executionCommandId: responseCommand.commandId,
    occurredAt,
    reactionTimeline: [],
    targets: perception.facts.targets,
    evidence: {
      pendingSnapshot: requireServerKernelRuleExecutionPendingSnapshot(current.snapshot),
      resolution,
      resolutionCommand: {
        ...responseCommand,
        kind: resolution.kind,
        requestId: resolution.requestId
      }
    },
    ...(input.retained ? { retained: input.retained } : {})
  })
  if (evaluated.outcome.kind === 'UNINTERRUPTED')
    throw new Error('Movement response lost its retained evidence.')
  return {
    ...evaluated,
    outcome: evaluated.outcome,
    resolutionCommands: [...root.resolutionCommands, responseCommand]
  }
}
