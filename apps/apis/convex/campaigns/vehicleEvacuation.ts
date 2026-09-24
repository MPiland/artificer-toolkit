import {
  campaignStoredPartyCurrencyGroupSchema,
  campaignStoredPartyCurrencySchema,
  campaignStoredPartyInventorySchema,
  campaignStoredPartyItemSchema
} from '@artificer-toolkit/schema/projections/campaignInventoryPersistence'
import type { MutationCtx } from '../_generated/server'
import type { Doc } from '../_generated/dataModel'
import {
  requireInventoryRowEditable,
  requireInventoryVehicleEditable
} from './inventoryCleanupGuards'

export interface CampaignVehicleEvacuationResult {
  vehicleId: string
  vehicleDefinitionId: string
  transferredTopLevelItemIds: string[]
  transferredCurrencyGroupIds: string[]
  sourceInventoryVersion: number
  destinationInventoryVersion: number
}

function balanceSlot(balance: Doc<'campaignPartyCurrencies'>): string {
  return `${balance.campaignCurrencySystemId ?? ''}:${balance.denominationId}`
}

export function assertCampaignVehicleCargo(
  campaignId: string,
  vehicleId: string,
  items: readonly Doc<'campaignPartyItems'>[],
  groups: readonly Doc<'campaignPartyCurrencyGroups'>[],
  balances: readonly Doc<'campaignPartyCurrencies'>[]
) {
  const itemsById = new Map<string, Doc<'campaignPartyItems'>>()
  for (const item of items) {
    const { _id, _creationTime, ...stored } = item
    const parsed = campaignStoredPartyItemSchema.parse(stored)
    if (parsed.campaignId !== campaignId || parsed.vehicleId !== vehicleId)
      throw new Error('Campaign Vehicle item scope is inconsistent.')
    if (itemsById.has(parsed.id)) throw new Error('Campaign Vehicle item IDs must be unique.')
    itemsById.set(parsed.id, item)
  }
  for (const item of items) {
    const visited = new Set<string>([item.id])
    let parentId = item.containerId
    while (parentId !== null) {
      if (visited.has(parentId))
        throw new Error('Campaign Vehicle item containers contain a cycle.')
      visited.add(parentId)
      const parent = itemsById.get(parentId)
      if (!parent) throw new Error('Campaign Vehicle item container is unavailable.')
      parentId = parent.containerId
    }
  }

  const groupsById = new Map<string, Doc<'campaignPartyCurrencyGroups'>>()
  for (const group of groups) {
    const { _id, _creationTime, ...stored } = group
    const parsed = campaignStoredPartyCurrencyGroupSchema.parse(stored)
    if (parsed.campaignId !== campaignId || parsed.vehicleId !== vehicleId)
      throw new Error('Campaign Vehicle currency group scope is inconsistent.')
    if (groupsById.has(parsed.id))
      throw new Error('Campaign Vehicle currency group IDs must be unique.')
    if (parsed.containerId !== null && !itemsById.has(parsed.containerId))
      throw new Error('Campaign Vehicle currency group container is unavailable.')
    groupsById.set(parsed.id, group)
  }
  const balanceIds = new Set<string>()
  for (const balance of balances) {
    if (balanceIds.has(balance.id)) throw new Error('Campaign Vehicle currency IDs must be unique.')
    balanceIds.add(balance.id)
    const { _id, _creationTime, ...stored } = balance
    const parsed = campaignStoredPartyCurrencySchema.parse(stored)
    if (parsed.campaignId !== campaignId || parsed.vehicleId !== vehicleId)
      throw new Error('Campaign Vehicle currency scope is inconsistent.')
    if (parsed.groupId !== undefined) {
      const group = groupsById.get(parsed.groupId)
      if (!group || parsed.containerId !== group.containerId)
        throw new Error('Campaign Vehicle currency group placement mismatch.')
    } else if (parsed.containerId !== null && !itemsById.has(parsed.containerId)) {
      throw new Error('Campaign Vehicle currency container is unavailable.')
    }
  }
}

/** Losslessly moves Vehicle custody to the party and removes the now-invalid instance. */
export async function evacuateCampaignVehicle(input: {
  ctx: MutationCtx
  campaignId: string
  vehicle: Doc<'campaignVehicles'>
}): Promise<CampaignVehicleEvacuationResult> {
  const { ctx, campaignId, vehicle } = input
  await requireInventoryVehicleEditable(ctx, campaignId, vehicle.id)
  if (vehicle.campaignId !== campaignId) throw new Error('Stored Campaign Vehicle scope mismatch.')
  const [sourceInventory, destinationInventory, items, groups, balances] = await Promise.all([
    ctx.db
      .query('campaignPartyInventories')
      .withIndex('by_campaignId_vehicleId', (q) =>
        q.eq('campaignId', campaignId).eq('vehicleId', vehicle.id)
      )
      .unique(),
    ctx.db
      .query('campaignPartyInventories')
      .withIndex('by_campaignId_vehicleId', (q) =>
        q.eq('campaignId', campaignId).eq('vehicleId', undefined)
      )
      .unique(),
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
  if ((items.length > 0 || groups.length > 0 || balances.length > 0) && !sourceInventory)
    throw new Error('Campaign Vehicle inventory owner is unavailable.')
  if (sourceInventory) {
    const { _id, _creationTime, ...stored } = sourceInventory
    campaignStoredPartyInventorySchema.parse(stored)
  }
  if (destinationInventory) {
    const { _id, _creationTime, ...stored } = destinationInventory
    campaignStoredPartyInventorySchema.parse(stored)
  }

  assertCampaignVehicleCargo(campaignId, vehicle.id, items, groups, balances)
  for (const item of items) await requireInventoryRowEditable(ctx, item)
  for (const group of groups) await requireInventoryRowEditable(ctx, group)
  for (const balance of balances) await requireInventoryRowEditable(ctx, balance)
  const mergeable = balances.filter(
    (balance) => balance.groupId === undefined && balance.containerId === null
  )
  const mergeSlots = new Map<string, Doc<'campaignPartyCurrencies'>[]>()
  for (const balance of mergeable) {
    const slot = balanceSlot(balance)
    mergeSlots.set(slot, [...(mergeSlots.get(slot) ?? []), balance])
  }
  const destinations = new Map<string, Doc<'campaignPartyCurrencies'> | null>()
  for (const [slot, sourceBalances] of mergeSlots) {
    const exemplar = sourceBalances[0]!
    const destination = await ctx.db
      .query('campaignPartyCurrencies')
      .withIndex('by_owner_system_denomination_container', (q) =>
        q
          .eq('campaignId', campaignId)
          .eq('vehicleId', undefined)
          .eq('campaignCurrencySystemId', exemplar.campaignCurrencySystemId)
          .eq('denominationId', exemplar.denominationId)
          .eq('groupId', undefined)
          .eq('containerId', null)
      )
      .unique()
    if (destination) {
      await requireInventoryRowEditable(ctx, destination)
      const { _id, _creationTime, ...stored } = destination
      campaignStoredPartyCurrencySchema.parse(stored)
    }
    const amount = sourceBalances.reduce((total, balance) => total + BigInt(balance.amount), 0n)
    const total = amount + BigInt(destination?.amount ?? 0)
    if (total > BigInt(Number.MAX_SAFE_INTEGER))
      throw new Error('Inventory amount exceeds the supported range.')
    destinations.set(slot, destination)
  }

  for (const item of items) await ctx.db.patch(item._id, { vehicleId: undefined })
  for (const group of groups) await ctx.db.patch(group._id, { vehicleId: undefined })
  for (const balance of balances.filter(
    (row) => row.groupId !== undefined || row.containerId !== null
  ))
    await ctx.db.patch(balance._id, { vehicleId: undefined })
  for (const [slot, sourceBalances] of mergeSlots) {
    const destination = destinations.get(slot) ?? null
    const total = sourceBalances.reduce((amount, balance) => amount + balance.amount, 0)
    if (destination) {
      await ctx.db.patch(destination._id, { amount: destination.amount + total })
      for (const balance of sourceBalances) await ctx.db.delete(balance._id)
    } else {
      const [retained, ...removed] = sourceBalances
      await ctx.db.patch(retained!._id, { vehicleId: undefined, amount: total })
      for (const balance of removed) await ctx.db.delete(balance._id)
    }
  }

  // The source owner's terminal logical version is audited even though its row is then removed.
  const sourceInventoryVersion = (sourceInventory?.version ?? 0) + 1
  const destinationInventoryVersion = (destinationInventory?.version ?? 0) + 1
  if (destinationInventory)
    await ctx.db.patch(destinationInventory._id, { version: destinationInventoryVersion })
  else
    await ctx.db.insert(
      'campaignPartyInventories',
      campaignStoredPartyInventorySchema.parse({
        campaignId,
        version: destinationInventoryVersion
      })
    )
  if (sourceInventory) await ctx.db.delete(sourceInventory._id)
  await ctx.db.delete(vehicle._id)
  return {
    vehicleId: vehicle.id,
    vehicleDefinitionId: vehicle.vehicleDefinitionId,
    transferredTopLevelItemIds: items
      .filter((item) => item.containerId === null)
      .map((item) => item.id)
      .sort(),
    transferredCurrencyGroupIds: groups.map((group) => group.id).sort(),
    sourceInventoryVersion,
    destinationInventoryVersion
  }
}
