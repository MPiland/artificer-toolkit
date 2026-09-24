import { describe, expect, it } from 'vitest'
import {
  socialStoredReportSchema,
  socialStoredModerationActionSchema,
  socialListingEvidenceSchema,
  socialApplicationEvidenceSchema
} from '../projections/socialModerationPersistence.js'
import {
  socialModerationQueueInputSchema,
  socialModerationQueuePageSchema,
  socialModerationEvidenceDtoSchema,
  socialReportReviewInputSchema,
  socialListingModerationInputSchema,
  socialProfileModerationInputSchema
} from '../api/socialModeration.js'
import { socialStoredListingInvalidationSchema } from '../projections/socialPersistence.js'

const id = '00000000-0000-4000-8000-000000000001'
const targetId = '00000000-0000-4000-8000-000000000002'
const now = '2026-09-08T12:00:00.000Z'
const report = {
  id,
  reporterProfileId: id,
  targetKind: 'PROFILE',
  targetProfileId: targetId,
  targetListingId: null,
  targetApplicationId: null,
  reason: 'HARASSMENT',
  details: 'Report details',
  evidenceSnapshot: { profilePublicId: targetId, username: 'TargetUser', status: 'ACTIVE' },
  status: 'SUBMITTED',
  queuePriority: 0,
  reviewStartedAt: null,
  resolvedAt: null,
  version: 0,
  createdAt: now,
  updatedAt: now
}

describe('native Social reporting contracts', () => {
  it('restricts profile safety actions to a versioned report without caller-supplied identity', () => {
    const input = { reportPublicId: id, expectedVersion: 0, reason: 'Protect Social participants' }
    for (const action of ['SUSPEND_PROFILE', 'RESTORE_PROFILE'])
      expect(socialProfileModerationInputSchema.safeParse({ ...input, action }).success).toBe(true)
    for (const action of ['HIDE_LISTING', 'RESTORE_LISTING', 'START_REVIEW'])
      expect(socialProfileModerationInputSchema.safeParse({ ...input, action }).success).toBe(false)
    expect(
      socialProfileModerationInputSchema.safeParse({
        ...input,
        action: 'SUSPEND_PROFILE',
        moderatorUserId: id
      }).success
    ).toBe(false)
  })
  it('keeps listing safety actions separate and retains only valid invalidation generations', () => {
    const input = {
      reportPublicId: id,
      expectedVersion: 0,
      reason: 'Protect the table',
      action: 'HIDE_LISTING'
    }
    expect(socialListingModerationInputSchema.safeParse(input).success).toBe(true)
    expect(
      socialListingModerationInputSchema.safeParse({ ...input, action: 'RESTORE_LISTING' }).success
    ).toBe(true)
    for (const action of ['VIEWED', 'START_REVIEW', 'SUSPEND_PROFILE', 'RESTORE_PROFILE'])
      expect(socialListingModerationInputSchema.safeParse({ ...input, action }).success).toBe(false)
    expect(
      socialListingModerationInputSchema.safeParse({ ...input, moderatorUserId: id }).success
    ).toBe(false)
    const event = { listingId: targetId, generation: 1, invalidatedAt: now }
    expect(socialStoredListingInvalidationSchema.parse(event)).toEqual(event)
    for (const generation of [-1, 0, 1.5])
      expect(
        socialStoredListingInvalidationSchema.safeParse({ ...event, generation }).success
      ).toBe(false)
  })
  it('preserves historical SQL evidence text, offset timestamps and local-time precision', () => {
    const expectations = {
      contentGuidance: '  Original guidance  ',
      attendancePolicy: '  Original attendance  ',
      allowedContentRules: '  Original content  ',
      tableConduct: '  Original conduct  ',
      contentBoundaries: '  Original boundaries  ',
      safetyPractices: ['LINES_AND_VEILS'],
      safetyDetails: '  Original safety  '
    }
    const capturedAt = '2026-09-08T09:00:00.123456-05:00'
    const listing = {
      listingPublicId: targetId,
      title: '  Original title  ',
      summary: '  Original summary  ',
      status: 'OPEN',
      audience: 'PUBLIC',
      moderationStatus: 'VISIBLE',
      hostProfilePublicId: id,
      hostUsername: 'OriginalHost',
      systemId: '00000000-0000-0000-0000-000000000001',
      format: 'ONGOING',
      toneTags: ['HEROIC'],
      toneDetails: '  Original tone  ',
      contentMaturity: 'STANDARD',
      playMode: 'IN_PERSON',
      schedule: {
        kind: 'RECURRING',
        timeZone: 'America/Chicago',
        summary: '  Original schedule  ',
        startsAt: null,
        weekday: 2,
        localStartTime: '19:30:00.123456',
        recurrence: 'WEEKLY'
      },
      location: { city: '  Austin  ', stateCode: 'TX' },
      expectations,
      version: 3,
      capturedAt
    }
    expect(socialListingEvidenceSchema.parse(listing)).toEqual(listing)
    for (const localStartTime of ['19:30', '19:30:00', '23:59:59.999999', '24:00:00']) {
      const original = { ...listing, schedule: { ...listing.schedule, localStartTime } }
      expect(socialListingEvidenceSchema.parse(original)).toEqual(original)
    }
    const oneTime = {
      ...listing,
      schedule: {
        ...listing.schedule,
        kind: 'ONE_TIME',
        startsAt: '2026-09-09T00:30:00+00:00',
        weekday: null,
        localStartTime: null,
        recurrence: null
      }
    }
    expect(socialListingEvidenceSchema.parse(oneTime)).toEqual(oneTime)
    const application = {
      applicationPublicId: targetId,
      listingPublicId: id,
      listingTitle: listing.title,
      applicantProfilePublicId: targetId,
      applicantUsername: 'OriginalApplicant',
      hostProfilePublicId: id,
      hostUsername: listing.hostUsername,
      message: '  Original application\n  ',
      status: 'ACCEPTED',
      listingVersion: 3,
      expectations,
      submittedAt: '2026-09-07T17:30:00.123456+00:00',
      respondedAt: capturedAt,
      version: 1,
      capturedAt
    }
    expect(socialApplicationEvidenceSchema.parse(application)).toEqual(application)
    const stored = {
      ...report,
      targetKind: 'APPLICATION',
      targetProfileId: null,
      targetApplicationId: targetId,
      details: '  Original report details  ',
      evidenceSnapshot: application
    }
    expect(socialStoredReportSchema.parse(stored)).toEqual(stored)
    for (const localStartTime of ['25:00:00', '24:00:01', '19:60:00', '19:30:00.1234567'])
      expect(
        socialListingEvidenceSchema.safeParse({
          ...listing,
          schedule: { ...listing.schedule, localStartTime }
        }).success
      ).toBe(false)
    for (const changes of [
      { message: ' ' },
      { message: 'x'.repeat(2001) },
      { message: ` ${'x'.repeat(2000)}` },
      { capturedAt: '2026-02-30T12:00:00+00:00' },
      { submittedAt: '2026-09-07T17:30:00' },
      { accountId: id }
    ])
      expect(
        socialApplicationEvidenceSchema.safeParse({ ...application, ...changes }).success
      ).toBe(false)
  })

  it('requires one matching bounded target snapshot and coherent report lifecycle', () => {
    expect(socialStoredReportSchema.parse(report)).toEqual(report)
    for (const changes of [
      { targetProfileId: null },
      { targetListingId: targetId },
      { targetProfileId: id },
      { targetKind: 'APPLICATION' },
      { evidenceSnapshot: { ...report.evidenceSnapshot, email: 'private@example.invalid' } },
      { evidenceSnapshot: { ...report.evidenceSnapshot, username: 'x'.repeat(31) } },
      { details: 'x'.repeat(4001) },
      { queuePriority: 1 },
      { reviewStartedAt: now },
      { resolvedAt: now },
      { status: 'UNDER_REVIEW', queuePriority: 1 },
      { status: 'RESOLVED', queuePriority: 2, resolvedAt: now },
      { status: 'DISMISSED', queuePriority: 1, reviewStartedAt: now, resolvedAt: now }
    ])
      expect(socialStoredReportSchema.safeParse({ ...report, ...changes }).success).toBe(false)
    for (const status of ['UNDER_REVIEW', 'RESOLVED', 'DISMISSED'])
      expect(
        socialStoredReportSchema.safeParse({
          ...report,
          status,
          queuePriority: status === 'UNDER_REVIEW' ? 1 : 2,
          reviewStartedAt: now,
          resolvedAt: status === 'UNDER_REVIEW' ? null : now
        }).success
      ).toBe(true)
  })

  it('keeps queue metadata separate from audited bounded evidence and actor identity', () => {
    const paginationOpts = { cursor: null, numItems: 48 }
    expect(socialModerationQueueInputSchema.parse({ paginationOpts })).toEqual({ paginationOpts })
    expect(
      socialModerationQueueInputSchema.safeParse({ paginationOpts, isSuperAdmin: true }).success
    ).toBe(false)
    expect(
      socialModerationQueueInputSchema.safeParse({ paginationOpts: { cursor: null, numItems: 49 } })
        .success
    ).toBe(false)
    const summary = {
      reportPublicId: id,
      targetKind: 'PROFILE',
      reason: 'HARASSMENT',
      status: 'SUBMITTED',
      version: 0,
      createdAt: now,
      updatedAt: now
    }
    const page = { page: [summary], isDone: true, continueCursor: '' }
    expect(socialModerationQueuePageSchema.safeParse(page).success).toBe(true)
    expect(
      socialModerationQueuePageSchema.safeParse({
        ...page,
        page: [{ ...summary, evidence: report.evidenceSnapshot }]
      }).success
    ).toBe(false)
    const detail = {
      ...summary,
      reporter: { profilePublicId: id, username: 'Reporter' },
      details: report.details,
      evidence: report.evidenceSnapshot
    }
    expect(socialModerationEvidenceDtoSchema.safeParse(detail).success).toBe(true)
    expect(
      socialModerationEvidenceDtoSchema.safeParse({ ...detail, evidence: { accountId: id } })
        .success
    ).toBe(false)
    for (const action of ['VIEWED', 'HIDE_LISTING', 'SUSPEND_PROFILE'])
      expect(
        socialReportReviewInputSchema.safeParse({
          reportPublicId: id,
          expectedVersion: 0,
          reason: 'Reason',
          action
        }).success
      ).toBe(false)
    expect(
      socialReportReviewInputSchema.safeParse({
        reportPublicId: id,
        expectedVersion: 0,
        reason: 'Reason',
        action: 'START_REVIEW'
      }).success
    ).toBe(true)
  })

  it('restricts audit targets and state metadata to the action being recorded', () => {
    const audit = {
      id,
      moderatorUserId: id,
      reportId: id,
      action: 'VIEWED',
      affectedProfileId: null,
      affectedListingId: null,
      reason: 'Viewed',
      beforeState: { reportStatus: 'SUBMITTED', reportVersion: 0 },
      afterState: { reportStatus: 'SUBMITTED', reportVersion: 0 },
      createdAt: now
    }
    expect(socialStoredModerationActionSchema.safeParse(audit).success).toBe(true)
    expect(
      socialStoredModerationActionSchema.safeParse({ ...audit, affectedProfileId: targetId })
        .success
    ).toBe(false)
    expect(
      socialStoredModerationActionSchema.safeParse({ ...audit, action: 'HIDE_LISTING' }).success
    ).toBe(false)
    expect(
      socialStoredModerationActionSchema.safeParse({
        ...audit,
        action: 'HIDE_LISTING',
        affectedListingId: targetId
      }).success
    ).toBe(true)
    expect(
      socialStoredModerationActionSchema.safeParse({
        ...audit,
        afterState: { ...audit.afterState, email: 'private' }
      }).success
    ).toBe(false)
  })
})
