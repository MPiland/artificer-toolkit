import { zodToConvex } from 'convex-helpers/server/zod4'
import {
  campaignInventoryOwnerVersionDtoSchema,
  campaignInventoryTransferOwnersInputSchema,
  campaignInventoryTransferVersionsDtoSchema,
  getCampaignInventoryInputSchema,
  type CampaignInventoryOwnerVersionDto,
  type CampaignInventoryTransferVersionsDto,
  type InventoryOwnerRefDto
} from '@artificer-toolkit/schema/api/campaignInventory'
import type { QueryCtx } from '../_generated/server'
import { query } from '../lib/queries'
import type { Doc } from '../_generated/dataModel'
import { requireIdentity } from '../lib/identity'
import { requireCampaignAuthority } from './authority'
import { readAssignedInventoryCharacter } from './inventoryCharacter'
import { readCampaignInventory } from './inventoryVersionDocuments'
import { requireCampaignVehicleCargoAccess } from './vehicleDocuments'

/** Current write fences do not grant access to destination Character inventory. */
async function readOwnerVersion(
  ctx: QueryCtx,
  campaign: Doc<'campaigns'>,
  member: Doc<'campaignMemberships'>,
  owner: InventoryOwnerRefDto,
  access: 'READ' | 'SOURCE' | 'DESTINATION'
): Promise<CampaignInventoryOwnerVersionDto> {
  if (owner.kind === 'CAMPAIGN') {
    if (owner.campaignId.toLowerCase() !== campaign.id)
      throw new Error('Inventory owner is unavailable in this Campaign.')
    return {
      owner: { kind: 'CAMPAIGN', campaignId: campaign.id },
      version: (await readCampaignInventory(ctx, campaign.id))?.version ?? 0
    }
  }
  if (owner.kind === 'VEHICLE') {
    const vehicleId = owner.vehicleId.toLowerCase()
    if (access === 'SOURCE' && member.role !== 'OWNER')
      throw new Error('Only the Campaign owner can transfer Vehicle cargo.')
    await requireCampaignVehicleCargoAccess(ctx, campaign, member, vehicleId)
    return {
      owner: { kind: 'VEHICLE', vehicleId },
      version: (await readCampaignInventory(ctx, campaign.id, vehicleId))?.version ?? 0
    }
  }
  const { record } = await readAssignedInventoryCharacter(
    ctx,
    campaign,
    member,
    owner.characterId,
    access
  )
  const characterId = record.id
  return campaignInventoryOwnerVersionDtoSchema.parse({
    owner: { kind: 'CHARACTER', characterId },
    version: record.play.streamVersion
  })
}

export const version = query({
  args: { input: zodToConvex(getCampaignInventoryInputSchema) },
  returns: zodToConvex(campaignInventoryOwnerVersionDtoSchema),
  handler: async (ctx, args): Promise<CampaignInventoryOwnerVersionDto> => {
    const input = getCampaignInventoryInputSchema.parse(args.input)
    const { userId } = await requireIdentity(ctx)
    const { campaign, membership } = await requireCampaignAuthority(ctx, input.campaignId, userId)
    return readOwnerVersion(ctx, campaign, membership, input.owner, 'READ')
  }
})

export const transferVersions = query({
  args: { input: zodToConvex(campaignInventoryTransferOwnersInputSchema) },
  returns: zodToConvex(campaignInventoryTransferVersionsDtoSchema),
  handler: async (ctx, args): Promise<CampaignInventoryTransferVersionsDto> => {
    const input = campaignInventoryTransferOwnersInputSchema.parse(args.input)
    const { userId } = await requireIdentity(ctx)
    const { campaign, membership } = await requireCampaignAuthority(ctx, input.campaignId, userId)
    if (campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
    const [source, destination] = await Promise.all([
      readOwnerVersion(ctx, campaign, membership, input.source, 'SOURCE'),
      readOwnerVersion(ctx, campaign, membership, input.destination, 'DESTINATION')
    ])
    if (JSON.stringify(source.owner) === JSON.stringify(destination.owner))
      throw new Error('Choose two different inventory owners.')
    return { sourceVersion: source.version, destinationVersion: destination.version }
  }
})
