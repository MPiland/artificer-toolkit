import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  sceneMeasurementsPageInputSchema,
  sceneMeasurementsPageSchema
} from '@artificer-toolkit/schema/api/sceneLiveState'
import { query } from '../lib/queries'
import { readLiveScene, parseLiveEntity } from './liveDocuments'

export const list = query({
  args: zodToConvexFields(sceneMeasurementsPageInputSchema.shape),
  returns: zodToConvex(sceneMeasurementsPageSchema),
  handler: async (ctx, args) => {
    const input = sceneMeasurementsPageInputSchema.parse(args)
    const { header } = await readLiveScene(ctx, input.sceneId, 'MEMBER')
    if (
      (input.paginationOpts.cursor !== null && input.expectedVersion === null) ||
      (input.expectedVersion !== null && input.expectedVersion !== header.version)
    )
      throw new Error('Live Scene snapshot changed before measurement hydration.')
    const result = await ctx.db
      .query('sceneLiveEntities')
      .withIndex('by_sceneId_collection_entityId', (q) =>
        q.eq('sceneId', header.id).eq('collection', 'measurements')
      )
      .paginate({ ...input.paginationOpts, maximumRowsRead: 8, maximumBytesRead: 512 * 1024 })
    return sceneMeasurementsPageSchema.parse({
      ...result,
      version: header.version,
      count: header.currentCounts.measurements,
      page: result.page.flatMap((row) => {
        const change = parseLiveEntity(row, header.version)
        if (change.value === null) return []
        if (change.value.collection !== 'measurements' || change.ordinal === null)
          throw new Error('Stored live Scene measurement is inconsistent.')
        return [{ ordinal: change.ordinal, measurement: change.value.entity }]
      })
    })
  }
})
