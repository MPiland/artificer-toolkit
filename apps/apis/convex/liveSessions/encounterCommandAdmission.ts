import type { LiveSessionBootstrapInput } from '@artificer-toolkit/schema/api/liveSessionState'
import { type QueryCtx } from '../_generated/server'
import { requireCampaignAuthority } from '../campaigns/authority'
import { requireIdentity } from '../lib/identity'
import { requireActiveCampaignLiveAuthority } from './authorityGuard'
import { rejectDomain } from '../lib/domainRejections'

/** The room's forwarded user, role, active Campaign and DO_ACTIVE epoch must all match the Run. */
export async function requireLiveEncounterRun(
  ctx: QueryCtx,
  input: LiveSessionBootstrapInput & { encounterId: string }
) {
  const { userId } = await requireIdentity(ctx)
  if (userId !== input.expectedUserId) throw new Error('Live Session identity mismatch.')
  const { campaign, membership } = await requireCampaignAuthority(ctx, input.campaignId, userId)
  if (membership.role !== input.expectedRole) throw new Error('Live Session role mismatch.')
  if (campaign.status !== 'ACTIVE') rejectDomain('CAMPAIGN_NOT_ACTIVE')
  await requireActiveCampaignLiveAuthority(ctx, {
    campaignId: campaign.id,
    epoch: input.authorityEpoch
  })
  const run = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (q) => q.eq('id', input.encounterId.toLowerCase()))
    .unique()
  if (!run || run.campaignId !== campaign.id)
    throw new Error('Live Session Encounter scope mismatch.')
  return { userId, campaign, membership, run }
}
