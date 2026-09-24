import { zodToConvex } from 'convex-helpers/server/zod4'
import {
  campaignInventoryTransferResultDtoSchema,
  transferCampaignInventoryInputSchema,
  type CampaignInventoryTransferResultDto
} from '@artificer-toolkit/schema/api/campaignInventory'
import { internal } from '../_generated/api'
import { mutation } from '../lib/mutations'
import { requireIdentity } from '../lib/identity'
import { requireCampaignAuthority } from './authority'

export const transfer = mutation({
  args: { input: zodToConvex(transferCampaignInventoryInputSchema) },
  returns: zodToConvex(campaignInventoryTransferResultDtoSchema),
  handler: async (ctx, args): Promise<CampaignInventoryTransferResultDto> => {
    const input = transferCampaignInventoryInputSchema.parse(args.input)
    const { userId } = await requireIdentity(ctx)
    const { campaign, membership } = await requireCampaignAuthority(ctx, input.campaignId, userId)
    if (campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
    if (input.source.kind === 'VEHICLE' && membership.role !== 'OWNER')
      throw new Error('Only the Campaign owner can transfer Vehicle cargo.')
    return ctx.runMutation(internal.campaigns.inventoryTransferCommands.transfer, { input })
  }
})
