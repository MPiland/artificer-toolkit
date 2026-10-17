import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import type { z } from 'zod'
import {
  campaignContentShareDtoSchema,
  campaignContentRemovalReceiptDtoSchema,
  shareCampaignContentInputSchema,
  unshareCampaignContentInputSchema,
  type CampaignContentRemovalReceiptDto,
  type CampaignContentShareDto
} from '@artificer-toolkit/schema/api/campaignCore'
import {
  campaignContentListInputSchema,
  campaignContentListPageSchema,
  type CampaignContentListPage
} from '@artificer-toolkit/schema/api/campaignContentList'
import { presentAuthoredSnapshotText } from '@artificer-toolkit/shared/campaign/textPolicy'
import {
  BACKGROUND_NODE_MAP,
  CLASS_NODE_MAP,
  CREATURE_NODE_MAP,
  EQUIPMENT_NODE_MAP,
  FEAT_NODE_MAP,
  RACE_NODE_MAP,
  SPELL_NODE_MAP,
  VEHICLE_NODE_MAP,
  type RuntimeNodeMap
} from '@artificer-toolkit/shared/maps'
import { query } from '../lib/queries'
import { mutation } from '../lib/mutations'
import { requireIdentity } from '../lib/identity'
import { requireCampaignAuthority } from './authority'
import { readCampaignSharedPublication } from './contentAccess'
import { internal } from '../_generated/api'

const campaignContentNodeMaps = {
  BACKGROUND: BACKGROUND_NODE_MAP,
  CLASS: CLASS_NODE_MAP,
  CREATURE: CREATURE_NODE_MAP,
  EQUIPMENT: EQUIPMENT_NODE_MAP,
  FEAT: FEAT_NODE_MAP,
  RACE: RACE_NODE_MAP,
  SPELL: SPELL_NODE_MAP,
  VEHICLE: VEHICLE_NODE_MAP
} satisfies Record<CampaignContentShareDto['subjectKind'], RuntimeNodeMap>

export const list = query({
  args: zodToConvexFields(campaignContentListInputSchema.shape),
  returns: zodToConvex(campaignContentListPageSchema),
  handler: async (ctx, args): Promise<CampaignContentListPage> => {
    const input = campaignContentListInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    const { campaign } = await requireCampaignAuthority(ctx, input.campaignId, userId)
    const result = await ctx.db
      .query('campaignContentShares')
      .withIndex('by_campaignId_subjectKind_subjectId', (q) => q.eq('campaignId', campaign.id))
      .paginate({ ...input.paginationOpts, maximumRowsRead: 4, maximumBytesRead: 1024 * 1024 })
    const page: CampaignContentShareDto[] = []
    for (const share of result.page) {
      const publication = await readCampaignSharedPublication(
        ctx,
        campaign,
        share.subjectKind,
        share.subjectId
      )
      if (!publication) continue
      page.push(
        campaignContentShareDtoSchema.parse({
          subjectKind: share.subjectKind,
          subjectId: share.subjectId,
          sharedBy: share.sharedBy,
          createdAt: share.createdAt,
          updatedAt: share.updatedAt,
          document: presentAuthoredSnapshotText(
            publication.document,
            campaignContentNodeMaps[share.subjectKind],
            campaign.contentMaturity
          )
        })
      )
    }
    return campaignContentListPageSchema.parse({ ...result, page })
  }
})

export const share = mutation({
  args: zodToConvexFields(shareCampaignContentInputSchema.shape),
  returns: zodToConvex<z.core.$ZodType<CampaignContentShareDto>>(campaignContentShareDtoSchema),
  handler: async (ctx, args): Promise<CampaignContentShareDto> =>
    ctx.runMutation(
      internal.campaigns.contentShareCommands.share,
      shareCampaignContentInputSchema.parse(args)
    )
})

export const unshare = mutation({
  args: zodToConvexFields(unshareCampaignContentInputSchema.shape),
  returns: zodToConvex(campaignContentRemovalReceiptDtoSchema),
  handler: async (ctx, args): Promise<CampaignContentRemovalReceiptDto> => {
    const request = unshareCampaignContentInputSchema.parse(args)
    return ctx.runMutation(internal.campaigns.contentShareRemoval.unshare, request)
  }
})
