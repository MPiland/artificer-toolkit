import { planInventoryItemTransfer } from '@artificer-toolkit/rules-runtime/character/inventoryItemTransfer'
import type { CampaignEventDto } from '@artificer-toolkit/schema/api/campaignLiveState'
import type { TransferCampaignInventoryInput } from '@artificer-toolkit/schema/api/campaignInventory'
import {
  campaignStoredPartyCurrencyGroupSchema,
  campaignStoredPartyCurrencySchema,
  campaignStoredPartyItemSchema
} from '@artificer-toolkit/schema/projections/campaignInventoryPersistence'
import type { Doc } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import {
  readCampaignCurrencyPlacement,
  readCampaignCurrencyGroup,
  readPartyDenomination,
  readHeldPartyEquipment
} from './partyInventoryDocuments'
import { retainPartyEquipmentRules } from './partyEquipmentRetention'
import {
  requireInventoryRowEditable,
  requireInventoryVehicleEditable,
  readInventoryRowAvailable
} from './inventoryCleanupGuards'

/** Reads and validates the selected Shared inventory item and every carried descendant, group, and balance. */
export async function readPartyVehicleItemForest(
  ctx: MutationCtx,
  campaign: Doc<'campaigns'>,
  vehicleId: string | undefined,
  itemId: string
) {
  await requireInventoryVehicleEditable(ctx, campaign.id, vehicleId)
  const item = await ctx.db
    .query('campaignPartyItems')
    .withIndex('by_campaignId_vehicleId_id', (q) =>
      q.eq('campaignId', campaign.id).eq('vehicleId', vehicleId).eq('id', itemId)
    )
    .unique()
  if (!item) throw new Error('Item is not available.')
  await requireInventoryRowEditable(ctx, item)
  const { _id, _creationTime, ...storedItem } = item
  campaignStoredPartyItemSchema.parse(storedItem)
  const equipment = await readHeldPartyEquipment(ctx, campaign, item)
  item.retainedRulesJson = await retainPartyEquipmentRules(ctx, campaign, item)

  const items = [item]
  const itemIds = new Set([item.id])
  const populatedItemIds = new Set<string>()
  const groups: Doc<'campaignPartyCurrencyGroups'>[] = []
  const balances: Doc<'campaignPartyCurrencies'>[] = []
  for (let index = 0; index < items.length; index += 1) {
    const container = items[index]!
    const identity = await ctx.db
      .query('campaignPartyItems')
      .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaign.id).eq('id', container.id))
      .unique()
    if (identity?._id !== container._id)
      throw new Error('Stored inventory item identity is inconsistent.')
    for await (const child of ctx.db
      .query('campaignPartyItems')
      .withIndex('by_campaignId_vehicleId_containerId', (q) =>
        q.eq('campaignId', campaign.id).eq('vehicleId', vehicleId).eq('containerId', container.id)
      )) {
      if (itemIds.has(child.id))
        throw new Error('Stored inventory contains a container cycle or duplicate item.')
      await requireInventoryRowEditable(ctx, child)
      const { _id, _creationTime, ...storedChild } = child
      campaignStoredPartyItemSchema.parse(storedChild)
      await readHeldPartyEquipment(ctx, campaign, child)
      child.retainedRulesJson = await retainPartyEquipmentRules(ctx, campaign, child)
      itemIds.add(child.id)
      populatedItemIds.add(container.id)
      items.push(child)
    }
    for await (const group of ctx.db
      .query('campaignPartyCurrencyGroups')
      .withIndex('by_campaignId_vehicleId_containerId', (q) =>
        q.eq('campaignId', campaign.id).eq('vehicleId', vehicleId).eq('containerId', container.id)
      )) {
      await requireInventoryRowEditable(ctx, group)
      const { _id, _creationTime, ...storedGroup } = group
      campaignStoredPartyCurrencyGroupSchema.parse(storedGroup)
      await readCampaignCurrencyGroup(ctx, campaign.id, vehicleId, group.id)
      const groupCurrencyIdentities = new Set<string>()
      for await (const balance of ctx.db
        .query('campaignPartyCurrencies')
        .withIndex('by_campaignId_vehicleId_groupId_id', (q) =>
          q.eq('campaignId', campaign.id).eq('vehicleId', vehicleId).eq('groupId', group.id)
        )) {
        await requireInventoryRowEditable(ctx, balance)
        if (balance.containerId !== container.id)
          throw new Error('Stored Campaign currency group placement mismatch.')
        const currencyIdentity = JSON.stringify([
          balance.denominationId,
          balance.campaignCurrencySystemId ?? null
        ])
        if (groupCurrencyIdentities.has(currencyIdentity))
          throw new Error('Stored Campaign currency group has duplicate balances.')
        groupCurrencyIdentities.add(currencyIdentity)
      }
      populatedItemIds.add(container.id)
      groups.push(group)
    }
    for await (const balance of ctx.db
      .query('campaignPartyCurrencies')
      .withIndex('by_campaignId_vehicleId_containerId', (q) =>
        q.eq('campaignId', campaign.id).eq('vehicleId', vehicleId).eq('containerId', container.id)
      )) {
      await requireInventoryRowEditable(ctx, balance)
      const { _id, _creationTime, ...storedBalance } = balance
      campaignStoredPartyCurrencySchema.parse(storedBalance)
      await readCampaignCurrencyPlacement(ctx, balance)
      populatedItemIds.add(container.id)
      balances.push(balance)
    }
  }
  return { item, equipment, items, groups, balances, populatedItemIds }
}
/** Caller has authorized the Campaign and verified both party or Vehicle inventory owners. */
export async function transferPartyVehicleCustody(
  ctx: MutationCtx,
  campaign: Doc<'campaigns'>,
  input: TransferCampaignInventoryInput,
  sourceVehicleId: string | undefined,
  destinationVehicleId: string | undefined
): Promise<CampaignEventDto['payload']> {
  await requireInventoryVehicleEditable(ctx, campaign.id, sourceVehicleId)
  await requireInventoryVehicleEditable(ctx, campaign.id, destinationVehicleId)
  const sourceOwnerId = sourceVehicleId ?? campaign.id
  const destinationOwnerId = destinationVehicleId ?? campaign.id
  const custodyContext = { sourceOwnerId, destinationOwnerId }

  if (input.kind === 'ITEM') {
    const itemId = input.itemId.toLowerCase()
    const { item, equipment, items, groups, balances, populatedItemIds } =
      await readPartyVehicleItemForest(ctx, campaign, sourceVehicleId, itemId)
    if (input.amount > item.quantity) throw new Error('Item is not available.')

    const plan = planInventoryItemTransfer({
      itemId,
      amount: input.amount,
      sourceItems: items.map((item) => {
        const {
          _id: _recordId,
          _creationTime: _recordTime,
          campaignId: _campaignId,
          vehicleId: _vehicleId,
          cleanupJobId: _cleanupJobId,
          ...held
        } = item
        return held
      }),
      occupiedContainerIds: populatedItemIds
    })
    const originalById = new Map(items.map((held) => [held.id, held]))
    for (const [heldItems, vehicleId] of [
      [plan.sourceItems, sourceVehicleId],
      [plan.destinationItems, destinationVehicleId]
    ] as const) {
      for (const held of heldItems) {
        const original = originalById.get(held.id)
        if (original)
          await ctx.db.patch(original._id, {
            ...held,
            vehicleId,
            ...(vehicleId === sourceVehicleId ? {} : { cleanupJobId: undefined })
          })
        else
          await ctx.db.insert(
            'campaignPartyItems',
            campaignStoredPartyItemSchema.parse({
              ...held,
              campaignId: campaign.id,
              ...(vehicleId === undefined ? {} : { vehicleId })
            })
          )
      }
    }
    for (const group of groups)
      await ctx.db.patch(group._id, { vehicleId: destinationVehicleId, cleanupJobId: undefined })
    for (const balance of balances)
      await ctx.db.patch(balance._id, { vehicleId: destinationVehicleId, cleanupJobId: undefined })

    return {
      kind: input.kind,
      action: 'CUSTODY_TRANSFER',
      source: input.source,
      destination: input.destination,
      custodyContext,
      itemId,
      itemLabel: item.customName ?? equipment.label,
      amount: input.amount,
      beforeQuantity: item.quantity,
      afterSourceQuantity: item.quantity - input.amount,
      afterDestinationQuantity: input.amount
    }
  }

  const denominationId = input.denominationId.toLowerCase()
  const { denomination, campaignCurrencySystemId } = await readPartyDenomination(
    ctx,
    campaign,
    denominationId,
    typeof input.campaignCurrencySystemId === 'string'
      ? input.campaignCurrencySystemId.toLowerCase()
      : input.campaignCurrencySystemId
  )
  const readBalances = async (vehicleId: string | undefined, access: 'SOURCE' | 'DESTINATION') => {
    const balances: Doc<'campaignPartyCurrencies'>[] = []
    let cursor: string | null = null
    // Complete indexed batches retain exact totals; transaction limits fail atomically, never truncate balances.
    while (true) {
      const batch: Doc<'campaignPartyCurrencies'>[] = await ctx.db
        .query('campaignPartyCurrencies')
        .withIndex('by_owner_system_denomination_id', (q) => {
          const scope = q
            .eq('campaignId', campaign.id)
            .eq('vehicleId', vehicleId)
            .eq('campaignCurrencySystemId', campaignCurrencySystemId)
            .eq('denominationId', denominationId)
          return cursor === null ? scope : scope.gt('id', cursor)
        })
        .take(48)
      for (const balance of batch) {
        const { _id, _creationTime, ...stored } = balance
        campaignStoredPartyCurrencySchema.parse(stored)
        const available = await readInventoryRowAvailable(ctx, balance)
        if (
          access === 'SOURCE' &&
          (available || (balance.groupId === undefined && balance.containerId === null))
        )
          await requireInventoryRowEditable(ctx, balance)
        await readCampaignCurrencyPlacement(ctx, balance)
        if (available) balances.push(balance)
      }
      if (batch.length < 48) return balances
      cursor = batch.at(-1)!.id
    }
  }
  const [sourceBalances, destinationBalances] = await Promise.all([
    readBalances(sourceVehicleId, 'SOURCE'),
    readBalances(destinationVehicleId, 'DESTINATION')
  ])
  const sourceBeforeAmount = sourceBalances.reduce(
    (total, balance) => total + BigInt(balance.amount),
    0n
  )
  const amount = BigInt(input.amount)
  if (sourceBeforeAmount < amount)
    throw new Error('Party inventory does not contain enough currency.')

  const destination = await ctx.db
    .query('campaignPartyCurrencies')
    .withIndex('by_owner_system_denomination_container', (q) =>
      q
        .eq('campaignId', campaign.id)
        .eq('vehicleId', destinationVehicleId)
        .eq('campaignCurrencySystemId', campaignCurrencySystemId)
        .eq('denominationId', denominationId)
        .eq('groupId', undefined)
        .eq('containerId', null)
    )
    .unique()
  if (destination) {
    await requireInventoryRowEditable(ctx, destination)
    const { _id, _creationTime, ...stored } = destination
    campaignStoredPartyCurrencySchema.parse(stored)
    await readCampaignCurrencyPlacement(ctx, destination)
  }
  const destinationBeforeAmount = destinationBalances.reduce(
    (total, balance) => total + BigInt(balance.amount),
    0n
  )
  const destinationSlotAmount = BigInt(destination?.amount ?? 0) + amount
  if (destinationSlotAmount > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error('Inventory amount exceeds the supported range.')

  let remaining = amount
  for (const balance of sourceBalances) {
    if (remaining === 0n) break
    const used = BigInt(balance.amount) < remaining ? BigInt(balance.amount) : remaining
    if (used === 0n) continue
    const nextAmount = BigInt(balance.amount) - used
    if (nextAmount === 0n) await ctx.db.delete(balance._id)
    else await ctx.db.patch(balance._id, { amount: Number(nextAmount) })
    remaining -= used
  }
  if (destination)
    await ctx.db.patch(destination._id, {
      amount: Number(destinationSlotAmount)
    })
  else
    await ctx.db.insert(
      'campaignPartyCurrencies',
      campaignStoredPartyCurrencySchema.parse({
        campaignId: campaign.id,
        ...(destinationVehicleId === undefined ? {} : { vehicleId: destinationVehicleId }),
        id: crypto.randomUUID(),
        denominationId,
        ...(campaignCurrencySystemId === undefined ? {} : { campaignCurrencySystemId }),
        amount: Number(destinationSlotAmount),
        containerId: null
      })
    )

  return {
    kind: input.kind,
    action: 'CUSTODY_TRANSFER',
    source: input.source,
    destination: input.destination,
    custodyContext,
    denominationId,
    ...(campaignCurrencySystemId === undefined ? {} : { campaignCurrencySystemId }),
    denominationLabel: denomination.label,
    amount: input.amount,
    beforeAmount: sourceBeforeAmount.toString(),
    afterSourceAmount: (sourceBeforeAmount - amount).toString(),
    beforeDestinationAmount: destinationBeforeAmount.toString(),
    afterDestinationAmount: (destinationBeforeAmount + amount).toString()
  }
}
