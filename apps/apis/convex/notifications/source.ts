import type { NotificationIntentData } from '@artificer-toolkit/schema/api/notifications'
import { campaignStoredInviteSchema } from '@artificer-toolkit/schema/projections/campaignPersistence'
import {
  socialStoredApplicationSchema,
  socialStoredListingSchema,
  socialStoredProfileSchema,
  type SocialStoredProfile
} from '@artificer-toolkit/schema/projections/socialPersistence'
import type { QueryCtx } from '../_generated/server'
import { isPartyMember, readParty } from '../campaigns/announcements'
import { requireCampaignAuthority } from '../campaigns/authority'
import { readProfile } from '../social/profiles'
import { hasSocialBlock } from '../social/visibility'
import { readAdmissionInvalidation } from '../social/admissionInvalidation'

async function readSourceCampaign(ctx: QueryCtx, campaignId: string, userId: string) {
  try {
    return await requireCampaignAuthority(ctx, campaignId, userId)
  } catch (error) {
    if (error instanceof Error && error.message === 'Campaign not found.') return null
    throw error
  }
}

async function readSocialSource(ctx: QueryCtx, listingId: string) {
  const listingRow = await ctx.db
    .query('socialListings')
    .withIndex('by_publicId', (q) => q.eq('id', listingId))
    .unique()
  if (!listingRow) return null
  const { _id: _listingId, _creationTime: _listingCreated, ...listingStored } = listingRow
  const listing = socialStoredListingSchema.parse(listingStored)
  const [authority, host] = await Promise.all([
    readSourceCampaign(ctx, listing.campaignId, listing.ownerUserId),
    readProfile(ctx, listing.ownerUserId)
  ])
  if (
    !authority ||
    authority.membership.role !== 'OWNER' ||
    authority.campaign.ownerUserId !== listing.ownerUserId ||
    !host
  )
    return null
  return {
    listing,
    campaign: authority.campaign,
    host: host.profile
  }
}

async function isSocialPairAvailable(
  ctx: QueryCtx,
  host: Pick<SocialStoredProfile, 'id' | 'status'>,
  participant: Pick<SocialStoredProfile, 'id' | 'status'>
) {
  return (
    host.status === 'ACTIVE' &&
    participant.status === 'ACTIVE' &&
    !(await hasSocialBlock(ctx, host.id, participant.id))
  )
}

async function applicationEligible(
  ctx: QueryCtx,
  recipientUserId: string,
  data: Extract<
    NotificationIntentData,
    { kind: 'SOCIAL_APPLICATION_SUBMITTED' | 'SOCIAL_APPLICATION_DECIDED' }
  >
) {
  const row = await ctx.db
    .query('socialApplications')
    .withIndex('by_publicId', (q) => q.eq('id', data.sourcePublicId))
    .unique()
  if (!row) return false
  const { _id, _creationTime, ...stored } = row
  const application = socialStoredApplicationSchema.parse(stored)
  if (application.listingId !== data.listingPublicId) return false
  const [source, applicantRow] = await Promise.all([
    readSocialSource(ctx, application.listingId),
    ctx.db
      .query('socialProfiles')
      .withIndex('by_publicId', (q) => q.eq('id', application.applicantProfileId))
      .unique()
  ])
  if (!source || !applicantRow) return false
  const { _id: _applicantId, _creationTime: _applicantCreated, ...applicantStored } = applicantRow
  const applicant = socialStoredProfileSchema.parse(applicantStored)
  if (!(await isSocialPairAvailable(ctx, source.host, applicant))) return false
  const invalidation =
    data.kind === 'SOCIAL_APPLICATION_SUBMITTED'
      ? await readAdmissionInvalidation(
          ctx,
          source.host.userId,
          { profileId: applicant.id },
          application.blockGeneration ?? 0,
          { id: application.listingId, generation: application.listingGeneration ?? 0 },
          application
        )
      : null
  if (data.kind === 'SOCIAL_APPLICATION_SUBMITTED')
    return (
      recipientUserId === source.host.userId &&
      application.status === 'SUBMITTED' &&
      !invalidation &&
      application.listingVersion === source.listing.version &&
      source.listing.status === 'OPEN' &&
      source.listing.audience === 'PUBLIC' &&
      source.listing.moderationStatus === 'VISIBLE' &&
      source.campaign.status === 'ACTIVE'
    )
  return recipientUserId === applicant.userId && application.status === data.decision
}

async function invitationEligible(
  ctx: QueryCtx,
  recipientUserId: string,
  data: Extract<
    NotificationIntentData,
    { kind: 'SOCIAL_INVITATION_RECEIVED' | 'SOCIAL_INVITATION_DECIDED' }
  >
) {
  const row = await ctx.db
    .query('campaignInvites')
    .withIndex('by_publicId', (q) => q.eq('id', data.sourcePublicId))
    .unique()
  if (!row) return false
  const { _id, _creationTime, ...stored } = row
  const invitation = campaignStoredInviteSchema.parse(stored)
  if (invitation.listingId !== data.listingPublicId) return false
  const [source, recipientRow] = await Promise.all([
    readSocialSource(ctx, invitation.listingId),
    ctx.db
      .query('socialProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', invitation.recipientUserId))
      .unique()
  ])
  if (!source || !recipientRow || invitation.createdBy !== source.campaign.ownerUserId) return false
  const { _id: _recipientId, _creationTime: _recipientCreated, ...recipientStored } = recipientRow
  const recipient = socialStoredProfileSchema.parse(recipientStored)
  if (!(await isSocialPairAvailable(ctx, source.host, recipient))) return false
  const invalidation =
    data.kind === 'SOCIAL_INVITATION_RECEIVED'
      ? await readAdmissionInvalidation(
          ctx,
          source.host.userId,
          { userId: recipient.userId },
          invitation.blockGeneration ?? 0,
          { id: invitation.listingId, generation: invitation.listingGeneration ?? 0 },
          invitation
        )
      : null
  if (data.kind === 'SOCIAL_INVITATION_RECEIVED')
    return (
      recipientUserId === invitation.recipientUserId &&
      invitation.status === 'PENDING' &&
      !invalidation &&
      Date.parse(invitation.expiresAt) > Date.now() &&
      Date.parse(invitation.expiresAt) === Date.parse(data.expiresAt) &&
      invitation.listingVersion === source.listing.version &&
      source.listing.status === 'OPEN' &&
      source.listing.moderationStatus === 'VISIBLE' &&
      source.campaign.status === 'ACTIVE'
    )
  return recipientUserId === source.campaign.ownerUserId && invitation.status === data.decision
}

async function announcementEligible(
  ctx: QueryCtx,
  recipientUserId: string,
  data: Extract<NotificationIntentData, { kind: 'CAMPAIGN_ANNOUNCEMENT' }>
) {
  const authority = await readSourceCampaign(ctx, data.campaignPublicId, recipientUserId)
  if (!authority) return false
  const { campaign, membership } = authority
  if (campaign.publicId !== data.campaignPublicId && campaign.id !== data.campaignPublicId)
    return false
  const announcement = await ctx.db
    .query('campaignAnnouncements')
    .withIndex('by_campaignId_publicId', (q) =>
      q.eq('campaignId', campaign.id).eq('announcementPublicId', data.announcementPublicId)
    )
    .unique()
  if (
    !announcement ||
    announcement.scope !== data.scope ||
    announcement.authorUserId === recipientUserId
  )
    return false
  if (announcement.scope !== 'PARTY') return true
  if (membership.role !== 'PLAYER' || announcement.partyId === null) return false
  const party = await readParty(ctx, campaign.id)
  return party?.id === announcement.partyId && isPartyMember(ctx, party.id, membership)
}

export async function isNotificationSourceEligible(
  ctx: QueryCtx,
  recipientUserId: string,
  data: NotificationIntentData
) {
  switch (data.kind) {
    case 'SOCIAL_APPLICATION_SUBMITTED':
    case 'SOCIAL_APPLICATION_DECIDED':
      return applicationEligible(ctx, recipientUserId, data)
    case 'SOCIAL_INVITATION_RECEIVED':
    case 'SOCIAL_INVITATION_DECIDED':
      return invitationEligible(ctx, recipientUserId, data)
    case 'CAMPAIGN_ANNOUNCEMENT':
      return announcementEligible(ctx, recipientUserId, data)
  }
}
