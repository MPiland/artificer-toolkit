import { v } from 'convex/values'
import { internal } from './_generated/api'
import {
  ACCOUNT_DELETION_BATCH,
  accountDeletionStepArgs,
  continueAccountDeletion,
  readAccountDeletionStep
} from './accountDeletionJobs'
import { scheduleOwnerCopyCleanup } from './campaigns/copyJobCleanup'
import { syncAccountUsage } from './lib/accountUsage'
import { internalMutation } from './lib/mutations'
import { resetAccountRateLimits } from './lib/rateLimits'
import { retainedFeed } from './notifications/feed'

/**
 * The FINISH step (ADR 0040): saved Encounter Blueprints in batches, then the remaining user-keyed
 * rows, before the ACCOUNT step removes the provider account.
 */
export const step = internalMutation({
  args: accountDeletionStepArgs,
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await readAccountDeletionStep(ctx, args, 'FINISH')
    if (!job) return null
    const { userId } = job
    const [blueprintUpdates, blueprints] = await Promise.all([
      ctx.db
        .query('encounterBlueprintUpdates')
        .withIndex('by_ownerUserId_commandId', (query) => query.eq('ownerUserId', userId))
        .take(ACCOUNT_DELETION_BATCH),
      ctx.db
        .query('encounterBlueprints')
        .withIndex('by_ownerUserId_commandId', (query) => query.eq('ownerUserId', userId))
        .take(ACCOUNT_DELETION_BATCH)
    ])
    for (const update of blueprintUpdates) await ctx.db.delete(update._id)
    for (const blueprint of blueprints) {
      await ctx.db.delete(blueprint._id)
      await syncAccountUsage(ctx, 'savedEncounters', blueprint.id)
    }
    if (blueprintUpdates.length || blueprints.length) {
      await continueAccountDeletion(ctx, job, true)
      return null
    }

    await resetAccountRateLimits(ctx, userId)
    for (const notification of await retainedFeed(ctx, userId))
      await ctx.db.delete(notification._id)
    const entitlement = await ctx.db
      .query('accountEntitlements')
      .withIndex('by_userId', (query) => query.eq('userId', userId))
      .unique()
    if (entitlement) await ctx.db.delete(entitlement._id)
    await continueAccountDeletion(ctx, job, false)
    return null
  }
})

/**
 * Scheduled by the ACCOUNT commit once the profile is gone: the purges that page themselves and
 * refuse to run while the account still exists.
 */
export const purge = internalMutation({
  args: { userId: v.string(), profileId: v.union(v.null(), v.string()) },
  returns: v.null(),
  handler: async (ctx, { userId, profileId }) => {
    const usageEntry = await ctx.db
      .query('accountUsageEntries')
      .withIndex('by_ownerUserId', (query) => query.eq('ownerUserId', userId))
      .first()
    await scheduleOwnerCopyCleanup(ctx, userId)
    if (usageEntry)
      await ctx.scheduler.runAfter(0, internal.accountUsage.purgeRecipient, { userId })
    await ctx.scheduler.runAfter(0, internal.notifications.delivery.purgeRecipient, { userId })
    await ctx.scheduler.runAfter(0, internal.media.assets.purgeAccount, { userId })
    await ctx.scheduler.runAfter(0, internal.social.accountCleanup.run, { userId, profileId })
    return null
  }
})
