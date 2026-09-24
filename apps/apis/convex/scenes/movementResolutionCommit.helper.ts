import type { sceneSpatialPrepareInputSchema } from '@artificer-toolkit/schema/api/sceneMovementPerception'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { MutationCtx } from '../_generated/server'
import { readSpatialPreparation } from './geometryDocuments'
import type { readResponse } from './movementResolutionDocuments'
import { evaluateSceneMovementResponse } from './movementResponse.helper'
import { assertNextMovementReactionCurrent } from './movementResolutionPreparation.helper'
import { persistSpatialPreparation } from './spatialPreparation'
import { settleSceneMovementSettlements } from './movementSettlements'

/** Consume a response checked in this mutation, reconstruct frozen results, and apply mechanics. */
export async function commitPreparedMovementResponse(
  ctx: MutationCtx,
  request: ReturnType<typeof sceneSpatialPrepareInputSchema.parse>,
  response: Awaited<ReturnType<typeof readResponse>>
) {
  const saveId = request.saveId
  const { save, current, responseCommand } = response
  if (save.id !== saveId.toLowerCase()) throw new Error('Movement response save is inconsistent.')
  const preparation = readSpatialPreparation(save)
  if (!preparation || preparation.outcome.kind === 'UNINTERRUPTED')
    throw new Error('Movement response preparation is unavailable.')
  await persistSpatialPreparation(ctx, saveId, preparation)
  const outcome = preparation.outcome
  const evaluated = await evaluateSceneMovementResponse(ctx, {
    request,
    current,
    responseCommand,
    occurredAt: preparation.occurredAt,
    retained: outcome
  })
  if (checksumCanonicalJson(evaluated.outcome) !== checksumCanonicalJson(outcome))
    throw new Error('Movement response does not match retained preparation.')
  await assertNextMovementReactionCurrent(ctx, request, outcome, evaluated.currentTargets)
  const settled = await settleSceneMovementSettlements(
    ctx,
    evaluated.settlements,
    outcome.kind === 'TERMINAL'
  )
  return {
    outcome,
    resolutionCommands: evaluated.resolutionCommands,
    ...settled,
    commandCharacterTransitions: settled.characterTransitions
  }
}
