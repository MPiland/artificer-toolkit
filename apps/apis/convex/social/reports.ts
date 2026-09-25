import { zodToConvex } from 'convex-helpers/server/zod4'
import {
  createSocialReportInputSchema,
  socialReportReceiptDtoSchema,
  type SocialReportReceiptDto
} from '@artificer-toolkit/schema/api/socialHub'
import { socialStoredReportSchema } from '@artificer-toolkit/schema/projections/socialModerationPersistence'
import { mutation } from '../lib/mutations'
import { requireSocialViewer } from './visibility'
import { consumeSocialRateLimit } from '../lib/rateLimits'
import { captureReportEvidence } from './reportEvidence'

export const create = mutation({
  args: { input: zodToConvex(createSocialReportInputSchema) },
  returns: zodToConvex(socialReportReceiptDtoSchema),
  handler: async (ctx, args): Promise<SocialReportReceiptDto> => {
    const input = createSocialReportInputSchema.parse(args.input)
    const actor = await requireSocialViewer(ctx)
    const now = new Date().toISOString()
    const evidenceSnapshot = await captureReportEvidence(ctx, actor, input, now)
    await consumeSocialRateLimit(ctx, actor.userId, 'REPORT')
    const report = socialStoredReportSchema.parse({
      id: crypto.randomUUID(),
      reporterProfileId: actor.id,
      targetKind: input.targetKind,
      targetProfileId: input.targetKind === 'PROFILE' ? input.targetPublicId.toLowerCase() : null,
      targetListingId: input.targetKind === 'LISTING' ? input.targetPublicId.toLowerCase() : null,
      targetApplicationId:
        input.targetKind === 'APPLICATION' ? input.targetPublicId.toLowerCase() : null,
      reason: input.reason,
      details: input.details,
      evidenceSnapshot,
      status: 'SUBMITTED',
      queuePriority: 0,
      reviewStartedAt: null,
      resolvedAt: null,
      createdAt: now,
      updatedAt: now,
      version: 0
    })
    await ctx.db.insert('socialReports', report)
    return { reportPublicId: report.id, status: 'SUBMITTED', createdAt: now }
  }
})
