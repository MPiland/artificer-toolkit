import type { ResolveEncounterActionInputDto } from '@artificer-toolkit/schema/api/encounters'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { readEncounterActionSceneInputs } from '@artificer-toolkit/encounter-persistence/actionSceneInputs'
import { VTT_SCENE_LIMITS } from '@artificer-toolkit/shared/vtt/scene'
import type { QueryCtx } from '../_generated/server'
import { readLiveScene } from '../scenes/liveDocuments'
import { createConvexEncounterStoreReader } from '../lib/convexEncounterStore'

/** Reads exact stored geometry without rules evaluation; the caller owns commit freshness. */
export async function readNativeActionSceneInputs(
  ctx: QueryCtx,
  state: EncounterRunState,
  command: Pick<ResolveEncounterActionInputDto, 'actorId' | 'targetActorId' | 'sceneContext'>,
  scope: 'OWNER' | 'MEMBER' = 'OWNER'
) {
  return readEncounterActionSceneInputs(
    { db: createConvexEncounterStoreReader(ctx) },
    state,
    command,
    {
      readScene: (sceneId) => readLiveScene(ctx, sceneId, scope),
      readLiveToken: async (sceneId, tokenId) => {
        const row = await ctx.db
          .query('sceneLiveEntities')
          .withIndex('by_sceneId_collection_entityId', (q) =>
            q.eq('sceneId', sceneId).eq('collection', 'tokens').eq('entityId', tokenId)
          )
          .unique()
        if (!row) return null
        const { _id, _creationTime, ...stored } = row
        return stored
      },
      readDefinitionToken: async (saveId, tokenId) => {
        let row = await ctx.db
          .query('sceneDefinitionEntities')
          .withIndex('by_saveId_collection_entityId', (q) =>
            q.eq('saveId', saveId).eq('value.collection', 'tokens').eq('entityId', tokenId)
          )
          .unique()
        // Immutable saves preserve UUID spelling; bindings and live edits use canonical IDs.
        if (!row) {
          const tokens = await ctx.db
            .query('sceneDefinitionEntities')
            .withIndex('by_saveId_collection_ordinal', (q) =>
              q.eq('saveId', saveId).eq('value.collection', 'tokens')
            )
            .take(VTT_SCENE_LIMITS.tokens + 1)
          const matches = tokens.filter((token) => token.entityId.toLowerCase() === tokenId)
          if (tokens.length > VTT_SCENE_LIMITS.tokens || matches.length !== 1)
            throw new Error('Action Scene token is unavailable.')
          row = matches[0] ?? null
        }
        if (!row) throw new Error('Action Scene token is unavailable.')
        const { _id, _creationTime, ...stored } = row
        return stored
      }
    }
  )
}
