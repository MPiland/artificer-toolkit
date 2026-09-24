import { v } from 'convex/values'
import { makeFunctionReference } from 'convex/server'
import { internalMutation } from './lib/mutations'

const purgeRecipientReference = makeFunctionReference<'mutation', { userId: string }, null>(
  'accountUsage:purgeRecipient'
)

export const purgeRecipient = internalMutation({
  args: { userId: v.string() },
  returns: v.null(),
  handler: async (ctx, { userId }) => {
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .unique()
    if (profile) throw new Error('Cannot purge an active account usage history.')
    const rows = await ctx.db
      .query('accountUsageEntries')
      .withIndex('by_ownerUserId', (q) => q.eq('ownerUserId', userId))
      .take(64)
    for (const row of rows) await ctx.db.delete(row._id)
    if (rows.length === 64) await ctx.scheduler.runAfter(0, purgeRecipientReference, { userId })
    return null
  }
})
