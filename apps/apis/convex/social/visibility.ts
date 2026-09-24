import { socialProfileDtoSchema } from '@artificer-toolkit/schema/api/socialHub'
import type { SocialStoredProfile } from '@artificer-toolkit/schema/projections/socialPersistence'
import type { QueryCtx } from '../_generated/server'
import { readAuthUser } from '../lib/authUserReads'
import { requireIdentity } from '../lib/identity'
import { readProfile } from './profiles'

export async function requireSocialViewer(ctx: QueryCtx) {
  const { userId } = await requireIdentity(ctx)
  const profile = (await readProfile(ctx, userId))?.profile
  if (!profile || profile.status !== 'ACTIVE')
    throw new Error('An active Social profile is required.')
  return profile
}

export async function hasSocialBlock(ctx: QueryCtx, first: string, second: string) {
  const blocks = await Promise.all([
    ctx.db
      .query('socialBlocks')
      .withIndex('by_blockerProfileId_blockedProfileId', (q) =>
        q.eq('blockerProfileId', first).eq('blockedProfileId', second)
      )
      .unique(),
    ctx.db
      .query('socialBlocks')
      .withIndex('by_blockerProfileId_blockedProfileId', (q) =>
        q.eq('blockerProfileId', second).eq('blockedProfileId', first)
      )
      .unique()
  ])
  return blocks.some((block) => block !== null)
}

export async function presentSocialProfile(ctx: QueryCtx, profile: SocialStoredProfile) {
  const account = await ctx.db
    .query('userProfiles')
    .withIndex('by_userId', (q) => q.eq('userId', profile.userId))
    .unique()
  const user = account ? await readAuthUser(ctx, account.authUserId) : null
  const username = user?.displayUsername ?? user?.username
  if (!username) throw new Error('Social profile not found.')
  return socialProfileDtoSchema.parse({ profilePublicId: profile.id, username })
}
