import {
  sceneCurrentEntityPageInputSchema,
  type SceneCurrentEntityPage,
  type SceneCurrentEntityPageInput
} from '@artificer-toolkit/schema/api/sceneRecipient'
import { readSceneCurrentEntities } from '@artificer-toolkit/encounter-persistence/sceneCurrentEntities'
import type { Doc } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import { readLiveScene } from './liveDocuments'

function stored<T extends { _id: unknown; _creationTime: unknown }>(row: T) {
  const { _id, _creationTime, ...value } = row
  return value
}

type LiveSceneRead = Pick<Awaited<ReturnType<typeof readLiveScene>>, 'header' | 'live'>

export async function readCurrentEntitiesFromScene(
  ctx: QueryCtx,
  input: SceneCurrentEntityPageInput,
  scene: LiveSceneRead,
  prefetched?: {
    definitionEntities: readonly Doc<'sceneDefinitionEntities'>[]
    liveEntities: readonly Doc<'sceneLiveEntities'>[]
  }
): Promise<SceneCurrentEntityPage> {
  return readSceneCurrentEntities(input, scene, {
    readDefinitionEntities: async ({ saveId, collection, afterOrdinal, numItems }) => {
      const rows = prefetched
        ? prefetched.definitionEntities
            .filter(
              (row) =>
                row.saveId === saveId &&
                row.value.collection === collection &&
                row.ordinal > afterOrdinal
            )
            .sort((left, right) => left.ordinal - right.ordinal)
            .slice(0, numItems + 1)
        : await ctx.db
            .query('sceneDefinitionEntities')
            .withIndex('by_saveId_collection_ordinal', (q) =>
              q.eq('saveId', saveId).eq('value.collection', collection).gt('ordinal', afterOrdinal)
            )
            .take(numItems + 1)
      return rows.map(stored)
    },
    readLiveEntity: async ({ sceneId, collection, entityId }) => {
      const matchingOverrides = prefetched?.liveEntities.filter(
        (row) =>
          row.sceneId === sceneId && row.collection === collection && row.entityId === entityId
      )
      if (matchingOverrides && matchingOverrides.length > 1)
        throw new Error('Stored Scene geometry override is inconsistent.')
      const row = prefetched
        ? (matchingOverrides?.[0] ?? null)
        : await ctx.db
            .query('sceneLiveEntities')
            .withIndex('by_sceneId_collection_entityId', (q) =>
              q.eq('sceneId', sceneId).eq('collection', collection).eq('entityId', entityId)
            )
            .unique()
      return row ? stored(row) : null
    },
    readLiveEntities: async ({ sceneId, collection, afterOrdinal, numItems }) => {
      const rows = prefetched
        ? prefetched.liveEntities
            .filter(
              (row) =>
                row.sceneId === sceneId &&
                row.collection === collection &&
                row.ordinal !== null &&
                row.ordinal > afterOrdinal
            )
            .sort((left, right) => left.ordinal! - right.ordinal!)
            .slice(0, numItems + 1)
        : await ctx.db
            .query('sceneLiveEntities')
            .withIndex('by_sceneId_collection_ordinal', (q) =>
              q.eq('sceneId', sceneId).eq('collection', collection).gt('ordinal', afterOrdinal)
            )
            .take(numItems + 1)
      return rows.map(stored)
    }
  })
}

export async function readCurrentEntities(
  ctx: QueryCtx,
  input: SceneCurrentEntityPageInput,
  scope: 'OWNER' | 'MEMBER'
): Promise<SceneCurrentEntityPage> {
  const parsed = sceneCurrentEntityPageInputSchema.parse(input)
  return readCurrentEntitiesFromScene(ctx, parsed, await readLiveScene(ctx, parsed.sceneId, scope))
}
