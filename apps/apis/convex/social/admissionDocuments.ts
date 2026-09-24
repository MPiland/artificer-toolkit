import {
  socialApplicationDtoSchema,
  socialProfileDtoSchema
} from '@artificer-toolkit/schema/api/socialHub'
import { campaignInviteDtoSchema } from '@artificer-toolkit/schema/api/campaignCore'
import {
  socialStoredApplicationSchema,
  socialStoredListingSchema,
  socialStoredProfileSchema,
  type SocialStoredProfile
} from '@artificer-toolkit/schema/projections/socialPersistence'
import { campaignStoredInviteSchema } from '@artificer-toolkit/schema/projections/campaignPersistence'
import { presentCampaignPlainText } from '@artificer-toolkit/shared/campaign/textPolicy'
import type { QueryCtx } from '../_generated/server'
import { requireOwnedCampaign } from './listingDocuments'
import { readProfile } from './profiles'
import { hasSocialBlock, presentSocialProfile } from './visibility'
import {
  readAdmissionInvalidation,
  applicationInvalidationPatch,
  invitationInvalidationPatch
} from './admissionInvalidation'
import { resolveListingSuspension } from './profileInvalidation'

async function findAdmissionListing(ctx: QueryCtx, listingId: string) {
  const row = await ctx.db
    .query('socialListings')
    .withIndex('by_publicId', (q) => q.eq('id', listingId.toLowerCase()))
    .unique()
  if (!row) return null
  const deletion = await ctx.db.query('campaignDeletionJobs')
    .withIndex('by_campaignId', (q) => q.eq('campaignId', row.campaignId)).unique()
  if (deletion) return null
  const { _id, _creationTime, ...stored } = row
  const listing = await resolveListingSuspension(ctx, socialStoredListingSchema.parse(stored))
  const campaign = await requireOwnedCampaign(ctx, listing.campaignId, listing.ownerUserId)
  const host = (await readProfile(ctx, campaign.ownerUserId))?.profile
  if (!host) return null
  return { listing, campaign, host }
}

export async function readAdmissionListing(ctx: QueryCtx, listingId: string) {
  const value = await findAdmissionListing(ctx, listingId)
  if (!value) throw new Error('Social listing not found.')
  return value
}

export async function requireAdmissionPair(
  ctx: QueryCtx,
  host: SocialStoredProfile,
  participant: SocialStoredProfile
) {
  if (
    host.status !== 'ACTIVE' ||
    participant.status !== 'ACTIVE' ||
    (await hasSocialBlock(ctx, host.id, participant.id))
  )
    throw new Error('Social admission is unavailable.')
}

export async function findApplication(ctx: QueryCtx, id: string) {
  const row = await ctx.db
    .query('socialApplications')
    .withIndex('by_publicId', (q) => q.eq('id', id.toLowerCase()))
    .unique()
  if (!row) return null
  const { _id, _creationTime, ...stored } = row
  const application = socialStoredApplicationSchema.parse(stored)
  const applicantRow = await ctx.db
    .query('socialProfiles')
    .withIndex('by_publicId', (q) => q.eq('id', application.applicantProfileId))
    .unique()
  if (
    !applicantRow &&
    (application.applicantDeletedAt === undefined || application.status === 'SUBMITTED')
  )
    return null
  const listing = await findAdmissionListing(ctx, application.listingId)
  if (!listing) return null
  const applicant = applicantRow
    ? (() => {
        const { _id: _profileId, _creationTime: _profileCreated, ...storedProfile } = applicantRow
        return socialStoredProfileSchema.parse(storedProfile)
      })()
    : null
  const invalidation =
    application.status === 'SUBMITTED'
      ? await readAdmissionInvalidation(
          ctx,
          listing.host.userId,
          { profileId: application.applicantProfileId },
          application.blockGeneration ?? 0,
          { id: application.listingId, generation: application.listingGeneration ?? 0 },
          application
        )
      : null
  return {
    rowId: _id,
    application: invalidation
      ? {
          ...application,
          ...applicationInvalidationPatch(application.version, invalidation)
        }
      : application,
    applicant,
    ...listing
  }
}

export async function readApplication(ctx: QueryCtx, id: string) {
  const value = await findApplication(ctx, id)
  if (!value) throw new Error('Social application not found.')
  return value
}

/** Only the applicant sees original message text; Standard host-facing prose is always masked. */
export async function presentApplication(
  ctx: QueryCtx,
  value: Awaited<ReturnType<typeof readApplication>>,
  privateMessage: boolean,
  showMatureText: boolean
) {
  const { application, campaign, applicant } = value
  const present = (text: string) =>
    campaign.contentMaturity === 'MATURE' && showMatureText
      ? text
      : presentCampaignPlainText(text, 'STANDARD')
  const expectations = application.expectationsSnapshot
  return socialApplicationDtoSchema.parse({
    applicationPublicId: application.id,
    listingPublicId: application.listingId,
    listingTitle: present(campaign.name),
    applicant: applicant
      ? await presentSocialProfile(ctx, applicant)
      : socialProfileDtoSchema.parse({
          profilePublicId: application.applicantProfileId,
          username: 'Deleted user'
        }),
    message: privateMessage ? application.message : present(application.message),
    status: application.status,
    listingVersion: application.listingVersion,
    expectations: {
      ...expectations,
      contentGuidance: present(expectations.contentGuidance),
      attendancePolicy: present(expectations.attendancePolicy),
      allowedContentRules: present(expectations.allowedContentRules),
      tableConduct: present(expectations.tableConduct),
      contentBoundaries: present(expectations.contentBoundaries),
      safetyDetails: present(expectations.safetyDetails)
    },
    submittedAt: application.submittedAt,
    respondedAt: application.respondedAt,
    version: application.version
  })
}

export async function findInvitation(ctx: QueryCtx, id: string) {
  const row = await ctx.db
    .query('campaignInvites')
    .withIndex('by_publicId', (q) => q.eq('id', id.toLowerCase()))
    .unique()
  if (!row) return null
  const { _id, _creationTime, ...stored } = row
  const invitation = campaignStoredInviteSchema.parse(stored)
  const creator = await ctx.db
    .query('userProfiles')
    .withIndex('by_userId', (q) => q.eq('userId', invitation.createdBy))
    .unique()
  if (!creator) return null
  const recipient = (await readProfile(ctx, invitation.recipientUserId))?.profile
  if (!recipient) return null
  const listing = await findAdmissionListing(ctx, invitation.listingId)
  if (!listing) return null
  const invalidation =
    invitation.status === 'PENDING'
      ? await readAdmissionInvalidation(
          ctx,
          listing.host.userId,
          { userId: invitation.recipientUserId },
          invitation.blockGeneration ?? 0,
          { id: invitation.listingId, generation: invitation.listingGeneration ?? 0 },
          invitation
        )
      : null
  return {
    rowId: _id,
    invitation: invalidation
      ? {
          ...invitation,
          ...invitationInvalidationPatch(invitation.version, invalidation)
        }
      : invitation,
    recipient,
    ...listing
  }
}

export async function readInvitation(ctx: QueryCtx, id: string) {
  const value = await findInvitation(ctx, id)
  if (!value) throw new Error('Social invitation not found.')
  return value
}

export async function presentInvitation(
  ctx: QueryCtx,
  value: Awaited<ReturnType<typeof readInvitation>>,
  showMatureText: boolean,
  asOf?: number
) {
  const { invitation, campaign, host } = value
  const profile = await presentSocialProfile(ctx, host)
  return campaignInviteDtoSchema.parse({
    invitePublicId: invitation.id,
    listingPublicId: invitation.listingId,
    listingTitle:
      campaign.contentMaturity === 'MATURE' && showMatureText
        ? campaign.name
        : presentCampaignPlainText(campaign.name, 'STANDARD'),
    hostProfilePublicId: host.id,
    hostUsername: profile.username,
    recipientUsername: invitation.recipientUsername,
    status:
      invitation.status === 'PENDING' &&
      asOf !== undefined &&
      Date.parse(invitation.expiresAt) <= asOf
        ? 'EXPIRED'
        : invitation.status,
    expiresAt: invitation.expiresAt,
    respondedAt: invitation.respondedAt,
    createdAt: invitation.createdAt,
    version: invitation.version
  })
}
