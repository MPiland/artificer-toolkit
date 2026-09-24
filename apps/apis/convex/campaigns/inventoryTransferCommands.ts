import type { CampaignEventDto } from '@artificer-toolkit/schema/api/campaignLiveState'
import { readInventoryCustodyOwner, publishInventoryCustodyOwners } from './inventoryCustodyOwners'
import { transferCharacterItemCustody } from './characterItemTransfer'
import { transferCharacterCurrencyCustody } from './characterCurrencyTransfer'
import { zodToConvex } from 'convex-helpers/server/zod4'
import {
  campaignInventoryTransferResultDtoSchema,
  transferCampaignInventoryInputSchema,
  type CampaignInventoryTransferResultDto
} from '@artificer-toolkit/schema/api/campaignInventory'
import { campaignStoredPartyInventorySchema } from '@artificer-toolkit/schema/projections/campaignInventoryPersistence'
import { campaignStoredEventSchema } from '@artificer-toolkit/schema/projections/campaignEventPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { internalMutation } from '../lib/mutations'
import { requireIdentity } from '../lib/identity'
import { requireCampaignAuthority } from './authority'
import { readAssignedInventoryCharacter } from './inventoryCharacter'
import { readCampaignInventory } from './partyInventoryDocuments'
import { transferPartyVehicleCustody } from './partyVehicleTransfer'
import { requireCampaignVehicleCargoAccess } from './vehicleDocuments'
import { requireInventoryVehicleEditable } from './inventoryCleanupGuards'

export const transfer = internalMutation({
  args: { input: zodToConvex(transferCampaignInventoryInputSchema) },
  returns: zodToConvex(campaignInventoryTransferResultDtoSchema),
  handler: async (ctx, args): Promise<CampaignInventoryTransferResultDto> => {
    const input = transferCampaignInventoryInputSchema.parse(args.input)
    const { userId } = await requireIdentity(ctx)
    const { campaign, membership } = await requireCampaignAuthority(ctx, input.campaignId, userId)
    if (campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
    if (input.source.kind === 'VEHICLE' && membership.role !== 'OWNER')
      throw new Error('Only the Campaign owner can transfer Vehicle cargo.')

    for (const owner of [input.source, input.destination]) {
      if (owner.kind === 'CAMPAIGN' && owner.campaignId.toLowerCase() !== campaign.id)
        throw new Error('Inventory owner is unavailable in this Campaign.')
    }
    const sourceVehicleId =
      input.source.kind === 'VEHICLE' ? input.source.vehicleId.toLowerCase() : undefined
    const destinationVehicleId =
      input.destination.kind === 'VEHICLE' ? input.destination.vehicleId.toLowerCase() : undefined

    const commandId = input.idempotencyKey.toLowerCase()
    const normalized = transferCampaignInventoryInputSchema.parse({
      ...input,
      campaignId: campaign.id,
      idempotencyKey: commandId,
      source:
        input.source.kind === 'CHARACTER'
          ? {
              kind: 'CHARACTER' as const,
              characterId: input.source.characterId.toLowerCase()
            }
          : sourceVehicleId === undefined
            ? { kind: 'CAMPAIGN' as const, campaignId: campaign.id }
            : { kind: 'VEHICLE' as const, vehicleId: sourceVehicleId },
      destination:
        input.destination.kind === 'CHARACTER'
          ? {
              kind: 'CHARACTER' as const,
              characterId: input.destination.characterId.toLowerCase()
            }
          : destinationVehicleId === undefined
            ? { kind: 'CAMPAIGN' as const, campaignId: campaign.id }
            : { kind: 'VEHICLE' as const, vehicleId: destinationVehicleId },
      ...(input.kind === 'ITEM'
        ? { itemId: input.itemId.toLowerCase() }
        : {
            denominationId: input.denominationId.toLowerCase(),
            ...(typeof input.campaignCurrencySystemId === 'string'
              ? {
                  campaignCurrencySystemId: input.campaignCurrencySystemId.toLowerCase()
                }
              : {})
          })
    })
    if (JSON.stringify(normalized.source) === JSON.stringify(normalized.destination))
      throw new Error('Choose two different inventory owners.')
    const inputFingerprint = checksumCanonicalJson({
      ...normalized,
      actorId: userId
    })
    if (normalized.source.kind === 'CHARACTER' && membership.role !== 'OWNER')
      await readAssignedInventoryCharacter(
        ctx,
        campaign,
        membership,
        normalized.source.characterId,
        'SOURCE'
      )
    const prior = await ctx.db
      .query('campaignEvents')
      .withIndex('by_campaignId_commandId', (q) =>
        q.eq('campaignId', campaign.id).eq('commandId', commandId)
      )
      .unique()
    if (prior) {
      const { _id, _creationTime, ...stored } = prior
      campaignStoredEventSchema.parse(stored)
      if (
        prior.actorUserId !== userId ||
        prior.inputFingerprint !== inputFingerprint ||
        prior.type !== 'CUSTODY_TRANSFER' ||
        !prior.inventoryAudit
      )
        throw new Error('This command ID was already used with different input.')
      return { eventId: prior.id }
    }
    let payload: CampaignEventDto['payload']
    if (normalized.source.kind === 'CHARACTER' || normalized.destination.kind === 'CHARACTER') {
      const [source, destination] = await Promise.all([
        readInventoryCustodyOwner(ctx, campaign, membership, normalized.source, 'SOURCE'),
        readInventoryCustodyOwner(ctx, campaign, membership, normalized.destination, 'DESTINATION')
      ])
      if (
        source.version !== input.expectedSourceVersion ||
        destination.version !== input.expectedDestinationVersion
      )
        throw new Error('Inventory changed before this transfer completed.')
      payload =
        normalized.kind === 'ITEM'
          ? await transferCharacterItemCustody(ctx, campaign, normalized, source, destination)
          : await transferCharacterCurrencyCustody(ctx, campaign, normalized, source, destination)
      await publishInventoryCustodyOwners(ctx, campaign, [source, destination])
    } else {
      if (destinationVehicleId !== undefined)
        await requireCampaignVehicleCargoAccess(ctx, campaign, membership, destinationVehicleId)
      await requireInventoryVehicleEditable(ctx, campaign.id, sourceVehicleId)
      await requireInventoryVehicleEditable(ctx, campaign.id, destinationVehicleId)
      const [sourceInventory, destinationInventory] = await Promise.all([
        readCampaignInventory(ctx, campaign.id, sourceVehicleId),
        readCampaignInventory(ctx, campaign.id, destinationVehicleId)
      ])
      if (
        (sourceInventory?.version ?? 0) !== input.expectedSourceVersion ||
        (destinationInventory?.version ?? 0) !== input.expectedDestinationVersion
      )
        throw new Error('Inventory changed before this transfer completed.')

      payload = await transferPartyVehicleCustody(
        ctx,
        campaign,
        normalized,
        sourceVehicleId,
        destinationVehicleId
      )
      for (const owner of [
        { stored: sourceInventory, vehicleId: sourceVehicleId },
        { stored: destinationInventory, vehicleId: destinationVehicleId }
      ]) {
        const inventory = campaignStoredPartyInventorySchema.parse({
          campaignId: campaign.id,
          ...(owner.vehicleId === undefined ? {} : { vehicleId: owner.vehicleId }),
          version: (owner.stored?.version ?? 0) + 1
        })
        if (owner.stored) await ctx.db.patch(owner.stored._id, { version: inventory.version })
        else await ctx.db.insert('campaignPartyInventories', inventory)
      }
    }
    const eventId = crypto.randomUUID()
    await ctx.db.insert(
      'campaignEvents',
      campaignStoredEventSchema.parse({
        id: eventId,
        campaignId: campaign.id,
        actorUserId: userId,
        type: 'CUSTODY_TRANSFER',
        visibility: 'OWNER',
        subjectCharacterId:
          normalized.source.kind === 'CHARACTER'
            ? normalized.source.characterId
            : normalized.destination.kind === 'CHARACTER'
              ? normalized.destination.characterId
              : null,
        payloadJson: JSON.stringify(payload),
        visibleInHistory: true,
        inventoryAudit: true,
        commandId,
        inputFingerprint,
        createdAt: new Date().toISOString()
      })
    )
    return { eventId }
  }
})
