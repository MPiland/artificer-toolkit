import {
  campaignContentRemovalReceiptDtoSchema,
  type CampaignContentRemovalReceiptDto
} from '@artificer-toolkit/schema/api/campaignCore'
import { campaignStoredEventSchema } from '@artificer-toolkit/schema/projections/campaignEventPersistence'
import type { Doc } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import type { CharacterSourceLossResult } from '../characters/sourceLoss'
import { evacuateCampaignVehicle } from './vehicleEvacuation'
import { beginVehicleCleanup, probeVehicleCleanup } from './vehicleCleanup'
import { readVehicleCleanupLock } from './vehicleCleanupDocuments'
import { campaignStoredVehicleSchema } from '@artificer-toolkit/schema/projections/campaignVehicleCleanupPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { readCampaignInventory } from './partyInventoryDocuments'

/** Writes the common Campaign consequences after a producer has removed source visibility. */
export async function finalizeCampaignContentRemoval(input: {
  ctx: MutationCtx
  campaign: Doc<'campaigns'>
  actorUserId: string
  reason: 'UNSHARE' | 'AUTHORED_DELETED' | 'MEMBER_LEFT' | 'MEMBER_REMOVED'
  departingMembership?: Pick<Doc<'campaignMemberships'>, 'userId' | 'accessStartedAt'>
  removedShares: CampaignContentRemovalReceiptDto['removedShares']
  characterResults: CharacterSourceLossResult[]
  vehicles: Doc<'campaignVehicles'>[]
  commandId?: string
  inputFingerprint?: string
}): Promise<CampaignContentRemovalReceiptDto> {
  const {
    ctx,
    campaign,
    actorUserId,
    reason,
    departingMembership,
    removedShares,
    characterResults,
    vehicles,
    commandId,
    inputFingerprint
  } = input
  const memberDeparture = reason === 'MEMBER_LEFT' || reason === 'MEMBER_REMOVED'
  if (memberDeparture && !departingMembership)
    throw new Error('Campaign departure membership identity is required.')
  if ((removedShares.length > 0 || memberDeparture) && (!commandId || !inputFingerprint))
    throw new Error('Campaign content-removal event identity is required.')
  const eventId = crypto.randomUUID()
  const occurredAt = new Date().toISOString()
  const campaignVersion = campaign.version + 1
  const evacuatedVehicles: CampaignContentRemovalReceiptDto['evacuatedVehicles'] = []
  const pendingVehicleCleanupIds: string[] = []
  for (const vehicle of vehicles.sort((left, right) => left.id.localeCompare(right.id))) {
    const lock = await readVehicleCleanupLock(ctx, vehicle)
    if (lock) {
      // Source/account loss joins the original captured command, including DESTROY, without re-granting it.
      pendingVehicleCleanupIds.push(lock.jobId)
      continue
    }
    if (!(await probeVehicleCleanup(ctx, campaign.id, vehicle.id, 'RETURN', true)).ordinary) {
      const { _id, _creationTime, ...stored } = vehicle
      const metadata = campaignStoredVehicleSchema.parse(stored)
      const inventory = await readCampaignInventory(ctx, campaign.id, vehicle.id)
      const acknowledgement = await beginVehicleCleanup(ctx, {
        campaignId: campaign.id,
        campaignVersion: campaign.version,
        vehicleId: vehicle.id,
        vehicleVersion: metadata.version,
        sourceInventoryVersion: inventory?.version ?? 0,
        actorUserId,
        eventId: crypto.randomUUID(),
        removalEventId: eventId,
        mode: 'RETURN',
        inputFingerprint: checksumCanonicalJson({
          operation: 'SOURCE_LOSS_VEHICLE_CLEANUP',
          removalEventId: eventId,
          parentInputFingerprint: inputFingerprint ?? null,
          vehicleId: vehicle.id,
          reason
        }),
        beforeAvailability: metadata.availability ?? 'AVAILABLE',
        label: metadata.label,
        vehicleDefinitionId: metadata.vehicleDefinitionId
      })
      pendingVehicleCleanupIds.push(acknowledgement.jobId)
      continue
    }
    const result = await evacuateCampaignVehicle({ ctx, campaignId: campaign.id, vehicle })
    evacuatedVehicles.push({
      vehicleId: result.vehicleId,
      vehicleDefinitionId: result.vehicleDefinitionId,
      transferredTopLevelItemIds: result.transferredTopLevelItemIds,
      transferredCurrencyGroupIds: result.transferredCurrencyGroupIds
    })
    await ctx.db.insert(
      'campaignEvents',
      campaignStoredEventSchema.parse({
        id: crypto.randomUUID(),
        campaignId: campaign.id,
        actorUserId,
        type: 'CAMPAIGN_VEHICLE_EVACUATED',
        visibility: 'OWNER',
        subjectCharacterId: null,
        payloadJson: JSON.stringify({
          reason: reason === 'UNSHARE' ? 'UNSHARED' : reason,
          removalEventId: eventId,
          formerCampaignVehicleId: result.vehicleId,
          authoredVehicleId: result.vehicleDefinitionId,
          transferredTopLevelItemIds: result.transferredTopLevelItemIds,
          transferredCurrencyGroupIds: result.transferredCurrencyGroupIds,
          sourceInventoryVersion: result.sourceInventoryVersion,
          destinationInventoryVersion: result.destinationInventoryVersion,
          resultingCampaignVersion: campaignVersion
        }),
        visibleInHistory: true,
        createdAt: occurredAt
      })
    )
  }
  const affectedCharacters: CampaignContentRemovalReceiptDto['affectedCharacters'] = []
  for (const result of characterResults.sort((left, right) =>
    left.characterId.localeCompare(right.characterId)
  )) {
    affectedCharacters.push({
      characterId: result.characterId,
      status: result.status,
      streamVersion: result.streamVersion
    })
    await ctx.db.insert(
      'campaignEvents',
      campaignStoredEventSchema.parse({
        id: crypto.randomUUID(),
        campaignId: campaign.id,
        actorUserId,
        type: 'CAMPAIGN_CHARACTER_RECONCILED',
        visibility: 'SUBJECT',
        subjectCharacterId: result.characterId,
        payloadJson: JSON.stringify({
          reason,
          removalEventId: eventId,
          removedSources: result.removedSources,
          status: result.status,
          streamVersion: result.streamVersion,
          draftOnly: result.draftOnly
        }),
        visibleInHistory: true,
        createdAt: occurredAt
      })
    )
  }
  const receipt = campaignContentRemovalReceiptDtoSchema.parse({
    eventId,
    campaignVersion,
    removedShares,
    affectedCharacters,
    evacuatedVehicles,
    ...(pendingVehicleCleanupIds.length ? { pendingVehicleCleanupIds } : {})
  })
  await ctx.db.patch(campaign._id, {
    version: campaignVersion,
    updatedAt: new Date(Math.max(Date.now(), Date.parse(campaign.updatedAt) + 1)).toISOString()
  })
  if (removedShares.length > 0 || memberDeparture) {
    await ctx.db.insert(
      'campaignEvents',
      campaignStoredEventSchema.parse({
        id: eventId,
        campaignId: campaign.id,
        actorUserId,
        type: 'CAMPAIGN_CONTENT_SHARES_REMOVED',
        visibility: memberDeparture ? 'OWNER' : 'TABLE',
        subjectCharacterId: null,
        payloadJson: JSON.stringify(
          memberDeparture
            ? { reason, departingMembership, receipt }
            : reason === 'UNSHARE'
              ? { receipt }
              : { reason, receipt }
        ),
        visibleInHistory: true,
        commandId,
        inputFingerprint,
        createdAt: occurredAt
      })
    )
  }
  return receipt
}
