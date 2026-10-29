import { v } from 'convex/values'
import { internal } from '../_generated/api'
import type { MutationCtx } from '../_generated/server'
import {
  accountDeletionStepArgs,
  continueAccountDeletion,
  readAccountDeletionStep
} from '../accountDeletionJobs'
import { internalMutation } from '../lib/mutations'
import { cancelNotification } from '../notifications/intents'
import { socialStoredApplicationSchema } from '@artificer-toolkit/schema/projections/socialPersistence'
import { readAdmissionListing } from './admissionDocuments'

const PAGE_SIZE = 8
/** Withdraws the applicant's submissions while the Social profile still exists. */
async function prepareSocialAccountDeletion(ctx: MutationCtx, profileId: string) {
  const rows = await ctx.db
    .query('socialApplications')
    .withIndex('by_applicantProfileId_status_submittedAt_id', (q) =>
      q.eq('applicantProfileId', profileId)
    )
    .collect()
  const now = new Date().toISOString()
  for (const row of rows) {
    const { _id, _creationTime, ...stored } = row
    const application = socialStoredApplicationSchema.parse(stored)
    if (application.applicantProfileId !== profileId)
      throw new Error('Stored Social application applicant mismatch.')
    if (application.status === 'SUBMITTED') {
      const listing = await readAdmissionListing(ctx, application.listingId)
      if (listing.campaign.ownerUserId !== listing.host.userId)
        throw new Error('Stored Social application host mismatch.')
      const withdrawnAt = new Date(
        Math.max(Date.parse(now), Date.parse(application.updatedAt) + 1)
      ).toISOString()
      const updated = {
        ...application,
        applicantDeletedAt: withdrawnAt,
        status: 'WITHDRAWN' as const,
        withdrawnAt,
        version: application.version + 1,
        updatedAt: withdrawnAt
      }
      await ctx.db.replace(row._id, socialStoredApplicationSchema.parse(updated))
      await cancelNotification(ctx, {
        recipientUserId: listing.host.userId,
        sourcePublicId: application.id,
        workflowKey: 'social-application-submitted',
        occurredAt: withdrawnAt
      })
    } else await ctx.db.patch(row._id, { applicantDeletedAt: now })
  }
}

export const prepareAccountDeletion = internalMutation({
  args: accountDeletionStepArgs,
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await readAccountDeletionStep(ctx, args, 'SOCIAL')
    if (!job) return null
    const profile = await ctx.db
      .query('socialProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', job.userId))
      .unique()
    if (profile) await prepareSocialAccountDeletion(ctx, profile.id)
    await continueAccountDeletion(ctx, job, false)
    return null
  }
})

export const run = internalMutation({
  args: { userId: v.string(), profileId: v.union(v.null(), v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const profileId = args.profileId
    const account = await ctx.db
      .query('userProfiles')
      .withIndex('by_userId', (query) => query.eq('userId', args.userId))
      .unique()
    const profile = profileId
      ? await ctx.db
          .query('socialProfiles')
          .withIndex('by_publicId', (query) => query.eq('id', profileId))
          .unique()
      : null
    if (account || profile) return null

    const [outgoingBlocks, incomingBlocks, createdInvites, receivedInvites] = await Promise.all([
      profileId
        ? ctx.db
            .query('socialBlocks')
            .withIndex('by_blockerProfileId_blockedProfileId', (query) =>
              query.eq('blockerProfileId', profileId)
            )
            .take(PAGE_SIZE)
        : [],
      profileId
        ? ctx.db
            .query('socialBlocks')
            .withIndex('by_blockedProfileId_blockerProfileId', (query) =>
              query.eq('blockedProfileId', profileId)
            )
            .take(PAGE_SIZE)
        : [],
      ctx.db
        .query('campaignInvites')
        .withIndex('by_createdBy_id', (query) => query.eq('createdBy', args.userId))
        .take(PAGE_SIZE),
      ctx.db
        .query('campaignInvites')
        .withIndex('by_recipientUserId_status_createdAt_id', (query) =>
          query.eq('recipientUserId', args.userId)
        )
        .take(PAGE_SIZE)
    ])
    const pages = [outgoingBlocks, incomingBlocks, createdInvites, receivedInvites]
    for (const page of pages) for (const row of page) await ctx.db.delete(row._id)
    if (pages.some((page) => page.length === PAGE_SIZE))
      await ctx.scheduler.runAfter(0, internal.social.accountCleanup.run, args)
    return null
  }
})
