import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  requestCampaignOwnershipTransferInputSchema,
  acceptCampaignOwnershipTransferInputSchema,
  campaignOwnershipTransferRequestResultSchema,
  campaignDetailDtoSchema
} from '@artificer-toolkit/schema/api/campaignCore'
import { campaignStoredOwnershipTransferSchema } from '@artificer-toolkit/schema/projections/campaignPersistence'
import { ENTITLEMENT_LIMITS } from '@artificer-toolkit/shared/account/entitlements'
import { mutation } from '../lib/mutations'
import { requireIdentity } from '../lib/identity'
import { syncAccountUsage } from '../lib/accountUsage'
import { requireCampaignAuthority, readCampaignDetail } from './documents'
import { readCampaignAccessTime } from './conversationDocuments'
import { closeCampaignAdmission } from '../social/admissionClosure'
import { scheduleLiveSessionUserEviction } from '../liveSessions/controlScheduling'

export const request = mutation({
  args: zodToConvexFields(requestCampaignOwnershipTransferInputSchema.shape),
  returns: zodToConvex(campaignOwnershipTransferRequestResultSchema),
  handler: async (ctx, args) => {
    const input = requestCampaignOwnershipTransferInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    const { campaign, membership } = await requireCampaignAuthority(ctx, input.campaignId, userId)
    if (membership.role !== 'OWNER')
      throw new Error('Only the Campaign owner may transfer ownership.')
    if (campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
    const { membership: recipient } = await requireCampaignAuthority(
      ctx,
      campaign.id,
      input.recipientUserId.toLowerCase()
    )
    if (recipient.role !== 'PLAYER') throw new Error('An active player recipient is required.')
    const document = campaignStoredOwnershipTransferSchema.parse({
      campaignId: campaign.id,
      fromUserId: userId,
      toUserId: recipient.userId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    })
    const current = await ctx.db
      .query('campaignOwnershipTransfers')
      .withIndex('by_campaignId', (q) => q.eq('campaignId', campaign.id))
      .unique()
    if (current) await ctx.db.replace(current._id, document)
    else await ctx.db.insert('campaignOwnershipTransfers', document)
    return { ok: true as const }
  }
})

export const accept = mutation({
  args: zodToConvexFields(acceptCampaignOwnershipTransferInputSchema.shape),
  returns: zodToConvex(campaignDetailDtoSchema),
  handler: async (ctx, args) => {
    const input = acceptCampaignOwnershipTransferInputSchema.parse(args)
    if (!(await ctx.auth.getUserIdentity())) throw new Error('Unauthenticated')
    const campaignId = input.campaignId.toLowerCase()
    const transfer = await ctx.db
      .query('campaignOwnershipTransfers')
      .withIndex('by_campaignId', (q) => q.eq('campaignId', campaignId))
      .unique()
    if (!transfer || Date.parse(transfer.expiresAt) <= Date.now())
      throw new Error('Ownership transfer is invalid or expired.')
    const { userId } = await requireIdentity(ctx)
    if (transfer.toUserId !== userId) throw new Error('Ownership transfer is invalid or expired.')
    const { _id, _creationTime, ...stored } = transfer
    campaignStoredOwnershipTransferSchema.parse(stored)
    const { campaign, membership: recipient } = await requireCampaignAuthority(
      ctx,
      campaignId,
      userId
    )
    if (campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
    if (recipient.role !== 'PLAYER' || transfer.fromUserId !== campaign.ownerUserId)
      throw new Error('Ownership transfer is invalid or expired.')
    const { membership: formerOwner } = await requireCampaignAuthority(
      ctx,
      campaignId,
      campaign.ownerUserId
    )
    const entitlement = await ctx.db
      .query('accountEntitlements')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .unique()
    const limit = ENTITLEMENT_LIMITS[entitlement?.tier ?? 'FREE'].activeHostedCampaigns
    if (limit !== null) {
      const owned = await ctx.db
        .query('campaigns')
        .withIndex('by_ownerUserId_status', (q) =>
          q.eq('ownerUserId', userId).eq('status', 'ACTIVE')
        )
        .take(limit)
      if (owned.length >= limit)
        throw new Error('Your account has reached its activeHostedCampaigns limit.')
    }
    // Strictly advance past all prior same-millisecond traffic; subsequent senders use this clock.
    const now = new Date((await readCampaignAccessTime(ctx, campaign)) + 1).toISOString()
    await closeCampaignAdmission(ctx, campaign, userId, now)
    await ctx.db.patch(formerOwner._id, { role: 'PLAYER', accessStartedAt: now })
    await ctx.db.patch(recipient._id, { role: 'OWNER', accessStartedAt: now })
    await scheduleLiveSessionUserEviction(ctx, {
      campaignId: campaign.id,
      userId: formerOwner.userId,
      membershipEpoch: formerOwner.accessStartedAt ?? formerOwner.joinedAt
    })
    await scheduleLiveSessionUserEviction(ctx, {
      campaignId: campaign.id,
      userId: recipient.userId,
      membershipEpoch: recipient.accessStartedAt ?? recipient.joinedAt
    })
    await ctx.db.patch(campaign._id, {
      ownerUserId: userId,
      version: campaign.version + 1,
      updatedAt: new Date(
        Math.max(Date.parse(now), Date.parse(campaign.updatedAt) + 1)
      ).toISOString()
    })
    await ctx.db.delete(transfer._id)
    await syncAccountUsage(ctx, 'activeHostedCampaigns', campaign.id)
    return readCampaignDetail(ctx, await requireCampaignAuthority(ctx, campaign.id, userId))
  }
})
