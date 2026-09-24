import { makeFunctionReference } from 'convex/server'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  socialProfileModerationInputSchema,
  socialModerationEvidenceDtoSchema,
  type SocialModerationEvidenceDto
} from '@artificer-toolkit/schema/api/socialModeration'
import {
  socialStoredModerationActionSchema,
  socialStoredReportSchema
} from '@artificer-toolkit/schema/projections/socialModerationPersistence'
import {
  socialStoredProfileInvalidationSchema,
  socialStoredProfileSchema
} from '@artificer-toolkit/schema/projections/socialPersistence'
import { mutation } from '../lib/mutations'
import {
  presentModerationReport,
  readModerationReport,
  requireSocialModerator
} from './moderationDocuments'
import { readProfileInvalidation } from './profileInvalidation'

const cleanup = makeFunctionReference<
  'mutation',
  {
    profileId: string
    userId: string
    generation: number
    invalidatedAt: string
    phase: 'LISTING'
    cursor: null
  },
  null
>('social/profileModerationCleanup:run')

export const action = mutation({
  args: zodToConvexFields(socialProfileModerationInputSchema.shape),
  returns: zodToConvex(socialModerationEvidenceDtoSchema),
  handler: async (ctx, args): Promise<SocialModerationEvidenceDto> => {
    const actor = await requireSocialModerator(ctx)
    const input = socialProfileModerationInputSchema.parse(args)
    const { rowId: reportRowId, report } = await readModerationReport(ctx, input.reportPublicId)
    if (report.version !== input.expectedVersion) throw new Error('Social report version conflict.')
    const profileId = report.targetProfileId
    if (!profileId) throw new Error('Social report does not target a profile.')
    const profileRow = await ctx.db
      .query('socialProfiles')
      .withIndex('by_publicId', (q) => q.eq('id', profileId))
      .unique()
    if (!profileRow) throw new Error('Social profile not found.')
    const { _id: profileRowId, _creationTime, ...profileStored } = profileRow
    const profile = socialStoredProfileSchema.parse(profileStored)
    const status = input.action === 'SUSPEND_PROFILE' ? 'SUSPENDED' : 'ACTIVE'
    if (profile.status === status)
      throw new Error('Social profile is already in that moderation state.')
    const latest = await readProfileInvalidation(ctx, { profileId: profile.id }, null)
    const priorGeneration = profile.invalidationGeneration ?? 0
    if (
      (latest?.generation ?? 0) !== priorGeneration ||
      (latest && latest.userId !== profile.userId)
    )
      throw new Error('Social profile invalidation is unavailable.')
    const now = new Date(
      Math.max(
        Date.now(),
        Date.parse(profile.updatedAt) + 1,
        Date.parse(report.updatedAt) + 1,
        latest ? Date.parse(latest.invalidatedAt) + 1 : 0
      )
    ).toISOString()
    const needsInvalidation = input.action === 'SUSPEND_PROFILE' || priorGeneration === 0
    const generation = priorGeneration + (needsInvalidation ? 1 : 0)
    const nextProfile = socialStoredProfileSchema.parse({
      ...profile,
      status,
      invalidationGeneration: generation,
      version: profile.version + 1,
      updatedAt: now
    })
    const nextReport = socialStoredReportSchema.parse({
      ...report,
      version: report.version + 1,
      updatedAt: now
    })
    if (needsInvalidation) {
      const invalidation = socialStoredProfileInvalidationSchema.parse({
        profileId: profile.id,
        userId: profile.userId,
        generation,
        invalidatedAt: now
      })
      await ctx.db.insert('socialProfileInvalidations', {
        ...invalidation,
        committedAt: ctx.db.vars.commitTs
      })
      await ctx.scheduler.runAfter(0, cleanup, {
        profileId: profile.id,
        userId: profile.userId,
        generation,
        invalidatedAt: now,
        phase: 'LISTING',
        cursor: null
      })
    }
    await ctx.db.replace(profileRowId, nextProfile)
    await ctx.db.replace(reportRowId, nextReport)
    await ctx.db.insert(
      'socialModerationActions',
      socialStoredModerationActionSchema.parse({
        id: crypto.randomUUID(),
        moderatorUserId: actor.userId,
        reportId: report.id,
        action: input.action,
        affectedProfileId: profile.id,
        affectedListingId: null,
        reason: input.reason,
        beforeState: {
          reportStatus: report.status,
          reportVersion: report.version,
          profileStatus: profile.status
        },
        afterState: {
          reportStatus: nextReport.status,
          reportVersion: nextReport.version,
          profileStatus: nextProfile.status,
          action: input.action
        },
        createdAt: now
      })
    )
    return presentModerationReport(ctx, nextReport)
  }
})
