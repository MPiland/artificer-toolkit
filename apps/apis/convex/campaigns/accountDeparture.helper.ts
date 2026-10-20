import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { MutationCtx } from '../_generated/server'
import { removeAccountCharacterActors } from '@artificer-toolkit/encounter-persistence/actorRemovalCommand'
import { readLiveCampaignAuthority } from '../liveSessions/authorityGuard'
import { requireCampaignAuthority } from './authority'
import { removeCampaignCharacterAssignment } from './characterDeparture'
import { removeEncounterActorController } from '../encounters/actorControllerRemoval'
import { removeCampaignCharacterController } from './characterControllers'
import { removeCampaignSharesAndReconcile } from './contentShareRemoval'
import { scheduleLiveSessionUserEviction } from '../liveSessions/controlScheduling'
import { encounterWriteTransaction } from '../encounters/encounterPorts'

/** Trusted account lifecycle producer; the native user-delete hook authorizes the caller. */
export async function removeAccountCampaignMemberships(ctx: MutationCtx, userId: string) {
  const profile = await ctx.db
    .query('userProfiles')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .unique()
  if (!profile) throw new Error('Account profile is missing.')

  const memberships = (
    await Promise.all(
      (['ACTIVE', 'LEFT'] as const).map((status) =>
        ctx.db
          .query('campaignMemberships')
          .withIndex('by_userId_status_joinedAt', (q) =>
            q.eq('userId', userId).eq('status', status)
          )
          .collect()
      )
    )
  )
    .flat()
    .sort((left, right) => left.campaignId.localeCompare(right.campaignId))

  for (const storedMembership of memberships) {
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
}
