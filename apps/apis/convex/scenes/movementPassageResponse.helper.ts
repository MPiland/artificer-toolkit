import type { sceneSpatialPrepareInputSchema } from '@artificer-toolkit/schema/api/sceneMovementPerception'
import type { SceneSpatialPreparation } from '@artificer-toolkit/schema/projections/sceneSpatialPreparation'
import { evaluateEncounterMovementPassageResponse } from '@artificer-toolkit/rules-runtime/encounterMovementPassageResponse'
import type { MutationCtx } from '../_generated/server'
import { readRunActors } from '../encounters/documents'
import { evaluateNativeMovementPassageContest } from '../encounters/movementPassageExecution'
import { loadMovementTargets } from '../encounters/movementTargets'
import { evaluateSceneMovementContinuation } from './movementContinuation.helper'
import type { assertMovementResolutionCurrent } from './movementResolutionDocuments'
import { readSpatialSceneGeometry } from './spatialGeometry'
import { readEncounterAutoRollByActorId } from '../encounters/actorController'

type Current = Awaited<ReturnType<typeof assertMovementResolutionCurrent>>
type Outcome = Exclude<SceneSpatialPreparation['outcome'], { kind: 'UNINTERRUPTED' }>

/** Contest evidence is evaluated before the same Scene transaction consumes its allowance. */
export async function evaluateSceneMovementPassageResponse(
  ctx: MutationCtx,
  input: {
    request: ReturnType<typeof sceneSpatialPrepareInputSchema.parse>
    current: Current
    responseCommand: Current['root']['resolutionCommands'][number]
    occurredAt: string
    retained?: Outcome
  }
) {
  const { current, request } = input
  if (!request.tokenOrdinals) throw new Error('Movement passage response is unavailable.')
  const geometry = await readSpatialSceneGeometry(ctx, request.saveId, request.tokenOrdinals)
  const actors = await readRunActors(ctx, current.state)
  return evaluateEncounterMovementPassageResponse(
    {
      state: current.state,
      snapshot: current.snapshot,
      resolution: current.answer,
      occurrenceId: current.occurrence.id,
      occurrenceVersion: current.occurrence.version,
      userId: current.userId,
      // Rolls go to each actor's controllers; the mover stays the command's initiator.
      autoRoll: await readEncounterAutoRollByActorId(ctx, {
        campaign: current.campaign,
        initiatorUserId: current.root.initiatorUserId,
        actors
      }),
      responseCommand: input.responseCommand,
      occurredAt: input.occurredAt,
      ...(input.retained ? { retained: input.retained } : {}),
      sceneTokens: geometry.sceneTokens,
      actorIdByTokenId: geometry.actorIdByTokenId,
      actors
    },
    {
      loadTargets: (actorIds) =>
        loadMovementTargets(ctx, {
          encounterId: current.state.id,
          expectedEncounterVersion: current.state.version,
          targetActorIds: actorIds,
          includeReactionSources: true
        }),
      evaluateContest: (contest) =>
        evaluateNativeMovementPassageContest(ctx, { ...contest, userId: current.userId }),
      continueMovement: (continuation) =>
        evaluateSceneMovementContinuation(ctx, { request, ...continuation })
    }
  )
}
