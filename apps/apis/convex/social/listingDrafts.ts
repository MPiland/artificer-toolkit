import { v } from 'convex/values'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  createSocialListingInputSchema,
  updateSocialListingInputSchema,
  socialListingDtoSchema,
  socialListingPublicIdInputSchema,
  socialListingVersionInputSchema,
  type SocialListingDto
} from '@artificer-toolkit/schema/api/socialHub'
import {
  socialListingListInputSchema,
  socialListingPageSchema,
  type SocialListingPage
} from '@artificer-toolkit/schema/api/socialListingList'
import { socialStoredListingSchema } from '@artificer-toolkit/schema/projections/socialPersistence'
import type { QueryCtx } from '../_generated/server'
import { query } from '../lib/queries'
import { mutation } from '../lib/mutations'
import { syncAccountUsage } from '../lib/accountUsage'
import {
  requireSocialOwner,
  requireOwnedCampaign,
  requireOwnedListing,
  presentListing,
  listingSearch,
  assertListingWrite
} from './listingDocuments'
import { saveListingEdit } from './listingEdits'

async function requireDraft(ctx: QueryCtx, id: string, userId: string) {
  const owned = await requireOwnedListing(ctx, id, userId)
  if (owned.listing.status !== 'DRAFT')
    throw new Error('Only draft Social listings are supported by this operation.')
  return owned
}

export const create = mutation({
  args: { input: zodToConvex(createSocialListingInputSchema) },
  returns: zodToConvex(socialListingDtoSchema),
  handler: async (ctx, args): Promise<SocialListingDto> => {
    const actor = await requireSocialOwner(ctx)
    const input = createSocialListingInputSchema.parse(args.input)
    const campaign = await requireOwnedCampaign(ctx, input.campaignId, actor.userId)
    await assertListingWrite(ctx, campaign, input.capacity, input.schedule.kind)
    const existing = await ctx.db
      .query('socialListings')
      .withIndex('by_campaignId', (q) => q.eq('campaignId', campaign.id))
      .unique()
    if (existing) throw new Error('This Campaign already has a Social listing.')
    const now = new Date().toISOString()
    const listing = socialStoredListingSchema.parse({
      ...input,
      search: listingSearch(campaign.name, input.summary),
      campaignId: campaign.id,
      id: crypto.randomUUID(),
      ownerUserId: actor.userId,
      ownerProfileGeneration: actor.invalidationGeneration,
      status: 'DRAFT',
      moderationStatus: 'VISIBLE',
      publishedAt: null,
      version: 0,
      createdAt: now,
      updatedAt: now
    })
    const result = await presentListing(ctx, listing, campaign, actor.host, true)
    await ctx.db.insert('socialListings', listing)
    return result
  }
})

export const get = query({
  args: zodToConvexFields(socialListingPublicIdInputSchema.shape),
  returns: zodToConvex(socialListingDtoSchema),
  handler: async (ctx, args): Promise<SocialListingDto> => {
    const actor = await requireSocialOwner(ctx)
    const { listingPublicId } = socialListingPublicIdInputSchema.parse(args)
    const { listing, campaign } = await requireDraft(ctx, listingPublicId, actor.userId)
    return presentListing(ctx, listing, campaign, actor.host, true)
  }
})

export const list = query({
  args: zodToConvexFields(socialListingListInputSchema.shape),
  returns: zodToConvex(socialListingPageSchema),
  handler: async (ctx, args): Promise<SocialListingPage> => {
    const actor = await requireSocialOwner(ctx)
    const { paginationOpts } = socialListingListInputSchema.parse(args)
    const result = await ctx.db
      .query('socialListings')
      .withIndex('by_ownerUserId_status_updatedAt_id', (q) =>
        q.eq('ownerUserId', actor.userId).eq('status', 'DRAFT')
      )
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
            const { listing, campaign } = await requireOwnedListing(ctx, row.id, actor.userId)
            if (listing.status !== 'DRAFT') return null
            return presentListing(ctx, listing, campaign, actor.host, true)
          })
        )
      ).filter((listing) => listing !== null)
    })
  }
})

export const update = mutation({
  args: { input: zodToConvex(updateSocialListingInputSchema) },
  returns: zodToConvex(socialListingDtoSchema),
  handler: async (ctx, args): Promise<SocialListingDto> => {
    const actor = await requireSocialOwner(ctx)
    const input = updateSocialListingInputSchema.parse(args.input)
    const owned = await requireDraft(ctx, input.listingPublicId, actor.userId)
    return saveListingEdit(ctx, owned, input, actor.host)
  }
})

export const remove = mutation({
  args: zodToConvexFields(socialListingVersionInputSchema.shape),
  returns: v.null(),
  handler: async (ctx, args) => {
    const actor = await requireSocialOwner(ctx)
    const { listingPublicId, expectedVersion } = socialListingVersionInputSchema.parse(args)
    const { rowId, listing } = await requireDraft(ctx, listingPublicId, actor.userId)
    if (listing.version !== expectedVersion) throw new Error('Social listing version conflict.')
    await ctx.db.delete(rowId)
    await syncAccountUsage(ctx, 'publicListings', listing.id)
    return null
  }
})
