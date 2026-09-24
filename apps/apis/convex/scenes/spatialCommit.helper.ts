import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { SceneToken } from '@artificer-toolkit/shared/vtt/scene'
import type { sceneSpatialPrepareInputSchema } from '@artificer-toolkit/schema/api/sceneMovementPerception'
import type { MutationCtx } from '../_generated/server'
import { evaluateNativeSpatialMovement } from '../encounters/spatialMovement'
import { readGeometrySave, readSpatialPreparation } from './geometryDocuments'
import { settleSceneMovementSettlements } from './movementSettlements'
import { evaluateInitialSceneMovement } from './spatialPreparation'
import { persistSpatialPreparation } from './spatialPreparationPersistence'

type Geometry = {
  sceneTokens: readonly SceneToken[]
  actorIdByTokenId: ReadonlyMap<string, string>
}

async function readSpatialCommit(ctx: MutationCtx, saveId: string, geometry: Geometry) {
  const { save, campaign, membership, userId } = await readGeometrySave(ctx, saveId)
  const preparation = readSpatialPreparation(save)
  if (!preparation || preparation.outcome.kind === 'PENDING')
    throw new Error('Completed spatial preparation is unavailable.')

  await persistSpatialPreparation(ctx, saveId, preparation)

  if (save.input.type !== 'MOVE_SCENE_TOKEN' || save.input.expectedEncounterVersion === null)
    throw new Error('Spatial terminal preparation requires Encounter movement.')

  const tokenId = save.input.tokenId
  const movingToken = geometry.sceneTokens.find((token) => token.id === tokenId)
  if (
    !movingToken ||
    movingToken.locked ||
    (membership.role !== 'OWNER' && !movingToken.controlledByUserIds.includes(userId))
  )
    throw new Error('Members may only move an unlocked token they control.')
  if (!geometry.actorIdByTokenId.get(movingToken.id))
    throw new Error('Spatial terminal moving actor is unavailable.')

  const root = {
    commandId: save.commandId,
    commandFingerprint: save.inputChecksum,
    initiatorUserId: save.actorUserId,
    correlationId: save.input.correlationId,
    encounterId: preparation.encounterId,
    sceneId: save.sceneId,
    tokenId: save.input.tokenId,
    expectedEncounterVersion: preparation.expectedEncounterVersion,
    expectedSceneVersion: save.input.expectedSceneVersion,
    movementKind: save.input.movementKind,
    originalPath: save.input.path
  }

  const rootOccurrence = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_campaignId_rootCommandId', (q) =>
      q.eq('campaignId', campaign.id).eq('rootCommandId', save.commandId)
    )
    .unique()
  if (rootOccurrence) throw new Error('Spatial terminal replay must be handled by the parent.')
  const pendingOccurrences = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_encounterId_state', (q) =>
      q.eq('encounterId', preparation.encounterId).eq('state', 'PENDING')
    )
    .take(2)
  if (pendingOccurrences.length > 0) throw new Error('Encounter has a pending rule occurrence.')

  return { save, preparation, root, movingToken }
}

/** Parent supplies authoritative geometry at the saved Scene version and atomically publishes the root receipt. */
export async function commitPreparedSpatialTerminal(
  ctx: MutationCtx,
  saveId: string,
  geometry: Geometry,
  request?: ReturnType<typeof sceneSpatialPrepareInputSchema.parse>
) {
  const { save, preparation, root, movingToken } = await readSpatialCommit(ctx, saveId, geometry)
  if (preparation.outcome.kind !== 'TERMINAL')
    throw new Error('Spatial terminal preparation is unavailable.')
  const result = preparation.outcome.result
  if (request) {
    const evaluated = await evaluateInitialSceneMovement(
      ctx,
      request,
      { occurrenceId: preparation.occurrenceId, occurredAt: preparation.occurredAt },
      preparation.outcome
    )
    if (
      evaluated.outcome.kind !== 'TERMINAL' ||
      checksumCanonicalJson(evaluated.outcome) !== checksumCanonicalJson(preparation.outcome)
    )
      throw new Error('Spatial terminal evaluation does not match retained preparation.')
    const settled = await settleSceneMovementSettlements(ctx, evaluated.settlements, true)
    return { kind: 'TERMINAL' as const, result, ...settled }
  }

  if (result.reactionExecutions.length !== 0)
    throw new Error('Automatic movement reaction source hints are unavailable.')

  const actual = await evaluateNativeSpatialMovement(
    ctx,
    {
      encounterId: preparation.encounterId,
      expectedEncounterVersion: preparation.expectedEncounterVersion,
      sceneId: save.sceneId,
      sceneVersion: save.snapshotVersion,
      actorIdByTokenId: geometry.actorIdByTokenId,
      sceneTokens: geometry.sceneTokens,
      root,
      currentPosition: { ...movingToken.position },
      occurrenceId: preparation.occurrenceId,
      occurrenceVersion: result.occurrenceVersion,
      executionCommandId: save.commandId,
      occurredAt: preparation.occurredAt,
      frozenTerminal: preparation.outcome
    },
    'COMMIT'
  )
  if (
    actual.kind !== 'TERMINAL' ||
    checksumCanonicalJson(actual.result) !== checksumCanonicalJson(result)
  )
    throw new Error('Spatial terminal evaluation does not match retained preparation.')
  return { ...actual, mechanicsChanged: false, characterTransitions: [] }
}

/** Rechecks ordinary movement without creating a rule occurrence or advancing the Run. */
export async function verifyPreparedUninterruptedMovement(
  ctx: MutationCtx,
  request: ReturnType<typeof sceneSpatialPrepareInputSchema.parse>,
  geometry: Geometry
) {
  const { preparation } = await readSpatialCommit(ctx, request.saveId, geometry)
  if (preparation.outcome.kind !== 'UNINTERRUPTED')
    throw new Error('Uninterrupted movement preparation is unavailable.')
  const evaluated = await evaluateInitialSceneMovement(ctx, request, {
    occurrenceId: preparation.occurrenceId,
    occurredAt: preparation.occurredAt
  })
  if (
    evaluated.outcome.kind !== 'UNINTERRUPTED' ||
    checksumCanonicalJson(evaluated.outcome) !== checksumCanonicalJson(preparation.outcome)
  )
    throw new Error('Uninterrupted movement evaluation does not match retained preparation.')
}
