import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  socialListingDtoSchema,
  socialListingPublicIdInputSchema,
  socialListingVersionInputSchema,
  updateSocialListingInputSchema,
  type SocialListingDto
} from '@artificer-toolkit/schema/api/socialHub'
import { socialStoredListingSchema } from '@artificer-toolkit/schema/projections/socialPersistence'
import {
  socialListingListInputSchema,
  socialListingPageSchema,
  type SocialListingPage
} from '@artificer-toolkit/schema/api/socialListingList'
import { query } from '../lib/queries'
import { mutation } from '../lib/mutations'
import { syncAccountUsage } from '../lib/accountUsage'
import {
  assertListingWrite,
  assertPublicListingCapacity,
  presentListing,
  listingSearch,
  requireOwnedListing,
  requireSocialOwner
} from './listingDocuments'
import { closeCampaignAdmission } from './admissionClosure'
import { saveListingEdit } from './listingEdits'

export const getOwned = query({
  args: zodToConvexFields(socialListingPublicIdInputSchema.shape),
  returns: zodToConvex(socialListingDtoSchema),
  handler: async (ctx, args): Promise<SocialListingDto> => {
    const actor = await requireSocialOwner(ctx)
    const { listingPublicId } = socialListingPublicIdInputSchema.parse(args)
    const { listing, campaign } = await requireOwnedListing(ctx, listingPublicId, actor.userId)
    return presentListing(ctx, listing, campaign, actor.host, true)
  }
})

export const open = mutation({
  args: zodToConvexFields(socialListingVersionInputSchema.shape),
  returns: zodToConvex(socialListingDtoSchema),
  handler: async (ctx, args): Promise<SocialListingDto> => {
    const actor = await requireSocialOwner(ctx)
    const { listingPublicId, expectedVersion } = socialListingVersionInputSchema.parse(args)
    const { rowId, listing, campaign } = await requireOwnedListing(
      ctx,
      listingPublicId,
      actor.userId
    )
    if (listing.version !== expectedVersion) throw new Error('Social listing version conflict.')
    if (listing.status !== 'DRAFT') throw new Error('Only draft Social listings can be opened.')
    const tier = await assertListingWrite(ctx, campaign, listing.capacity, listing.schedule.kind)
    if (listing.moderationStatus !== 'VISIBLE')
      throw new Error('A hidden Social listing cannot be opened.')
    if (listing.audience === 'PUBLIC') await assertPublicListingCapacity(ctx, actor.userId, tier)
    const now = new Date(Math.max(Date.now(), Date.parse(listing.updatedAt) + 1)).toISOString()
    const opened = socialStoredListingSchema.parse({
      ...listing,
      search: listingSearch(campaign.name, listing.summary),
      status: 'OPEN',
      publishedAt: listing.publishedAt ?? now,
      version: listing.version + 1,
      updatedAt: now
    })
    await ctx.db.replace(rowId, opened)
    await syncAccountUsage(ctx, 'publicListings', listing.id)
    return presentListing(ctx, opened, campaign, actor.host, true)
  }
})

export const close = mutation({
  args: zodToConvexFields(socialListingVersionInputSchema.shape),
  returns: zodToConvex(socialListingDtoSchema),
  handler: async (ctx, args): Promise<SocialListingDto> => {
    const actor = await requireSocialOwner(ctx)
    const { listingPublicId, expectedVersion } = socialListingVersionInputSchema.parse(args)
    const { listing, campaign } = await requireOwnedListing(ctx, listingPublicId, actor.userId)
    if (listing.version !== expectedVersion) throw new Error('Social listing version conflict.')
    if (listing.status !== 'OPEN') throw new Error('Only open Social listings can be closed.')
    const now = new Date(Math.max(Date.now(), Date.parse(listing.updatedAt) + 1)).toISOString()
    await closeCampaignAdmission(ctx, campaign, actor.userId, now)
    const closed = await requireOwnedListing(ctx, listingPublicId, actor.userId)
    return presentListing(ctx, closed.listing, campaign, actor.host, true)
  }
})

export const listOwned = query({
  args: zodToConvexFields(socialListingListInputSchema.shape),
  returns: zodToConvex(socialListingPageSchema),
  handler: async (ctx, args): Promise<SocialListingPage> => {
    const actor = await requireSocialOwner(ctx)
    const { paginationOpts } = socialListingListInputSchema.parse(args)
    const result = await ctx.db
      .query('socialListings')
      .withIndex('by_ownerUserId_updatedAt_id', (q) => q.eq('ownerUserId', actor.userId))
      .order('desc')
      .paginate({
        ...paginationOpts,
        maximumRowsRead: 8,
        maximumBytesRead: 1024 * 1024
      })
    return socialListingPageSchema.parse({
      ...result,
      page: (
        await Promise.all(
          result.page.map(async (row) => {
            const deletion = await ctx.db
              .query('campaignDeletionJobs')
              .withIndex('by_campaignId', (q) => q.eq('campaignId', row.campaignId))
              .unique()
            if (deletion) return null
            const { listing, campaign } = await requireOwnedListing(ctx, row.id, actor.userId)
            return presentListing(ctx, listing, campaign, actor.host, true)
          })
        )
      ).filter((row) => row !== null)
    })
  }
})

export const update = mutation({
  args: { input: zodToConvex(updateSocialListingInputSchema) },
  returns: zodToConvex(socialListingDtoSchema),
  handler: async (ctx, args): Promise<SocialListingDto> => {
    const actor = await requireSocialOwner(ctx)
    const input = updateSocialListingInputSchema.parse(args.input)
    const owned = await requireOwnedListing(ctx, input.listingPublicId, actor.userId)
    return saveListingEdit(ctx, owned, input, actor.host)
  }
})
