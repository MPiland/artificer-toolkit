import type { sceneSpatialPrepareInputSchema } from '@artificer-toolkit/schema/api/sceneMovementPerception'
import type { SceneSpatialPreparation } from '@artificer-toolkit/schema/projections/sceneSpatialPreparation'
import { requireServerKernelRuleExecutionPendingSnapshot } from '@artificer-toolkit/schema/shared/rulesExecution'
import { evaluateEncounterMovementActionResponse } from '@artificer-toolkit/rules-runtime/encounterMovementActionResponse'
import type { MutationCtx } from '../_generated/server'
import type { Doc } from '../_generated/dataModel'
import {
  executeNativeMovementReactionAction,
  prepareNativeMovementReactionAction,
  planNativeMovementReactionAction,
  resumeNativeMovementLegendaryResistance
} from '../encounters/actionMovementReactions'
import { replayNativeMovementReactionAction } from '../encounters/movementReactionReplay'
import { prepareNativeMovementConcentration } from '../encounters/movementConcentration'
import type { MovementTarget } from '../encounters/movementTargets'
import { createRulesRuntime } from '../rules/runtime'
import { readAutoRollDice } from '../lib/rollPreferences'
import type { assertMovementResolutionCurrent } from './movementResolutionDocuments'
import { readSceneMovementReactionPerception } from './movementPerceptionValidation'
import { evaluateSceneMovementContinuation } from './movementContinuation.helper'
import type { SceneMovementSettlement } from './movementSettlements'

type Outcome = Exclude<SceneSpatialPreparation['outcome'], { kind: 'UNINTERRUPTED' }>
type Current = Awaited<ReturnType<typeof assertMovementResolutionCurrent>>
type ReactionContext = Extract<Current['context'], { kind: 'ENCOUNTER_MOVEMENT_REACTION' }>

/** Reconstructs the selected action before the enclosing Scene transaction publishes its plan. */
export async function evaluateSceneMovementActionResponse(
  ctx: MutationCtx,
  input: {
    request: ReturnType<typeof sceneSpatialPrepareInputSchema.parse>
    current: Current
    responseCommand: ReactionContext['root']['resolutionCommands'][number]
    occurredAt: string
    retained?: Outcome
  }
): Promise<{
  outcome: Outcome
  settlements: SceneMovementSettlement[]
  resolutionCommands: ReactionContext['root']['resolutionCommands']
}> {
  const { current, request } = input
  if (current.context.kind !== 'ENCOUNTER_MOVEMENT_REACTION')
    throw new Error('Movement action response requires an issued reaction.')
  const snapshot = requireServerKernelRuleExecutionPendingSnapshot(current.snapshot)
  const runtime = await createRulesRuntime(ctx, current.userId)
  const perception = await readSceneMovementReactionPerception(
    ctx,
    request,
    request.perceptionEnvironments ?? []
  )
  if (!perception) throw new Error('Movement reaction facts are unavailable.')
  return evaluateEncounterMovementActionResponse<
    NonNullable<MovementTarget['characterFacts']>,
    Doc<'characters'>,
    Awaited<ReturnType<typeof prepareNativeMovementReactionAction>>,
    ReturnType<typeof planNativeMovementReactionAction>,
    Awaited<ReturnType<typeof prepareNativeMovementConcentration>>['settlements'][number],
    SceneMovementSettlement
  >(
    {
      state: current.state,
      snapshot,
      context: current.context,
      resolution: current.command.resolution,
      occurrenceId: current.occurrence.id,
      occurrenceVersion: current.occurrence.version,
      userId: current.userId,
      // The responding user rolls in this slice.
      autoRoll: await readAutoRollDice(ctx, current.userId),
      responseCommand: input.responseCommand,
      occurredAt: input.occurredAt,
      runtime,
      sceneTokens: perception.geometry.sceneTokens,
      actorIdByTokenId: perception.geometry.actorIdByTokenId,
      resolvePerception: perception.resolvePerception,
      targets: perception.facts.targets,
      ...(input.retained ? { retained: input.retained } : {})
    },
    {
      prepareReaction: ({ targets, maintenanceProjection, ...reaction }) =>
        prepareNativeMovementReactionAction(ctx, reaction, targets, maintenanceProjection),
      replayReaction: (reaction) => replayNativeMovementReactionAction({ ctx, ...reaction }),
      executeReaction: (reaction) => executeNativeMovementReactionAction(ctx, reaction),
      resumeResistance: (reaction) => resumeNativeMovementLegendaryResistance(ctx, reaction),
      planReaction: planNativeMovementReactionAction,
      prepareConcentration: (concentration) =>
        prepareNativeMovementConcentration(ctx, concentration),
      continueMovement: (continuation) =>
        evaluateSceneMovementContinuation(ctx, { request, ...continuation })
    }
  )
}
