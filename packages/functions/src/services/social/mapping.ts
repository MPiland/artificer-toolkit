import type {
  CampaignInviteProjection,
  SocialApplicationRecord,
  SocialListingRecord,
  SocialProfileRecord,
  SocialReportRecord
} from '@artificer-toolkit/db'
import {
  socialListingExpectationsDtoSchema,
  type SocialApplicationDto,
  type SocialListingDto,
  type SocialListingExpectationsDto,
  type SocialModerationReportDto,
  type SocialProfileDto
} from '@artificer-toolkit/schema/api/socialHub'
import type { CampaignInviteDto } from '@artificer-toolkit/schema/api/campaigns'
import { jsonSchema } from '@artificer-toolkit/schema/api/campaignContractSchemas'
import { presentCampaignPlainText } from '@artificer-toolkit/shared/campaign/textPolicy'

export function socialIso(value: string | Date): string {
  return typeof value === 'string' ? new Date(value).toISOString() : value.toISOString()
}

export function mapSocialProfile(record: SocialProfileRecord): SocialProfileDto {
  return { profilePublicId: record.id, username: record.username }
}

type SocialPresentationOptions = {
  privateOwnerView?: boolean
  showMatureText?: boolean
}

function presentSocialText(
  value: string,
  maturity: SocialListingRecord['contentMaturity'],
  options: SocialPresentationOptions
): string {
  if (options.privateOwnerView || (maturity === 'MATURE' && options.showMatureText)) return value
  return presentCampaignPlainText(value, 'STANDARD')
}

function presentExpectations(
  expectations: SocialListingExpectationsDto,
  maturity: SocialListingRecord['contentMaturity'],
  options: SocialPresentationOptions
): SocialListingExpectationsDto {
  return {
    contentGuidance: presentSocialText(expectations.contentGuidance, maturity, options),
    attendancePolicy: presentSocialText(expectations.attendancePolicy, maturity, options),
    allowedContentRules: presentSocialText(expectations.allowedContentRules, maturity, options),
    tableConduct: presentSocialText(expectations.tableConduct, maturity, options),
    contentBoundaries: presentSocialText(expectations.contentBoundaries, maturity, options),
    safetyPractices: expectations.safetyPractices,
    safetyDetails: presentSocialText(expectations.safetyDetails, maturity, options)
  }
}

export function listingExpectations(
  listing: SocialListingRecord,
  options: SocialPresentationOptions = {}
): SocialListingExpectationsDto {
  return presentExpectations(
    {
      contentGuidance: listing.contentGuidance,
      attendancePolicy: listing.attendancePolicy,
      allowedContentRules: listing.allowedContentRules,
      tableConduct: listing.tableConduct,
      contentBoundaries: listing.contentBoundaries,
      safetyPractices: listing.safetyPractices,
      safetyDetails: listing.safetyDetails
    },
    listing.contentMaturity,
    options
  )
}

export function mapSocialListing(
  record: SocialListingRecord,
  options: SocialPresentationOptions = {}
): SocialListingDto {
  const present = (value: string) => presentSocialText(value, record.contentMaturity, options)
  let schedule: SocialListingDto['schedule']
  if (record.scheduleKind === 'FLEXIBLE') {
    schedule = {
      kind: 'FLEXIBLE',
      timeZone: record.timeZone,
      summary: present(record.scheduleSummary)
    }
  } else if (record.scheduleKind === 'ONE_TIME') {
    if (!record.startsAt) throw new Error('ONE_TIME Social listing is missing starts_at.')
    schedule = {
      kind: 'ONE_TIME',
      timeZone: record.timeZone,
      summary: present(record.scheduleSummary),
      startsAt: socialIso(record.startsAt)
    }
  } else {
    if (record.weekday === null || !record.localStartTime || !record.recurrence) {
      throw new Error('RECURRING Social listing is missing schedule fields.')
    }
    schedule = {
      kind: 'RECURRING',
      timeZone: record.timeZone,
      summary: present(record.scheduleSummary),
      weekday: record.weekday,
      localStartTime: record.localStartTime.slice(0, 5),
      recurrence: record.recurrence
    }
  }

  return {
    listingPublicId: record.id,
    host: { profilePublicId: record.hostProfileId, username: record.hostUsername },
    title: present(record.title),
    summary: present(record.summary),
    status: record.status,
    audience: record.audience,
    moderationStatus: record.moderationStatus,
    system: {
      systemId: record.systemId,
      label: record.systemLabel,
      rulesetCode: record.rulesetCode,
      rulesetVersion: record.rulesetVersion
    },
    format: record.campaignFormat,
    toneTags: record.toneTags,
    toneDetails: record.toneDetails ? present(record.toneDetails) : null,
    contentMaturity: record.contentMaturity,
    playMode: record.playMode,
    capacity: record.capacity,
    availableSeats: Math.max(0, record.capacity - record.activePlayerCount),
    ageBand: '18_PLUS',
    schedule,
    location:
      record.city && record.stateCode ? { city: record.city, stateCode: record.stateCode } : null,
    expectations: listingExpectations(record, options),
    isFree: true,
    publishedAt: record.publishedAt ? socialIso(record.publishedAt) : null,
    version: record.version
  }
}

export function mapSocialApplication(
  record: SocialApplicationRecord,
  options: SocialPresentationOptions & { privateApplicationText?: boolean } = {}
): SocialApplicationDto {
  const expectations = socialListingExpectationsDtoSchema.parse(record.expectationsSnapshot)
  return {
    applicationPublicId: record.id,
    listingPublicId: record.listingId,
    listingTitle: presentSocialText(record.listingTitle, record.contentMaturity, options),
    applicant: {
      profilePublicId: record.applicantProfileId,
      username: record.applicantUsername
    },
    message: options.privateApplicationText
      ? record.message
      : presentSocialText(record.message, record.contentMaturity, options),
    status: record.status,
    listingVersion: record.listingVersion,
    expectations: presentExpectations(expectations, record.contentMaturity, options),
    submittedAt: socialIso(record.submittedAt),
    respondedAt: record.respondedAt ? socialIso(record.respondedAt) : null,
    version: record.version
  }
}

export function mapCampaignInvite(
  record: CampaignInviteProjection,
  showMatureText = false
): CampaignInviteDto {
  return {
    invitePublicId: record.id,
    listingPublicId: record.listingId,
    listingTitle: presentSocialText(record.listingTitle, record.contentMaturity, {
      showMatureText
    }),
    hostProfilePublicId: record.hostProfileId,
    hostUsername: record.hostUsername,
    recipientUsername: record.recipientUsername,
    status: record.status,
    expiresAt: socialIso(record.expiresAt),
    respondedAt: record.respondedAt ? socialIso(record.respondedAt) : null,
    createdAt: socialIso(record.createdAt),
    version: record.version
  }
}

/*
 * The remaining mapper deliberately leaves moderator evidence untouched. Opening
 * evidence is separately authorized and audited before this DTO is returned.
 */
export function mapModerationReport(record: SocialReportRecord): SocialModerationReportDto {
  return {
    reportPublicId: record.id,
    targetKind: record.targetKind,
    reason: record.reason,
    status: record.status,
    createdAt: socialIso(record.createdAt),
    updatedAt: socialIso(record.updatedAt),
    version: record.version,
    reporter: {
      profilePublicId: record.reporterProfileId,
      username: record.reporterUsername
    },
    details: record.details,
    evidence: jsonSchema.parse(record.evidenceSnapshot)
  }
}
