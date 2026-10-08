import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  sceneLiveStateHeaderSchema,
  sceneLiveStateEntityPageInputSchema
} from '@artificer-toolkit/schema/api/sceneLiveState'
import { sceneDefinitionEntityPageSchema } from '@artificer-toolkit/schema/api/sceneDefinitionSave'
import { getCampaignLiveSceneInputDtoSchema } from '@artificer-toolkit/schema/api/vttScenes'
import { sceneStoredDefinitionEntitySchema } from '@artificer-toolkit/schema/projections/sceneDefinitionPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { query } from '../lib/queries'
import { readLiveScene } from './liveDocuments'

function stored<T extends { _id: unknown; _creationTime: unknown }>(row: T) {
  const { _id, _creationTime, ...value } = row
  return value
}

export const header = query({
  args: zodToConvexFields(getCampaignLiveSceneInputDtoSchema.shape),
  returns: zodToConvex(sceneLiveStateHeaderSchema),
  handler: async (ctx, args) => {
    const input = getCampaignLiveSceneInputDtoSchema.parse(args)
    return (await readLiveScene(ctx, input.sceneId, 'OWNER')).header
  }
})

export const entities = query({
  args: zodToConvexFields(sceneLiveStateEntityPageInputSchema.shape),
  returns: zodToConvex(sceneDefinitionEntityPageSchema),
  handler: async (ctx, args) => {
    const input = sceneLiveStateEntityPageInputSchema.parse(args)
    const { header: scene } = await readLiveScene(ctx, input.sceneId, 'OWNER')
    if (
      scene.version !== input.expectedVersion ||
      scene.definitionSaveId !== input.definitionSaveId.toLowerCase()
    )
      throw new Error('Live Scene snapshot changed before hydration.')
    const result = await ctx.db
      .query('sceneDefinitionEntities')
      .withIndex('by_saveId_collection_ordinal', (q) =>
        q.eq('saveId', scene.definitionSaveId).eq('value.collection', input.collection)
      )
      .paginate({ ...input.paginationOpts, maximumRowsRead: 8, maximumBytesRead: 512 * 1024 })
    return sceneDefinitionEntityPageSchema.parse({
      ...result,
      page: result.page.map((row) => {
        const entity = sceneStoredDefinitionEntitySchema.parse(stored(row))
        if (
          entity.saveId !== scene.definitionSaveId ||
          entity.value.collection !== input.collection ||
          entity.entityId !== entity.value.entity.id ||
          entity.ordinal >= scene.counts[input.collection] ||
          entity.checksum !== checksumCanonicalJson(entity.value)
        )
          throw new Error('Stored live Scene entity is inconsistent.')
        return { ordinal: entity.ordinal, value: entity.value }
      })
    })
  }
})
