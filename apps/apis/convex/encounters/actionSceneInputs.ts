import type { ResolveEncounterActionInputDto } from '@artificer-toolkit/schema/api/encounters'
import type { SceneLiveEntity } from '@artificer-toolkit/schema/api/sceneLiveState'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import {
  encounterActorTokenBindingSchema,
  encounterSceneBindingSchema
} from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { sceneStoredDefinitionEntitySchema } from '@artificer-toolkit/schema/projections/sceneDefinitionPersistence'
import { VTT_SCENE_LIMITS } from '@artificer-toolkit/shared/vtt/scene'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { QueryCtx } from '../_generated/server'
import { parseLiveEntity, readLiveScene } from '../scenes/liveDocuments'
import { normalizeSceneGeometryEntity } from '../scenes/geometryValues'

/** Reads exact stored geometry without rules evaluation; the caller owns commit freshness. */
export async function readNativeActionSceneInputs(
  ctx: QueryCtx,
  state: EncounterRunState,
  command: Pick<ResolveEncounterActionInputDto, 'actorId' | 'targetActorId' | 'sceneContext'>,
  scope: 'OWNER' | 'MEMBER' = 'OWNER'
) {
  const request = command.sceneContext
  if (!request) return null
  const { header, live } = await readLiveScene(ctx, request.sceneId, scope)
  const bindingRow = await ctx.db
    .query('encounterSceneBindings')
    .withIndex('by_encounterId', (q) => q.eq('encounterId', state.id))
    .unique()
  if (!bindingRow) throw new Error('Action Scene context is stale.')
  const { _id, _creationTime, ...storedBinding } = bindingRow
  const binding = encounterSceneBindingSchema.parse(storedBinding)
  if (
    header.id !== request.sceneId ||
    header.version !== request.expectedSceneVersion ||
    header.campaignId !== state.campaignId ||
    binding.encounterId !== state.id ||
    binding.campaignId !== state.campaignId ||
    binding.sceneId !== header.id
  )
    throw new Error('Action Scene context is stale.')

  async function readToken(tokenId: string, actorId: string) {
    const actorBindingRow = await ctx.db
      .query('encounterActorTokenBindings')
      .withIndex('by_encounterId_tokenId', (q) =>
        q.eq('encounterId', state.id).eq('tokenId', tokenId)
      )
      .unique()
    if (!actorBindingRow) throw new Error('Action Scene token context is stale.')
    const { _id, _creationTime, ...storedActorBinding } = actorBindingRow
    const actorBinding = encounterActorTokenBindingSchema.parse(storedActorBinding)
    const actorRow = await ctx.db
      .query('encounterActorTokenBindings')
      .withIndex('by_encounterId_actorId', (q) =>
        q.eq('encounterId', state.id).eq('actorId', actorId)
      )
      .unique()
    if (
      actorBinding.actorId !== actorId ||
      actorBinding.sceneId !== header.id ||
      actorBinding.encounterId !== state.id ||
      actorBinding.tokenId !== tokenId ||
      actorRow?._id !== actorBindingRow._id
    )
      throw new Error('Action Scene token context is stale.')
    const overrideRow = await ctx.db
      .query('sceneLiveEntities')
      .withIndex('by_sceneId_collection_entityId', (q) =>
        q.eq('sceneId', header.id).eq('collection', 'tokens').eq('entityId', tokenId)
      )
      .unique()
    let value: Extract<SceneLiveEntity, { collection: 'tokens' }>
    if (overrideRow) {
      const override = parseLiveEntity(overrideRow, header.version)
      if (
        override.value?.collection !== 'tokens' ||
        override.ordinal === null ||
        override.ordinal >= (live?.nextOrdinals.tokens ?? header.counts.tokens)
      )
        throw new Error('Action Scene token is unavailable.')
      value = override.value
    } else {
      let row = await ctx.db
        .query('sceneDefinitionEntities')
        .withIndex('by_saveId_collection_entityId', (q) =>
          q
            .eq('saveId', header.definitionSaveId)
            .eq('value.collection', 'tokens')
            .eq('entityId', tokenId)
        )
        .unique()
      // Immutable saves preserve UUID spelling; bindings and live edits use canonical IDs.
      if (!row) {
        const tokens = await ctx.db
          .query('sceneDefinitionEntities')
          .withIndex('by_saveId_collection_ordinal', (q) =>
            q.eq('saveId', header.definitionSaveId).eq('value.collection', 'tokens')
          )
          .take(VTT_SCENE_LIMITS.tokens + 1)
        const matches = tokens.filter((token) => token.entityId.toLowerCase() === tokenId)
        if (tokens.length > VTT_SCENE_LIMITS.tokens || matches.length !== 1)
          throw new Error('Action Scene token is unavailable.')
        row = matches[0] ?? null
      }
      if (!row) throw new Error('Action Scene token is unavailable.')
      const { _id, _creationTime, ...stored } = row
      const base = sceneStoredDefinitionEntitySchema.parse(stored)
      if (
        base.saveId !== header.definitionSaveId ||
        base.value.collection !== 'tokens' ||
        base.entityId.toLowerCase() !== tokenId ||
        base.value.entity.id !== base.entityId ||
        base.ordinal >= header.counts.tokens ||
        base.checksum !== checksumCanonicalJson(base.value)
      )
        throw new Error('Stored action Scene token is inconsistent.')
      value = base.value
    }
    const normalized = normalizeSceneGeometryEntity(value)
    if (normalized.collection !== 'tokens') throw new Error('Action Scene token is unavailable.')
    const token = normalized.entity
    return {
      actorId,
      tokenId: token.id,
      position: token.position,
      width: token.width,
      height: token.height,
      rotationDegrees: token.rotationDegrees
    }
  }
  const [sourceToken, targetToken] = await Promise.all([
    readToken(request.sourceTokenId, command.actorId),
    readToken(request.targetTokenId, command.targetActorId)
  ])
  return {
    sceneId: header.id,
    sceneVersion: header.version,
    sourceToken,
    targetToken,
    sceneGrid: header.grid
  }
}
