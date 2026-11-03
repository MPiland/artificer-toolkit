import { socialProfileDtoSchema } from '@artificer-toolkit/schema/api/socialHub'
import type { SocialStoredProfile } from '@artificer-toolkit/schema/projections/socialPersistence'
import type { QueryCtx } from '../_generated/server'
import { isAuthUserBanned, readAuthUser } from '../lib/authUserReads'
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

/**
 * Reads the account behind another viewer's social profile for discovery (D211). Inactive,
 * blocked and banned profiles return null so callers cannot tell them apart. A ban is read here
 * rather than written as a suspension because bans are applied outside the app and can expire.
 */
export async function readDiscoverableAccount(
  ctx: QueryCtx,
  viewer: SocialStoredProfile,
  profile: SocialStoredProfile
) {
  if (profile.status !== 'ACTIVE' || (await hasSocialBlock(ctx, viewer.id, profile.id)))
    return null
  const account = await ctx.db
    .query('userProfiles')
    .withIndex('by_userId', (q) => q.eq('userId', profile.userId))
    .unique()
  const user = account ? await readAuthUser(ctx, account.authUserId) : null
  return account && user && !isAuthUserBanned(user) ? account : null
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
