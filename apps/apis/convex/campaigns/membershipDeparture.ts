import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import type { z } from 'zod'
import {
  leaveCampaignInputSchema,
  removeCampaignMemberInputSchema,
  campaignMembershipDepartureResultSchema,
  campaignContentRemovalReceiptDtoSchema
} from '@artificer-toolkit/schema/api/campaignCore'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { type MutationCtx } from '../_generated/server'
import { mutation } from '../lib/mutations'
import { requireIdentity } from '../lib/identity'
import { requireCampaignAuthority } from './authority'
import { removeCampaignCharacterAssignment } from './characterDeparture'
import { removeCampaignSharesAndReconcile } from './contentShareRemoval'
import { scheduleLiveSessionUserEviction } from '../liveSessions/controlScheduling'
import { removeEncounterActorController } from '../encounters/actorControllerRemoval'
import { removeCampaignCharacterController } from './characterControllers'

async function depart(
  ctx: MutationCtx,
  input: z.output<typeof leaveCampaignInputSchema>,
  actorUserId: string,
  departingUserId: string,
  reason: 'MEMBER_LEFT' | 'MEMBER_REMOVED'
) {
  const campaignId = input.campaignId.toLowerCase()
  const commandId = input.commandId.toLowerCase()
  const inputFingerprint = checksumCanonicalJson({
    operation: reason,
    campaignId,
    actorUserId,
    departingUserId,
    commandId,
    expectedCampaignVersion: input.expectedCampaignVersion,
    expectedMembershipAccessStartedAt: new Date(
      input.expectedMembershipAccessStartedAt
    ).toISOString()
  })
  // Exact acknowledgements remain available to the original actor after access is revoked.
  // They never authorize reads or remove a membership from a later admission epoch.
  const prior = await ctx.db
    .query('campaignEvents')
    .withIndex('by_campaignId_commandId', (q) =>
      q.eq('campaignId', campaignId).eq('commandId', commandId)
    )
    .unique()
  if (prior) {
    if (
      prior.type !== 'CAMPAIGN_CONTENT_SHARES_REMOVED' ||
      prior.actorUserId !== actorUserId ||
      prior.inputFingerprint !== inputFingerprint
    )
      throw new Error('This command ID was already used with different input.')
    const payload: unknown = JSON.parse(prior.payloadJson)
    if (!payload || typeof payload !== 'object' || !('receipt' in payload))
      throw new Error('Stored Campaign departure receipt is invalid.')
    campaignContentRemovalReceiptDtoSchema.parse(payload.receipt)
    await scheduleLiveSessionUserEviction(ctx, {
      campaignId,
      userId: departingUserId,
      membershipEpoch: new Date(input.expectedMembershipAccessStartedAt).toISOString()
    })
    return { ok: true as const }
  }

  const { campaign, membership: actor } = await requireCampaignAuthority(
    ctx,
    campaignId,
    actorUserId
  )
  if (campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
  if (reason === 'MEMBER_REMOVED' && actor.role !== 'OWNER')
    throw new Error('Only the Campaign owner may remove a member.')
  const departing = await ctx.db
    .query('campaignMemberships')
    .withIndex('by_campaignId_userId', (q) =>
      q.eq('campaignId', campaign.id).eq('userId', departingUserId)
    )
    .unique()
  if (!departing || departing.status !== 'ACTIVE' || departing.role !== 'PLAYER')
    throw new Error('An active player membership is required; the Campaign owner cannot leave.')
  if (Date.parse(departing.accessStartedAt) !== Date.parse(input.expectedMembershipAccessStartedAt))
    throw new Error('Campaign membership changed before this action completed.')
  if (campaign.version !== input.expectedCampaignVersion)
    throw new Error('Campaign changed before this action completed.')

  const assignment = await ctx.db
    .query('campaignCharacterAssignments')
    .withIndex('by_campaignId_userId', (q) =>
      q.eq('campaignId', campaign.id).eq('userId', departingUserId)
    )
    .unique()
  if (assignment)
    await removeCampaignCharacterAssignment({ ctx, campaign, assignment, actorUserId, reason })

  const direct = ctx.db
    .query('campaignContentShares')
    .withIndex('by_campaignId_sharedBy', (q) =>
      q.eq('campaignId', campaign.id).eq('sharedBy', departingUserId)
    )
  await removeCampaignSharesAndReconcile({
    ctx,
    campaign,
    actorUserId,
    direct,
    reason,
    departingMembership: { userId: departing.userId, accessStartedAt: departing.accessStartedAt },
    commandId,
    inputFingerprint
  })
  await removeEncounterActorController(ctx, campaign, departing.userId)
  await removeCampaignCharacterController(ctx, campaign, departing.userId)
  await ctx.db.patch(departing._id, { status: 'LEFT', leftAt: new Date().toISOString() })
  await scheduleLiveSessionUserEviction(ctx, {
    campaignId: campaign.id,
    userId: departing.userId,
    membershipEpoch: departing.accessStartedAt
  })
  return { ok: true as const }
}

export const leave = mutation({
  args: zodToConvexFields(leaveCampaignInputSchema.shape),
  returns: zodToConvex(campaignMembershipDepartureResultSchema),
  handler: async (ctx, args) => {
    const input = leaveCampaignInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    return depart(ctx, input, userId, userId, 'MEMBER_LEFT')
  }
})

export const removeMember = mutation({
  args: zodToConvexFields(removeCampaignMemberInputSchema.shape),
  returns: zodToConvex(campaignMembershipDepartureResultSchema),
  handler: async (ctx, args) => {
    const input = removeCampaignMemberInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    return depart(ctx, input, userId, input.userId.toLowerCase(), 'MEMBER_REMOVED')
  }
})
