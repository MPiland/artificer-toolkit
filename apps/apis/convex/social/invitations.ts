import { v } from 'convex/values'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  createCampaignInviteInputSchema,
  campaignInviteVersionInputSchema,
  campaignInviteDtoSchema,
  campaignDetailDtoSchema,
  type CampaignInviteDto,
  type CampaignDetailDto
} from '@artificer-toolkit/schema/api/campaignCore'
import { campaignStoredInviteSchema } from '@artificer-toolkit/schema/projections/campaignPersistence'
import { ENTITLEMENT_LIMITS } from '@artificer-toolkit/shared/account/entitlements'
import { mutation } from '../lib/mutations'
import { components } from '../_generated/api'
import {
  readActiveCampaignMembers,
  readCampaignDetail,
  requireCampaignAuthority
} from '../campaigns/documents'
import { cancelNotification, enqueueNotification } from '../notifications/intents'
import { requireSocialViewer, presentSocialProfile } from './visibility'
import { readProfile } from './profiles'
import { consumeSocialRateLimit } from './rateLimits'
import {
  readAdmissionListing,
  readInvitation,
  presentInvitation,
  requireAdmissionPair
} from './admissionDocuments'
import { acceptAdmission, notifyInvitationDecision } from './admission'
import { expireInvitation } from './invitationExpiry'
import { readBlockInvalidation } from './blockInvalidation'
import { readAdmissionInvalidation, invitationInvalidationPatch } from './admissionInvalidation'
import { readListingInvalidation } from './listingInvalidation'

export const create = mutation({
  args: zodToConvexFields(createCampaignInviteInputSchema.shape),
  returns: zodToConvex(campaignInviteDtoSchema),
  handler: async (ctx, args): Promise<CampaignInviteDto> => {
    const actor = await requireSocialViewer(ctx)
    const input = createCampaignInviteInputSchema.parse(args)
    const value = await readAdmissionListing(ctx, input.listingPublicId)
    const { listing, campaign, host } = value
    if (campaign.ownerUserId !== actor.userId) throw new Error('Social listing not found.')
    if (
      listing.version !== input.expectedListingVersion ||
      listing.status !== 'OPEN' ||
      listing.moderationStatus !== 'VISIBLE' ||
      campaign.status !== 'ACTIVE'
    )
      throw new Error('This Social listing is not available for invitations.')
    const user = await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: 'user',
      where: [{ field: 'username', value: input.username.trim().toLowerCase() }]
    })
    const account = user
      ? await ctx.db
          .query('userProfiles')
          .withIndex('by_authUserId', (q) => q.eq('authUserId', user._id))
          .unique()
      : null
    const recipient = account ? (await readProfile(ctx, account.userId))?.profile : null
    if (!recipient || recipient.userId === actor.userId)
      throw new Error('Social recipient not found.')
    await requireAdmissionPair(ctx, host, recipient)
    const { invalidation } = await readBlockInvalidation(ctx, host, recipient)
    const listingInvalidation = await readListingInvalidation(ctx, listing.id, null)
    const [members, entitlement] = await Promise.all([
      readActiveCampaignMembers(ctx, campaign),
      ctx.db
        .query('accountEntitlements')
        .withIndex('by_userId', (q) => q.eq('userId', actor.userId))
        .unique()
    ])
    if (members.some((member) => member.userId === recipient.userId))
      throw new Error('This user is already a Campaign member.')
    const players = members.filter((member) => member.role === 'PLAYER').length
    if (players >= listing.capacity) throw new Error('This table no longer has an available seat.')
    if (players >= ENTITLEMENT_LIMITS[entitlement?.tier ?? 'FREE'].playerSeatsPerCampaign)
      throw new Error('This Campaign has reached its account player seat limit.')
    const nowMs = Date.now()
    const expires = input.expiresAt ? Date.parse(input.expiresAt) : nowMs + 7 * 86_400_000
    if (!Number.isFinite(expires) || expires <= nowMs || expires > nowMs + 30 * 86_400_000)
      throw new Error('Invite expiry must be within the next 30 days.')
    const now = new Date(nowMs).toISOString()
    const existing = await ctx.db
      .query('campaignInvites')
      .withIndex('by_listingId_recipientUserId_status', (q) =>
        q
          .eq('listingId', listing.id)
          .eq('recipientUserId', recipient.userId)
          .eq('status', 'PENDING')
      )
      .unique()
    if (existing) {
      const event = await readAdmissionInvalidation(
        ctx,
        host.userId,
        { userId: recipient.userId },
        existing.blockGeneration ?? 0,
        { id: listing.id, generation: existing.listingGeneration ?? 0 },
        existing
      )
      if (event) {
        const staleAt = event.invalidatedAt
        await ctx.db.patch(existing._id, invitationInvalidationPatch(existing.version, event))
        await cancelNotification(ctx, {
          recipientUserId: existing.recipientUserId,
          sourcePublicId: existing.id,
          workflowKey: 'social-invitation-received',
          occurredAt: staleAt
        })
      } else if (!(await expireInvitation(ctx, existing, now)))
        throw new Error('This user already has a pending invitation.')
    }
    await consumeSocialRateLimit(ctx, actor.userId, 'INVITE')
    const invitation = campaignStoredInviteSchema.parse({
      id: crypto.randomUUID(),
      listingId: listing.id,
      createdBy: actor.userId,
      recipientUserId: recipient.userId,
      recipientUsername: (await presentSocialProfile(ctx, recipient)).username,
      listingVersion: listing.version,
      status: 'PENDING',
      expiresAt: new Date(expires).toISOString(),
      respondedAt: null,
      revokedAt: null,
      expiredAt: null,
      blockGeneration: invalidation?.generation ?? 0,
      listingGeneration: listingInvalidation?.generation ?? 0,
      ownerProfileGeneration: host.invalidationGeneration ?? 0,
      participantProfileGeneration: recipient.invalidationGeneration ?? 0,
      version: 0,
      createdAt: now,
      updatedAt: now
    })
    const rowId = await ctx.db.insert('campaignInvites', invitation)
    await enqueueNotification(ctx, {
      recipientUserId: recipient.userId,
      data: {
        kind: 'SOCIAL_INVITATION_RECEIVED',
        sourcePublicId: invitation.id,
        listingPublicId: listing.id,
        listingTitle: campaign.name,
        hostUsername: (await presentSocialProfile(ctx, host)).username,
        expiresAt: invitation.expiresAt,
        occurredAt: now
      }
    })
    return presentInvitation(ctx, { ...value, rowId, invitation, recipient }, true)
  }
})

export const accept = mutation({
  args: zodToConvexFields(campaignInviteVersionInputSchema.shape),
  returns: zodToConvex(campaignDetailDtoSchema),
  handler: async (ctx, args): Promise<CampaignDetailDto> => {
    const actor = await requireSocialViewer(ctx)
    const input = campaignInviteVersionInputSchema.parse(args)
    const value = await acceptAdmission(ctx, actor, {
      kind: 'INVITATION',
      id: input.invitePublicId,
      expectedVersion: input.expectedVersion
    })
    return readCampaignDetail(
      ctx,
      await requireCampaignAuthority(ctx, value.campaign.id, actor.userId)
    )
  }
})

export const decline = mutation({
  args: zodToConvexFields(campaignInviteVersionInputSchema.shape),
  returns: zodToConvex(campaignInviteDtoSchema),
  handler: async (ctx, args): Promise<CampaignInviteDto> => {
    const actor = await requireSocialViewer(ctx)
    const input = campaignInviteVersionInputSchema.parse(args)
    const value = await readInvitation(ctx, input.invitePublicId)
    if (value.recipient.userId !== actor.userId) throw new Error('Social invitation not found.')
    await requireAdmissionPair(ctx, value.host, value.recipient)
    const { invitation } = value
    if (invitation.status !== 'PENDING' || invitation.version !== input.expectedVersion)
      throw new Error('Social invitation version conflict.')
    if (Date.parse(invitation.expiresAt) <= Date.now())
      throw new Error('Social invitation has expired.')
    const now = new Date(Math.max(Date.now(), Date.parse(invitation.updatedAt) + 1)).toISOString()
    const updated = {
      ...invitation,
      status: 'DECLINED' as const,
      respondedAt: now,
      updatedAt: now,
      version: invitation.version + 1
    }
    await ctx.db.replace(value.rowId, updated)
    await notifyInvitationDecision(ctx, value, 'DECLINED', now)
    return presentInvitation(
      ctx,
      { ...value, invitation: updated },
      actor.contentPreference === 'MATURE'
    )
  }
})

export const revoke = mutation({
  args: zodToConvexFields(campaignInviteVersionInputSchema.shape),
  returns: v.null(),
  handler: async (ctx, args) => {
    const actor = await requireSocialViewer(ctx)
    const input = campaignInviteVersionInputSchema.parse(args)
    const value = await readInvitation(ctx, input.invitePublicId)
    if (value.campaign.ownerUserId !== actor.userId) throw new Error('Social invitation not found.')
    const { invitation } = value
    if (invitation.status !== 'PENDING' || invitation.version !== input.expectedVersion)
      throw new Error('Social invitation version conflict.')
    const now = new Date(Math.max(Date.now(), Date.parse(invitation.updatedAt) + 1)).toISOString()
    await ctx.db.replace(value.rowId, {
      ...invitation,
      status: 'REVOKED',
      revokedAt: now,
      updatedAt: now,
      version: invitation.version + 1
    })
    await cancelNotification(ctx, {
      recipientUserId: invitation.recipientUserId,
      sourcePublicId: invitation.id,
      workflowKey: 'social-invitation-received',
      occurredAt: now
    })
    return null
  }
})
