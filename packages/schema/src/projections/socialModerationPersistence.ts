import { z, lazySchema } from '../zod.js'
import {
  socialProfileDtoSchema,
  socialProfileStatusDtoSchema,
  socialListingDtoSchema,
  socialApplicationDtoSchema,
  socialModerationQueueItemDtoSchema,
  socialModerationReportDtoSchema,
  socialModerationActionDtoSchema,
  socialListingModerationStatusDtoSchema,
  socialReportStatusDtoSchema,
  socialScheduleKindDtoSchema,
  socialRecurrenceDtoSchema,
  socialListingExpectationsDtoSchema,
  socialListingLocationDtoSchema
} from '../api/socialHub.js'
import {
  timestampSchema,
  timeZoneSchema,
  uuidSchema,
  versionSchema
} from '../api/campaignContractSchemas.js'

// Evidence is not an authoring input: validate its text without normalizing the captured value.
function originalText(schema: z.ZodMiniString) {
  const check = schema._zod.def.checks?.find(
    (candidate): candidate is z.core.$ZodCheckMaxLength => candidate._zod.def.check === 'max_length'
  )
  const limit = check?._zod.def.maximum
  if (typeof limit !== 'number') throw new Error('Evidence text requires a size bound.')
  return z
    .string()
    .check(z.maxLength(limit))
    .check(z.refine((value) => z.safeParse(schema, value).success))
}

const evidenceTimestampSchema = lazySchema(() =>
  z.iso.datetime({ offset: true }).check(z.maxLength(35))
)
const evidenceUsernameSchema = lazySchema(() => originalText(socialProfileDtoSchema.shape.username))
const evidenceExpectationsSchema = lazySchema(() =>
  z.extend(socialListingExpectationsDtoSchema, {
    contentGuidance: originalText(socialListingExpectationsDtoSchema.shape.contentGuidance),
    attendancePolicy: originalText(socialListingExpectationsDtoSchema.shape.attendancePolicy),
    allowedContentRules: originalText(socialListingExpectationsDtoSchema.shape.allowedContentRules),
    tableConduct: originalText(socialListingExpectationsDtoSchema.shape.tableConduct),
    contentBoundaries: originalText(socialListingExpectationsDtoSchema.shape.contentBoundaries),
    safetyDetails: originalText(socialListingExpectationsDtoSchema.shape.safetyDetails)
  })
)

export const socialProfileEvidenceSchema = lazySchema(() =>
  z.extend(socialProfileDtoSchema, {
    username: evidenceUsernameSchema,
    status: socialProfileStatusDtoSchema
  })
)

export const socialListingEvidenceSchema = lazySchema(() =>
  z.extend(
    z.pick(socialListingDtoSchema, {
      listingPublicId: true,
      title: true,
      summary: true,
      status: true,
      audience: true,
      moderationStatus: true,
      format: true,
      toneTags: true,
      toneDetails: true,
      contentMaturity: true,
      playMode: true,
      location: true,
      expectations: true,
      version: true
    }),
    {
      title: originalText(socialListingDtoSchema.shape.title),
      summary: originalText(socialListingDtoSchema.shape.summary),
      toneDetails: z.nullable(
        originalText(socialListingDtoSchema.shape.toneDetails._zod.def.innerType)
      ),
      location: z.nullable(
        z.extend(socialListingLocationDtoSchema, {
          city: originalText(socialListingLocationDtoSchema.shape.city),
          stateCode: originalText(
            socialListingLocationDtoSchema.shape.stateCode.check(z.maxLength(2))
          )
        })
      ),
      expectations: evidenceExpectationsSchema,
      hostProfilePublicId: uuidSchema,
      hostUsername: evidenceUsernameSchema,
      systemId: uuidSchema,
      schedule: z.strictObject({
        kind: socialScheduleKindDtoSchema,
        timeZone: originalText(timeZoneSchema),
        summary: originalText(socialListingDtoSchema.shape.summary),
        startsAt: z.nullable(evidenceTimestampSchema),
        weekday: z.nullable(z.number().check(z.int()).check(z.gte(0)).check(z.lte(6))),
        localStartTime: z.nullable(
          z
            .string()
            .check(z.regex(/^(?:([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,6})?)?|24:00:00)$/))
        ),
        recurrence: z.nullable(socialRecurrenceDtoSchema)
      }),
      capturedAt: evidenceTimestampSchema
    }
  )
)

export const socialApplicationEvidenceSchema = lazySchema(() =>
  z.extend(
    z.pick(socialApplicationDtoSchema, {
      applicationPublicId: true,
      listingPublicId: true,
      listingTitle: true,
      message: true,
      status: true,
      listingVersion: true,
      expectations: true,
      submittedAt: true,
      respondedAt: true,
      version: true
    }),
    {
      listingTitle: originalText(socialApplicationDtoSchema.shape.listingTitle),
      message: originalText(socialApplicationDtoSchema.shape.message),
      expectations: evidenceExpectationsSchema,
      submittedAt: evidenceTimestampSchema,
      respondedAt: z.nullable(evidenceTimestampSchema),
      applicantProfilePublicId: uuidSchema,
      applicantUsername: evidenceUsernameSchema,
      hostProfilePublicId: uuidSchema,
      hostUsername: evidenceUsernameSchema,
      capturedAt: evidenceTimestampSchema
    }
  )
)

export const socialReportEvidenceSchema = lazySchema(() =>
  z.union([
    socialProfileEvidenceSchema,
    socialListingEvidenceSchema,
    socialApplicationEvidenceSchema
  ])
)

export const socialStoredReportSchema = lazySchema(() =>
  z
    .extend(z.omit(socialModerationQueueItemDtoSchema, { reportPublicId: true }), {
      id: uuidSchema,
      reporterProfileId: uuidSchema,
      targetProfileId: z.nullable(uuidSchema),
      targetListingId: z.nullable(uuidSchema),
      targetApplicationId: z.nullable(uuidSchema),
      details: originalText(socialModerationReportDtoSchema.shape.details),
      evidenceSnapshot: socialReportEvidenceSchema,
      reviewStartedAt: z.nullable(timestampSchema),
      resolvedAt: z.nullable(timestampSchema),
      // The existing queue orders submitted, reviewing, then all terminal reports by creation time.
      queuePriority: z.union([z.literal(0), z.literal(1), z.literal(2)])
    })
    .check(
      z.refine((report) => {
        const targets = [report.targetProfileId, report.targetListingId, report.targetApplicationId]
        const target =
          report.targetKind === 'PROFILE'
            ? report.targetProfileId
            : report.targetKind === 'LISTING'
              ? report.targetListingId
              : report.targetApplicationId
        const evidenceId =
          report.targetKind === 'PROFILE' && 'profilePublicId' in report.evidenceSnapshot
            ? report.evidenceSnapshot.profilePublicId
            : report.targetKind === 'LISTING' &&
                'listingPublicId' in report.evidenceSnapshot &&
                !('applicationPublicId' in report.evidenceSnapshot)
              ? report.evidenceSnapshot.listingPublicId
              : report.targetKind === 'APPLICATION' &&
                  'applicationPublicId' in report.evidenceSnapshot
                ? report.evidenceSnapshot.applicationPublicId
                : null
        return (
          target !== null &&
          targets.filter((id) => id !== null).length === 1 &&
          target === evidenceId
        )
      }, 'Report target and evidence must agree.')
    )
    .check(
      z.refine(
        (report) =>
          report.status === 'SUBMITTED'
            ? report.queuePriority === 0 &&
              report.reviewStartedAt === null &&
              report.resolvedAt === null
            : report.status === 'UNDER_REVIEW'
              ? report.queuePriority === 1 &&
                report.reviewStartedAt !== null &&
                report.resolvedAt === null
              : report.queuePriority === 2 &&
                report.reviewStartedAt !== null &&
                report.resolvedAt !== null,
        'Report lifecycle metadata must agree with its status.'
      )
    )
)

const moderationStateSchema = lazySchema(() =>
  z.strictObject({
    reportStatus: socialReportStatusDtoSchema,
    reportVersion: versionSchema,
    listingModerationStatus: z.optional(socialListingModerationStatusDtoSchema),
    profileStatus: z.optional(socialProfileStatusDtoSchema)
  })
)

export const socialStoredModerationActionSchema = lazySchema(() =>
  z
    .strictObject({
      id: uuidSchema,
      moderatorUserId: uuidSchema,
      reportId: uuidSchema,
      action: socialModerationActionDtoSchema,
      affectedProfileId: z.nullable(uuidSchema),
      affectedListingId: z.nullable(uuidSchema),
      reason: originalText(socialModerationReportDtoSchema.shape.details),
      beforeState: moderationStateSchema,
      afterState: z.extend(moderationStateSchema, {
        action: z.optional(socialModerationActionDtoSchema)
      }),
      createdAt: timestampSchema
    })
    .check(
      z.refine(
        (audit) =>
          audit.action === 'HIDE_LISTING' || audit.action === 'RESTORE_LISTING'
            ? audit.affectedListingId !== null && audit.affectedProfileId === null
            : audit.action === 'SUSPEND_PROFILE' || audit.action === 'RESTORE_PROFILE'
              ? audit.affectedProfileId !== null && audit.affectedListingId === null
              : audit.affectedProfileId === null && audit.affectedListingId === null,
        'Moderation audit targets must agree with the action.'
      )
    )
)

export type SocialStoredReport = z.infer<typeof socialStoredReportSchema>
