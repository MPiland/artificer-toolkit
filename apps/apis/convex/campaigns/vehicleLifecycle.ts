import type {
  CampaignVehicleLifecycleInput,
  CampaignVehicleLifecycleResult
} from '@artificer-toolkit/schema/api/campaignVehicles'
import {
  campaignVehicleLifecyclePayloadSchema,
  type CampaignVehicleLifecyclePayload
} from '@artificer-toolkit/schema/api/campaignVehicles'
import { campaignStoredPartyInventorySchema } from '@artificer-toolkit/schema/projections/campaignInventoryPersistence'
import { campaignStoredEventSchema } from '@artificer-toolkit/schema/projections/campaignEventPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { Doc } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { requireCampaignAuthority } from './authority'
import { readCampaignInventory } from './partyInventoryDocuments'
import { evacuateCampaignVehicle, assertCampaignVehicleCargo } from './vehicleEvacuation'
import { campaignStoredVehicleSchema } from '@artificer-toolkit/schema/projections/campaignVehicleCleanupPersistence'
import { beginVehicleCleanup, probeVehicleCleanup } from './vehicleCleanup'
import { readVehicleCleanupJob } from './vehicleCleanupDocuments'
import {
  requireInventoryRowEditable,
  requireInventoryVehicleEditable
} from './inventoryCleanupGuards'

const lifecycleType = 'VEHICLE_LIFECYCLE'

function availability(
  vehicle: Pick<Doc<'campaignVehicles'>, 'availability'>
): 'AVAILABLE' | 'UNAVAILABLE' {
  return vehicle.availability ?? 'AVAILABLE'
}

async function destroyVehicleCargo(
  ctx: MutationCtx,
  campaignId: string,
  vehicle: Doc<'campaignVehicles'>,
  inventory: Doc<'campaignPartyInventories'> | null
) {
  const [items, groups, balances] = await Promise.all([
    ctx.db
      .query('campaignPartyItems')
      .withIndex('by_campaignId_vehicleId_id', (q) =>
        q.eq('campaignId', campaignId).eq('vehicleId', vehicle.id)
      )
      .collect(),
    ctx.db
      .query('campaignPartyCurrencyGroups')
      .withIndex('by_campaignId_vehicleId_id', (q) =>
        q.eq('campaignId', campaignId).eq('vehicleId', vehicle.id)
      )
      .collect(),
    ctx.db
      .query('campaignPartyCurrencies')
      .withIndex('by_campaignId_vehicleId_id', (q) =>
        q.eq('campaignId', campaignId).eq('vehicleId', vehicle.id)
      )
      .collect()
  ])
  if ((items.length > 0 || groups.length > 0 || balances.length > 0) && !inventory)
    throw new Error('Campaign Vehicle inventory owner is unavailable.')
  if (inventory) {
    const { _id, _creationTime, ...stored } = inventory
    const parsed = campaignStoredPartyInventorySchema.parse(stored)
    if (parsed.campaignId !== campaignId || parsed.vehicleId !== vehicle.id)
      throw new Error('Campaign Vehicle inventory scope is inconsistent.')
  }

  assertCampaignVehicleCargo(campaignId, vehicle.id, items, groups, balances)
  for (const item of items) await requireInventoryRowEditable(ctx, item)
  for (const group of groups) await requireInventoryRowEditable(ctx, group)
  for (const balance of balances) await requireInventoryRowEditable(ctx, balance)
  for (const balance of balances) await ctx.db.delete(balance._id)
  for (const group of groups) await ctx.db.delete(group._id)
  for (const item of items) await ctx.db.delete(item._id)
  if (inventory) await ctx.db.delete(inventory._id)
  await ctx.db.delete(vehicle._id)
  return {
    itemCount: items.length,
    currencyGroupCount: groups.length,
    currencyCount: balances.length
  }
}

export async function executeCampaignVehicleLifecycle(
  ctx: MutationCtx,
  input: CampaignVehicleLifecycleInput,
  userId: string
): Promise<CampaignVehicleLifecycleResult> {
  const campaignId = input.campaignId.toLowerCase()
  const vehicleId = input.vehicleId.toLowerCase()
  const commandId = input.idempotencyKey.toLowerCase()
  const { campaign, membership } = await requireCampaignAuthority(ctx, campaignId, userId)
  if (membership.role !== 'OWNER') throw new Error('Only the Campaign owner can manage Vehicles.')
  if (campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
  const normalized = { ...input, campaignId: campaign.id, vehicleId, idempotencyKey: commandId }
  const inputFingerprint = checksumCanonicalJson({ ...normalized, actorId: userId })
  const priorJobs = await ctx.db
    .query('campaignVehicleCleanupJobs')
    .withIndex('by_campaignId_commandId', (q) =>
      q.eq('grant.campaignId', campaign.id).eq('grant.commandId', commandId)
    )
    .take(2)
  if (priorJobs.length > 1) throw new Error('This command ID has duplicate cleanup receipts.')
  const cleanupReceipt = priorJobs[0]
    ? await readVehicleCleanupJob(ctx, priorJobs[0].id, campaign.id)
    : null
  if (
    cleanupReceipt &&
    (cleanupReceipt.grant.commandId !== commandId ||
      cleanupReceipt.grant.vehicleId !== vehicleId ||
      cleanupReceipt.grant.actorUserId !== userId ||
      cleanupReceipt.grant.inputFingerprint !== inputFingerprint ||
      cleanupReceipt.status === 'PURGED')
  )
    throw new Error('This command ID was already used with different input.')
  const prior = await ctx.db
    .query('campaignEvents')
    .withIndex('by_campaignId_commandId', (q) =>
      q.eq('campaignId', campaign.id).eq('commandId', commandId)
    )
    .unique()
  if (prior) {
    const { _id, _creationTime, ...stored } = prior
    const receipt = campaignStoredEventSchema.parse(stored)
    if (
      receipt.campaignId !== campaign.id ||
      receipt.type !== lifecycleType ||
      receipt.visibility !== 'OWNER' ||
      receipt.subjectCharacterId !== null ||
      receipt.commandId !== commandId ||
      receipt.actorUserId !== userId ||
      receipt.inputFingerprint !== inputFingerprint ||
      !receipt.inventoryAudit
    )
      throw new Error('This command ID was already used with different input.')
    if (
      cleanupReceipt &&
      (cleanupReceipt.status !== 'COMPLETED' || cleanupReceipt.grant.eventId !== receipt.id)
    )
      throw new Error('Campaign Vehicle cleanup receipt is inconsistent.')
    return { eventId: receipt.id, ...(cleanupReceipt ? { cleanupJobId: cleanupReceipt.id } : {}) }
  }
  if (cleanupReceipt) {
    if (cleanupReceipt.status === 'COMPLETED')
      throw new Error('Campaign Vehicle cleanup event is unavailable.')
    return { eventId: cleanupReceipt.grant.eventId, cleanupJobId: cleanupReceipt.id }
  }
  const vehicle = await ctx.db
    .query('campaignVehicles')
    .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaign.id).eq('id', vehicleId))
    .unique()
  if (!vehicle) throw new Error('Campaign Vehicle is unavailable.')
  const { _id, _creationTime, ...storedVehicle } = vehicle
  const metadata = campaignStoredVehicleSchema.parse(storedVehicle)
  if (metadata.campaignId !== campaign.id || metadata.id !== vehicleId)
    throw new Error('Campaign Vehicle scope is inconsistent.')
  await requireInventoryVehicleEditable(ctx, campaign.id, vehicleId)
  if (metadata.version !== input.expectedVersion)
    throw new Error('Campaign Vehicle changed before this action completed.')

  const eventId = crypto.randomUUID()
  const occurredAt = new Date().toISOString()
  let payload: CampaignVehicleLifecyclePayload
  if (input.action === 'MAKE_UNAVAILABLE' || input.action === 'RESTORE') {
    const nextAvailability = input.action === 'MAKE_UNAVAILABLE' ? 'UNAVAILABLE' : 'AVAILABLE'
    if (availability(metadata) === nextAvailability)
      throw new Error(`Campaign Vehicle is already ${nextAvailability.toLowerCase()}.`)
    await ctx.db.patch(vehicle._id, {
      availability: nextAvailability,
      version: metadata.version + 1,
      updatedAt: new Date(Math.max(Date.now(), Date.parse(metadata.updatedAt) + 1)).toISOString()
    })
    payload =
      input.action === 'MAKE_UNAVAILABLE'
        ? { action: input.action, vehicleId: metadata.id, availability: 'UNAVAILABLE' }
        : { action: input.action, vehicleId: metadata.id, availability: 'AVAILABLE' }
  } else {
    const [inventory, partyInventory] = await Promise.all([
      readCampaignInventory(ctx, campaign.id, vehicle.id),
      input.action === 'REMOVE_RETURN_CARGO'
        ? readCampaignInventory(ctx, campaign.id)
        : Promise.resolve(null)
    ])
    if ((inventory?.version ?? 0) !== input.expectedInventoryVersion)
      throw new Error('Vehicle inventory changed before this action completed.')
    if (
      input.action === 'REMOVE_RETURN_CARGO' &&
      (partyInventory?.version ?? 0) !== input.expectedPartyInventoryVersion
    )
      throw new Error('Party inventory changed before this action completed.')
    const mode = input.action === 'REMOVE_RETURN_CARGO' ? 'RETURN' : 'DESTROY'
    if (!(await probeVehicleCleanup(ctx, campaign.id, vehicle.id, mode)).ordinary) {
      const acknowledgement = await beginVehicleCleanup(ctx, {
        campaignId: campaign.id,
        campaignVersion: campaign.version,
        vehicleId: vehicle.id,
        vehicleVersion: metadata.version,
        sourceInventoryVersion: inventory?.version ?? 0,
        actorUserId: userId,
        eventId,
        commandId,
        inputFingerprint,
        mode,
        beforeAvailability: availability(metadata),
        label: metadata.label,
        vehicleDefinitionId: metadata.vehicleDefinitionId
      })
      return { eventId, cleanupJobId: acknowledgement.jobId }
    }
    if (input.action === 'REMOVE_RETURN_CARGO') {
      const result = await evacuateCampaignVehicle({ ctx, campaignId: campaign.id, vehicle })
      payload = {
        action: input.action,
        vehicleId: result.vehicleId,
        vehicleDefinitionId: result.vehicleDefinitionId,
        transferredTopLevelItemIds: result.transferredTopLevelItemIds,
        transferredCurrencyGroupIds: result.transferredCurrencyGroupIds,
        sourceInventoryVersion: result.sourceInventoryVersion,
        destinationInventoryVersion: result.destinationInventoryVersion
      }
    } else {
      const result = await destroyVehicleCargo(ctx, campaign.id, vehicle, inventory)
      payload = { action: input.action, vehicleId: vehicle.id, ...result }
    }
  }
  await ctx.db.insert(
    'campaignEvents',
    campaignStoredEventSchema.parse({
      id: eventId,
      campaignId: campaign.id,
      actorUserId: userId,
      type: lifecycleType,
      visibility: 'OWNER',
      subjectCharacterId: null,
      payloadJson: JSON.stringify(campaignVehicleLifecyclePayloadSchema.parse(payload)),
      visibleInHistory: true,
      inventoryAudit: true,
      commandId,
      inputFingerprint,
      createdAt: occurredAt
    })
  )
  return { eventId }
}
