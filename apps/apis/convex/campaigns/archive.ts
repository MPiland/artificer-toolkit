import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  archiveCampaignInputSchema,
  campaignDetailDtoSchema,
  type CampaignDetailDto
} from '@artificer-toolkit/schema/api/campaignCore'
import { mutation } from '../lib/mutations'
import { requireIdentity } from '../lib/identity'
import { syncAccountUsage } from '../lib/accountUsage'
import { readCampaignDetail, requireCampaignAuthority } from './documents'
import { closeCampaignAdmission } from '../social/admissionClosure'
import { scheduleLiveSessionRoomClosure } from '../liveSessions/controlScheduling'

export const archive = mutation({
  args: zodToConvexFields(archiveCampaignInputSchema.shape),
  returns: zodToConvex(campaignDetailDtoSchema),
  handler: async (ctx, args): Promise<CampaignDetailDto> => {
    const { userId } = await requireIdentity(ctx)
    const { campaignId, expectedVersion } = archiveCampaignInputSchema.parse(args)
    const { campaign, membership } = await requireCampaignAuthority(ctx, campaignId, userId)
    if (membership.role !== 'OWNER') throw new Error('You cannot perform this Campaign action.')
    if (campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
    if (campaign.version !== expectedVersion)
      throw new Error('Campaign changed before this action completed.')

    const now = new Date(Math.max(Date.now(), Date.parse(campaign.updatedAt) + 1)).toISOString()
    await closeCampaignAdmission(ctx, campaign, campaign.ownerUserId, now)
    await ctx.db.patch(campaign._id, {
      status: 'ARCHIVED',
      version: campaign.version + 1,
      updatedAt: now
    })
    await syncAccountUsage(ctx, 'activeHostedCampaigns', campaign.id)
    await scheduleLiveSessionRoomClosure(ctx, campaign.id)
    return readCampaignDetail(ctx, await requireCampaignAuthority(ctx, campaignId, userId))
  }
})
