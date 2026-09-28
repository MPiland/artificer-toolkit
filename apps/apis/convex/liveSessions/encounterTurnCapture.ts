import type {
  LiveSessionEncounterRulesRequest,
  LiveSessionEncounterRulesResponse
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { QueryCtx } from '../_generated/server'
import { readMaintainedState } from '@artificer-toolkit/encounter-persistence/effectStore'
import { readSpatialEffect } from '@artificer-toolkit/encounter-persistence/spatialEffectStore'
import { readCurrentEntities } from '../scenes/currentEntities'
import { readLiveScene } from '../scenes/liveDocuments'

type TurnRequest = Extract<
  LiveSessionEncounterRulesRequest,
  {
    kind:
      | 'MAINTENANCE_STATE'
      | 'SCENE_PERCEPTION'
      | 'SCENE_PERCEPTION_ENTITIES'
      | 'SCENE_SPATIAL_EFFECTS'
  }
>
type TurnResponse = {
  [K in TurnRequest['kind']]: Omit<
    Extract<LiveSessionEncounterRulesResponse, { kind: K }>,
    'readChecksum' | 'revisions'
  >
}[TurnRequest['kind']]

/** The caller has checked owner authority, the live Session epoch, and the exact Run version. */
export async function readEncounterTurnCapture(
  ctx: QueryCtx,
  state: EncounterRunState,
  request: TurnRequest
): Promise<TurnResponse> {
  if (request.kind === 'MAINTENANCE_STATE') {
    const row = await ctx.db
      .query('encounterMaintainedEffectStates')
      .withIndex('by_encounterId_id', (q) =>
        q.eq('encounterId', state.id).eq('id', request.stateId)
      )
      .unique()
    return { kind: request.kind, state: row ? readMaintainedState(row) : null }
  }

  if (
    request.kind === 'SCENE_PERCEPTION' &&
    (!state.actorIds.includes(request.observerActorId) ||
      !state.actorIds.includes(request.subjectActorId))
  )
    throw new Error('Turn effect perception actor is not in the Encounter.')

  const binding = await ctx.db
    .query('encounterSceneBindings')
    .withIndex('by_encounterId', (q) => q.eq('encounterId', state.id))
    .unique()

  if (request.kind === 'SCENE_PERCEPTION') {
    if (!binding) return { kind: request.kind, context: null }
    const [observerBinding, subjectBinding] = await Promise.all([
      ctx.db
        .query('encounterActorTokenBindings')
        .withIndex('by_encounterId_actorId', (q) =>
          q.eq('encounterId', state.id).eq('actorId', request.observerActorId)
        )
        .unique(),
      ctx.db
        .query('encounterActorTokenBindings')
        .withIndex('by_encounterId_actorId', (q) =>
          q.eq('encounterId', state.id).eq('actorId', request.subjectActorId)
        )
        .unique()
    ])
    if (!observerBinding || !subjectBinding) return { kind: request.kind, context: null }
    if (
      binding.campaignId !== state.campaignId ||
      observerBinding.sceneId !== binding.sceneId ||
      subjectBinding.sceneId !== binding.sceneId
    )
      throw new Error('Turn effect perception binding is stale.')
    const { header } = await readLiveScene(ctx, binding.sceneId, 'MEMBER')
    if (header.campaignId !== state.campaignId) throw new Error('Turn effect Scene is stale.')
    return {
      kind: request.kind,
      context: {
        header,
        observerTokenId: observerBinding.tokenId,
        subjectTokenId: subjectBinding.tokenId
      }
    }
  }

  const sceneId =
    request.kind === 'SCENE_PERCEPTION_ENTITIES' ? request.page.sceneId : request.sceneId
  if (!binding || binding.sceneId !== sceneId || binding.campaignId !== state.campaignId)
    throw new Error('Turn effect perception Scene scope is unavailable.')
  const { header } = await readLiveScene(ctx, sceneId, 'MEMBER')
  if (header.campaignId !== state.campaignId) throw new Error('Turn effect Scene is stale.')
  if (request.kind === 'SCENE_PERCEPTION_ENTITIES') {
    if (
      header.version !== request.page.expectedVersion ||
      header.definitionSaveId !== request.page.definitionSaveId
    )
      throw new Error('Turn effect Scene changed before entity capture.')
    return {
      kind: request.kind,
      page: await readCurrentEntities(ctx, request.page, 'MEMBER')
    }
  }
  if (header.version !== request.expectedSceneVersion)
    throw new Error('Turn effect Scene changed before spatial effect capture.')
  const rows = await ctx.db
    .query('encounterSpatialRuleEffects')
    .withIndex('by_encounterId_sceneId_id', (q) =>
      request.afterEffectId === null
        ? q.eq('encounterId', state.id).eq('sceneId', sceneId)
        : q.eq('encounterId', state.id).eq('sceneId', sceneId).gt('id', request.afterEffectId)
    )
    .take(4)
  const effects = rows.map(readSpatialEffect)
  return {
    kind: request.kind,
    sceneId,
    sceneVersion: header.version,
    effects,
    continueAfter: effects.length === 4 ? effects[3]!.id : null
  }
}
