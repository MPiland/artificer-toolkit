import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  socialProfileDtoSchema,
  socialProfilePublicIdInputSchema,
  socialListingDtoSchema,
  socialListingPublicIdInputSchema,
  type SocialListingDto,
  type SocialProfileDto
} from '@artificer-toolkit/schema/api/socialHub'
import {
  socialStoredProfileSchema,
  socialStoredListingSchema
} from '@artificer-toolkit/schema/projections/socialPersistence'
import { query } from '../lib/queries'
import { readProfile } from './profiles'
import { presentListing, requireOwnedCampaign } from './listingDocuments'
import { hasSocialBlock, presentSocialProfile, requireSocialViewer } from './visibility'
import { resolveListingSuspension } from './profileInvalidation'

export const getProfile = query({
  args: zodToConvexFields(socialProfilePublicIdInputSchema.shape),
  returns: zodToConvex(socialProfileDtoSchema),
  handler: async (ctx, args): Promise<SocialProfileDto> => {
    const viewer = await requireSocialViewer(ctx)
    const { profilePublicId } = socialProfilePublicIdInputSchema.parse(args)
    const row = await ctx.db
      .query('socialProfiles')
      .withIndex('by_publicId', (q) => q.eq('id', profilePublicId.toLowerCase()))
      .unique()
    if (!row || row.status !== 'ACTIVE' || (await hasSocialBlock(ctx, viewer.id, row.id)))
      throw new Error('Social profile not found.')
    const { _id, _creationTime, ...stored } = row
    return presentSocialProfile(ctx, socialStoredProfileSchema.parse(stored))
  }
})

export const getListing = query({
  args: zodToConvexFields(socialListingPublicIdInputSchema.shape),
  returns: zodToConvex(socialListingDtoSchema),
  handler: async (ctx, args): Promise<SocialListingDto> => {
    const viewer = await requireSocialViewer(ctx)
    const { listingPublicId } = socialListingPublicIdInputSchema.parse(args)
    const row = await ctx.db
      .query('socialListings')
      .withIndex('by_publicId', (q) => q.eq('id', listingPublicId.toLowerCase()))
      .unique()
    if (!row) throw new Error('Social listing not found.')
    const { _id, _creationTime, ...stored } = row
    const listing = await resolveListingSuspension(ctx, socialStoredListingSchema.parse(stored))
    const host = (await readProfile(ctx, row.ownerUserId))?.profile
    if (!host || host.status !== 'ACTIVE' || (await hasSocialBlock(ctx, viewer.id, host.id)))
      throw new Error('Social listing not found.')
    const campaign = await requireOwnedCampaign(ctx, row.campaignId, row.ownerUserId)
    const owner = campaign.ownerUserId === viewer.userId
    if (
      !owner &&
      (listing.status !== 'OPEN' ||
        row.audience !== 'PUBLIC' ||
        row.moderationStatus !== 'VISIBLE' ||
        campaign.status !== 'ACTIVE')
    )
      throw new Error('Social listing not found.')
    return presentListing(
      ctx,
      listing,
      campaign,
      await presentSocialProfile(ctx, host),
      campaign.contentMaturity === 'MATURE' &&
        (owner || (viewer.contentPreference === 'MATURE' && viewer.adultAttestedAt !== null))
    )
  }
})
