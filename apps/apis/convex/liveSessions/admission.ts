import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import { v } from 'convex/values'
import {
  liveSessionJoinOptionsDtoSchema,
  liveSessionTicketAdmissionDtoSchema,
  type LiveSessionTicketAdmissionDto
} from '@artificer-toolkit/schema/api/liveSessionIdentity'
import { internalMutation } from '../lib/mutations'
import { requireIdentity } from '../lib/identity'
import { consumeUserRateLimit } from '../lib/rateLimits'
import { claimCampaignLiveAuthority } from './authority'

export const authorize = internalMutation({
  args: { ...zodToConvexFields(liveSessionJoinOptionsDtoSchema.shape), expiresAt: v.number() },
  returns: zodToConvex(liveSessionTicketAdmissionDtoSchema),
  handler: async (ctx, args): Promise<LiveSessionTicketAdmissionDto> => {
    const input = liveSessionJoinOptionsDtoSchema.parse({ campaignId: args.campaignId })
    const { userId } = await requireIdentity(ctx)
    await consumeUserRateLimit(ctx, 'liveSessionTicket', userId)
    const { authority, campaign, membership } = await claimCampaignLiveAuthority(ctx, {
      ...input,
      expiresAt: args.expiresAt,
      userId
    })
    return liveSessionTicketAdmissionDtoSchema.parse({
      authorityEpoch: authority.epoch,
      campaignId: campaign.id,
      role: membership.role,
      sub: userId
    })
  }
})
