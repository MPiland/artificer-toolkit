import { z } from 'zod'

import { postgresUuidSchema } from '../shared/postgresUuid.js'
import {
  campaignContentMaturityDtoSchema,
  campaignFormatDtoSchema,
  campaignToneTagsDtoSchema
} from './campaignCore.js'
import {
  jsonSchema,
  timestampSchema,
  timeZoneSchema,
  uuidSchema,
  versionSchema
} from './campaignContractSchemas.js'
import { tableSafetyPracticeDtoSchema } from './tableSafety.js'

const usernameSchema = z.string().trim().min(3).max(30)
const titleSchema = z.string().trim().min(1).max(100)
const summarySchema = z.string().trim().min(1).max(2_000)
const policyTextSchema = z.string().trim().min(1).max(4_000)
const applicationMessageSchema = z.string().trim().min(1).max(2_000)
const reportDetailsSchema = z.string().trim().min(1).max(4_000)
const stateCodeSchema = z
  .string()
  .trim()
  .regex(/^[A-Z]{2}$/)

export const socialProfileStatusDtoSchema = z.enum(['ACTIVE', 'SUSPENDED'])
export const socialContentPreferenceDtoSchema = z.enum(['STANDARD', 'MATURE'])
export const socialListingStatusDtoSchema = z.enum(['DRAFT', 'OPEN', 'CLOSED'])
export const socialListingAudienceDtoSchema = z.enum(['PRIVATE', 'PUBLIC'])
export const socialListingModerationStatusDtoSchema = z.enum(['VISIBLE', 'HIDDEN'])
export const socialPlayModeDtoSchema = z.enum(['ONLINE', 'IN_PERSON', 'HYBRID'])
export const socialSafetyPracticeDtoSchema = tableSafetyPracticeDtoSchema
export const socialScheduleKindDtoSchema = z.enum(['FLEXIBLE', 'ONE_TIME', 'RECURRING'])
export const socialRecurrenceDtoSchema = z.enum(['WEEKLY', 'BIWEEKLY'])
export const socialApplicationStatusDtoSchema = z.enum([
  'SUBMITTED',
  'WITHDRAWN',
  'ACCEPTED',
  'DECLINED',
  'EXPIRED',
  'BLOCKED'
])
export const socialReportReasonDtoSchema = z.enum([
  'HARASSMENT',
  'HATE_OR_ABUSE',
  'SEXUAL_CONTENT',
  'SPAM_OR_SCAM',
  'SAFETY_MISREPRESENTATION',
  'PRIVACY',
  'OTHER'
])
export const socialReportStatusDtoSchema = z.enum([
  'SUBMITTED',
  'UNDER_REVIEW',
  'RESOLVED',
  'DISMISSED'
])
export const socialModerationActionDtoSchema = z.enum([
  'VIEWED',
  'START_REVIEW',
  'DISMISS',
  'RESOLVE',
  'HIDE_LISTING',
  'RESTORE_LISTING',
  'SUSPEND_PROFILE',
  'RESTORE_PROFILE'
])

export const socialProfileDtoSchema = z.strictObject({
  profilePublicId: uuidSchema,
  username: usernameSchema
})

export const socialEligibilityDtoSchema = z.strictObject({
  eligible: z.boolean(),
  profilePublicId: uuidSchema.nullable(),
  adultAttestedAt: timestampSchema.nullable(),
  contentPreference: socialContentPreferenceDtoSchema,
  status: socialProfileStatusDtoSchema.nullable()
})

export const updateSocialContentPreferenceInputSchema = z.discriminatedUnion('contentPreference', [
  z.strictObject({ contentPreference: z.literal('STANDARD') }),
  z.strictObject({
    contentPreference: z.literal('MATURE'),
    birthDate: z.iso.date().optional()
  })
])

export const socialProfilePublicIdInputSchema = z.strictObject({
  profilePublicId: uuidSchema
})

export const socialListingScheduleDtoSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('FLEXIBLE'),
    timeZone: timeZoneSchema,
    summary: summarySchema
  }),
  z.strictObject({
    kind: z.literal('ONE_TIME'),
    timeZone: timeZoneSchema,
    summary: summarySchema,
    startsAt: timestampSchema
  }),
  z.strictObject({
    kind: z.literal('RECURRING'),
    timeZone: timeZoneSchema,
    summary: summarySchema,
    weekday: z.number().int().min(0).max(6),
    localStartTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    recurrence: socialRecurrenceDtoSchema
  })
])

export const socialListingLocationDtoSchema = z.strictObject({
  city: z.string().trim().min(1).max(100),
  stateCode: stateCodeSchema
})

export const socialListingExpectationsDtoSchema = z.strictObject({
  contentGuidance: policyTextSchema,
  attendancePolicy: policyTextSchema,
  allowedContentRules: policyTextSchema,
  tableConduct: policyTextSchema,
  contentBoundaries: policyTextSchema,
  safetyPractices: z.array(socialSafetyPracticeDtoSchema).min(1).max(6),
  safetyDetails: policyTextSchema
})

export const socialListingSystemDtoSchema = z.strictObject({
  systemId: postgresUuidSchema,
  label: z.string().trim().min(1).max(120),
  rulesetCode: z.string().trim().min(1).max(100),
  rulesetVersion: z.string().trim().min(1).max(100)
})

export const socialListingDtoSchema = z.strictObject({
  listingPublicId: uuidSchema,
  host: socialProfileDtoSchema,
  title: titleSchema,
  summary: summarySchema,
  status: socialListingStatusDtoSchema,
  audience: socialListingAudienceDtoSchema,
  moderationStatus: socialListingModerationStatusDtoSchema,
  system: socialListingSystemDtoSchema,
  format: campaignFormatDtoSchema,
  toneTags: campaignToneTagsDtoSchema,
  toneDetails: z.string().trim().min(1).max(1_000).nullable(),
  contentMaturity: campaignContentMaturityDtoSchema,
  playMode: socialPlayModeDtoSchema,
  capacity: z.number().int().positive(),
  availableSeats: z.number().int().nonnegative(),
  ageBand: z.literal('13_PLUS'),
  schedule: socialListingScheduleDtoSchema,
  location: socialListingLocationDtoSchema.nullable(),
  expectations: socialListingExpectationsDtoSchema,
  isFree: z.literal(true),
  publishedAt: timestampSchema.nullable(),
  version: versionSchema
})

const socialListingFieldsSchema = z.strictObject({
  summary: summarySchema,
  audience: socialListingAudienceDtoSchema,
  systemId: postgresUuidSchema,
  playMode: socialPlayModeDtoSchema,
  capacity: z.number().int().min(1).max(100),
  schedule: socialListingScheduleDtoSchema,
  location: socialListingLocationDtoSchema.nullable(),
  expectations: socialListingExpectationsDtoSchema
})

const validateSocialListingLocation = (
  value: {
    playMode: z.infer<typeof socialPlayModeDtoSchema>
    location: unknown
  },
  context: z.RefinementCtx
) => {
  const needsLocation = value.playMode !== 'ONLINE'
  if (needsLocation !== (value.location !== null))
    context.addIssue({
      code: 'custom',
      path: ['location'],
      message: needsLocation
        ? 'City and state are required for in-person and hybrid tables.'
        : 'Online tables cannot publish a location.'
    })
}

export const createSocialListingInputSchema = socialListingFieldsSchema
  .extend({ campaignId: uuidSchema })
  .superRefine(validateSocialListingLocation)
export const updateSocialListingInputSchema = socialListingFieldsSchema
  .extend({
    listingPublicId: uuidSchema,
    expectedVersion: versionSchema
  })
  .superRefine(validateSocialListingLocation)
export const socialListingVersionInputSchema = z.strictObject({
  listingPublicId: uuidSchema,
  expectedVersion: versionSchema
})
export const socialListingPublicIdInputSchema = z.strictObject({
  listingPublicId: uuidSchema
})

export const socialDiscoveryCursorDtoSchema = z.strictObject({
  publishedAt: timestampSchema,
  listingPublicId: uuidSchema
})

export const socialDiscoveryInputSchema = z.strictObject({
  query: z.string().trim().max(200).optional(),
  systemId: postgresUuidSchema.optional(),
  rulesetCode: z.string().trim().min(1).max(100).optional(),
  rulesetVersion: z.string().trim().min(1).max(100).optional(),
  format: campaignFormatDtoSchema.optional(),
  contentMaturity: campaignContentMaturityDtoSchema.optional(),
  toneTags: campaignToneTagsDtoSchema.optional(),
  playMode: socialPlayModeDtoSchema.optional(),
  timeZone: timeZoneSchema.optional(),
  scheduleKind: socialScheduleKindDtoSchema.optional(),
  weekday: z.number().int().min(0).max(6).optional(),
  stateCode: stateCodeSchema.optional(),
  city: z.string().trim().min(1).max(100).optional(),
  minimumAvailableSeats: z.number().int().min(1).max(100).optional(),
  safetyPractices: z.array(socialSafetyPracticeDtoSchema).max(6).optional(),
  cursor: socialDiscoveryCursorDtoSchema.optional(),
  limit: z.number().int().min(1).max(50).default(20)
})

export const socialDiscoveryPageDtoSchema = z.strictObject({
  items: z.array(socialListingDtoSchema),
  nextCursor: socialDiscoveryCursorDtoSchema.nullable()
})

export const socialApplicationDtoSchema = z.strictObject({
  applicationPublicId: uuidSchema,
  listingPublicId: uuidSchema,
  listingTitle: titleSchema,
  applicant: socialProfileDtoSchema,
  message: applicationMessageSchema,
  status: socialApplicationStatusDtoSchema,
  listingVersion: versionSchema,
  expectations: socialListingExpectationsDtoSchema,
  submittedAt: timestampSchema,
  respondedAt: timestampSchema.nullable(),
  version: versionSchema
})

export const submitSocialApplicationInputSchema = z.strictObject({
  listingPublicId: uuidSchema,
  message: applicationMessageSchema,
  expectedListingVersion: versionSchema
})
export const socialApplicationVersionInputSchema = z.strictObject({
  applicationPublicId: uuidSchema,
  expectedVersion: versionSchema
})
export const decideSocialApplicationInputSchema = socialApplicationVersionInputSchema.extend({
  decision: z.enum(['ACCEPT', 'DECLINE'])
})

export const socialBlockDtoSchema = z.strictObject({
  profile: socialProfileDtoSchema,
  createdAt: timestampSchema
})
export const socialBlockInputSchema = socialProfilePublicIdInputSchema

export const createSocialReportInputSchema = z.discriminatedUnion('targetKind', [
  z.strictObject({
    targetKind: z.literal('PROFILE'),
    targetPublicId: uuidSchema,
    reason: socialReportReasonDtoSchema,
    details: reportDetailsSchema
  }),
  z.strictObject({
    targetKind: z.literal('LISTING'),
    targetPublicId: uuidSchema,
    reason: socialReportReasonDtoSchema,
    details: reportDetailsSchema
  }),
  z.strictObject({
    targetKind: z.literal('APPLICATION'),
    targetPublicId: uuidSchema,
    reason: socialReportReasonDtoSchema,
    details: reportDetailsSchema
  })
])

export const socialReportReceiptDtoSchema = z.strictObject({
  reportPublicId: uuidSchema,
  status: z.literal('SUBMITTED'),
  createdAt: timestampSchema
})

export const socialModerationQueueItemDtoSchema = z.strictObject({
  reportPublicId: uuidSchema,
  targetKind: z.enum(['PROFILE', 'LISTING', 'APPLICATION']),
  reason: socialReportReasonDtoSchema,
  status: socialReportStatusDtoSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  version: versionSchema
})

export const socialModerationReportDtoSchema = socialModerationQueueItemDtoSchema.extend({
  reporter: socialProfileDtoSchema,
  details: reportDetailsSchema,
  evidence: jsonSchema
})

export const socialReportPublicIdInputSchema = z.strictObject({
  reportPublicId: uuidSchema
})

export const takeSocialModerationActionInputSchema = z.strictObject({
  reportPublicId: uuidSchema,
  action: socialModerationActionDtoSchema.exclude(['VIEWED']),
  reason: reportDetailsSchema,
  expectedVersion: versionSchema
})

export type SocialProfileDto = z.infer<typeof socialProfileDtoSchema>
export type SocialEligibilityDto = z.infer<typeof socialEligibilityDtoSchema>
export type UpdateSocialContentPreferenceInput = z.input<
  typeof updateSocialContentPreferenceInputSchema
>
export type SocialListingScheduleDto = z.infer<typeof socialListingScheduleDtoSchema>
export type SocialListingLocationDto = z.infer<typeof socialListingLocationDtoSchema>
export type SocialListingExpectationsDto = z.infer<typeof socialListingExpectationsDtoSchema>
export type SocialListingDto = z.infer<typeof socialListingDtoSchema>
export type CreateSocialListingInput = z.input<typeof createSocialListingInputSchema>
export type UpdateSocialListingInput = z.input<typeof updateSocialListingInputSchema>
export type SocialDiscoveryInput = z.input<typeof socialDiscoveryInputSchema>
export type SocialDiscoveryPageDto = z.infer<typeof socialDiscoveryPageDtoSchema>
export type SocialApplicationDto = z.infer<typeof socialApplicationDtoSchema>
export type SubmitSocialApplicationInput = z.input<typeof submitSocialApplicationInputSchema>
export type DecideSocialApplicationInput = z.input<typeof decideSocialApplicationInputSchema>
export type SocialBlockDto = z.infer<typeof socialBlockDtoSchema>
export type CreateSocialReportInput = z.input<typeof createSocialReportInputSchema>
export type SocialReportReceiptDto = z.infer<typeof socialReportReceiptDtoSchema>
export type SocialModerationQueueItemDto = z.infer<typeof socialModerationQueueItemDtoSchema>
export type SocialModerationReportDto = z.infer<typeof socialModerationReportDtoSchema>
export type TakeSocialModerationActionInput = z.input<typeof takeSocialModerationActionInputSchema>
