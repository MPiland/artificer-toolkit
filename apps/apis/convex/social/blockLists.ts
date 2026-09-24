import { stream } from 'convex-helpers/server/stream'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  socialBlockListInputSchema,
  socialBlockPageSchema,
  type SocialBlockPage
} from '@artificer-toolkit/schema/api/socialBlockLists'
import {
  socialStoredBlockSchema,
  socialStoredProfileSchema
} from '@artificer-toolkit/schema/projections/socialPersistence'
import { query } from '../_generated/server'
import schema from '../schema'
import { presentSocialProfile, requireSocialViewer } from './visibility'

export const list = query({
  args: zodToConvexFields(socialBlockListInputSchema.shape),
  returns: zodToConvex(socialBlockPageSchema),
  handler: async (ctx, args): Promise<SocialBlockPage> => {
    const input = socialBlockListInputSchema.parse(args)
    const actor = await requireSocialViewer(ctx)
    const result = await stream(ctx.db, schema)
      .query('socialBlocks')
      .withIndex('by_blockerProfileId_createdAt_blockedProfileId', (q) =>
        q.eq('blockerProfileId', actor.id)
      )
      .order('desc')
      .map(async (row) => {
        const { _id, _creationTime, ...stored } = row
        const block = socialStoredBlockSchema.parse(stored)
        const target = await ctx.db
          .query('socialProfiles')
          .withIndex('by_publicId', (q) => q.eq('id', block.blockedProfileId))
          .unique()
        if (!target) return null
        const { _id: _targetId, _creationTime: _targetCreated, ...profile } = target
        const parsed = socialStoredProfileSchema.parse(profile)
        try {
          return {
            profile: await presentSocialProfile(ctx, parsed),
            createdAt: block.createdAt
          }
        } catch (error) {
          if (error instanceof Error && error.message === 'Social profile not found.') return null
          throw error
        }
      })
      .paginate({ ...input.paginationOpts, maximumRowsRead: 8, maximumBytesRead: 1024 * 1024 })
    return socialBlockPageSchema.parse(result)
  }
})
