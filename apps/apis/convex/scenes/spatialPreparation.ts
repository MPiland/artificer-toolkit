import { prepareMovementResponse } from './movementResolutionPreparation.helper'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import { sceneSpatialPrepareInputSchema } from '@artificer-toolkit/schema/api/sceneMovementPerception'
// eslint-disable-next-line no-restricted-imports -- The native builder preserves the metadata getter; the handler applies withSceneVisionTracking explicitly.
import { internalMutation } from '../_generated/server'
import { withSceneVisionTracking } from '../lib/mutations'
import { evaluateSceneMovementContinuation } from './movementContinuation.helper'
import { readSpatialSceneGeometry } from './spatialGeometry'
import {
  sceneSpatialPreparationSchema,
  type SceneSpatialPreparation
} from '@artificer-toolkit/schema/projections/sceneSpatialPreparation'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { MutationCtx } from '../_generated/server'
import {
  assertGeometryReceiving,
  readGeometrySave,
  readSpatialPreparation
} from './geometryDocuments'
import { discoverSceneMovementReactions } from './movementPerceptionValidation'
import { persistSpatialPreparation } from './spatialPreparationPersistence'

export { persistSpatialPreparation } from './spatialPreparationPersistence'

/** The geometry action validates the complete path before requesting sealed rule evidence. */
export const prepare = internalMutation({
  args: zodToConvexFields(sceneSpatialPrepareInputSchema.shape),
  // Convex exports this metadata at deployment; ordinary invocations need no schema conversion.
  get returns() {
    return zodToConvex(sceneSpatialPreparationSchema)
  },
  handler: async (rawCtx, args): Promise<SceneSpatialPreparation> => {
    const ctx = withSceneVisionTracking(rawCtx)
    const request = sceneSpatialPrepareInputSchema.parse(args)
    const currentSave = await readGeometrySave(ctx, request.saveId)
    const { save, header, membership, userId } = currentSave
    if (save.movementResolution) return prepareMovementResponse(ctx, request)
    assertGeometryReceiving(save, header.version, userId)
    if (
      save.input.type !== 'MOVE_SCENE_TOKEN' ||
      save.input.expectedEncounterVersion === null ||
      !request.tokenOrdinals
    )
      throw new Error('Spatial preparation requires bound movement and token source hints.')
    const tokenId = save.input.tokenId
    const geometry = await readSpatialSceneGeometry(
      ctx,
      request.saveId,
      request.tokenOrdinals,
      currentSave
    )
    const token = geometry.sceneTokens.find((entry) => entry.id === tokenId)
    if (
      !token ||
      token.locked ||
      (membership.role !== 'OWNER' && !token.controlledByUserIds.includes(userId))
    )
      throw new Error('Members may only move an unlocked token they control.')
    if (!geometry.actorIdByTokenId.has(token.id))
      throw new Error('Spatial moving actor is unavailable.')
    if (checksumCanonicalJson(token.position) !== checksumCanonicalJson(save.input.path[0]))
      throw new Error('Movement path does not begin at the current token position.')
    const prior = readSpatialPreparation(save)
    if (prior) return persistSpatialPreparation(ctx, request.saveId, prior)
    const pending = await ctx.db
      .query('encounterRuleOccurrences')
      .withIndex('by_encounterId_state', (q) =>
        q.eq('encounterId', geometry.encounter.id).eq('state', 'PENDING')
      )
      .take(1)
    if (pending.length) throw new Error('Encounter has a pending rule occurrence.')
    const existing = await ctx.db
      .query('encounterRuleOccurrences')
      .withIndex('by_campaignId_rootCommandId', (q) =>
        q.eq('campaignId', header.campaignId).eq('rootCommandId', save.commandId)
      )
      .unique()
    if (existing) throw new Error('Spatial occurrence replay must use the published command.')
    const occurrenceId = crypto.randomUUID()
    const occurredAt = new Date().toISOString()
    const evaluated = await evaluateInitialSceneMovement(
      ctx,
      request,
      { occurrenceId, occurredAt },
      undefined,
      geometry
    )
    return persistSpatialPreparation(ctx, request.saveId, {
      encounterId: geometry.encounter.id,
      expectedEncounterVersion: save.input.expectedEncounterVersion,
      occurrenceId,
      occurredAt,
      outcome: evaluated.outcome
    })
  }
})

/** Re-evaluate at each prepare/finish boundary; geometry may be reused within its read-only transaction phase. */
export async function evaluateInitialSceneMovement(
  ctx: MutationCtx,
  request: ReturnType<typeof sceneSpatialPrepareInputSchema.parse>,
  identity: Pick<SceneSpatialPreparation, 'occurrenceId' | 'occurredAt'>,
  retained?: Exclude<SceneSpatialPreparation['outcome'], { kind: 'UNINTERRUPTED' }>,
  currentGeometry?: Awaited<ReturnType<typeof readSpatialSceneGeometry>>
) {
  const currentSave = currentGeometry?.saveContext ?? (await readGeometrySave(ctx, request.saveId))
  const { save, header, membership, userId } = currentSave
  if (save.id !== request.saveId.toLowerCase())
    throw new Error('Initial movement save identity differs.')
  assertGeometryReceiving(save, header.version, userId)
  if (
    save.input.type !== 'MOVE_SCENE_TOKEN' ||
    save.input.expectedEncounterVersion === null ||
    !request.tokenOrdinals
  )
    throw new Error('Initial movement requires Encounter movement and token sources.')
  const geometry =
    currentGeometry ??
    (await readSpatialSceneGeometry(ctx, request.saveId, request.tokenOrdinals, currentSave))
  const tokenId = save.input.tokenId
  const token = geometry.sceneTokens.find((entry) => entry.id === tokenId)
  if (
    !token ||
    token.locked ||
    (membership.role !== 'OWNER' && !token.controlledByUserIds.includes(userId)) ||
    !geometry.actorIdByTokenId.has(token.id) ||
    checksumCanonicalJson(token.position) !== checksumCanonicalJson(save.input.path[0])
  )
    throw new Error('Initial movement token authority or position is stale.')
  const reactions = await discoverSceneMovementReactions(
    ctx,
    request,
    identity.occurrenceId,
    request.perceptionEnvironments ?? [],
    geometry
  )
  return evaluateSceneMovementContinuation(ctx, {
    request,
    state: geometry.encounter,
    userId,
    root: {
      commandId: save.commandId,
      commandFingerprint: save.inputChecksum,
      initiatorUserId: userId,
      correlationId: save.input.correlationId,
      encounterId: geometry.encounter.id,
      sceneId: header.id,
      tokenId,
      expectedEncounterVersion: save.input.expectedEncounterVersion,
      expectedSceneVersion: save.input.expectedSceneVersion,
      movementKind: save.input.movementKind,
      originalPath: save.input.path
    },
    sceneVersion: header.version,
    sceneTokens: geometry.sceneTokens,
    actorIdByTokenId: geometry.actorIdByTokenId,
    currentPosition: token.position,
    occurrenceId: identity.occurrenceId,
    occurrenceVersion: 0,
    executionCommandId: save.commandId,
    occurredAt: identity.occurredAt,
    reactionTimeline: reactions.reactionTimeline,
    targets: reactions.movementTargets ?? new Map(),
    ...(retained ? { retained } : {})
  })
}
