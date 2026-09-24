import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  campaignSessionDtoSchema,
  finishCampaignSessionInputSchema,
  type CampaignSessionDto
} from '@artificer-toolkit/schema/api/campaignSessions'
import { campaignStoredCommandSchema } from '@artificer-toolkit/schema/projections/campaignSessionPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { mutation } from '../lib/mutations'
import { requireIdentity } from '../lib/identity'
import { requireCampaignAuthority } from './authority'
import { presentSession, requireSession } from './sessionDocuments'

export const finish = mutation({
  args: zodToConvexFields(finishCampaignSessionInputSchema.shape),
  returns: zodToConvex(campaignSessionDtoSchema),
  handler: async (ctx, args): Promise<CampaignSessionDto> => {
    const input = finishCampaignSessionInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    const { campaign, membership } = await requireCampaignAuthority(ctx, input.campaignId, userId)
    if (membership.role !== 'OWNER') throw new Error('Campaign not found.')
    if (campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
    const commandId = input.commandId.toLowerCase()
    const inputFingerprint = checksumCanonicalJson(input)
    const prior = await ctx.db
      .query('campaignCommands')
      .withIndex('by_campaignId_commandId', (q) =>
        q.eq('campaignId', campaign.id).eq('commandId', commandId)
      )
      .unique()
    if (prior) {
      if (prior.commandType !== 'FINISH_SESSION' || prior.inputFingerprint !== inputFingerprint)
        throw new Error('This command ID was already used with different input.')
      if (
        prior.resultPayload.campaignId !== campaign.id ||
        prior.resultPayload.id !== input.sessionId.toLowerCase() ||
        prior.resultPayload.status !== 'FINISHED' ||
        prior.resultPayload.version !== input.expectedVersion + 1
      )
        throw new Error('Stored Session command result mismatch.')
      return campaignSessionDtoSchema.parse(prior.resultPayload)
    }
    const session = await requireSession(ctx, campaign.id, input.sessionId)
    if (session.version !== input.expectedVersion) throw new Error('Session version conflict.')
    if (session.status !== 'OPEN') throw new Error('Session is already finished.')
    const now = new Date().toISOString()
    const patch = {
      status: 'FINISHED' as const,
      finishedAt: now,
      updatedAt: now,
      version: session.version + 1
    }
    await ctx.db.patch(session._id, patch)

    const result = presentSession({ ...session, ...patch }, campaign.contentMaturity)
    await ctx.db.insert(
      'campaignCommands',
      campaignStoredCommandSchema.parse({
        campaignId: campaign.id,
        commandId,
        commandType: 'FINISH_SESSION',
        inputFingerprint,
        resultPayload: result,
        createdAt: now
      })
    )
    return result
  }
})
