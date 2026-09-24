import type { sceneSpatialPrepareInputSchema } from '@artificer-toolkit/schema/api/sceneMovementPerception'
import type { SceneSpatialPreparation } from '@artificer-toolkit/schema/projections/sceneSpatialPreparation'
import type { MutationCtx } from '../_generated/server'
import type { MovementTarget } from '../encounters/movementTargets'
import { evaluateSceneMovementResponse } from './movementResponse.helper'
import { readSpatialPreparation } from './geometryDocuments'
import { readResponse } from './movementResolutionDocuments'
import { revalidateSceneMovementReactionChoice } from './movementPerceptionValidation'
import { readSpatialSceneGeometry } from './spatialGeometry'
import { persistSpatialPreparation } from './spatialPreparation'

type ResponseOutcome = Exclude<SceneSpatialPreparation['outcome'], { kind: 'UNINTERRUPTED' }>

/** Issuing the next choice requires current sources; a declined historical option remains frozen. */
export async function assertNextMovementReactionCurrent(
  ctx: MutationCtx,
  request: ReturnType<typeof sceneSpatialPrepareInputSchema.parse>,
  outcome: ResponseOutcome,
  currentTargets?: ReadonlyMap<string, MovementTarget>
) {
  if (outcome.kind !== 'PENDING') return
  const context = outcome.pendingSnapshot.applicationContext
  if (context.kind !== 'ENCOUNTER_MOVEMENT_REACTION' || context.phase.kind !== 'CHOICE') return
  const next = context.reactionTimeline[0]
  if (!next || next.kind !== 'CONTROLLER_CHOICE')
    throw new Error('The next movement reaction choice is stale.')
  await revalidateSceneMovementReactionChoice(
    ctx,
    request,
    outcome.pendingSnapshot.occurrenceId,
    next.group,
    request.perceptionEnvironments ?? [],
    currentTargets
  )
}

/** Resolve sealed evidence before Node computes the remaining path and fog; no mechanics publish here. */
export async function prepareMovementResponse(
  ctx: MutationCtx,
  request: ReturnType<typeof sceneSpatialPrepareInputSchema.parse>
): Promise<SceneSpatialPreparation> {
  if (!request.tokenOrdinals) throw new Error('Movement response token source hints are missing.')
  const geometry = await readSpatialSceneGeometry(ctx, request.saveId, request.tokenOrdinals)
  const { save, current, responseCommand } = await readResponse(ctx, request.saveId, geometry)
  const prior = readSpatialPreparation(save)
  if (prior) return persistSpatialPreparation(ctx, save.id, prior)
  const occurredAt = new Date().toISOString()
  const evaluated = await evaluateSceneMovementResponse(ctx, {
    request,
    current,
    responseCommand,
    occurredAt
  })
  await assertNextMovementReactionCurrent(ctx, request, evaluated.outcome, evaluated.currentTargets)
  return persistSpatialPreparation(ctx, save.id, {
    encounterId: current.state.id,
    expectedEncounterVersion: current.state.version,
    occurrenceId: current.occurrence.id,
    occurredAt,
    outcome: evaluated.outcome
  })
}
