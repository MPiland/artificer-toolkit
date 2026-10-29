import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { v } from 'convex/values'
import type { Doc } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import {
  accountDeletionStepArgs,
  continueAccountDeletion,
  readAccountDeletionStep
} from '../accountDeletionJobs'
import { internalMutation } from '../lib/mutations'
import { removeAccountCharacterActors } from '@artificer-toolkit/encounter-persistence/actorRemovalCommand'
import { readLiveCampaignAuthority } from '../liveSessions/authorityGuard'
import { requireCampaignAuthority } from './authority'
import { removeCampaignCharacterAssignment } from './characterDeparture'
import { removeEncounterActorController } from '../encounters/actorControllerRemoval'
import { removeCampaignCharacterController } from './characterControllers'
import { removeCampaignSharesAndReconcile } from './contentShareRemoval'
import { scheduleLiveSessionUserEviction } from '../liveSessions/controlScheduling'
import { encounterWriteTransaction } from '../encounters/encounterPorts'

/** Trusted account lifecycle producer: departs one membership; the deletion job authorizes it. */
export async function departAccountCampaignMembership(
  ctx: MutationCtx,
  userId: string,
  storedMembership: Doc<'campaignMemberships'>
) {
  if (storedMembership.role !== 'PLAYER')
    throw new Error('Account deletion is restricted by Campaign ownership.')

  const root = await ctx.db
    .query('campaigns')
    .withIndex('by_publicId', (q) => q.eq('id', storedMembership.campaignId))
    .unique()
  if (!root) throw new Error('Stored Campaign membership has no Campaign.')
  const { campaign } = await requireCampaignAuthority(ctx, root.id, root.ownerUserId)

  // A Campaign with live authority has its room own every open Run; the room's departure
  // reconcile removes a deleted Character's actor, and release covers the rest (D74).
  if (!(await readLiveCampaignAuthority(ctx, campaign.id)))
    await removeAccountCharacterActors(encounterWriteTransaction(ctx), campaign.id, userId)

  const freshRoot = await ctx.db
    .query('campaigns')
    .withIndex('by_publicId', (q) => q.eq('id', campaign.id))
    .unique()
  if (!freshRoot) throw new Error('Stored Campaign membership has no Campaign.')
  const { campaign: freshCampaign } = await requireCampaignAuthority(
    ctx,
    freshRoot.id,
    freshRoot.ownerUserId
  )
  const membership = await ctx.db
    .query('campaignMemberships')
    .withIndex('by_campaignId_userId', (q) =>
      q.eq('campaignId', freshCampaign.id).eq('userId', userId)
    )
    .unique()
  if (
    !membership ||
    membership._id !== storedMembership._id ||
    membership.role !== 'PLAYER' ||
    (membership.status !== 'ACTIVE' && membership.status !== 'LEFT')
  )
    throw new Error('Stored Campaign membership changed during account deletion.')

  const assignment = await ctx.db
    .query('campaignCharacterAssignments')
    .withIndex('by_campaignId_userId', (q) =>
      q.eq('campaignId', freshCampaign.id).eq('userId', userId)
    )
    .unique()
  if (assignment) {
    if (
      membership.status !== 'ACTIVE' ||
      assignment.campaignId !== freshCampaign.id ||
      assignment.userId !== userId
    )
      throw new Error('Stored Campaign Character assignment mismatch.')
    await removeCampaignCharacterAssignment({
      ctx,
      campaign: freshCampaign,
      assignment,
      actorUserId: userId,
      reason: 'MEMBER_LEFT'
    })
  }

  const direct = ctx.db
    .query('campaignContentShares')
    .withIndex('by_campaignId_sharedBy', (q) =>
      q.eq('campaignId', freshCampaign.id).eq('sharedBy', userId)
    )
  if (membership.status === 'ACTIVE' || (await direct.first()))
    await removeCampaignSharesAndReconcile({
      ctx,
      campaign: freshCampaign,
      actorUserId: userId,
      direct,
      reason: 'MEMBER_LEFT',
      departingMembership: {
        userId: membership.userId,
        accessStartedAt: membership.accessStartedAt
      },
      commandId: crypto.randomUUID(),
      inputFingerprint: checksumCanonicalJson({
        operation: 'ACCOUNT_DELETION',
        campaignId: freshCampaign.id,
        userId,
        campaignVersion: freshCampaign.version,
        membershipAccessStartedAt: membership.accessStartedAt
      })
    })
  if (membership.status === 'ACTIVE') {
    await removeEncounterActorController(ctx, freshCampaign, userId)
    await removeCampaignCharacterController(ctx, freshCampaign, userId)
    await ctx.db.patch(membership._id, { status: 'LEFT', leftAt: new Date().toISOString() })
    await scheduleLiveSessionUserEviction(ctx, {
      campaignId: freshCampaign.id,
      userId,
      membershipEpoch: membership.accessStartedAt
    })
  }
}

// Departure runs before the account commit, while the profile and auth user still exist: Campaign
// reads require both for every ACTIVE member (ADR 0040).
export const step = internalMutation({
  args: accountDeletionStepArgs,
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await readAccountDeletionStep(ctx, args, 'CAMPAIGNS')
    if (!job) return null
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', job.userId))
      .unique()
    if (!profile) throw new Error('Account profile is missing.')
    const active = await ctx.db
      .query('campaignMemberships')
      .withIndex('by_userId_status_joinedAt', (q) =>
        q.eq('userId', job.userId).eq('status', 'ACTIVE')
      )
      .first()
    if (active) {
      await departAccountCampaignMembership(ctx, job.userId, active)
      await continueAccountDeletion(ctx, job, true)
      return null
    }
    const left = await ctx.db
      .query('campaignMemberships')
      .withIndex('by_userId_status_joinedAt', (q) =>
        q.eq('userId', job.userId).eq('status', 'LEFT')
      )
      .paginate({ numItems: 1, cursor: job.cursor })
    for (const membership of left.page)
      await departAccountCampaignMembership(ctx, job.userId, membership)
    await continueAccountDeletion(ctx, job, !left.isDone, left.continueCursor)
    return null
  }
})
