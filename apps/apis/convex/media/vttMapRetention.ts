import { v } from 'convex/values'
import { internalMutation } from '../lib/mutations'
import { mapIsReferenced } from './vttMapDocuments'

export const backfill = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  returns: v.object({
    cursor: v.union(v.string(), v.null()),
    isDone: v.boolean(),
    processed: v.number(),
    orphanedReferencedMapIds: v.array(v.string())
  }),
  handler: async (ctx, { cursor }) => {
    const page = await ctx.db.query('mediaAssets').paginate({ cursor, numItems: 8 })
    let processed = 0
    const orphanedReferencedMapIds: string[] = []
    for (const asset of page.page) {
      if (asset.profileClass !== 'VTT_MAP') continue
      processed += 1
      const hasSceneReferences = await mapIsReferenced(ctx, asset.id)
      if (asset.hasSceneReferences !== hasSceneReferences)
        await ctx.db.patch(asset._id, { hasSceneReferences })
      if (
        hasSceneReferences &&
        !(await ctx.db
          .query('userProfiles')
          .withIndex('by_userId', (q) => q.eq('userId', asset.ownerUserId))
          .unique())
      )
        orphanedReferencedMapIds.push(asset.id)
    }
    return {
      cursor: page.isDone ? null : page.continueCursor,
      isDone: page.isDone,
      processed,
      orphanedReferencedMapIds
    }
  }
})
