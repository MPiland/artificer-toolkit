import { zodToConvex } from 'convex-helpers/server/zod4'
import {
  liveSessionBootstrapInputSchema,
  liveSessionBootstrapResponseSchema,
  type LiveSessionBootstrapResponse
} from '@artificer-toolkit/schema/api/liveSessionState'
import { internalQuery } from '../_generated/server'
import { requireCampaignAuthority } from '../campaigns/authority'
import { requireIdentity } from '../lib/identity'
import { requireCampaignLiveAuthority } from './authorityGuard'

export const bootstrap = internalQuery({
  args: zodToConvex(liveSessionBootstrapInputSchema),
  returns: zodToConvex(liveSessionBootstrapResponseSchema),
  handler: async (ctx, args): Promise<LiveSessionBootstrapResponse> => {
    const input = liveSessionBootstrapInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    if (userId !== input.expectedUserId) throw new Error('Live Session identity mismatch.')
    const { campaign, membership } = await requireCampaignAuthority(ctx, input.campaignId, userId)
    if (membership.role !== input.expectedRole) throw new Error('Live Session role mismatch.')
    const authority = await requireCampaignLiveAuthority(ctx, {
      campaignId: campaign.id,
      sessionId: input.sessionId,
      epoch: input.authorityEpoch
    })
    if (authority.phase !== 'ACTIVATING' && authority.phase !== 'DO_ACTIVE')
      throw new Error('Live Session authority is draining.')

    return liveSessionBootstrapResponseSchema.parse({
      activationFingerprint: authority.activationFingerprint,
      persistedSequence: authority.persistedSequence,
      persistedStateChecksum: authority.persistedStateChecksum
    })
  }
})
