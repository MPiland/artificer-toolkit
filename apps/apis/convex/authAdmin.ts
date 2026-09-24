import { authIdentityDtoSchema } from '@artificer-toolkit/schema/api/auth'
import { v } from 'convex/values'
import { components } from './_generated/api'
import { internalMutation } from './lib/mutations'

// Deployment-admin CLI only. Application clients cannot provision or change roles.
export const setRole = internalMutation({
  args: { userId: v.string(), role: v.union(v.literal('user'), v.literal('superadmin')) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = authIdentityDtoSchema.parse(args)
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_userId', (query) => query.eq('userId', identity.userId))
      .unique()
    if (!profile) throw new Error('Account not found')
    const user = await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: 'user',
      where: [{ field: '_id', value: profile.authUserId }]
    })
    if (!user) throw new Error('Account not found')
    if (
      identity.role === 'superadmin' &&
      (!user.emailVerified || (user.banned && (!user.banExpires || user.banExpires >= Date.now())))
    ) {
      throw new Error('A verified, active account is required')
    }
    if (user.role !== identity.role) {
      await ctx.runMutation(components.betterAuth.adapter.updateOne, {
        input: {
          model: 'user',
          where: [{ field: '_id', value: user._id }],
          update: { role: identity.role, updatedAt: Date.now() }
        }
      })
    }
    return null
  }
})
