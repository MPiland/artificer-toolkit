import { z, lazySchema } from '../zod.js'

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

const usernameSchema = lazySchema(() =>
  z.string().check(z.trim()).check(z.minLength(3)).check(z.maxLength(30))
)
const titleSchema = lazySchema(() =>
  z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(100))
)
const summarySchema = lazySchema(() =>
  z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(2_000))
)
const policyTextSchema = lazySchema(() =>
  z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(4_000))
)
const applicationMessageSchema = lazySchema(() =>
  z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(2_000))
)
const reportDetailsSchema = lazySchema(() =>
  z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(4_000))
)
const stateCodeSchema = lazySchema(() =>
  z
    .string()
    .check(z.trim())
    .check(z.regex(/^[A-Z]{2}$/))
)

export const socialProfileStatusDtoSchema = lazySchema(() => z.enum(['ACTIVE', 'SUSPENDED']))
export const socialContentPreferenceDtoSchema = lazySchema(() => z.enum(['STANDARD', 'MATURE']))
export const socialListingStatusDtoSchema = lazySchema(() => z.enum(['DRAFT', 'OPEN', 'CLOSED']))
export const socialListingAudienceDtoSchema = lazySchema(() => z.enum(['PRIVATE', 'PUBLIC']))
export const socialListingModerationStatusDtoSchema = lazySchema(() =>
  z.enum(['VISIBLE', 'HIDDEN'])
)
export const socialPlayModeDtoSchema = lazySchema(() => z.enum(['ONLINE', 'IN_PERSON', 'HYBRID']))
export const socialSafetyPracticeDtoSchema = tableSafetyPracticeDtoSchema
export const socialScheduleKindDtoSchema = lazySchema(() =>
  z.enum(['FLEXIBLE', 'ONE_TIME', 'RECURRING'])
)
export const socialRecurrenceDtoSchema = lazySchema(() => z.enum(['WEEKLY', 'BIWEEKLY']))
export const socialApplicationStatusDtoSchema = lazySchema(() =>
  z.enum(['SUBMITTED', 'WITHDRAWN', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'BLOCKED'])
)
export const socialReportReasonDtoSchema = lazySchema(() =>
  z.enum([
    'HARASSMENT',
    'HATE_OR_ABUSE',
    'SEXUAL_CONTENT',
    'SPAM_OR_SCAM',
    'SAFETY_MISREPRESENTATION',
    'PRIVACY',
    'OTHER'
  ])
)
export const socialReportStatusDtoSchema = lazySchema(() =>
  z.enum(['SUBMITTED', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED'])
)
export const socialModerationActionDtoSchema = lazySchema(() =>
  z.enum([
    'VIEWED',
    'START_REVIEW',
    'DISMISS',
    'RESOLVE',
    'HIDE_LISTING',
    'RESTORE_LISTING',
    'SUSPEND_PROFILE',
    'RESTORE_PROFILE'
  ])
)

export const socialProfileDtoSchema = lazySchema(() =>
  z.strictObject({
    profilePublicId: uuidSchema,
    username: usernameSchema
  })
)

export const socialEligibilityDtoSchema = lazySchema(() =>
  z.strictObject({
    eligible: z.boolean(),
    profilePublicId: z.nullable(uuidSchema),
    adultAttestedAt: z.nullable(timestampSchema),
    contentPreference: socialContentPreferenceDtoSchema,
    status: z.nullable(socialProfileStatusDtoSchema)
  })
)

export const updateSocialContentPreferenceInputSchema = lazySchema(() =>
  z.discriminatedUnion('contentPreference', [
    z.strictObject({ contentPreference: z.literal('STANDARD') }),
    z.strictObject({
      contentPreference: z.literal('MATURE'),
      birthDate: z.optional(z.iso.date())
    })
  ])
)

export const socialProfilePublicIdInputSchema = lazySchema(() =>
  z.strictObject({
    profilePublicId: uuidSchema
  })
)

export const socialListingScheduleDtoSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
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
      weekday: z.number().check(z.int()).check(z.gte(0)).check(z.lte(6)),
      localStartTime: z.string().check(z.regex(/^([01]\d|2[0-3]):[0-5]\d$/)),
      recurrence: socialRecurrenceDtoSchema
    })
  ])
)

export const socialListingLocationDtoSchema = lazySchema(() =>
  z.strictObject({
    city: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(100)),
    stateCode: stateCodeSchema
  })
)

export const socialListingExpectationsDtoSchema = lazySchema(() =>
  z.strictObject({
    contentGuidance: policyTextSchema,
    attendancePolicy: policyTextSchema,
    allowedContentRules: policyTextSchema,
    tableConduct: policyTextSchema,
    contentBoundaries: policyTextSchema,
    safetyPractices: z
      .array(socialSafetyPracticeDtoSchema)
      .check(z.minLength(1))
      .check(z.maxLength(6)),
    safetyDetails: policyTextSchema
  })
)

export const socialListingSystemDtoSchema = lazySchema(() =>
  z.strictObject({
    systemId: postgresUuidSchema,
    label: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(120)),
    rulesetCode: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(100)),
    rulesetVersion: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(100))
  })
)

export const socialListingDtoSchema = lazySchema(() =>
  z.strictObject({
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
    toneDetails: z.nullable(
      z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(1_000))
    ),
    contentMaturity: campaignContentMaturityDtoSchema,
    playMode: socialPlayModeDtoSchema,
    capacity: z.number().check(z.int()).check(z.positive()),
    availableSeats: z.number().check(z.int()).check(z.nonnegative()),
    ageBand: z.literal('13_PLUS'),
    schedule: socialListingScheduleDtoSchema,
    location: z.nullable(socialListingLocationDtoSchema),
    expectations: socialListingExpectationsDtoSchema,
    isFree: z.literal(true),
    publishedAt: z.nullable(timestampSchema),
    version: versionSchema
  })
)

const socialListingFieldsSchema = lazySchema(() =>
  z.strictObject({
    summary: summarySchema,
    audience: socialListingAudienceDtoSchema,
    systemId: postgresUuidSchema,
    playMode: socialPlayModeDtoSchema,
    capacity: z.number().check(z.int()).check(z.gte(1)).check(z.lte(100)),
    schedule: socialListingScheduleDtoSchema,
    location: z.nullable(socialListingLocationDtoSchema),
    expectations: socialListingExpectationsDtoSchema
  })
)

const validateSocialListingLocation = (
  value: {
    playMode: z.infer<typeof socialPlayModeDtoSchema>
    location: unknown
  },
  context: z.core.$RefinementCtx
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

export const createSocialListingInputSchema = lazySchema(() =>
  z
    .extend(socialListingFieldsSchema, { campaignId: uuidSchema })
    .check(z.superRefine(validateSocialListingLocation))
)
export const updateSocialListingInputSchema = lazySchema(() =>
  z
    .extend(socialListingFieldsSchema, {
      listingPublicId: uuidSchema,
      expectedVersion: versionSchema
    })
    .check(z.superRefine(validateSocialListingLocation))
)
export const socialListingVersionInputSchema = lazySchema(() =>
  z.strictObject({
    listingPublicId: uuidSchema,
    expectedVersion: versionSchema
  })
)
export const socialListingPublicIdInputSchema = lazySchema(() =>
  z.strictObject({
    listingPublicId: uuidSchema
  })
)

export const socialDiscoveryCursorDtoSchema = lazySchema(() =>
  z.strictObject({
    publishedAt: timestampSchema,
    listingPublicId: uuidSchema
  })
)

export const socialDiscoveryInputSchema = lazySchema(() =>
  z.strictObject({
    query: z.optional(z.string().check(z.trim()).check(z.maxLength(200))),
    systemId: z.optional(postgresUuidSchema),
    rulesetCode: z.optional(
      z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(100))
    ),
    rulesetVersion: z.optional(
      z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(100))
    ),
    format: z.optional(campaignFormatDtoSchema),
    contentMaturity: z.optional(campaignContentMaturityDtoSchema),
    toneTags: z.optional(campaignToneTagsDtoSchema),
    playMode: z.optional(socialPlayModeDtoSchema),
    timeZone: z.optional(timeZoneSchema),
    scheduleKind: z.optional(socialScheduleKindDtoSchema),
    weekday: z.optional(z.number().check(z.int()).check(z.gte(0)).check(z.lte(6))),
    stateCode: z.optional(stateCodeSchema),
    city: z.optional(z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(100))),
    minimumAvailableSeats: z.optional(z.number().check(z.int()).check(z.gte(1)).check(z.lte(100))),
    safetyPractices: z.optional(z.array(socialSafetyPracticeDtoSchema).check(z.maxLength(6))),
    cursor: z.optional(socialDiscoveryCursorDtoSchema),
    limit: z._default(z.number().check(z.int()).check(z.gte(1)).check(z.lte(50)), 20)
  })
)

export const socialDiscoveryPageDtoSchema = lazySchema(() =>
  z.strictObject({
    items: z.array(socialListingDtoSchema),
    nextCursor: z.nullable(socialDiscoveryCursorDtoSchema)
  })
)

export const socialApplicationDtoSchema = lazySchema(() =>
  z.strictObject({
    applicationPublicId: uuidSchema,
    listingPublicId: uuidSchema,
    listingTitle: titleSchema,
    applicant: socialProfileDtoSchema,
    message: applicationMessageSchema,
    status: socialApplicationStatusDtoSchema,
    listingVersion: versionSchema,
    expectations: socialListingExpectationsDtoSchema,
    submittedAt: timestampSchema,
    respondedAt: z.nullable(timestampSchema),
    version: versionSchema
  })
)

export const submitSocialApplicationInputSchema = lazySchema(() =>
  z.strictObject({
    listingPublicId: uuidSchema,
    message: applicationMessageSchema,
    expectedListingVersion: versionSchema
  })
)
export const socialApplicationVersionInputSchema = lazySchema(() =>
  z.strictObject({
    applicationPublicId: uuidSchema,
    expectedVersion: versionSchema
  })
)
export const decideSocialApplicationInputSchema = lazySchema(() =>
  z.extend(socialApplicationVersionInputSchema, {
    decision: z.enum(['ACCEPT', 'DECLINE'])
  })
)

export const socialBlockDtoSchema = lazySchema(() =>
  z.strictObject({
    profile: socialProfileDtoSchema,
    createdAt: timestampSchema
  })
)
export const socialBlockInputSchema = socialProfilePublicIdInputSchema

export const createSocialReportInputSchema = lazySchema(() =>
  z.discriminatedUnion('targetKind', [
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
)

export const socialReportReceiptDtoSchema = lazySchema(() =>
  z.strictObject({
    reportPublicId: uuidSchema,
    status: z.literal('SUBMITTED'),
    createdAt: timestampSchema
  })
)

export const socialModerationQueueItemDtoSchema = lazySchema(() =>
  z.strictObject({
    reportPublicId: uuidSchema,
    targetKind: z.enum(['PROFILE', 'LISTING', 'APPLICATION']),
    reason: socialReportReasonDtoSchema,
    status: socialReportStatusDtoSchema,
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
    version: versionSchema
  })
)

export const socialModerationReportDtoSchema = lazySchema(() =>
  z.extend(socialModerationQueueItemDtoSchema, {
    reporter: socialProfileDtoSchema,
    details: reportDetailsSchema,
    evidence: jsonSchema
  })
)

export const socialReportPublicIdInputSchema = lazySchema(() =>
  z.strictObject({
    reportPublicId: uuidSchema
  })
)

export const takeSocialModerationActionInputSchema = lazySchema(() =>
  z.strictObject({
    reportPublicId: uuidSchema,
    action: z.enum([
      socialModerationActionDtoSchema._zod.def.entries.START_REVIEW,
      socialModerationActionDtoSchema._zod.def.entries.DISMISS,
      socialModerationActionDtoSchema._zod.def.entries.RESOLVE,
      socialModerationActionDtoSchema._zod.def.entries.HIDE_LISTING,
      socialModerationActionDtoSchema._zod.def.entries.RESTORE_LISTING,
      socialModerationActionDtoSchema._zod.def.entries.SUSPEND_PROFILE,
      socialModerationActionDtoSchema._zod.def.entries.RESTORE_PROFILE
    ]),
    reason: reportDetailsSchema,
    expectedVersion: versionSchema
  })
)

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
export type SocialApplicationVersionInput = z.infer<typeof socialApplicationVersionInputSchema>
export type SubmitSocialApplicationInput = z.input<typeof submitSocialApplicationInputSchema>
export type DecideSocialApplicationInput = z.input<typeof decideSocialApplicationInputSchema>
export type SocialBlockDto = z.infer<typeof socialBlockDtoSchema>
export type CreateSocialReportInput = z.input<typeof createSocialReportInputSchema>
export type SocialReportReceiptDto = z.infer<typeof socialReportReceiptDtoSchema>
export type SocialModerationQueueItemDto = z.infer<typeof socialModerationQueueItemDtoSchema>
export type SocialModerationReportDto = z.infer<typeof socialModerationReportDtoSchema>
export type TakeSocialModerationActionInput = z.input<typeof takeSocialModerationActionInputSchema>
