import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  socialInvitationPublicIdInputSchema,
  socialListingInvitationPublicIdInputSchema,
  type SocialInvitationPublicIdInput,
  type SocialListingInvitationPublicIdInput
} from '@artificer-toolkit/schema/api/socialAdmissionLists'
import {
  campaignInviteDtoSchema,
  type CampaignInviteDto
} from '@artificer-toolkit/schema/api/campaignCore'
import { query } from '../lib/queries'
import { presentInvitation, readInvitation, requireAdmissionPair } from './admissionDocuments'
import { requireOwnedListing } from './listingDocuments'
import { requireSocialViewer } from './visibility'

export const getReceived = query({
  args: zodToConvexFields(socialInvitationPublicIdInputSchema.shape),
  returns: zodToConvex(campaignInviteDtoSchema),
  handler: async (ctx, args): Promise<CampaignInviteDto> => {
    const actor = await requireSocialViewer(ctx)
    const input: SocialInvitationPublicIdInput = socialInvitationPublicIdInputSchema.parse(args)
    const value = await readInvitation(ctx, input.invitePublicId)
    if (value.recipient.userId !== actor.userId) throw new Error('Social invitation not found.')
    await requireAdmissionPair(ctx, value.host, value.recipient)
    return presentInvitation(
      ctx,
      value,
      actor.contentPreference === 'MATURE',
      Date.parse(input.asOf)
    )
  }
})

export const getForListing = query({
  args: zodToConvexFields(socialListingInvitationPublicIdInputSchema.shape),
  returns: zodToConvex(campaignInviteDtoSchema),
  handler: async (ctx, args): Promise<CampaignInviteDto> => {
    const actor = await requireSocialViewer(ctx)
    const input: SocialListingInvitationPublicIdInput =
      socialListingInvitationPublicIdInputSchema.parse(args)
    const owned = await requireOwnedListing(ctx, input.listingPublicId, actor.userId)
    const value = await readInvitation(ctx, input.invitePublicId)
    if (value.invitation.listingId !== owned.listing.id)
      throw new Error('Social invitation not found.')
    await requireAdmissionPair(ctx, value.host, value.recipient)
    return presentInvitation(ctx, value, true, Date.parse(input.asOf))
  }
})
