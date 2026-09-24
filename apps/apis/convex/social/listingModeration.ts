import { makeFunctionReference } from 'convex/server'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  socialListingModerationInputSchema,
  socialModerationEvidenceDtoSchema,
  type SocialModerationEvidenceDto
} from '@artificer-toolkit/schema/api/socialModeration'
import {
  socialStoredModerationActionSchema,
  socialStoredReportSchema
} from '@artificer-toolkit/schema/projections/socialModerationPersistence'
import {
  socialStoredListingInvalidationSchema,
  socialStoredListingSchema
} from '@artificer-toolkit/schema/projections/socialPersistence'
import { mutation } from '../lib/mutations'
import {
  presentModerationReport,
  readModerationReport,
  requireSocialModerator
} from './moderationDocuments'
import { readListingInvalidation } from './listingInvalidation'

const cleanup = makeFunctionReference<
  'mutation',
  {
    listingId: string
    ownerUserId: string
    generation: number
    invalidatedAt: string
    phase: 'APPLICATION'
    cursor: null
  },
  null
>('social/listingModerationCleanup:run')

export const action = mutation({
  args: zodToConvexFields(socialListingModerationInputSchema.shape),
  returns: zodToConvex(socialModerationEvidenceDtoSchema),
  handler: async (ctx, args): Promise<SocialModerationEvidenceDto> => {
    const actor = await requireSocialModerator(ctx)
    const input = socialListingModerationInputSchema.parse(args)
    const { rowId: reportRowId, report } = await readModerationReport(ctx, input.reportPublicId)
    if (report.version !== input.expectedVersion) throw new Error('Social report version conflict.')
    const listingId = report.targetListingId
    if (!listingId) throw new Error('Social report does not target a listing.')
    const listingRow = await ctx.db
      .query('socialListings')
      .withIndex('by_publicId', (q) => q.eq('id', listingId))
      .unique()
    if (!listingRow) throw new Error('Social listing not found.')
    const { _id: listingRowId, _creationTime, ...listingStored } = listingRow
    const listing = socialStoredListingSchema.parse(listingStored)
    const moderationStatus = input.action === 'HIDE_LISTING' ? 'HIDDEN' : 'VISIBLE'
    if (listing.moderationStatus === moderationStatus)
      throw new Error('Social listing is already in that moderation state.')

    const latest = await readListingInvalidation(ctx, listing.id, null)
    const now = new Date(
      Math.max(
        Date.now(),
        Date.parse(listing.updatedAt) + 1,
        Date.parse(report.updatedAt) + 1,
        latest ? Date.parse(latest.invalidatedAt) + 1 : 0
      )
    ).toISOString()
    const nextListing = socialStoredListingSchema.parse({
      ...listing,
      moderationStatus,
      version: listing.version + 1,
      updatedAt: now
    })
    const nextReport = socialStoredReportSchema.parse({
      ...report,
      version: report.version + 1,
      updatedAt: now
    })

    if (input.action === 'HIDE_LISTING' || !latest) {
      const invalidation = socialStoredListingInvalidationSchema.parse({
        listingId: listing.id,
        generation: (latest?.generation ?? 0) + 1,
        invalidatedAt: now
      })
      await ctx.db.insert('socialListingInvalidations', {
        ...invalidation,
        committedAt: ctx.db.vars.commitTs
      })
      await ctx.scheduler.runAfter(0, cleanup, {
        listingId: listing.id,
        ownerUserId: listing.ownerUserId,
        generation: invalidation.generation,
        invalidatedAt: invalidation.invalidatedAt,
        phase: 'APPLICATION',
        cursor: null
      })
    }
    await ctx.db.replace(listingRowId, nextListing)
    await ctx.db.replace(reportRowId, nextReport)
    await ctx.db.insert(
      'socialModerationActions',
      socialStoredModerationActionSchema.parse({
        id: crypto.randomUUID(),
        moderatorUserId: actor.userId,
        reportId: report.id,
        action: input.action,
        affectedProfileId: null,
        affectedListingId: listing.id,
        reason: input.reason,
        beforeState: {
          reportStatus: report.status,
          reportVersion: report.version,
          listingModerationStatus: listing.moderationStatus
        },
        afterState: {
          reportStatus: nextReport.status,
          reportVersion: nextReport.version,
          listingModerationStatus: nextListing.moderationStatus,
          action: input.action
        },
        createdAt: now
      })
    )
    return presentModerationReport(ctx, nextReport)
  }
})
