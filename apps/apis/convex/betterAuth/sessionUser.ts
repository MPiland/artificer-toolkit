import { v } from 'convex/values'
import { query } from './_generated/server'
import schema from './schema'

// The app derives both identifiers from the same verified Convex identity.
export const get = query({
  args: { sessionId: v.string(), userId: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      ...schema.tables.user.validator.fields,
      _id: v.id('user'),
      _creationTime: v.number()
    })
  ),
  handler: async (ctx, { sessionId, userId }) => {
    const sessionKey = ctx.db.normalizeId('session', sessionId)
    const userKey = ctx.db.normalizeId('user', userId)
    if (!sessionKey || !userKey) return null
    const session = await ctx.db.get(sessionKey)
    if (!session || session.expiresAt <= Date.now() || session.userId !== userId) return null
    return ctx.db.get(userKey)
  }
})
