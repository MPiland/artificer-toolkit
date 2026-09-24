import { versionSchema } from '@artificer-toolkit/schema/api/campaignContractSchemas'
import type { InventoryOwnerRefDto } from '@artificer-toolkit/schema/api/campaignInventory'
import { campaignStoredPartyInventorySchema } from '@artificer-toolkit/schema/projections/campaignInventoryPersistence'
import { canonicalizeRuleDocument, checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { readCharacterRecord, characterDocumentSchema } from '../characters/stateDocuments'
import type { Doc } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { readAssignedInventoryCharacter } from './inventoryCharacter'
import { readCampaignInventory } from './partyInventoryDocuments'
import { requireCampaignVehicleCargoAccess } from './vehicleDocuments'
import { requireInventoryVehicleEditable } from './inventoryCleanupGuards'

type BaseOwner = { ref: InventoryOwnerRefDto; version: number }
export type InventoryCustodyOwner = BaseOwner &
  (
    | {
        kind: 'CHARACTER'
        record: Doc<'characters'>
        character: ReturnType<typeof readCharacterRecord>
      }
    | {
        kind: 'SHARED'
        vehicleId: string | undefined
        inventory: Doc<'campaignPartyInventories'> | null
      }
  )

export async function readInventoryCustodyOwner(
  ctx: QueryCtx,
  campaign: Doc<'campaigns'>,
  member: Doc<'campaignMemberships'>,
  ref: InventoryOwnerRefDto,
  access: 'SOURCE' | 'DESTINATION'
): Promise<InventoryCustodyOwner> {
  if (ref.kind === 'CHARACTER') {
    const { record, character } = await readAssignedInventoryCharacter(
      ctx,
      campaign,
      member,
      ref.characterId,
      access
    )
    return {
      kind: 'CHARACTER',
      ref: { kind: 'CHARACTER', characterId: record.id },
      record,
      character,
      version: versionSchema.parse(record.streamVersion)
    }
  }
  if (ref.kind === 'CAMPAIGN' && ref.campaignId.toLowerCase() !== campaign.id)
    throw new Error('Inventory owner is unavailable in this Campaign.')
  const vehicleId = ref.kind === 'VEHICLE' ? ref.vehicleId.toLowerCase() : undefined
  if (vehicleId !== undefined) {
    if (access === 'SOURCE' && member.role !== 'OWNER')
      throw new Error('Only the Campaign owner can transfer Vehicle cargo.')
    await requireCampaignVehicleCargoAccess(ctx, campaign, member, vehicleId)
    await requireInventoryVehicleEditable(ctx, campaign.id, vehicleId)
  }
  const inventory = await readCampaignInventory(ctx, campaign.id, vehicleId)
  return {
    kind: 'SHARED',
    vehicleId,
    inventory,
    version: versionSchema.parse(inventory?.version ?? 0),
    ref:
      vehicleId === undefined
        ? { kind: 'CAMPAIGN', campaignId: campaign.id }
        : { kind: 'VEHICLE', vehicleId }
  }
}

/** Mechanics, both canonical owner fences and the Campaign receipt share the caller's mutation. */
export async function publishInventoryCustodyOwners(
  ctx: MutationCtx,
  campaign: Doc<'campaigns'>,
  owners: readonly InventoryCustodyOwner[]
) {
  for (const owner of owners) {
    const version = versionSchema.parse(owner.version + 1)
    if (owner.kind === 'CHARACTER') {
      const updatedAt = Date.parse(owner.record.updatedAt)
      if (!Number.isFinite(updatedAt)) throw new Error('Stored Character update time is invalid.')
      const character = characterDocumentSchema.parse(owner.character)
      const document: unknown = JSON.parse(JSON.stringify(character))
      await ctx.db.patch(owner.record._id, {
        streamVersion: version,
        documentJson: canonicalizeRuleDocument(document),
        checksum: checksumRuleDocument(document),
        updatedAt: new Date(Math.max(Date.now(), updatedAt + 1)).toISOString()
      })
    } else {
      const inventory = campaignStoredPartyInventorySchema.parse({
        campaignId: campaign.id,
        ...(owner.vehicleId === undefined ? {} : { vehicleId: owner.vehicleId }),
        version
      })
      if (owner.inventory) await ctx.db.patch(owner.inventory._id, { version })
      else await ctx.db.insert('campaignPartyInventories', inventory)
    }
  }
}
