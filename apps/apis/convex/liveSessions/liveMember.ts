import type { LiveSessionBootstrapInput } from '@artificer-toolkit/schema/api/liveSessionState'
import type { QueryCtx } from '../_generated/server'
import { requireCampaignAuthority } from '../campaigns/authority'
import { requireIdentity } from '../lib/identity'
import { requireActiveCampaignLiveAuthority } from './authorityGuard'

/** The forwarded member, their current role and the room's active epoch. */
export async function requireLiveMember(ctx: QueryCtx, input: LiveSessionBootstrapInput) {
  const { userId } = await requireIdentity(ctx)
  if (userId !== input.expectedUserId) throw new Error('Live movement identity mismatch.')
  const { membership } = await requireCampaignAuthority(ctx, input.campaignId, userId)
  if (membership.role !== input.expectedRole) throw new Error('Live Session role mismatch.')
  await requireActiveCampaignLiveAuthority(ctx, {
    campaignId: input.campaignId,
    epoch: input.authorityEpoch
  })
  return userId
}
