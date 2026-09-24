import { zeroAccountUsage } from '@artificer-toolkit/schema/projections/accountUsage'
import { internal } from '../_generated/api'
import type { MutationCtx } from '../_generated/server'
import { removeAccountCampaignMemberships } from '../campaigns/accountDeparture.helper'
import { scheduleOwnerCopyCleanup } from '../campaigns/copyJobCleanup'
import { removeAccountPrivateCharacters } from '../characters/accountDeletion'
import { removeAccountContentSources } from '../content/accountDefinitionDeletion'
import { removeAccountAuthoredContent } from '../content/deletion'
import { retainAccountCampaignMedia } from '../media/accountRetention.helper'
import { retainedFeed } from '../notifications/feed'
import { prepareSocialAccountDeletion } from '../social/accountCleanup'
import { syncAccountUsage } from './accountUsage'

type AuthUser = { _id: string }

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
      entitlementUsage: zeroAccountUsage,
      entitlementUsageReady: true
    })
  }
}

export async function onAuthUserDelete(ctx: MutationCtx, user: AuthUser): Promise<void> {
  const profile = await ctx.db
    .query('userProfiles')
    .withIndex('by_authUserId', (query) => query.eq('authUserId', user._id))
    .unique()

  if (!profile) return

  const socialProfile = await ctx.db
    .query('socialProfiles')
    .withIndex('by_userId', (query) => query.eq('userId', profile.userId))
    .unique()
  const ownedCampaign = await ctx.db
    .query('campaigns')
    .withIndex('by_ownerUserId_status', (query) => query.eq('ownerUserId', profile.userId))
    .first()
  if (ownedCampaign) throw new Error('Account deletion is restricted by owned Campaigns.')
  await retainAccountCampaignMedia(ctx, profile.userId)
  await prepareSocialAccountDeletion(ctx, profile.userId, socialProfile?.id ?? null)
  await removeAccountCampaignMemberships(ctx, profile.userId)
  await removeAccountPrivateCharacters(ctx, profile.userId)
  await removeAccountAuthoredContent(ctx, profile.userId)
  await removeAccountContentSources(ctx, profile.userId)
  const [blueprintUpdates, blueprints] = await Promise.all([
    ctx.db
      .query('encounterBlueprintUpdates')
      .withIndex('by_ownerUserId_commandId', (query) => query.eq('ownerUserId', profile.userId))
      .collect(),
    ctx.db
      .query('encounterBlueprints')
      .withIndex('by_ownerUserId_commandId', (query) => query.eq('ownerUserId', profile.userId))
      .collect()
  ])
  for (const update of blueprintUpdates) await ctx.db.delete(update._id)
  for (const blueprint of blueprints) {
    await ctx.db.delete(blueprint._id)
    await syncAccountUsage(ctx, 'savedEncounters', blueprint.id)
  }
  if (socialProfile) await ctx.db.delete(socialProfile._id)
  const socialLimits = await ctx.db
    .query('socialActionRateLimits')
    .withIndex('by_userId_action_window', (query) => query.eq('userId', profile.userId))
    .take(9)
  if (socialLimits.length > 8) throw new Error('Invalid Social rate-limit cardinality.')
  for (const limit of socialLimits) await ctx.db.delete(limit._id)
  const notifications = await retainedFeed(ctx, profile.userId)
  for (const notification of notifications) await ctx.db.delete(notification._id)
  const entitlement = await ctx.db
    .query('accountEntitlements')
    .withIndex('by_userId', (query) => query.eq('userId', profile.userId))
    .unique()
  if (entitlement) await ctx.db.delete(entitlement._id)
  const usageEntry = await ctx.db
    .query('accountUsageEntries')
    .withIndex('by_ownerUserId', (query) => query.eq('ownerUserId', profile.userId))
    .first()
  await ctx.db.delete(profile._id)
  await scheduleOwnerCopyCleanup(ctx, profile.userId)
  if (usageEntry)
    await ctx.scheduler.runAfter(0, internal.accountUsage.purgeRecipient, {
      userId: profile.userId
    })
  await ctx.scheduler.runAfter(0, internal.notifications.delivery.purgeRecipient, {
    userId: profile.userId
  })
  await ctx.scheduler.runAfter(0, internal.media.assets.purgeAccount, {
    userId: profile.userId
  })
  await ctx.scheduler.runAfter(0, internal.social.accountCleanup.run, {
    userId: profile.userId,
    profileId: socialProfile?.id ?? null
  })
}
