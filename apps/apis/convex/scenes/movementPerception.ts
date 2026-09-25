import { assertMovementResolutionCurrent } from './movementResolutionDocuments'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import { sceneGeometryFinishInputSchema } from '@artificer-toolkit/schema/api/sceneGeometry'
import {
  sceneMovementPerceptionCaptureSchema,
  type SceneMovementPerceptionCapture
} from '@artificer-toolkit/schema/api/sceneMovementPerception'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { collectEncounterMovementReactionContacts } from '@artificer-toolkit/rules-runtime/encounterMovementReactionContacts'
import { discoverEncounterMovementReactionSources } from '@artificer-toolkit/rules-runtime/encounterMovementReactionSources'
import { encounterSceneGridPolicyRegistry } from '@artificer-toolkit/rules-runtime/sceneGridPolicyRegistry'
// eslint-disable-next-line no-restricted-imports -- Preserve lazy return metadata and apply the same Scene vision tracking in the handler.
import { internalMutation, type MutationCtx } from '../_generated/server'
import { withSceneVisionTracking } from '../lib/mutations'
import { loadNativeMovementReactionSources } from '../encounters/movementReactionFacts'
import { readGeometrySave, assertGeometryReceiving } from './geometryDocuments'
import { readSpatialSceneGeometry } from './spatialGeometry'
import { requireBoundTokenMoveControl } from '../encounters/actorController'

type Request = ReturnType<typeof sceneGeometryFinishInputSchema.parse>
type Footprint = SceneMovementPerceptionCapture['requests'][number]['observer']

export function requestFor(
  scope: Pick<SceneMovementPerceptionCapture, 'sceneId' | 'sceneVersion' | 'grid'>,
  observerToken: Footprint,
  subjectToken: Footprint
) {
  const observer = {
    position: observerToken.position,
    width: observerToken.width,
    height: observerToken.height
  }
  const subject = {
    position: subjectToken.position,
    width: subjectToken.width,
    height: subjectToken.height
  }
  return {
    key: checksumRuleDocument({ ...scope, observer, subject }),
    observer,
    subject
  }
}

export async function readMovement(
  ctx: MutationCtx,
  request: Request,
  currentGeometry?: Awaited<ReturnType<typeof readSpatialSceneGeometry>>
) {
  const currentSave = currentGeometry?.saveContext ?? (await readGeometrySave(ctx, request.saveId))
  const { save, header, userId, membership } = currentSave
  if (save.id !== request.saveId.toLowerCase())
    throw new Error('Movement perception save identity differs.')
  assertGeometryReceiving(save, header.version, userId)
  if (
    save.input.type !== 'MOVE_SCENE_TOKEN' ||
    save.input.expectedEncounterVersion === null ||
    !request.tokenOrdinals
  )
    throw new Error('Reaction perception requires bound Scene movement.')
  const movement = save.input
  const geometry =
    currentGeometry ??
    (await readSpatialSceneGeometry(ctx, request.saveId, request.tokenOrdinals, currentSave))
  const token = geometry.sceneTokens.find((value) => value.id === movement.tokenId)
  const response = save.movementResolution ? await assertMovementResolutionCurrent(ctx, save) : null
  if (!token || token.locked)
    throw new Error('Members may only move an unlocked token they control.')
  if (!response)
    await requireBoundTokenMoveControl(ctx, {
      campaign: currentSave.campaign,
      membership,
      encounterId: geometry.encounter.id,
      tokenId: token.id
    })
  if (
    checksumRuleDocument(token.position) !==
    checksumRuleDocument(response?.root.currentPosition ?? movement.path[0])
  )
    throw new Error('Movement path does not begin at the current token position.')
  const scope = {
    sceneId: header.id,
    sceneVersion: header.version,
    grid: encounterSceneGridPolicyRegistry.resolveEffectiveGrid({
      encounter: geometry.encounter,
      sceneGrid: header.grid
    })
  }
  return { save, header, movement, geometry, token, scope, response }
}

/** Only server-issued contact footprints leave the transaction; large Scene geometry stays in the action. */
export const capture = internalMutation({
  args: zodToConvexFields(sceneGeometryFinishInputSchema.shape),
  get returns() {
    return zodToConvex(sceneMovementPerceptionCaptureSchema)
  },
  handler: async (rawCtx, args): Promise<SceneMovementPerceptionCapture> => {
    const ctx = withSceneVisionTracking(rawCtx)
    const { header, movement, geometry, token, scope, response } = await readMovement(
      ctx,
      sceneGeometryFinishInputSchema.parse(args)
    )
    if (geometry.encounter.automationMode === 'MANUAL') return { ...scope, header, requests: [] }
    const context = response?.context
    const timeline =
      context?.kind === 'ENCOUNTER_MOVEMENT_REACTION'
        ? context.reactionTimeline
        : context?.kind === 'ENCOUNTER_MOVEMENT_PASSAGE_CHOICE'
          ? context.movement.reactionTimeline
          : context?.kind === 'ENCOUNTER_OPTIONAL_COMBAT_CONTEST'
            ? context.movementContinuation?.reactionTimeline
            : undefined
    const contacts = timeline
      ? timeline.flatMap((entry) =>
          entry.group.options.map((option) => ({
            candidate: option.candidate,
            perceptionRequirement: option.binding.perceptionRequirement
          }))
        )
      : collectEncounterMovementReactionContacts({
          grid: scope.grid,
          movementKind: movement.movementKind,
          movingTokenId: movement.tokenId,
          path: movement.path,
          actorIdByTokenId: geometry.actorIdByTokenId,
          tokens: geometry.sceneTokens,
          sources: discoverEncounterMovementReactionSources({
            ...(await loadNativeMovementReactionSources(ctx, {
              encounterId: geometry.encounter.id,
              expectedEncounterVersion: movement.expectedEncounterVersion!
            })),
            tokens: geometry.sceneTokens,
            actorIdByTokenId: geometry.actorIdByTokenId
          })
        }).map((contact) => ({
          candidate: contact.candidate,
          perceptionRequirement: contact.source.source.binding.perceptionRequirement
        }))
    const requests = new Map<string, SceneMovementPerceptionCapture['requests'][number]>()
    for (const contact of contacts) {
      if (contact.perceptionRequirement === null) continue
      const observer = geometry.sceneTokens.find(
        (entry) => entry.id === contact.candidate.reactorTokenId
      )
      if (!observer) throw new Error('Reaction observer token is unavailable.')
      const request = requestFor(scope, observer, {
        ...token,
        position: contact.candidate.contact
      })
      requests.set(request.key, request)
    }
    return sceneMovementPerceptionCaptureSchema.parse({
      ...scope,
      header,
      requests: [...requests.values()]
    })
  }
})
