import { ENTITLEMENT_LIMITS } from '@artificer-toolkit/shared/account/entitlements'
import { campaignStoredMembershipSchema } from '@artificer-toolkit/schema/projections/campaignPersistence'
import type { SocialStoredProfile } from '@artificer-toolkit/schema/projections/socialPersistence'
import type { MutationCtx } from '../_generated/server'
import { readActiveCampaignMembers } from '../campaigns/authority'
import { cancelNotification, enqueueNotification } from '../notifications/intents'
import { readApplication, readInvitation, requireAdmissionPair } from './admissionDocuments'

export async function notifyApplicationDecision(
  ctx: MutationCtx,
  value: Awaited<ReturnType<typeof readApplication>>,
  decision: 'ACCEPTED' | 'DECLINED',
  now: string
) {
  if (!value.applicant) throw new Error('Social admission is unavailable.')
  await cancelNotification(ctx, {
    recipientUserId: value.host.userId,
    sourcePublicId: value.application.id,
    workflowKey: 'social-application-submitted',
    occurredAt: now
  })
  await enqueueNotification(ctx, {
    recipientUserId: value.applicant.userId,
    data: {
      kind: 'SOCIAL_APPLICATION_DECIDED',
      sourcePublicId: value.application.id,
      listingPublicId: value.listing.id,
      listingTitle: value.campaign.name,
      decision,
      occurredAt: now
    }
  })
}

export async function notifyInvitationDecision(
  ctx: MutationCtx,
  value: Awaited<ReturnType<typeof readInvitation>>,
  decision: 'ACCEPTED' | 'DECLINED',
  now: string
) {
  await cancelNotification(ctx, {
    recipientUserId: value.recipient.userId,
    sourcePublicId: value.invitation.id,
    workflowKey: 'social-invitation-received',
    occurredAt: now
  })
  await enqueueNotification(ctx, {
    recipientUserId: value.host.userId,
    data: {
      kind: 'SOCIAL_INVITATION_DECIDED',
      sourcePublicId: value.invitation.id,
      listingPublicId: value.listing.id,
      listingTitle: value.campaign.name,
      recipientUsername: value.invitation.recipientUsername,
      decision,
      occurredAt: now
    }
  })
}

/** Both public admission paths share the membership-range and owner-tier reads in one transaction. */
export async function acceptAdmission(
  ctx: MutationCtx,
  actor: SocialStoredProfile,
  source: { kind: 'APPLICATION' | 'INVITATION'; id: string; expectedVersion: number }
) {
  const value =
    source.kind === 'APPLICATION'
      ? { kind: 'APPLICATION' as const, ...(await readApplication(ctx, source.id)) }
      : { kind: 'INVITATION' as const, ...(await readInvitation(ctx, source.id)) }
  const { campaign, listing, host } = value
  const participant = value.kind === 'APPLICATION' ? value.applicant : value.recipient
  if (!participant) throw new Error('Social admission is unavailable.')
  const record = value.kind === 'APPLICATION' ? value.application : value.invitation
  if (
    value.kind === 'APPLICATION'
      ? actor.userId !== campaign.ownerUserId || listing.audience !== 'PUBLIC'
      : actor.userId !== value.recipient.userId
  )
    throw new Error('Social admission is unavailable.')
  if (participant.userId === campaign.ownerUserId)
    throw new Error('The Campaign owner cannot be admitted as a player.')
  await requireAdmissionPair(ctx, host, participant)
  const existing = await ctx.db
    .query('campaignMemberships')
    .withIndex('by_campaignId_userId', (q) =>
      q.eq('campaignId', campaign.id).eq('userId', participant.userId)
    )
    .unique()
  if (existing) {
    const { _id, _creationTime, ...stored } = existing
    campaignStoredMembershipSchema.parse(stored)
  }
  if (record.status === 'ACCEPTED') {
    if (existing?.status !== 'ACTIVE' || existing.role !== 'PLAYER')
      throw new Error('Social admission is unavailable.')
    return value
  }
  if (
    record.status !== (value.kind === 'APPLICATION' ? 'SUBMITTED' : 'PENDING') ||
    record.version !== source.expectedVersion ||
    record.listingVersion !== listing.version
  )
    throw new Error('Social admission version conflict.')
  if (value.kind === 'INVITATION' && Date.parse(value.invitation.expiresAt) <= Date.now())
    throw new Error('Social invitation has expired.')
  if (
    listing.status !== 'OPEN' ||
    listing.moderationStatus !== 'VISIBLE' ||
    campaign.status !== 'ACTIVE'
  )
    throw new Error('Social admission is unavailable.')
  const members = await readActiveCampaignMembers(ctx, campaign)
  const now = new Date(
    Math.max(
      Date.now(),
      Date.parse(record.updatedAt),
      ...members.map((member) => Date.parse(member.accessStartedAt)),
      ...(existing
        ? [
            Date.parse(existing.accessStartedAt),
            Date.parse(existing.joinedAt),
            ...(existing.leftAt ? [Date.parse(existing.leftAt)] : [])
          ]
        : [])
    ) + 1
  ).toISOString()
  if (existing?.status !== 'ACTIVE') {
    const entitlement = await ctx.db
      .query('accountEntitlements')
      .withIndex('by_userId', (q) => q.eq('userId', campaign.ownerUserId))
      .unique()
    const players = members.filter((member) => member.role === 'PLAYER').length
    if (players >= listing.capacity) throw new Error('This table no longer has an available seat.')
    if (players >= ENTITLEMENT_LIMITS[entitlement?.tier ?? 'FREE'].playerSeatsPerCampaign)
      throw new Error('This Campaign has reached its account player seat limit.')
    // A rejoin starts a new access epoch; it cannot revive old chat membership or departure receipts.
    const membership = campaignStoredMembershipSchema.parse({
      campaignId: campaign.id,
      userId: participant.userId,
      role: 'PLAYER',
      status: 'ACTIVE',
      accessStartedAt: now,
      joinedAt: now,
      leftAt: null
    })
    if (existing) await ctx.db.replace(existing._id, membership)
    else await ctx.db.insert('campaignMemberships', membership)
  } else if (existing.role !== 'PLAYER')
    throw new Error('The Campaign owner cannot be admitted as a player.')
  if (value.kind === 'APPLICATION') {
    const application = {
      ...value.application,
      status: 'ACCEPTED' as const,
      respondedAt: now,
      updatedAt: now,
      version: value.application.version + 1
    }
    await ctx.db.replace(value.rowId, application)
    await notifyApplicationDecision(ctx, value, 'ACCEPTED', now)
    return { ...value, application }
  }
  const invitation = {
    ...value.invitation,
    status: 'ACCEPTED' as const,
    respondedAt: now,
    updatedAt: now,
    version: value.invitation.version + 1
  }
  await ctx.db.replace(value.rowId, invitation)
  await notifyInvitationDecision(ctx, value, 'ACCEPTED', now)
  return { ...value, invitation }
}
