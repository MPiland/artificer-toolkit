import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import { v } from 'convex/values'
import {
  liveSessionJoinOptionsDtoSchema,
  liveSessionTicketAdmissionDtoSchema,
  type LiveSessionTicketAdmissionDto
} from '@artificer-toolkit/schema/api/liveSessionIdentity'
import { internalMutation } from '../lib/mutations'
import { requireIdentity } from '../lib/identity'
import { claimCampaignLiveAuthority } from './authority'

export const authorize = internalMutation({
  args: { ...zodToConvexFields(liveSessionJoinOptionsDtoSchema.shape), expiresAt: v.number() },
  returns: zodToConvex(liveSessionTicketAdmissionDtoSchema),
  handler: async (ctx, args): Promise<LiveSessionTicketAdmissionDto> => {
    const input = liveSessionJoinOptionsDtoSchema.parse({
      campaignId: args.campaignId,
      sessionId: args.sessionId
    })
    const { userId } = await requireIdentity(ctx)
    const { authority, campaign, membership, session } = await claimCampaignLiveAuthority(ctx, {
      ...input,
      expiresAt: args.expiresAt,
      userId
    })
    return liveSessionTicketAdmissionDtoSchema.parse({
      authorityEpoch: authority.epoch,
      campaignId: campaign.id,
      role: membership.role,
      sessionId: session.id,
      sub: userId
    })
  }
})
