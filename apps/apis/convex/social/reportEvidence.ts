import type { CreateSocialReportInput } from '@artificer-toolkit/schema/api/socialHub'
import {
  socialApplicationEvidenceSchema,
  socialListingEvidenceSchema,
  socialProfileEvidenceSchema
} from '@artificer-toolkit/schema/projections/socialModerationPersistence'
import {
  socialStoredProfileSchema,
  type SocialStoredProfile
} from '@artificer-toolkit/schema/projections/socialPersistence'
import type { QueryCtx } from '../_generated/server'
import { hasSocialBlock, presentSocialProfile } from './visibility'
import { readAdmissionListing, readApplication } from './admissionDocuments'

export async function captureReportEvidence(
  ctx: QueryCtx,
  reporter: SocialStoredProfile,
  input: CreateSocialReportInput,
  now: string
) {
  const id = input.targetPublicId.toLowerCase()
  if (input.targetKind === 'PROFILE') {
    const row = await ctx.db
      .query('socialProfiles')
      .withIndex('by_publicId', (q) => q.eq('id', id))
      .unique()
    if (
      !row ||
      row.id === reporter.id ||
      (row.status !== 'ACTIVE' && !(await hasSocialBlock(ctx, reporter.id, row.id)))
    )
      throw new Error('Report target not found.')
    const { _id, _creationTime, ...stored } = row
    const profile = socialStoredProfileSchema.parse(stored)
    return socialProfileEvidenceSchema.parse({
      ...(await presentSocialProfile(ctx, profile)),
      status: profile.status
    })
  }
  if (input.targetKind === 'APPLICATION') {
    const value = await readApplication(ctx, id)
    const { application, listing, campaign, host, applicant } = value
    if (!applicant) throw new Error('Report target not found.')
    if (application.applicantProfileId !== reporter.id && campaign.ownerUserId !== reporter.userId)
      throw new Error('Report target not found.')
    const [hostProfile, applicantProfile] = await Promise.all([
      presentSocialProfile(ctx, host),
      presentSocialProfile(ctx, applicant)
    ])
    return socialApplicationEvidenceSchema.parse({
      applicationPublicId: application.id,
      listingPublicId: listing.id,
      listingTitle: campaign.name,
      applicantProfilePublicId: applicant.id,
      applicantUsername: applicantProfile.username,
      hostProfilePublicId: host.id,
      hostUsername: hostProfile.username,
      message: application.message,
      status: application.status,
      listingVersion: application.listingVersion,
      expectations: application.expectationsSnapshot,
      submittedAt: application.submittedAt,
      respondedAt: application.respondedAt,
      version: application.version,
      capturedAt: now
    })
  }
  const { listing, campaign, host } = await readAdmissionListing(ctx, id)
  const [application, invitation] = await Promise.all([
    ctx.db
      .query('socialApplications')
      .withIndex('by_listingId_applicantProfileId_status', (q) =>
        q.eq('listingId', listing.id).eq('applicantProfileId', reporter.id)
      )
      .first(),
    ctx.db
      .query('campaignInvites')
      .withIndex('by_listingId_recipientUserId_status', (q) =>
        q.eq('listingId', listing.id).eq('recipientUserId', reporter.userId)
      )
      .first()
  ])
  const historical =
    campaign.ownerUserId === reporter.userId || application !== null || invitation !== null
  if (
    !historical &&
    (campaign.status !== 'ACTIVE' ||
      listing.status !== 'OPEN' ||
      listing.audience !== 'PUBLIC' ||
      listing.moderationStatus !== 'VISIBLE' ||
      host.status !== 'ACTIVE' ||
      (await hasSocialBlock(ctx, reporter.id, host.id)))
  )
    throw new Error('Report target not found.')
  const profile = await presentSocialProfile(ctx, host)
  return socialListingEvidenceSchema.parse({
    listingPublicId: listing.id,
    title: campaign.name,
    summary: listing.summary,
    status: listing.status,
    audience: listing.audience,
    moderationStatus: listing.moderationStatus,
    hostProfilePublicId: host.id,
    hostUsername: profile.username,
    systemId: listing.systemId,
    format: campaign.format,
    toneTags: campaign.toneTags,
    toneDetails: campaign.toneDetails,
    contentMaturity: campaign.contentMaturity,
    playMode: listing.playMode,
    schedule: {
      ...listing.schedule,
      startsAt: listing.schedule.kind === 'ONE_TIME' ? listing.schedule.startsAt : null,
      weekday: listing.schedule.kind === 'RECURRING' ? listing.schedule.weekday : null,
      localStartTime:
        listing.schedule.kind === 'RECURRING' ? listing.schedule.localStartTime : null,
      recurrence: listing.schedule.kind === 'RECURRING' ? listing.schedule.recurrence : null
    },
    location: listing.location,
    expectations: listing.expectations,
    version: listing.version,
    capturedAt: now
  })
}
