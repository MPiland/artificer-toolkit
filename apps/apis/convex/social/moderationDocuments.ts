import {
  socialModerationQueueItemDtoSchema,
  socialProfileDtoSchema
} from '@artificer-toolkit/schema/api/socialHub'
import { socialModerationEvidenceDtoSchema } from '@artificer-toolkit/schema/api/socialModeration'
import {
  socialStoredReportSchema,
  socialStoredModerationActionSchema,
  type SocialStoredReport
} from '@artificer-toolkit/schema/projections/socialModerationPersistence'
import { socialStoredProfileSchema } from '@artificer-toolkit/schema/projections/socialPersistence'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { requireSuperadmin } from '../lib/identity'
import { requireSocialViewer, presentSocialProfile } from './visibility'

export async function requireSocialModerator(ctx: QueryCtx) {
  await requireSuperadmin(ctx)
  return requireSocialViewer(ctx)
}

export async function readModerationReport(ctx: QueryCtx, id: string) {
  const row = await ctx.db
    .query('socialReports')
    .withIndex('by_publicId', (q) => q.eq('id', id.toLowerCase()))
    .unique()
  if (!row) throw new Error('Social report not found.')
  const { _id, _creationTime, ...stored } = row
  return { rowId: _id, report: socialStoredReportSchema.parse(stored) }
}

export function presentReportSummary(report: SocialStoredReport) {
  return socialModerationQueueItemDtoSchema.parse({
    reportPublicId: report.id,
    targetKind: report.targetKind,
    reason: report.reason,
    status: report.status,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
    version: report.version
  })
}

export async function presentModerationReport(ctx: QueryCtx, report: SocialStoredReport) {
  const row = await ctx.db
    .query('socialProfiles')
    .withIndex('by_publicId', (q) => q.eq('id', report.reporterProfileId))
    .unique()
  let reporter = socialProfileDtoSchema.parse({
    profilePublicId: report.reporterProfileId,
    username: 'Deleted user'
  })
  if (row) {
    const { _id, _creationTime, ...stored } = row
    reporter = await presentSocialProfile(ctx, socialStoredProfileSchema.parse(stored))
  }
  return socialModerationEvidenceDtoSchema.parse({
    ...presentReportSummary(report),
    reporter,
    details: report.details,
    evidence: report.evidenceSnapshot
  })
}

export async function auditReportReview(
  ctx: MutationCtx,
  moderatorUserId: string,
  before: SocialStoredReport,
  after: SocialStoredReport,
  action: 'VIEWED' | 'START_REVIEW' | 'RESOLVE' | 'DISMISS',
  reason: string,
  now: string
) {
  await ctx.db.insert(
    'socialModerationActions',
    socialStoredModerationActionSchema.parse({
      id: crypto.randomUUID(),
      moderatorUserId,
      reportId: before.id,
      action,
      affectedProfileId: null,
      affectedListingId: null,
      reason,
      beforeState: { reportStatus: before.status, reportVersion: before.version },
      afterState: {
        reportStatus: after.status,
        reportVersion: after.version,
        ...(action === 'VIEWED' ? {} : { action })
      },
      createdAt: now
    })
  )
}
