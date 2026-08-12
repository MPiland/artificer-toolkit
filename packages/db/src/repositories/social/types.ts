import type { Timestamp } from '../campaignTypes.js'
import type { CampaignContentMaturity, CampaignFormat, CampaignToneTag } from '../campaignTypes.js'

export type SocialProfileStatus = 'ACTIVE' | 'SUSPENDED'
export type SocialContentPreference = 'STANDARD' | 'MATURE'
export type SocialListingStatus = 'DRAFT' | 'OPEN' | 'CLOSED'
export type SocialListingAudience = 'PRIVATE' | 'PUBLIC'
export type SocialListingModerationStatus = 'VISIBLE' | 'HIDDEN'
export type SocialPlayMode = 'ONLINE' | 'IN_PERSON' | 'HYBRID'
export type SocialScheduleKind = 'FLEXIBLE' | 'ONE_TIME' | 'RECURRING'
export type SocialRecurrence = 'WEEKLY' | 'BIWEEKLY'
export type SocialSafetyPractice =
  | 'SESSION_ZERO'
  | 'LINES_AND_VEILS'
  | 'X_CARD'
  | 'OPEN_DOOR'
  | 'SCRIPT_CHANGE'
  | 'OTHER'
export type SocialApplicationStatus =
  | 'SUBMITTED'
  | 'WITHDRAWN'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'EXPIRED'
  | 'BLOCKED'
export type SocialReportReason =
  | 'HARASSMENT'
  | 'HATE_OR_ABUSE'
  | 'SEXUAL_CONTENT'
  | 'SPAM_OR_SCAM'
  | 'SAFETY_MISREPRESENTATION'
  | 'PRIVACY'
  | 'OTHER'
export type SocialReportStatus = 'SUBMITTED' | 'UNDER_REVIEW' | 'RESOLVED' | 'DISMISSED'
export type SocialModerationAction =
  | 'VIEWED'
  | 'START_REVIEW'
  | 'DISMISS'
  | 'RESOLVE'
  | 'HIDE_LISTING'
  | 'RESTORE_LISTING'
  | 'SUSPEND_PROFILE'
  | 'RESTORE_PROFILE'
export type SocialRateLimitAction = 'INVITE' | 'APPLICATION' | 'REPORT' | 'BLOCK'
export type SocialRateLimitWindow = 'HOUR' | 'DAY'

export interface SocialProfileRecord {
  id: string
  userId: string
  username: string
  adultAttestedAt: Timestamp | null
  contentPreference: SocialContentPreference
  status: SocialProfileStatus
  version: number
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface SocialListingRecord {
  id: string
  campaignId: string
  campaignOwnerUserId: string
  campaignStatus: 'ACTIVE' | 'ARCHIVED'
  hostProfileId: string
  hostUsername: string
  status: SocialListingStatus
  audience: SocialListingAudience
  moderationStatus: SocialListingModerationStatus
  systemId: string
  systemLabel: string
  rulesetCode: string
  rulesetVersion: string
  title: string
  summary: string
  campaignFormat: CampaignFormat
  toneTags: CampaignToneTag[]
  toneDetails: string | null
  contentMaturity: CampaignContentMaturity
  playMode: SocialPlayMode
  capacity: number
  activePlayerCount: number
  scheduleKind: SocialScheduleKind
  timeZone: string
  scheduleSummary: string
  startsAt: Timestamp | null
  weekday: number | null
  localStartTime: string | null
  recurrence: SocialRecurrence | null
  city: string | null
  stateCode: string | null
  contentGuidance: string
  attendancePolicy: string
  allowedContentRules: string
  tableConduct: string
  contentBoundaries: string
  safetyPractices: SocialSafetyPractice[]
  safetyDetails: string
  isFree: boolean
  priceAmount: string | number | null
  priceCurrency: string | null
  publishedAt: Timestamp | null
  version: number
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface SocialListingWrite {
  title: string
  summary: string
  audience: SocialListingAudience
  systemId: string
  campaignFormat: CampaignFormat
  toneTags: CampaignToneTag[]
  toneDetails: string | null
  contentMaturity: CampaignContentMaturity
  playMode: SocialPlayMode
  capacity: number
  scheduleKind: SocialScheduleKind
  timeZone: string
  scheduleSummary: string
  startsAt: string | null
  weekday: number | null
  localStartTime: string | null
  recurrence: SocialRecurrence | null
  city: string | null
  stateCode: string | null
  contentGuidance: string
  attendancePolicy: string
  allowedContentRules: string
  tableConduct: string
  contentBoundaries: string
  safetyPractices: SocialSafetyPractice[]
  safetyDetails: string
  isFree: boolean
  priceAmount: number | null
  priceCurrency: string | null
}

export interface SocialDiscoveryFilters {
  query?: string
  systemId?: string
  rulesetCode?: string
  rulesetVersion?: string
  campaignFormat?: CampaignFormat
  contentMaturity?: CampaignContentMaturity
  toneTags?: CampaignToneTag[]
  playMode?: SocialPlayMode
  timeZone?: string
  scheduleKind?: SocialScheduleKind
  weekday?: number
  stateCode?: string
  city?: string
  minimumAvailableSeats?: number
  safetyPractices?: SocialSafetyPractice[]
  cursor?: { publishedAt: string; listingId: string }
  limit: number
}

export interface SocialApplicationRecord {
  id: string
  listingId: string
  listingTitle: string
  contentMaturity: CampaignContentMaturity
  campaignId: string
  hostUserId: string
  applicantProfileId: string
  applicantUserId: string
  applicantUsername: string
  message: string
  status: SocialApplicationStatus
  listingVersion: number
  expectationsSnapshot: unknown
  submittedAt: Timestamp
  withdrawnAt: Timestamp | null
  respondedAt: Timestamp | null
  expiredAt: Timestamp | null
  blockedAt: Timestamp | null
  version: number
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface SocialBlockRecord {
  blockerProfileId: string
  blockedProfileId: string
  blockedUsername: string
  createdAt: Timestamp
}

export type SocialReportTargetKind = 'PROFILE' | 'LISTING' | 'APPLICATION'

export interface SocialReportRecord {
  id: string
  reporterProfileId: string
  reporterUsername: string
  targetKind: SocialReportTargetKind
  targetProfileId: string | null
  targetListingId: string | null
  targetApplicationId: string | null
  reason: SocialReportReason
  details: string
  evidenceSnapshot: unknown
  status: SocialReportStatus
  reviewStartedAt: Timestamp | null
  resolvedAt: Timestamp | null
  version: number
  createdAt: Timestamp
  updatedAt: Timestamp
}

export type SocialModerationQueueRecord = Omit<
  SocialReportRecord,
  | 'reporterProfileId'
  | 'reporterUsername'
  | 'targetProfileId'
  | 'targetListingId'
  | 'targetApplicationId'
  | 'details'
  | 'evidenceSnapshot'
  | 'reviewStartedAt'
  | 'resolvedAt'
>

export interface SocialReportEvidence {
  targetKind: SocialReportTargetKind
  targetId: string
  snapshot: Record<string, unknown>
}
