import { planInventoryItemTransfer } from '@artificer-toolkit/rules-runtime/character/inventoryItemTransfer'
import type { CampaignEventDto } from '@artificer-toolkit/schema/api/campaignLiveState'
import type { TransferCampaignInventoryInput } from '@artificer-toolkit/schema/api/campaignInventory'
import {
  campaignStoredPartyCurrencyGroupSchema,
  campaignStoredPartyCurrencySchema,
  campaignStoredPartyItemSchema
} from '@artificer-toolkit/schema/projections/campaignInventoryPersistence'
import {
  createCharacterCurrencyIdentityKey,
  characterCurrencyIdentity
} from '@artificer-toolkit/schema/shared/characterCurrency'
import type { Doc } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import type { InventoryCustodyOwner } from './inventoryCustodyOwners'
import { readAcquiredEquipmentRules } from '@artificer-toolkit/rules-runtime/character/acquiredEquipmentRules'
import { removeCharacterItemReferences } from '@artificer-toolkit/rules-runtime/character/characterSourceLoss'
import { retainCharacterEquipmentRules } from '../characters/acquiredEquipment'
import { readPartyVehicleItemForest } from './partyVehicleTransfer'

type ItemTransfer = Extract<TransferCampaignInventoryInput, { kind: 'ITEM' }>
type CharacterOwner = Extract<InventoryCustodyOwner, { kind: 'CHARACTER' }>

function readCharacterItems(owner: CharacterOwner) {
  return owner.character.state.equipment.inventory.map((item) => ({
    ...item,
    containerId: item.containerId ?? null
  }))
}

function toCharacterInventoryItem(item: ReturnType<typeof readCharacterItems>[number]) {
  const { containerId, ...held } = item
  return containerId === null ? held : { ...held, containerId }
}

function toSharedHeldItem(item: Doc<'campaignPartyItems'>) {
  const {
    _id: _recordId,
    _creationTime: _recordTime,
    campaignId: _campaignId,
    vehicleId: _vehicleId,
    cleanupJobId: _cleanupJobId,
    ...held
  } = item
  return held
}

function assertDistinctGroupIds(groups: readonly { id: string }[], label: string) {
  const ids = new Set<string>()
  for (const group of groups) {
    if (ids.has(group.id)) throw new Error(`${label} has duplicate currency group identities.`)
    ids.add(group.id)
  }
}

function qualifyCharacterGroups(
  owner: CharacterOwner,
  groups: readonly (typeof owner.character.state.currency)[number][]
) {
  assertDistinctGroupIds(owner.character.state.currency, 'Character inventory')
  const itemIds = new Set(owner.character.state.equipment.inventory.map((item) => item.id))
  return groups.map((group) => {
    if (!group.containerId || !itemIds.has(group.containerId))
      throw new Error('Character currency container is unavailable.')
    const identities = new Set<string>()
    return {
      ...group,
      currencies: group.currencies.map((currency) => {
        if (!Number.isSafeInteger(currency.amount) || currency.amount < 0)
          throw new Error('Character currency amount is outside the supported range.')
        const identity = characterCurrencyIdentity(currency)
        const key = createCharacterCurrencyIdentityKey(identity)
        if (identities.has(key)) throw new Error('Character currency group has duplicate balances.')
        identities.add(key)
        return { ...currency, ...identity }
      })
    }
  })
}

async function assertSharedGroupIdsAvailable(
  ctx: MutationCtx,
  campaign: Doc<'campaigns'>,
  groups: readonly { id: string }[]
) {
  assertDistinctGroupIds(groups, 'Moved currency')
  for (const group of groups) {
    const existing = await ctx.db
      .query('campaignPartyCurrencyGroups')
      .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaign.id).eq('id', group.id))
      .unique()
    if (existing) throw new Error('Destination inventory already holds this currency group.')
  }
}

function ownerId(owner: InventoryCustodyOwner) {
  return owner.ref.kind === 'CHARACTER'
    ? owner.ref.characterId
    : owner.ref.kind === 'VEHICLE'
      ? owner.ref.vehicleId
      : owner.ref.campaignId
}

/** Caller owns authority, fences, receipts, audit, and version publication. */
export async function transferCharacterItemCustody(
  ctx: MutationCtx,
  campaign: Doc<'campaigns'>,
  input: ItemTransfer,
  source: InventoryCustodyOwner,
  destination: InventoryCustodyOwner
): Promise<CampaignEventDto['payload']> {
  if (source.kind !== 'CHARACTER' && destination.kind !== 'CHARACTER')
    throw new Error('Character custody is required.')

  const itemId = input.itemId.toLowerCase()
  if (source.kind === 'CHARACTER')
    source.character = {
      ...source.character,
      state: await retainCharacterEquipmentRules(ctx, source.character)
    }
  const sourceForest =
    source.kind === 'SHARED'
      ? await readPartyVehicleItemForest(ctx, campaign, source.vehicleId, itemId)
      : undefined
  const sourceItems =
    source.kind === 'CHARACTER'
      ? readCharacterItems(source)
      : sourceForest!.items.map(toSharedHeldItem)
  const occupiedContainerIds =
    source.kind === 'CHARACTER'
      ? new Set(
          source.character.state.currency.flatMap((group) =>
            group.containerId === undefined ? [] : [group.containerId]
          )
        )
      : sourceForest!.populatedItemIds
  const plan = planInventoryItemTransfer({
    sourceItems,
    itemId,
    amount: input.amount,
    occupiedContainerIds
  })
  const movedOriginalIds = plan.movedIds
  const sourceReplacementIds = new Set(plan.sourceItems.map((item) => item.id))

  let itemLabel: string
  if (source.kind === 'CHARACTER') {
    const sourceById = new Map(sourceItems.map((item) => [item.id, item]))
    for (const movedId of movedOriginalIds) {
      const held = sourceById.get(movedId)
      if (!held) throw new Error('Character inventory item is unavailable.')
      if (!held.retainedRulesJson)
        throw new Error('Acquired Character Equipment rules are missing.')
      readAcquiredEquipmentRules(held.retainedRulesJson, held.equipmentId, campaign.gameSystemId)
    }
    const root = sourceById.get(plan.root.id)
    if (!root) throw new Error('Character inventory item is unavailable.')
    if (!root.retainedRulesJson) throw new Error('Acquired Character Equipment rules are missing.')
    const equipment = readAcquiredEquipmentRules(
      root.retainedRulesJson,
      root.equipmentId,
      campaign.gameSystemId
    ).equipment
    itemLabel = root.customName ?? equipment.label
  } else {
    itemLabel = sourceForest!.item.customName ?? sourceForest!.equipment.label
  }

  const sourceCharacterGroups =
    source.kind === 'CHARACTER'
      ? source.character.state.currency.filter(
          (group) => group.containerId !== undefined && movedOriginalIds.has(group.containerId)
        )
      : []
  const qualifiedSourceCharacterGroups =
    source.kind === 'CHARACTER' && sourceCharacterGroups.length > 0
      ? qualifyCharacterGroups(source, sourceCharacterGroups)
      : []
  const sharedCharacterGroups =
    source.kind === 'SHARED'
      ? [
          ...sourceForest!.groups.map((group) => ({
            id: group.id,
            ...(group.containerId === null ? {} : { containerId: group.containerId }),
            currencies: sourceForest!.balances
              .filter((balance) => balance.groupId === group.id)
              .map((balance) => ({
                currencyId: balance.denominationId,
                ...(balance.campaignCurrencySystemId === undefined
                  ? { kind: 'RULESET' as const }
                  : {
                      kind: 'CAMPAIGN' as const,
                      campaignCurrencySystemId: balance.campaignCurrencySystemId
                    }),
                amount: balance.amount
              }))
          })),
          ...sourceForest!.balances
            .filter((balance) => balance.groupId === undefined)
            .map((balance) => ({
              id: balance.id,
              ...(balance.containerId === null ? {} : { containerId: balance.containerId }),
              currencies: [
                {
                  currencyId: balance.denominationId,
                  ...(balance.campaignCurrencySystemId === undefined
                    ? { kind: 'RULESET' as const }
                    : {
                        kind: 'CAMPAIGN' as const,
                        campaignCurrencySystemId: balance.campaignCurrencySystemId
                      }),
                  amount: balance.amount
                }
              ]
            }))
        ]
      : []

  if (destination.kind === 'CHARACTER') {
    const destinationItemIds = new Set(
      destination.character.state.equipment.inventory.map((item) => item.id)
    )
    for (const item of plan.destinationItems) {
      if (destinationItemIds.has(item.id))
        throw new Error('Destination Character already holds this item.')
    }
    const destinationGroups =
      source.kind === 'CHARACTER' ? qualifiedSourceCharacterGroups : sharedCharacterGroups
    const destinationGroupIds = new Set(
      destination.character.state.currency.map((group) => group.id)
    )
    assertDistinctGroupIds(destinationGroups, 'Moved currency')
    for (const group of destinationGroups) {
      if (destinationGroupIds.has(group.id))
        throw new Error('Destination Character already holds this currency group.')
    }
    destination.character = {
      ...destination.character,
      state: {
        ...destination.character.state,
        equipment: {
          ...destination.character.state.equipment,
          inventory: [
            ...destination.character.state.equipment.inventory,
            ...plan.destinationItems.map(toCharacterInventoryItem)
          ]
        },
        currency: [...destination.character.state.currency, ...destinationGroups]
      }
    }
  } else {
    for (const item of plan.destinationItems) {
      const existing = await ctx.db
        .query('campaignPartyItems')
        .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaign.id).eq('id', item.id))
        .unique()
      if (existing) throw new Error('Destination inventory already holds this item.')
    }
    await assertSharedGroupIdsAvailable(ctx, campaign, qualifiedSourceCharacterGroups)
  }

  if (source.kind === 'CHARACTER') {
    if (destination.kind === 'SHARED') {
      for (const item of plan.destinationItems) {
        await ctx.db.insert(
          'campaignPartyItems',
          campaignStoredPartyItemSchema.parse({
            ...item,
            campaignId: campaign.id,
            ...(destination.vehicleId === undefined ? {} : { vehicleId: destination.vehicleId })
          })
        )
      }
      for (const group of qualifiedSourceCharacterGroups) {
        await ctx.db.insert(
          'campaignPartyCurrencyGroups',
          campaignStoredPartyCurrencyGroupSchema.parse({
            campaignId: campaign.id,
            ...(destination.vehicleId === undefined ? {} : { vehicleId: destination.vehicleId }),
            id: group.id,
            containerId: group.containerId
          })
        )
        for (const currency of group.currencies) {
          if (currency.kind !== 'RULESET' && currency.kind !== 'CAMPAIGN')
            throw new Error(
              'Character currency needs a current qualified identity before transfer.'
            )
          await ctx.db.insert(
            'campaignPartyCurrencies',
            campaignStoredPartyCurrencySchema.parse({
              campaignId: campaign.id,
              ...(destination.vehicleId === undefined ? {} : { vehicleId: destination.vehicleId }),
              id: crypto.randomUUID(),
              groupId: group.id,
              denominationId: currency.currencyId,
              ...(currency.kind === 'CAMPAIGN'
                ? { campaignCurrencySystemId: currency.campaignCurrencySystemId }
                : {}),
              amount: currency.amount,
              containerId: group.containerId
            })
          )
        }
      }
    }
    source.character = {
      ...source.character,
      state: {
        ...source.character.state,
        equipment: {
          ...source.character.state.equipment,
          inventory: [
            ...source.character.state.equipment.inventory.filter(
              (item) => !movedOriginalIds.has(item.id)
            ),
            ...plan.sourceItems.map(toCharacterInventoryItem)
          ]
        },
        currency: source.character.state.currency.filter(
          (group) => !qualifiedSourceCharacterGroups.some((candidate) => candidate.id === group.id)
        )
      }
    }
    source.character = {
      ...source.character,
      state: removeCharacterItemReferences(
        source.character.state,
        new Set([...movedOriginalIds].filter((movedId) => !sourceReplacementIds.has(movedId)))
      )
    }
  } else {
    for (const balance of sourceForest!.balances) await ctx.db.delete(balance._id)
    for (const group of sourceForest!.groups) await ctx.db.delete(group._id)
    for (const item of sourceForest!.items) await ctx.db.delete(item._id)
    for (const item of plan.sourceItems) {
      const original = sourceForest!.items.find((candidate) => candidate.id === item.id)
      await ctx.db.insert(
        'campaignPartyItems',
        campaignStoredPartyItemSchema.parse({
          ...item,
          campaignId: campaign.id,
          ...(source.vehicleId === undefined ? {} : { vehicleId: source.vehicleId }),
          ...(original?.cleanupJobId === undefined ? {} : { cleanupJobId: original.cleanupJobId })
        })
      )
    }
  }

  return {
    kind: 'ITEM',
    action: 'CUSTODY_TRANSFER',
    source: source.ref,
    destination: destination.ref,
    custodyContext: {
      sourceOwnerId: ownerId(source),
      destinationOwnerId: ownerId(destination)
    },
    itemId,
    itemLabel,
    amount: input.amount,
    beforeQuantity: plan.root.quantity,
    afterSourceQuantity: plan.root.quantity - input.amount,
    afterDestinationQuantity: input.amount
  }
}
