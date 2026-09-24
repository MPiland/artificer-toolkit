import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import { v } from 'convex/values'
import type { Id } from '../_generated/dataModel'
import { internal } from '../_generated/api'
import { internalQuery, type MutationCtx, type QueryCtx } from '../_generated/server'
import { internalMutation } from '../lib/mutations'
import {
  socialRetentionApplyInputSchema,
  socialRetentionApplyResultSchema,
  socialRetentionPreviewInputSchema,
  socialRetentionPreviewResultSchema,
  type SocialRetentionPreviewInput
} from '@artificer-toolkit/schema/api/socialRetention'
import {
  socialStoredApplicationSchema,
  socialStoredRateLimitSchema
} from '@artificer-toolkit/schema/projections/socialPersistence'
import {
  campaignStoredInviteSchema,
  campaignStoredMembershipSchema
} from '@artificer-toolkit/schema/projections/campaignPersistence'
import { socialStoredReportSchema } from '@artificer-toolkit/schema/projections/socialModerationPersistence'

type RetentionId =
  | Id<'campaignInvites'>
  | Id<'socialReports'>
  | Id<'socialApplications'>
  | Id<'socialActionRateLimits'>
type RetentionCursor = {
  continueCursor: string
  isDone: boolean
  splitCursor?: string | null
  pageStatus?: 'SplitRecommended' | 'SplitRequired' | null
}
type RetentionSelection = RetentionCursor & {
  scanned: number
  matches: Array<{ id: RetentionId; reportId?: string }>
}

function cutoffValues(input: SocialRetentionPreviewInput) {
  const asOf = Date.parse(input.asOf)
  if (asOf < 0 || asOf > Date.now()) throw new Error('Retention requires a current or past cutoff.')
  const terminalBefore = asOf - 180 * 86_400_000
  const ratesBefore = asOf - 2 * 86_400_000
  const reportCutoff = new Date(asOf)
  const month = reportCutoff.getUTCMonth()
  reportCutoff.setUTCFullYear(reportCutoff.getUTCFullYear() - 2)
  if (reportCutoff.getUTCMonth() !== month) reportCutoff.setUTCDate(0)
  const reportsBefore = reportCutoff.toISOString()
  const reportRangeStart = reportsBefore.slice(0, -1)
  const earlierShortTimes = [16, 19, 21, 22]
    .map((length) => `${reportsBefore.slice(0, length)}Z`)
    .filter((value) => value >= reportRangeStart && Date.parse(value) < reportCutoff.getTime())
    .sort()
  return { terminalBefore, ratesBefore, reportCutoff, reportRangeStart, earlierShortTimes }
}

async function selectRetentionPage(
  ctx: QueryCtx | MutationCtx,
  input: SocialRetentionPreviewInput,
  requireNoReports = false
): Promise<RetentionSelection> {
  const { terminalBefore, ratesBefore, reportCutoff, reportRangeStart, earlierShortTimes } =
    cutoffValues(input)
  const pagination = { ...input.paginationOpts, maximumRowsRead: 8, maximumBytesRead: 1024 * 1024 }
  if (input.phase === 'INVITATIONS') {
    const result = await ctx.db.query('campaignInvites').paginate(pagination)
    const matches = result.page.flatMap((raw) => {
      const { _id, _creationTime, ...stored } = raw
      const row = campaignStoredInviteSchema.parse(stored)
      return row.status !== 'PENDING' &&
        Date.parse(row.respondedAt ?? row.revokedAt ?? row.expiredAt ?? row.updatedAt) <
          terminalBefore
        ? [{ id: _id }]
        : []
    })
    const { page, ...cursor } = result
    return { ...cursor, scanned: page.length, matches }
  }
  if (input.phase === 'REPORTS') {
    const result = await ctx.db.query('socialReports').paginate(pagination)
    const matches = result.page.flatMap((raw) => {
      const { _id, _creationTime, ...stored } = raw
      const row = socialStoredReportSchema.parse(stored)
      return (row.status === 'RESOLVED' || row.status === 'DISMISSED') &&
        row.resolvedAt !== null &&
        Date.parse(row.resolvedAt) < reportCutoff.getTime()
        ? [{ id: _id, reportId: row.id }]
        : []
    })
    const { page, ...cursor } = result
    return { ...cursor, scanned: page.length, matches }
  }
  if (input.phase === 'RATE_WINDOWS') {
    const result = await ctx.db.query('socialActionRateLimits').paginate(pagination)
    const matches = result.page.flatMap((raw) => {
      const { _id, _creationTime, ...stored } = raw
      const row = socialStoredRateLimitSchema.parse(stored)
      return Date.parse(row.windowStartedAt) < ratesBefore ? [{ id: _id }] : []
    })
    const { page, ...cursor } = result
    return { ...cursor, scanned: page.length, matches }
  }
  const result = await ctx.db.query('socialApplications').paginate(pagination)
  const matches: RetentionSelection['matches'] = []
  for (const raw of result.page) {
    const { _id, _creationTime, ...stored } = raw
    const row = socialStoredApplicationSchema.parse(stored)
    if (row.status === 'SUBMITTED') continue
    const terminalAt = Math.max(
      Date.parse(
        row.withdrawnAt ?? row.respondedAt ?? row.expiredAt ?? row.blockedAt ?? row.updatedAt
      ),
      row.applicantDeletedAt ? Date.parse(row.applicantDeletedAt) : Number.NEGATIVE_INFINITY
    )
    if (terminalAt >= terminalBefore) continue
    const listing = await ctx.db
      .query('socialListings')
      .withIndex('by_publicId', (q) => q.eq('id', row.listingId))
      .unique()
    const applicant = await ctx.db
      .query('socialProfiles')
      .withIndex('by_publicId', (q) => q.eq('id', row.applicantProfileId))
      .unique()
    if (!listing || (!applicant && !row.applicantDeletedAt)) continue
    const membership = applicant
      ? await ctx.db
          .query('campaignMemberships')
          .withIndex('by_campaignId_userId', (q) =>
            q.eq('campaignId', listing.campaignId).eq('userId', applicant.userId)
          )
          .unique()
      : null
    if (membership) {
      const {
        _id: _membershipId,
        _creationTime: _membershipCreation,
        ...membershipStored
      } = membership
      campaignStoredMembershipSchema.parse(membershipStored)
      if ((membership.status === 'LEFT') !== (membership.leftAt !== null))
        throw new Error('Invalid Campaign membership retention state.')
    }
    if (row.status === 'ACCEPTED' && membership?.status === 'ACTIVE') continue
    if (membership?.leftAt && Date.parse(membership.leftAt) >= terminalBefore) continue
    const unresolvedReports = await Promise.all([
      ctx.db
        .query('socialReports')
        .withIndex('by_targetApplicationId_queuePriority_resolvedAt', (q) =>
          q.eq('targetApplicationId', row.id).lt('queuePriority', 2)
        )
        .first(),
      ctx.db
        .query('socialReports')
        .withIndex('by_targetApplicationId_queuePriority_resolvedAt', (q) =>
          q.eq('targetApplicationId', row.id).eq('queuePriority', 2).eq('resolvedAt', null)
        )
        .first()
    ])
    if (unresolvedReports.some((report) => report !== null)) continue
    let protectedReport = false
    if (requireNoReports) {
      protectedReport =
        (await ctx.db
          .query('socialReports')
          .withIndex('by_targetApplicationId_queuePriority_resolvedAt', (q) =>
            q.eq('targetApplicationId', row.id)
          )
          .first()) !== null
    } else {
      let lower = reportRangeStart
      let exclusive = false
      for (const upper of [...earlierShortTimes, undefined]) {
        const report = await ctx.db
          .query('socialReports')
          .withIndex('by_targetApplicationId_queuePriority_resolvedAt', (q) => {
            const target = q.eq('targetApplicationId', row.id).eq('queuePriority', 2)
            const range = exclusive
              ? target.gt('resolvedAt', lower)
              : target.gte('resolvedAt', lower)
            return upper === undefined ? range : range.lt('resolvedAt', upper)
          })
          .first()
        if (report) {
          protectedReport = true
          break
        }
        if (upper !== undefined) {
          lower = upper
          exclusive = true
        }
      }
    }
    if (!protectedReport) matches.push({ id: _id })
  }
  const { page, ...cursor } = result
  return { ...cursor, scanned: page.length, matches }
}

export const preview = internalQuery({
  args: zodToConvexFields(socialRetentionPreviewInputSchema.shape),
  returns: zodToConvex(socialRetentionPreviewResultSchema),
  handler: async (ctx, args) => {
    const { matches, ...result } = await selectRetentionPage(
      ctx,
      socialRetentionPreviewInputSchema.parse(args)
    )
    return { ...result, eligible: matches.length }
  }
})

export const apply = internalMutation({
  args: zodToConvexFields(socialRetentionApplyInputSchema.shape),
  returns: zodToConvex(socialRetentionApplyResultSchema),
  handler: async (ctx, args) => {
    const input = socialRetentionApplyInputSchema.parse(args)
    const { matches, ...result } = await selectRetentionPage(ctx, input, true)
    for (const match of matches) {
      await ctx.db.delete(match.id)
      if (match.reportId)
        await ctx.scheduler.runAfter(0, internal.social.retention.cleanupReportActions, {
          reportId: match.reportId
        })
    }
    return { ...result, eligible: matches.length, deleted: matches.length }
  }
})

export const cleanupReportActions = internalMutation({
  args: zodToConvexFields({ reportId: socialStoredReportSchema.shape.id }),
  returns: v.null(),
  handler: async (ctx, { reportId }) => {
    const report = await ctx.db
      .query('socialReports')
      .withIndex('by_publicId', (q) => q.eq('id', reportId))
      .unique()
    if (report) return null
    const audits = await ctx.db
      .query('socialModerationActions')
      .withIndex('by_reportId_createdAt_id', (q) => q.eq('reportId', reportId))
      .take(8)
    for (const audit of audits) await ctx.db.delete(audit._id)
    if (audits.length === 8)
      await ctx.scheduler.runAfter(0, internal.social.retention.cleanupReportActions, { reportId })
    return null
  }
})
