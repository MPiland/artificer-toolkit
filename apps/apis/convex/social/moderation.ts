import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import { socialReportPublicIdInputSchema } from '@artificer-toolkit/schema/api/socialHub'
import {
  socialModerationQueueInputSchema,
  socialModerationQueuePageSchema,
  socialReportReviewInputSchema,
  socialModerationEvidenceDtoSchema,
  type SocialModerationEvidenceDto,
  type SocialModerationQueuePage
} from '@artificer-toolkit/schema/api/socialModeration'
import { socialStoredReportSchema } from '@artificer-toolkit/schema/projections/socialModerationPersistence'
import { query } from '../lib/queries'
import { mutation } from '../lib/mutations'
import {
  requireSocialModerator,
  readModerationReport,
  presentModerationReport,
  presentReportSummary,
  auditReportReview
} from './moderationDocuments'

export const list = query({
  args: zodToConvexFields(socialModerationQueueInputSchema.shape),
  returns: zodToConvex(socialModerationQueuePageSchema),
  handler: async (ctx, args): Promise<SocialModerationQueuePage> => {
    await requireSocialModerator(ctx)
    const input = socialModerationQueueInputSchema.parse(args)
    const result = await ctx.db
      .query('socialReports')
      .withIndex('by_queuePriority_createdAt_id')
      .order('asc')
      .paginate({ ...input.paginationOpts, maximumRowsRead: 8, maximumBytesRead: 1024 * 1024 })
    return socialModerationQueuePageSchema.parse({
      ...result,
      page: result.page.map((row) => {
        const { _id, _creationTime, ...stored } = row
        return presentReportSummary(socialStoredReportSchema.parse(stored))
      })
    })
  }
})

export const open = mutation({
  args: zodToConvexFields(socialReportPublicIdInputSchema.shape),
  returns: zodToConvex(socialModerationEvidenceDtoSchema),
  handler: async (ctx, args): Promise<SocialModerationEvidenceDto> => {
    const actor = await requireSocialModerator(ctx)
    const { reportPublicId } = socialReportPublicIdInputSchema.parse(args)
    const { report } = await readModerationReport(ctx, reportPublicId)
    await auditReportReview(
      ctx,
      actor.userId,
      report,
      report,
      'VIEWED',
      'Moderator opened report evidence.',
      new Date().toISOString()
    )
    return presentModerationReport(ctx, report)
  }
})

export const review = mutation({
  args: zodToConvexFields(socialReportReviewInputSchema.shape),
  returns: zodToConvex(socialModerationEvidenceDtoSchema),
  handler: async (ctx, args): Promise<SocialModerationEvidenceDto> => {
    const actor = await requireSocialModerator(ctx)
    const input = socialReportReviewInputSchema.parse(args)
    const { rowId, report } = await readModerationReport(ctx, input.reportPublicId)
    if (report.version !== input.expectedVersion) throw new Error('Social report version conflict.')
    if (
      input.action === 'START_REVIEW'
        ? report.status !== 'SUBMITTED'
        : report.status !== 'UNDER_REVIEW'
    )
      throw new Error('This report cannot make that transition.')
    const now = new Date(Math.max(Date.now(), Date.parse(report.updatedAt) + 1)).toISOString()
    const status =
      input.action === 'START_REVIEW'
        ? 'UNDER_REVIEW'
        : input.action === 'RESOLVE'
          ? 'RESOLVED'
          : 'DISMISSED'
    const next = socialStoredReportSchema.parse({
      ...report,
      status,
      queuePriority: status === 'UNDER_REVIEW' ? 1 : 2,
      reviewStartedAt: status === 'UNDER_REVIEW' ? now : report.reviewStartedAt,
      resolvedAt: status === 'UNDER_REVIEW' ? null : now,
      version: report.version + 1,
      updatedAt: now
    })
    await ctx.db.replace(rowId, next)
    await auditReportReview(ctx, actor.userId, report, next, input.action, input.reason, now)
    return presentModerationReport(ctx, next)
  }
})
