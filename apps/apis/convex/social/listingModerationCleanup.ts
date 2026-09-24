import { makeFunctionReference } from 'convex/server'
import { v } from 'convex/values'
import { campaignStoredInviteSchema } from '@artificer-toolkit/schema/projections/campaignPersistence'
import { socialStoredApplicationSchema } from '@artificer-toolkit/schema/projections/socialPersistence'
import { internalMutation } from '../lib/mutations'
import { cancelNotification } from '../notifications/intents'
import {
  applicationInvalidationPatch,
  invitationInvalidationPatch,
  readAdmissionInvalidation
} from './admissionInvalidation'

const PAGE_SIZE = 20
const phases = ['APPLICATION', 'INVITATION'] as const
type CleanupPhase = (typeof phases)[number]
type CleanupArgs = {
  listingId: string
  ownerUserId: string
  generation: number
  profileGeneration?: number
  invalidatedAt: string
  phase: CleanupPhase
  cursor: string | null
}

const nextPage = makeFunctionReference<'mutation', CleanupArgs, null>(
  'social/listingModerationCleanup:run'
)

export const run = internalMutation({
  args: {
    listingId: v.string(),
    ownerUserId: v.string(),
    generation: v.number(),
    profileGeneration: v.optional(v.number()),
    invalidatedAt: v.string(),
    phase: v.union(...phases.map((phase) => v.literal(phase))),
    cursor: v.union(v.null(), v.string())
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const listing = await ctx.db
      .query('socialListings')
      .withIndex('by_publicId', (q) => q.eq('id', args.listingId))
      .unique()
    // Transfer finalizes the old owner's pending requests; old jobs must not target the new owner's.
    if (!listing || listing.ownerUserId !== args.ownerUserId) return null
    const application = args.phase === 'APPLICATION'
    const page = application
      ? await ctx.db
          .query('socialApplications')
          .withIndex('by_listingId_status', (q) =>
            q.eq('listingId', args.listingId).eq('status', 'SUBMITTED')
          )
          .paginate({ cursor: args.cursor, numItems: PAGE_SIZE })
      : await ctx.db
          .query('campaignInvites')
          .withIndex('by_listingId_status', (q) =>
            q.eq('listingId', args.listingId).eq('status', 'PENDING')
          )
          .paginate({ cursor: args.cursor, numItems: PAGE_SIZE })

    for (const row of page.page) {
      const { _id, _creationTime, ...stored } = row
      if (application) {
        const record = socialStoredApplicationSchema.parse(stored)
        if (
          args.profileGeneration === undefined
            ? (record.listingGeneration ?? 0) >= args.generation
            : (record.ownerProfileGeneration ?? 0) >= args.profileGeneration
        )
          continue
        const event = await readAdmissionInvalidation(
          ctx,
          args.ownerUserId,
          { profileId: record.applicantProfileId },
          record.blockGeneration ?? 0,
          { id: args.listingId, generation: record.listingGeneration ?? 0 },
          record
        )
        if (!event) throw new Error('Social listing invalidation is unavailable.')
        await ctx.db.patch(_id, applicationInvalidationPatch(record.version, event))
        await cancelNotification(ctx, {
          recipientUserId: args.ownerUserId,
          sourcePublicId: record.id,
          workflowKey: 'social-application-submitted',
          occurredAt: event.invalidatedAt
        })
      } else {
        const record = campaignStoredInviteSchema.parse(stored)
        if (
          args.profileGeneration === undefined
            ? (record.listingGeneration ?? 0) >= args.generation
            : (record.ownerProfileGeneration ?? 0) >= args.profileGeneration
        )
          continue
        const event = await readAdmissionInvalidation(
          ctx,
          args.ownerUserId,
          { userId: record.recipientUserId },
          record.blockGeneration ?? 0,
          { id: args.listingId, generation: record.listingGeneration ?? 0 },
          record
        )
        if (!event) throw new Error('Social listing invalidation is unavailable.')
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
