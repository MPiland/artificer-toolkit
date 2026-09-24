import { components } from '../_generated/api'
import type { QueryCtx } from '../_generated/server'

export async function requireFixtureAccount(ctx: QueryCtx, userId: string) {
  if (process.env.SITE_URL !== 'http://localhost:3000')
    throw new Error('Fixture cleanup requires the development application origin.')
  const profile = await ctx.db
    .query('userProfiles')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .unique()
  if (!profile) throw new Error('Fixture profile is missing.')
  const user = await ctx.runQuery(components.betterAuth.adapter.findOne, {
    model: 'user',
    where: [{ field: '_id', value: profile.authUserId }]
  })
  if (!user || !/^draft_[0-9a-f]{12}@example\.invalid$/.test(user.email))
    throw new Error('Fixture account is required.')
}
