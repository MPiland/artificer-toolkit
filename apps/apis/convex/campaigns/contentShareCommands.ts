import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import type { z } from 'zod'
import {
  campaignContentShareDtoSchema,
  shareCampaignContentInputSchema,
  type CampaignContentShareDto
} from '@artificer-toolkit/schema/api/campaignCore'
import { campaignStoredContentShareSchema } from '@artificer-toolkit/schema/projections/campaignContentPersistence'
import { getCampaignCapabilities } from '@artificer-toolkit/shared/campaign/capabilities'
import { internalMutation } from '../lib/mutations'
import { requireIdentity } from '../lib/identity'
import {
  readCurrentPublication,
  readOwnedCurrentRoot,
  requireCampaignContentParents
} from './contentAccess'
import { requireCampaignAuthority } from './authority'

export const share = internalMutation({
  args: zodToConvexFields(shareCampaignContentInputSchema.shape),
  returns: zodToConvex<z.core.$ZodType<CampaignContentShareDto>>(campaignContentShareDtoSchema),
  handler: async (ctx, args): Promise<CampaignContentShareDto> => {
    const input = shareCampaignContentInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    const { campaign, membership } = await requireCampaignAuthority(ctx, input.campaignId, userId)
    if (!getCampaignCapabilities(campaign.status, membership.role).shareOwnedContent)
      throw new Error('You cannot share content with this Campaign.')
    const subjectId = input.subjectId.toLowerCase()
    const root = await readOwnedCurrentRoot(ctx, input.subjectKind, subjectId, userId)
    if (!root) throw new Error('Only active homebrew you own can be shared.')
    if (root.systemId !== campaign.gameSystemId)
      throw new Error('Shared content must belong to the Campaign Game System.')
    await requireCampaignContentParents(ctx, campaign, root)
    const publication = await readCurrentPublication(ctx, root)
    const existing = await ctx.db
      .query('campaignContentShares')
      .withIndex('by_campaignId_subjectKind_subjectId', (q) =>
        q
          .eq('campaignId', campaign.id)
          .eq('subjectKind', input.subjectKind)
          .eq('subjectId', subjectId)
      )
      .unique()
    if (existing && existing.sharedBy !== userId)
      throw new Error('Campaign content root is already shared by a different author.')
    const now = new Date().toISOString()
    const stored = campaignStoredContentShareSchema.parse({
      campaignId: campaign.id,
      subjectKind: input.subjectKind,
      subjectId,
      sharedBy: userId,
      createdAt: existing?.createdAt ?? now,
      updatedAt: existing?.updatedAt ?? now
    })
    if (!existing) await ctx.db.insert('campaignContentShares', stored)
    return campaignContentShareDtoSchema.parse({
      subjectKind: stored.subjectKind,
      subjectId: stored.subjectId,
      sharedBy: stored.sharedBy,
      createdAt: stored.createdAt,
      updatedAt: stored.updatedAt,
      document: publication.document
    })
  }
})
