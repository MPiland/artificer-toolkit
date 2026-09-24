import { v } from 'convex/values'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
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
import { internalMutation } from '../lib/mutations'
import { requireIdentity } from '../lib/identity'
import { requireCampaignAuthority } from './authority'
import { requireCampaignVehicleDefinition } from './vehicleSources'
import { presentCampaignVehicle } from './vehicleDocuments'
import { executeCampaignVehicleLifecycle } from './vehicleLifecycle'
import { readCampaignInventory } from './partyInventoryDocuments'
import { requireInventoryVehicleEditable } from './inventoryCleanupGuards'

export const create = internalMutation({
  args: zodToConvexFields(createCampaignVehicleInputSchema.shape),
  returns: zodToConvex(campaignVehicleDtoSchema),
  handler: async (ctx, args): Promise<CampaignVehicleDto> => {
    const input = createCampaignVehicleInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    const { campaign, membership } = await requireCampaignAuthority(ctx, input.campaignId, userId)
    if (membership.role !== 'OWNER') throw new Error('Only the Campaign owner can manage Vehicles.')
    if (campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
    const vehicleDefinitionId = input.vehicleDefinitionId.toLowerCase()
    await requireCampaignVehicleDefinition(ctx, campaign, vehicleDefinitionId)
    const now = new Date().toISOString()
    const vehicle = campaignVehicleDtoSchema.parse({
      id: crypto.randomUUID(),
      campaignId: campaign.id,
      vehicleDefinitionId,
      label: input.label ?? null,
      availability: 'AVAILABLE',
      version: 0,
      createdAt: now,
      updatedAt: now
    })
    const id = await ctx.db.insert('campaignVehicles', vehicle)
    return presentCampaignVehicle(campaign, (await ctx.db.get(id))!)
  }
})

export const update = internalMutation({
  args: zodToConvexFields(updateCampaignVehicleInputSchema.shape),
  returns: zodToConvex(campaignVehicleDtoSchema),
  handler: async (ctx, args): Promise<CampaignVehicleDto> => {
    const input = updateCampaignVehicleInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    const { campaign, membership } = await requireCampaignAuthority(ctx, input.campaignId, userId)
    if (membership.role !== 'OWNER') throw new Error('Only the Campaign owner can manage Vehicles.')
    if (campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
    const vehicle = await ctx.db
      .query('campaignVehicles')
      .withIndex('by_campaignId_id', (q) =>
        q.eq('campaignId', campaign.id).eq('id', input.vehicleId.toLowerCase())
      )
      .unique()
    if (!vehicle) throw new Error('Campaign Vehicle is unavailable.')
    presentCampaignVehicle(campaign, vehicle)
    await requireInventoryVehicleEditable(ctx, campaign.id, vehicle.id)
    if (vehicle.version !== input.expectedVersion)
      throw new Error('Campaign Vehicle changed before this action completed.')
    await requireCampaignVehicleDefinition(ctx, campaign, vehicle.vehicleDefinitionId)
    await ctx.db.patch(vehicle._id, {
      label: input.label,
      version: vehicle.version + 1,
      updatedAt: new Date(Math.max(Date.now(), Date.parse(vehicle.updatedAt) + 1)).toISOString()
    })
    return presentCampaignVehicle(campaign, (await ctx.db.get(vehicle._id))!)
  }
})

export const remove = internalMutation({
  args: zodToConvexFields(deleteCampaignVehicleInputSchema.shape),
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const input = deleteCampaignVehicleInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    const { campaign, membership } = await requireCampaignAuthority(ctx, input.campaignId, userId)
    if (membership.role !== 'OWNER') throw new Error('Only the Campaign owner can manage Vehicles.')
    if (campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
    const vehicle = await ctx.db
      .query('campaignVehicles')
      .withIndex('by_campaignId_id', (q) =>
        q.eq('campaignId', campaign.id).eq('id', input.vehicleId.toLowerCase())
      )
      .unique()
    if (!vehicle) throw new Error('Campaign Vehicle is unavailable.')
    presentCampaignVehicle(campaign, vehicle)
    await requireInventoryVehicleEditable(ctx, campaign.id, vehicle.id)
    if (vehicle.version !== input.expectedVersion)
      throw new Error('Campaign Vehicle changed before this action completed.')
    const [item, currencyGroup, currency, inventory] = await Promise.all([
      ctx.db
        .query('campaignPartyItems')
        .withIndex('by_campaignId_vehicleId_id', (q) =>
          q.eq('campaignId', campaign.id).eq('vehicleId', vehicle.id)
        )
        .first(),
      ctx.db
        .query('campaignPartyCurrencyGroups')
        .withIndex('by_campaignId_vehicleId_id', (q) =>
          q.eq('campaignId', campaign.id).eq('vehicleId', vehicle.id)
        )
        .first(),
      ctx.db
        .query('campaignPartyCurrencies')
        .withIndex('by_campaignId_vehicleId_id', (q) =>
          q.eq('campaignId', campaign.id).eq('vehicleId', vehicle.id)
        )
        .first(),
      readCampaignInventory(ctx, campaign.id, vehicle.id)
    ])
    // Use the Vehicle lifecycle removal commands when cargo is present.
    if (item || currencyGroup || currency)
      throw new Error('Nonempty Vehicle inventory requires Vehicle lifecycle removal.')
    if (inventory) await ctx.db.delete(inventory._id)
    await ctx.db.delete(vehicle._id)
    return null
  }
})

export const lifecycle = internalMutation({
  args: { input: zodToConvex(campaignVehicleLifecycleInputSchema) },
  returns: zodToConvex(campaignVehicleLifecycleResultSchema),
  handler: async (ctx, args): Promise<CampaignVehicleLifecycleResult> => {
    const input = campaignVehicleLifecycleInputSchema.parse(args.input)
    const { userId } = await requireIdentity(ctx)
    return executeCampaignVehicleLifecycle(ctx, input, userId)
  }
})
