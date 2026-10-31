import { v, type Validator } from 'convex/values'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import type { z } from 'zod'
import {
  campaignVehicleDtoSchema,
  createCampaignVehicleInputSchema,
  updateCampaignVehicleInputSchema,
  deleteCampaignVehicleInputSchema,
  campaignVehicleLifecycleInputSchema,
  campaignVehicleLifecycleResultSchema,
  type CampaignVehicleDto,
  type CampaignVehicleLifecycleResult
} from '@artificer-toolkit/schema/api/campaignVehicles'
import {
  authoredCataloguePageSchema,
  type AuthoredCataloguePage
} from '@artificer-toolkit/schema/api/authoredCatalogue'
import {
  campaignVehicleListInputSchema,
  campaignVehiclePageSchema,
  type CampaignVehiclePage
} from '@artificer-toolkit/schema/api/campaignVehiclePages'
import { query } from '../lib/queries'
import { mutation } from '../lib/mutations'
import { internal } from '../_generated/api'
import { requireIdentity } from '../lib/identity'
import { requireCampaignAuthority } from './authority'
import { readCampaignCatalogueOptions } from './catalogueOptions'
import { presentCampaignVehicle } from './vehicleDocuments'

export const list = query({
  args: zodToConvexFields(campaignVehicleListInputSchema.shape),
  get returns(): Validator<CampaignVehiclePage, 'required', string> {
    return zodToConvex<z.core.$ZodType<CampaignVehiclePage>>(campaignVehiclePageSchema)
  },
  handler: async (ctx, args): Promise<CampaignVehiclePage> => {
    const input = campaignVehicleListInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    const { campaign, membership } = await requireCampaignAuthority(ctx, input.campaignId, userId)
    const vehicleRows = ctx.db.query('campaignVehicles')
    const result = await (
      membership.role === 'OWNER'
        ? vehicleRows.withIndex('by_campaignId_createdAt_id', (q) =>
            q.eq('campaignId', campaign.id)
          )
        : vehicleRows.withIndex('by_campaignId_availability_createdAt_id', (q) =>
            q.eq('campaignId', campaign.id).eq('availability', 'AVAILABLE')
          )
    ).paginate({ ...input.paginationOpts, maximumRowsRead: 48, maximumBytesRead: 1024 * 1024 })
    return campaignVehiclePageSchema.parse({
      ...result,
      page: result.page.map((row) => presentCampaignVehicle(campaign, row))
    })
  }
})

/** Complete official Vehicle options under this Campaign's current catalogue binding. */
export const definitionOptions = query({
  args: zodToConvexFields(campaignVehicleListInputSchema.shape),
  get returns(): Validator<AuthoredCataloguePage, 'required', string> {
    return zodToConvex<z.core.$ZodType<AuthoredCataloguePage>>(authoredCataloguePageSchema)
  },
  handler: async (ctx, args): Promise<AuthoredCataloguePage> => {
    const input = campaignVehicleListInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    const { campaign } = await requireCampaignAuthority(ctx, input.campaignId, userId)
    return readCampaignCatalogueOptions(ctx, campaign, userId, 'VEHICLE', input.paginationOpts)
  }
})
export const create = mutation({
  args: zodToConvexFields(createCampaignVehicleInputSchema.shape),
  returns: zodToConvex(campaignVehicleDtoSchema),
  handler: async (ctx, args): Promise<CampaignVehicleDto> =>
    ctx.runMutation(
      internal.campaigns.vehicleCommands.create,
      createCampaignVehicleInputSchema.parse(args)
    )
})
export const update = mutation({
  args: zodToConvexFields(updateCampaignVehicleInputSchema.shape),
  returns: zodToConvex(campaignVehicleDtoSchema),
  handler: async (ctx, args): Promise<CampaignVehicleDto> =>
    ctx.runMutation(
      internal.campaigns.vehicleCommands.update,
      updateCampaignVehicleInputSchema.parse(args)
    )
})
export const remove = mutation({
  args: zodToConvexFields(deleteCampaignVehicleInputSchema.shape),
  returns: v.null(),
  handler: async (ctx, args): Promise<null> =>
    ctx.runMutation(
      internal.campaigns.vehicleCommands.remove,
      deleteCampaignVehicleInputSchema.parse(args)
    )
})
export const lifecycle = mutation({
  args: { input: zodToConvex(campaignVehicleLifecycleInputSchema) },
  returns: zodToConvex(campaignVehicleLifecycleResultSchema),
  handler: async (ctx, args): Promise<CampaignVehicleLifecycleResult> =>
    ctx.runMutation(internal.campaigns.vehicleCommands.lifecycle, {
      input: campaignVehicleLifecycleInputSchema.parse(args.input)
    })
})
