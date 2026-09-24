import { zodToConvex } from 'convex-helpers/server/zod4'
import {
  campaignPartyInventoryMutationInputSchema,
  campaignPartyInventoryMutationResultDtoSchema,
  inventoryItemDtoSchema
} from '@artificer-toolkit/schema/api/campaignInventory'
import type { CampaignEventDto } from '@artificer-toolkit/schema/api/campaignLiveState'
import {
  campaignStoredPartyInventorySchema,
  campaignStoredPartyItemSchema,
  campaignStoredPartyCurrencySchema
} from '@artificer-toolkit/schema/projections/campaignInventoryPersistence'
import { campaignStoredEventSchema } from '@artificer-toolkit/schema/projections/campaignEventPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { mutation } from '../lib/mutations'
import type { Doc } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { requireCampaignVehicleCargoAccess } from './vehicleDocuments'
import { requireIdentity } from '../lib/identity'
import { requireCampaignAuthority } from './authority'
import {
  readCampaignInventory,
  readCampaignCurrencyPlacement,
  readCampaignCurrencyGroup,
  readPartyEquipment,
  readHeldPartyEquipment,
  readPartyDenomination
} from './partyInventoryDocuments'
import { retainPartyEquipmentRules } from './partyEquipmentRetention'
import {
  requireInventoryRowEditable,
  requireInventoryVehicleEditable
} from './inventoryCleanupGuards'

async function requirePlacementContainer(
  ctx: MutationCtx,
  campaign: Doc<'campaigns'>,
  vehicleId: string | undefined,
  containerId: string
) {
  const container = await ctx.db
    .query('campaignPartyItems')
    .withIndex('by_campaignId_vehicleId_id', (q) =>
      q.eq('campaignId', campaign.id).eq('vehicleId', vehicleId).eq('id', containerId)
    )
    .unique()
  if (!container) throw new Error('Inventory container is unavailable.')
  await requireInventoryRowEditable(ctx, container)
  const { _id, _creationTime, ...stored } = container
  campaignStoredPartyItemSchema.parse(stored)
  if (container.containerId !== null)
    throw new Error('Nested inventory containers are unavailable.')
  const equipment = await readHeldPartyEquipment(ctx, campaign, container)
  if (equipment.capacity === undefined) throw new Error('Inventory destination is not a container.')
  return container
}
export const mutate = mutation({
  args: { input: zodToConvex(campaignPartyInventoryMutationInputSchema) },
  returns: zodToConvex(campaignPartyInventoryMutationResultDtoSchema),
  handler: async (ctx, args) => {
    const input = campaignPartyInventoryMutationInputSchema.parse(args.input)
    const { userId } = await requireIdentity(ctx)
    const { campaign, membership } = await requireCampaignAuthority(ctx, input.campaignId, userId)
    if (membership.role !== 'OWNER')
      throw new Error('Only the Campaign owner can change party inventory.')
    if (campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
    const vehicleId = input.vehicleId?.toLowerCase()
    if (vehicleId !== undefined)
      await requireCampaignVehicleCargoAccess(ctx, campaign, membership, vehicleId)
    await requireInventoryVehicleEditable(ctx, campaign.id, vehicleId)
    const containerId =
      'containerId' in input && typeof input.containerId === 'string'
        ? input.containerId.toLowerCase()
        : 'containerId' in input
          ? input.containerId
          : undefined
    const fromContainerId =
      input.kind === 'CURRENCY_MOVE' ? (input.fromContainerId?.toLowerCase() ?? null) : null
    const toContainerId =
      input.kind === 'CURRENCY_MOVE' ? (input.toContainerId?.toLowerCase() ?? null) : null
    const commandId = input.idempotencyKey.toLowerCase()
    const inputFingerprint = checksumCanonicalJson({
      ...input,
      campaignId: campaign.id,
      idempotencyKey: commandId,
      actorId: userId,
      ...(input.vehicleId === undefined ? {} : { vehicleId }),
      ...(containerId === undefined ? {} : { containerId }),
      ...(input.kind === 'CURRENCY_MOVE' ? { fromContainerId, toContainerId } : {}),
      ...(input.kind === 'ITEM_ADD'
        ? { equipmentId: input.equipmentId.toLowerCase() }
        : input.kind === 'CURRENCY_ADJUST' || input.kind === 'CURRENCY_MOVE'
          ? {
              denominationId: input.denominationId.toLowerCase(),
              ...(typeof input.campaignCurrencySystemId === 'string'
                ? {
                    campaignCurrencySystemId: input.campaignCurrencySystemId.toLowerCase()
                  }
                : {})
            }
          : { itemId: input.itemId.toLowerCase() })
    })
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
        prior.type !== `PARTY_${input.kind}` ||
        !prior.inventoryAudit
      )
        throw new Error('This command ID was already used with different input.')
      return { eventId: prior.id }
    }
    const inventory = await readCampaignInventory(ctx, campaign.id, vehicleId)
    const version = inventory?.version ?? 0
    if (version !== input.expectedOwnerVersion)
      throw new Error('Party inventory changed before this mutation completed.')
    const custody: CampaignEventDto['payload'] =
      vehicleId === undefined
        ? { kind: 'CAMPAIGN', campaignId: campaign.id, ownerId: campaign.id }
        : {
            kind: 'VEHICLE',
            vehicleId,
            campaignId: campaign.id,
            ownerId: vehicleId
          }
    let eventType: string
    let payload: CampaignEventDto['payload']
    if (input.kind === 'ITEM_ADD') {
      const equipmentId = input.equipmentId.toLowerCase()
      if (containerId !== undefined && containerId !== null)
        await requirePlacementContainer(ctx, campaign, vehicleId, containerId)
      const equipment = await readPartyEquipment(ctx, campaign, equipmentId)
      if (containerId !== undefined && containerId !== null) {
        if (equipment.capacity !== undefined)
          throw new Error('Nested inventory containers are unavailable.')
      }
      const item = campaignStoredPartyItemSchema.parse({
        campaignId: campaign.id,
        ...(vehicleId === undefined ? {} : { vehicleId }),
        id: crypto.randomUUID(),
        equipmentId,
        quantity: input.quantity,
        containerId: containerId ?? null,
        retainedRulesJson: await retainPartyEquipmentRules(ctx, campaign, {
          equipmentId
        })
      })
      inventoryItemDtoSchema.parse({
        id: item.id,
        quantity: item.quantity,
        containerId: item.containerId,
        label: equipment.label,
        isContainer: equipment.capacity !== undefined
      })
      await ctx.db.insert('campaignPartyItems', item)
      eventType = 'PARTY_ITEM_ADD'
      payload = {
        action: input.kind,
        custody,
        itemId: item.id,
        equipmentId,
        itemLabel: equipment.label,
        beforeQuantity: 0,
        afterQuantity: item.quantity
      }
    } else if (
      input.kind === 'ITEM_UPDATE' ||
      input.kind === 'ITEM_CONSUME' ||
      input.kind === 'ITEM_REMOVE'
    ) {
      const item = await ctx.db
        .query('campaignPartyItems')
        .withIndex('by_campaignId_vehicleId_id', (q) =>
          q
            .eq('campaignId', campaign.id)
            .eq('vehicleId', vehicleId)
            .eq('id', input.itemId.toLowerCase())
        )
        .unique()
      if (!item) throw new Error('Party item is not available.')
      await requireInventoryRowEditable(ctx, item)
      if (input.kind === 'ITEM_UPDATE' && containerId !== undefined && containerId !== null) {
        if (containerId === item.id) throw new Error('An inventory item cannot contain itself.')
        await requirePlacementContainer(ctx, campaign, vehicleId, containerId)
      }
      const { _id, _creationTime, ...storedItem } = item
      campaignStoredPartyItemSchema.parse(storedItem)
      const equipment =
        input.kind === 'ITEM_UPDATE' && input.quantity > item.quantity
          ? await readPartyEquipment(ctx, campaign, item.equipmentId)
          : await readHeldPartyEquipment(ctx, campaign, item)
      if (input.kind === 'ITEM_UPDATE' && containerId !== undefined && containerId !== null) {
        if (equipment.capacity !== undefined)
          throw new Error('Nested inventory containers are unavailable.')
      }
      const quantity =
        input.kind === 'ITEM_UPDATE'
          ? input.quantity
          : input.kind === 'ITEM_CONSUME'
            ? item.quantity - input.amount
            : 0
      if (quantity < 0) throw new Error('Party item does not contain enough quantity.')
      if (quantity === 0) {
        const [child, currencyGroups, currency] = await Promise.all([
          ctx.db
            .query('campaignPartyItems')
            .withIndex('by_campaignId_vehicleId_containerId', (q) =>
              q.eq('campaignId', campaign.id).eq('vehicleId', vehicleId).eq('containerId', item.id)
            )
            .first(),
          ctx.db
            .query('campaignPartyCurrencyGroups')
            .withIndex('by_campaignId_vehicleId_containerId', (q) =>
              q.eq('campaignId', campaign.id).eq('vehicleId', vehicleId).eq('containerId', item.id)
            )
            .collect(),
          ctx.db
            .query('campaignPartyCurrencies')
            .withIndex('by_campaignId_vehicleId_containerId', (q) =>
              q.eq('campaignId', campaign.id).eq('vehicleId', vehicleId).eq('containerId', item.id)
            )
            .first()
        ])
        if (child) await requireInventoryRowEditable(ctx, child)
        if (currency) await requireInventoryRowEditable(ctx, currency)
        for (const group of currencyGroups) await requireInventoryRowEditable(ctx, group)
        if (child || currency) throw new Error('Empty a container before removing or consuming it.')
        for (const group of currencyGroups) {
          await readCampaignCurrencyGroup(ctx, campaign.id, vehicleId, group.id)
          const balance = await ctx.db
            .query('campaignPartyCurrencies')
            .withIndex('by_campaignId_vehicleId_groupId_id', (q) =>
              q.eq('campaignId', campaign.id).eq('vehicleId', vehicleId).eq('groupId', group.id)
            )
            .first()
          if (balance) await requireInventoryRowEditable(ctx, balance)
          if (balance) throw new Error('Empty a container before removing or consuming it.')
        }
        // Keep empty group identities when their explicitly removed container disappears.
        for (const group of currencyGroups) await ctx.db.patch(group._id, { containerId: null })
        await ctx.db.delete(item._id)
      } else
        await ctx.db.patch(item._id, {
          quantity,
          ...(input.kind === 'ITEM_UPDATE' && containerId !== undefined ? { containerId } : {})
        })
      eventType =
        input.kind === 'ITEM_UPDATE'
          ? 'PARTY_ITEM_UPDATE'
          : input.kind === 'ITEM_CONSUME'
            ? 'PARTY_ITEM_CONSUME'
            : 'PARTY_ITEM_REMOVE'
      payload = {
        action: input.kind,
        custody,
        itemId: item.id,
        itemLabel: equipment.label,
        beforeQuantity: item.quantity,
        afterQuantity: quantity,
        ...(input.kind === 'ITEM_CONSUME' ? { consumedQuantity: input.amount } : {})
      }
    } else if (input.kind === 'CURRENCY_ADJUST') {
      if (containerId !== undefined && containerId !== null)
        await requirePlacementContainer(ctx, campaign, vehicleId, containerId)
      const denominationId = input.denominationId.toLowerCase()
      const { denomination, campaignCurrencySystemId } = await readPartyDenomination(
        ctx,
        campaign,
        denominationId,
        typeof input.campaignCurrencySystemId === 'string'
          ? input.campaignCurrencySystemId.toLowerCase()
          : input.campaignCurrencySystemId
      )
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
        for (const row of batch) {
          if (containerId !== undefined && row.containerId !== containerId) continue
          await requireInventoryRowEditable(ctx, row)
          const { _id, _creationTime, ...stored } = row
          campaignStoredPartyCurrencySchema.parse(stored)
          await readCampaignCurrencyPlacement(ctx, row)
        }
        balances.push(
          ...batch.filter((row) => containerId === undefined || row.containerId === containerId)
        )
        if (batch.length < 48) break
        cursor = batch.at(-1)!.id
      }
      const beforeAmount = balances.reduce((total, balance) => total + BigInt(balance.amount), 0n)
      const delta = BigInt(input.amount)
      if (beforeAmount + delta < 0n)
        throw new Error('Party inventory does not contain enough currency.')
      if (delta > 0n) {
        const existing = await ctx.db
          .query('campaignPartyCurrencies')
          .withIndex('by_owner_system_denomination_container', (q) =>
            q
              .eq('campaignId', campaign.id)
              .eq('vehicleId', vehicleId)
              .eq('campaignCurrencySystemId', campaignCurrencySystemId)
              .eq('denominationId', denominationId)
              .eq('groupId', undefined)
              .eq('containerId', containerId ?? null)
          )
          .unique()
        if (existing) {
          await requireInventoryRowEditable(ctx, existing)
          const { _id, _creationTime, ...stored } = existing
          campaignStoredPartyCurrencySchema.parse(stored)
          await readCampaignCurrencyPlacement(ctx, existing)
        }
        const amount = BigInt(existing?.amount ?? 0) + delta
        if (amount > BigInt(Number.MAX_SAFE_INTEGER))
          throw new Error('Inventory amount exceeds the supported range.')
        if (existing) await ctx.db.patch(existing._id, { amount: Number(amount) })
        else
          await ctx.db.insert(
            'campaignPartyCurrencies',
            campaignStoredPartyCurrencySchema.parse({
              campaignId: campaign.id,
              ...(vehicleId === undefined ? {} : { vehicleId }),
              id: crypto.randomUUID(),
              denominationId,
              ...(campaignCurrencySystemId ? { campaignCurrencySystemId } : {}),
              amount: Number(amount),
              containerId: containerId ?? null
            })
          )
      } else {
        let remaining = -delta
        for (const balance of balances) {
          if (remaining === 0n) break
          const used = BigInt(balance.amount) < remaining ? BigInt(balance.amount) : remaining
          if (used === 0n) continue
          const amount = BigInt(balance.amount) - used
          if (amount === 0n) await ctx.db.delete(balance._id)
          else await ctx.db.patch(balance._id, { amount: Number(amount) })
          remaining -= used
        }
      }
      eventType = 'PARTY_CURRENCY_ADJUST'
      payload = {
        action: input.kind,
        custody,
        denominationId,
        ...(campaignCurrencySystemId === undefined ? {} : { campaignCurrencySystemId }),
        denominationLabel: denomination.label,
        beforeAmount: beforeAmount.toString(),
        afterAmount: (beforeAmount + delta).toString(),
        amount: input.amount
      }
    } else {
      const denominationId = input.denominationId.toLowerCase()
      const { denomination, campaignCurrencySystemId } = await readPartyDenomination(
        ctx,
        campaign,
        denominationId,
        typeof input.campaignCurrencySystemId === 'string'
          ? input.campaignCurrencySystemId.toLowerCase()
          : input.campaignCurrencySystemId
      )
      if (fromContainerId !== null)
        await requirePlacementContainer(ctx, campaign, vehicleId, fromContainerId)
      if (toContainerId !== null)
        await requirePlacementContainer(ctx, campaign, vehicleId, toContainerId)
      const balances: Doc<'campaignPartyCurrencies'>[] = []
      let cursor: string | null = null
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
        for (const row of batch) {
          if (row.containerId !== fromContainerId) continue
          await requireInventoryRowEditable(ctx, row)
          const { _id, _creationTime, ...stored } = row
          campaignStoredPartyCurrencySchema.parse(stored)
          await readCampaignCurrencyPlacement(ctx, row)
        }
        balances.push(...batch.filter((row) => row.containerId === fromContainerId))
        if (batch.length < 48) break
        cursor = batch.at(-1)!.id
      }
      const beforeAmount = balances.reduce((total, row) => total + BigInt(row.amount), 0n)
      const amount = BigInt(input.amount)
      if (fromContainerId !== toContainerId && beforeAmount < amount)
        throw new Error('Party inventory does not contain enough currency.')
      if (fromContainerId !== toContainerId) {
        const destination = await ctx.db
          .query('campaignPartyCurrencies')
          .withIndex('by_owner_system_denomination_container', (q) =>
            q
              .eq('campaignId', campaign.id)
              .eq('vehicleId', vehicleId)
              .eq('campaignCurrencySystemId', campaignCurrencySystemId)
              .eq('denominationId', denominationId)
              .eq('groupId', undefined)
              .eq('containerId', toContainerId)
          )
          .unique()
        if (destination) {
          await requireInventoryRowEditable(ctx, destination)
          const { _id, _creationTime, ...stored } = destination
          campaignStoredPartyCurrencySchema.parse(stored)
          await readCampaignCurrencyPlacement(ctx, destination)
        }
        const nextAmount = BigInt(destination?.amount ?? 0) + amount
        if (nextAmount > BigInt(Number.MAX_SAFE_INTEGER))
          throw new Error('Inventory amount exceeds the supported range.')
        let remaining = amount
        for (const balance of balances) {
          if (remaining === 0n) break
          const used = BigInt(balance.amount) < remaining ? BigInt(balance.amount) : remaining
          const nextAmount = BigInt(balance.amount) - used
          if (nextAmount === 0n) await ctx.db.delete(balance._id)
          else await ctx.db.patch(balance._id, { amount: Number(nextAmount) })
          remaining -= used
        }

        if (destination) await ctx.db.patch(destination._id, { amount: Number(nextAmount) })
        else
          await ctx.db.insert(
            'campaignPartyCurrencies',
            campaignStoredPartyCurrencySchema.parse({
              campaignId: campaign.id,
              ...(vehicleId === undefined ? {} : { vehicleId }),
              id: crypto.randomUUID(),
              denominationId,
              ...(campaignCurrencySystemId ? { campaignCurrencySystemId } : {}),
              amount: Number(amount),
              containerId: toContainerId
            })
          )
      }
      eventType = 'PARTY_CURRENCY_MOVE'
      payload = {
        action: input.kind,
        custody,
        denominationId,
        ...(campaignCurrencySystemId === undefined ? {} : { campaignCurrencySystemId }),
        denominationLabel: denomination.label,
        fromContainerId: fromContainerId,
        toContainerId: toContainerId,
        beforeAmount: beforeAmount.toString(),
        afterAmount: (fromContainerId === toContainerId
          ? beforeAmount
          : beforeAmount - amount
        ).toString(),
        amount: input.amount
      }
    }
    const nextInventory = campaignStoredPartyInventorySchema.parse({
      campaignId: campaign.id,
      ...(vehicleId === undefined ? {} : { vehicleId }),
      version: version + 1
    })
    if (inventory) await ctx.db.patch(inventory._id, { version: nextInventory.version })
    else await ctx.db.insert('campaignPartyInventories', nextInventory)
    const eventId = crypto.randomUUID()
    await ctx.db.insert(
      'campaignEvents',
      campaignStoredEventSchema.parse({
        id: eventId,
        campaignId: campaign.id,
        actorUserId: userId,
        type: eventType,
        visibility: 'OWNER',
        subjectCharacterId: null,
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
