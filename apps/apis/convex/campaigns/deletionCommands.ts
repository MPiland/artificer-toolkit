import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  deleteCampaignInputSchema,
  campaignDeletionResultSchema,
  type CampaignDeletionResult
} from '@artificer-toolkit/schema/api/campaignCore'
import { internalMutation } from '../lib/mutations'
import { requireIdentity } from '../lib/identity'
import { requireCampaignAuthority } from './authority'
import { closeCampaignAdmission } from '../social/admissionClosure'
import { scheduleCampaignDeletion } from './deletionJobs'
import { readCampaignLiveAuthority } from '../liveSessions/authorityGuard'

export const remove = internalMutation({
  args: zodToConvexFields(deleteCampaignInputSchema.shape),
  returns: zodToConvex(campaignDeletionResultSchema),
  handler: async (ctx, args): Promise<CampaignDeletionResult> => {
    const { campaignId, expectedVersion } = deleteCampaignInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    const prior = await ctx.db
      .query('campaignDeletionJobs')
      .withIndex('by_campaignId', (q) => q.eq('campaignId', campaignId))
      .unique()
    if (prior) {
      if (prior.ownerUserId !== userId) throw new Error('Campaign not found.')
      if (prior.expectedVersion !== expectedVersion)
        throw new Error('Campaign changed before this action completed.')
      if (prior.status === 'FAILED') {
        const resumed = {
          ...prior,
          status: 'DELETING' as const,
          error: null,
          revision: prior.revision + 1,
          updatedAt: new Date().toISOString()
        }
        await ctx.db.patch(prior._id, {
          status: resumed.status,
          error: null,
          revision: resumed.revision,
          updatedAt: resumed.updatedAt
        })
        await scheduleCampaignDeletion(ctx, resumed)
      }
      return { ok: true }
    }
    const { campaign, membership } = await requireCampaignAuthority(ctx, campaignId, userId)
    if (membership.role !== 'OWNER') throw new Error('You cannot perform this Campaign action.')
    if (campaign.version !== expectedVersion)
      throw new Error('Campaign changed before this action completed.')

    const listing = await ctx.db
      .query('socialListings')
      .withIndex('by_campaignId', (q) => q.eq('campaignId', campaign.id))
      .unique()
    if (listing) {
      // Preserve the existing SQL RESTRICT boundary, including terminal reports and audit history.
      const [report, moderation] = await Promise.all([
        ctx.db
          .query('socialReports')
          .withIndex('by_evidenceListingPublicId', (q) =>
            q.eq('evidenceSnapshot.listingPublicId', listing.id)
          )
          .first(),
        ctx.db
          .query('socialModerationActions')
          .withIndex('by_affectedListingId', (q) => q.eq('affectedListingId', listing.id))
          .first()
      ])
      if (report || moderation)
        throw new Error('Campaign admission history is referenced by moderation.')
    }

    const liveAuthority = await readCampaignLiveAuthority(ctx, campaign.id)
    const now = new Date(Math.max(Date.now(), Date.parse(campaign.updatedAt) + 1)).toISOString()
    await closeCampaignAdmission(ctx, campaign, campaign.ownerUserId, now, true)

    const jobId = await ctx.db.insert('campaignDeletionJobs', {
      campaignRootId: campaign._id,
      campaignId: campaign.id,
      ownerUserId: userId,
      expectedVersion,
      stage: 'DRAIN_ROOM',
      liveAuthority: liveAuthority ? { epoch: liveAuthority.epoch } : null,
      ...(liveAuthority ? { liveAuthorityId: liveAuthority._id } : {}),
      phase: 0,
      revision: 0,
      status: 'DELETING',
      error: null,
      createdAt: now,
      updatedAt: now
    })
    const job = await ctx.db.get(jobId)
    if (!job) throw new Error('Campaign deletion job is missing.')
    await scheduleCampaignDeletion(ctx, job, true)
    return { ok: true }
  }
})
