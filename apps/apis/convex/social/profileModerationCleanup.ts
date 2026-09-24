import { makeFunctionReference } from 'convex/server'
import { v } from 'convex/values'
import { campaignStoredInviteSchema } from '@artificer-toolkit/schema/projections/campaignPersistence'
import {
  socialStoredApplicationSchema,
  socialStoredListingSchema
} from '@artificer-toolkit/schema/projections/socialPersistence'
import { type MutationCtx } from '../_generated/server'
import { internalMutation } from '../lib/mutations'
import { syncAccountUsage } from '../lib/accountUsage'
import { cancelNotification } from '../notifications/intents'
import {
  applicationInvalidationPatch,
  invitationInvalidationPatch,
  readAdmissionInvalidation
} from './admissionInvalidation'
import { resolveListingSuspension } from './profileInvalidation'

const PAGE_SIZE = 20
const phases = ['LISTING', 'APPLICATION', 'INVITATION'] as const
type CleanupPhase = (typeof phases)[number]
type CleanupArgs = {
  profileId: string
  userId: string
  generation: number
  invalidatedAt: string
  phase: CleanupPhase
  cursor: string | null
}

const nextPage = makeFunctionReference<'mutation', CleanupArgs, null>(
  'social/profileModerationCleanup:run'
)
const listingCleanup = makeFunctionReference<
  'mutation',
  {
    listingId: string
    ownerUserId: string
    generation: number
    profileGeneration: number
    invalidatedAt: string
    phase: 'APPLICATION'
    cursor: null
  },
  null
>('social/listingModerationCleanup:run')

async function currentListing(ctx: MutationCtx, listingId: string) {
  const row = await ctx.db
    .query('socialListings')
    .withIndex('by_publicId', (q) => q.eq('id', listingId))
    .unique()
  if (!row) return null
  const { _id, _creationTime, ...stored } = row
  return socialStoredListingSchema.parse(stored)
}

export const run = internalMutation({
  args: {
    profileId: v.string(),
    userId: v.string(),
    generation: v.number(),
    invalidatedAt: v.string(),
    phase: v.union(...phases.map((phase) => v.literal(phase))),
    cursor: v.union(v.null(), v.string())
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (args.phase === 'LISTING') {
      const page = await ctx.db
        .query('socialListings')
        .withIndex('by_ownerUserId_updatedAt_id', (q) => q.eq('ownerUserId', args.userId))
        .paginate({ cursor: args.cursor, numItems: PAGE_SIZE })
      for (const row of page.page) {
        const { _id, _creationTime, ...stored } = row
        const listing = socialStoredListingSchema.parse(stored)
        if ((listing.ownerProfileGeneration ?? 0) >= args.generation) continue
        const suspended = await resolveListingSuspension(ctx, listing)
        await ctx.db.replace(_id, suspended)
        await syncAccountUsage(ctx, 'publicListings', listing.id)
        await ctx.scheduler.runAfter(0, listingCleanup, {
          listingId: listing.id,
          ownerUserId: listing.ownerUserId,
          generation: 0,
          profileGeneration: suspended.ownerProfileGeneration ?? args.generation,
          invalidatedAt: args.invalidatedAt,
          phase: 'APPLICATION',
          cursor: null
        })
      }
      if (!page.isDone) {
        await ctx.scheduler.runAfter(0, nextPage, { ...args, cursor: page.continueCursor })
        return null
      }
      await ctx.scheduler.runAfter(0, nextPage, { ...args, phase: 'APPLICATION', cursor: null })
      return null
    }

    const application = args.phase === 'APPLICATION'
    const page = application
      ? await ctx.db
          .query('socialApplications')
          .withIndex('by_applicantProfileId_status_submittedAt_id', (q) =>
            q.eq('applicantProfileId', args.profileId).eq('status', 'SUBMITTED')
          )
          .paginate({ cursor: args.cursor, numItems: PAGE_SIZE })
      : await ctx.db
          .query('campaignInvites')
          .withIndex('by_recipientUserId_status_createdAt_id', (q) =>
            q.eq('recipientUserId', args.userId).eq('status', 'PENDING')
          )
          .paginate({ cursor: args.cursor, numItems: PAGE_SIZE })
    for (const row of page.page) {
      const { _id, _creationTime, ...stored } = row
      if (application) {
        const record = socialStoredApplicationSchema.parse(stored)
        if ((record.participantProfileGeneration ?? 0) >= args.generation) continue
        const listing = await currentListing(ctx, record.listingId)
        if (!listing) continue
        const event = await readAdmissionInvalidation(
          ctx,
          listing.ownerUserId,
          { profileId: record.applicantProfileId },
          record.blockGeneration ?? 0,
          { id: record.listingId, generation: record.listingGeneration ?? 0 },
          record
        )
        if (!event) throw new Error('Social profile invalidation is unavailable.')
        await ctx.db.patch(_id, applicationInvalidationPatch(record.version, event))
        await cancelNotification(ctx, {
          recipientUserId: listing.ownerUserId,
          sourcePublicId: record.id,
          workflowKey: 'social-application-submitted',
          occurredAt: event.invalidatedAt
        })
      } else {
        const record = campaignStoredInviteSchema.parse(stored)
        if ((record.participantProfileGeneration ?? 0) >= args.generation) continue
        const listing = await currentListing(ctx, record.listingId)
        if (!listing || record.createdBy !== listing.ownerUserId) continue
        const event = await readAdmissionInvalidation(
          ctx,
          listing.ownerUserId,
          { userId: record.recipientUserId },
          record.blockGeneration ?? 0,
          { id: record.listingId, generation: record.listingGeneration ?? 0 },
          record
        )
        if (!event) throw new Error('Social profile invalidation is unavailable.')
        await ctx.db.patch(_id, invitationInvalidationPatch(record.version, event))
        await cancelNotification(ctx, {
          recipientUserId: record.recipientUserId,
          sourcePublicId: record.id,
          workflowKey: 'social-invitation-received',
          occurredAt: event.invalidatedAt
        })
      }
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, nextPage, { ...args, cursor: page.continueCursor })
      return null
    }
    if (args.phase === 'APPLICATION')
      await ctx.scheduler.runAfter(0, nextPage, { ...args, phase: 'INVITATION', cursor: null })
    return null
  }
})
