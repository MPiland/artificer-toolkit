import { SOCIAL_RATE_LIMITS } from '@artificer-toolkit/shared/social/rateLimits'
import { socialStoredRateLimitSchema } from '@artificer-toolkit/schema/projections/socialPersistence'
import type { MutationCtx } from '../_generated/server'

// Called inside the authorized source mutation: failure rolls back every counter and source write.
export async function consumeSocialRateLimit(
  ctx: MutationCtx,
  userId: string,
  action: keyof typeof SOCIAL_RATE_LIMITS
) {
  const now = Date.now()
  for (const { window, limit } of SOCIAL_RATE_LIMITS[action]) {
    const duration = window === 'HOUR' ? 3_600_000 : 86_400_000
    let windowStartedAt = new Date(Math.floor(now / duration) * duration).toISOString()
    const row = await ctx.db
      .query('socialActionRateLimits')
      .withIndex('by_userId_action_window', (q) =>
        q.eq('userId', userId).eq('action', action).eq('window', window)
      )
      .unique()
    let count = 0
    if (row) {
      const { _id, _creationTime, ...stored } = row
      const current = socialStoredRateLimitSchema.parse(stored)
      if (Date.parse(current.windowStartedAt) >= Date.parse(windowStartedAt)) {
        count = current.count
        windowStartedAt = current.windowStartedAt
      }
    }
    if (count >= limit) throw new Error('Too many Social actions. Try again later.')
    const value = socialStoredRateLimitSchema.parse({
      userId,
      action,
      window,
      windowStartedAt,
      count: count + 1
    })
    if (row) await ctx.db.replace(row._id, value)
    else await ctx.db.insert('socialActionRateLimits', value)
  }
}
