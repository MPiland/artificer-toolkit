import { zeroAccountUsage } from '@artificer-toolkit/schema/projections/accountUsage'
import { internal } from '../_generated/api'
import type { MutationCtx } from '../_generated/server'
import { scheduleLiveSessionInputInvalidation } from '../liveSessions/controlScheduling'

type AuthUser = { _id: string }

/** Username changes invalidate leased author labels in each active Campaign. */
export async function onAuthUserUpdate(ctx: MutationCtx, user: AuthUser): Promise<void> {
  const profile = await ctx.db
    .query('userProfiles')
    .withIndex('by_authUserId', (q) => q.eq('authUserId', user._id))
    .unique()
  if (!profile) return
  for await (const membership of ctx.db
    .query('campaignMemberships')
    .withIndex('by_userId_status_joinedAt', (q) =>
      q.eq('userId', profile.userId).eq('status', 'ACTIVE')
    )) {
    const authority = await ctx.db
      .query('campaignLiveAuthorities')
      .withIndex('by_campaignId', (q) => q.eq('campaignId', membership.campaignId))
      .unique()
    if (authority?.phase === 'DO_ACTIVE')
      await scheduleLiveSessionInputInvalidation(ctx, membership.campaignId, ['PREFERENCES'])
  }
}

export async function onAuthUserCreate(ctx: MutationCtx, user: AuthUser): Promise<void> {
  const existingProfile = await ctx.db
    .query('userProfiles')
    .withIndex('by_authUserId', (query) => query.eq('authUserId', user._id))
    .unique()

  if (!existingProfile) {
    await ctx.db.insert('userProfiles', {
      userId: crypto.randomUUID(),
      authUserId: user._id,
      bio: null,
      registrationCompleted: true,
      authoringExperience: 'guided',
      autoRollDice: true,
      gmRollVisibility: 'PUBLIC',
      entitlementUsage: zeroAccountUsage,
      entitlementUsageReady: true
    })
  }
}

/**
 * The atomic account commit of a staged deletion (ADR 0040): the job's last step, ACCOUNT, calls
 * `deleteUser` after every owned row is gone, and this removes the profiles and the job in one commit.
 */
export async function onAuthUserDelete(ctx: MutationCtx, user: AuthUser): Promise<void> {
  const profile = await ctx.db
    .query('userProfiles')
    .withIndex('by_authUserId', (query) => query.eq('authUserId', user._id))
    .unique()

  if (!profile) return

  const [job, socialProfile, ownedCampaign, activeMembership] = await Promise.all([
    ctx.db
      .query('accountDeletionJobs')
      .withIndex('by_userId', (query) => query.eq('userId', profile.userId))
      .unique(),
    ctx.db
      .query('socialProfiles')
      .withIndex('by_userId', (query) => query.eq('userId', profile.userId))
      .unique(),
    ctx.db
      .query('campaigns')
      .withIndex('by_ownerUserId_status', (query) => query.eq('ownerUserId', profile.userId))
      .first(),
    ctx.db
      .query('campaignMemberships')
      .withIndex('by_userId_status_joinedAt', (query) =>
        query.eq('userId', profile.userId).eq('status', 'ACTIVE')
      )
      .first()
  ])
  if (ownedCampaign) throw new Error('Account deletion is restricted by owned Campaigns.')
  if (activeMembership) throw new Error('Account deletion requires Campaign departure first.')
  if (job?.step !== 'ACCOUNT' || job.authUserId !== user._id)
    throw new Error('Account deletion is not scheduled.')
  if (socialProfile) await ctx.db.delete(socialProfile._id)
  await ctx.db.delete(profile._id)
  await ctx.db.delete(job._id)
  // These purges require the profile to be gone, so they follow this commit.
  await ctx.scheduler.runAfter(0, internal.accountDeletionFinish.purge, {
    userId: profile.userId,
    profileId: socialProfile?.id ?? null
  })
}
