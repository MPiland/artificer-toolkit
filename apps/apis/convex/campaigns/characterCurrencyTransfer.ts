import type { CampaignEventDto } from '@artificer-toolkit/schema/api/campaignLiveState'
import type { TransferCampaignInventoryInput } from '@artificer-toolkit/schema/api/campaignInventory'
import { campaignStoredPartyCurrencySchema } from '@artificer-toolkit/schema/projections/campaignInventoryPersistence'
import {
  createCharacterCurrencyIdentityKey,
  characterCurrencyIdentity
} from '@artificer-toolkit/schema/shared/characterCurrency'
import type { Doc } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import type { InventoryCustodyOwner } from './inventoryCustodyOwners'
import { readCampaignCurrencyPlacement, readPartyDenomination } from './partyInventoryDocuments'
import { requireInventoryRowEditable, readInventoryRowAvailable } from './inventoryCleanupGuards'

type CharacterOwner = Extract<InventoryCustodyOwner, { kind: 'CHARACTER' }>
type SharedOwner = Extract<InventoryCustodyOwner, { kind: 'SHARED' }>

function readCharacterBalances(owner: CharacterOwner) {
  const groupIds = new Set<string>()
  const itemIds = new Set(owner.character.state.equipment.inventory.map((item) => item.id))
  return owner.character.state.currency.flatMap((group) => {
    if (groupIds.has(group.id))
      throw new Error('Character currency groups must have unique identities.')
    groupIds.add(group.id)
    if (group.containerId && !itemIds.has(group.containerId))
      throw new Error('Character currency container is unavailable.')
    const identities = new Set<string>()
    return group.currencies.map((currency) => {
      if (!Number.isSafeInteger(currency.amount) || currency.amount < 0)
        throw new Error('Character currency amount is outside the supported range.')
      const identity = characterCurrencyIdentity(currency)
      const key = createCharacterCurrencyIdentityKey(identity)
      if (identities.has(key)) throw new Error('Character currency group has duplicate balances.')
      identities.add(key)
      return { group, currency, identity, key }
    })
  })
}

async function readSharedBalances(
  ctx: MutationCtx,
  campaign: Doc<'campaigns'>,
  owner: SharedOwner,
  denominationId: string,
  campaignCurrencySystemId: string | undefined,
  access: 'SOURCE' | 'DESTINATION'
) {
  const rows: Doc<'campaignPartyCurrencies'>[] = []
  const groupedKeys = new Set<string>()
  for await (const row of ctx.db
    .query('campaignPartyCurrencies')
    .withIndex('by_owner_system_denomination_id', (q) =>
      q
        .eq('campaignId', campaign.id)
        .eq('vehicleId', owner.vehicleId)
        .eq('campaignCurrencySystemId', campaignCurrencySystemId)
        .eq('denominationId', denominationId)
    )) {
    const { _id, _creationTime, ...stored } = row
    campaignStoredPartyCurrencySchema.parse(stored)
    const available = await readInventoryRowAvailable(ctx, row)
    if (
      (access === 'SOURCE' && available) ||
      (row.groupId === undefined && row.containerId === null)
    )
      await requireInventoryRowEditable(ctx, row)
    await readCampaignCurrencyPlacement(ctx, row)
    if (row.groupId !== undefined) {
      if (groupedKeys.has(row.groupId))
        throw new Error('Campaign currency group has duplicate balances.')
      groupedKeys.add(row.groupId)
    }
    if (available) rows.push(row)
  }
  return rows
}

/** The endpoint verifies current authority and both captured fences before this atomic settlement. */
export async function transferCharacterCurrencyCustody(
  ctx: MutationCtx,
  campaign: Doc<'campaigns'>,
  input: Extract<TransferCampaignInventoryInput, { kind: 'CURRENCY' }>,
  source: InventoryCustodyOwner,
  destination: InventoryCustodyOwner
): Promise<CampaignEventDto['payload']> {
  const denominationId = input.denominationId.toLowerCase()
  const { denomination, campaignCurrencySystemId } = await readPartyDenomination(
    ctx,
    campaign,
    denominationId,
    typeof input.campaignCurrencySystemId === 'string'
      ? input.campaignCurrencySystemId.toLowerCase()
      : input.campaignCurrencySystemId
  )
  const identity =
    campaignCurrencySystemId === undefined
      ? { currencyId: denominationId, kind: 'RULESET' as const }
      : { currencyId: denominationId, kind: 'CAMPAIGN' as const, campaignCurrencySystemId }
  const key = createCharacterCurrencyIdentityKey(identity)
  const sourceCharacterBalances =
    source.kind === 'CHARACTER'
      ? readCharacterBalances(source).filter((entry) => entry.key === key)
      : []
  const destinationCharacterBalances =
    destination.kind === 'CHARACTER'
      ? readCharacterBalances(destination).filter((entry) => entry.key === key)
      : []
  const sourceSharedBalances =
    source.kind === 'SHARED'
      ? await readSharedBalances(
          ctx,
          campaign,
          source,
          denominationId,
          campaignCurrencySystemId,
          'SOURCE'
        )
      : []
  const destinationSharedBalances =
    destination.kind === 'SHARED'
      ? await readSharedBalances(
          ctx,
          campaign,
          destination,
          denominationId,
          campaignCurrencySystemId,
          'DESTINATION'
        )
      : []
  const sourceBefore =
    sourceCharacterBalances.reduce((sum, entry) => sum + BigInt(entry.currency.amount), 0n) +
    sourceSharedBalances.reduce((sum, row) => sum + BigInt(row.amount), 0n)
  const destinationBefore =
    destinationCharacterBalances.reduce((sum, entry) => sum + BigInt(entry.currency.amount), 0n) +
    destinationSharedBalances.reduce((sum, row) => sum + BigInt(row.amount), 0n)
  const amount = BigInt(input.amount)
  if (sourceBefore < amount) throw new Error('Inventory does not contain enough currency.')

  const destinationCharacterSlot = destinationCharacterBalances.find(
    (entry) => !entry.group.containerId
  )
  const destinationSharedSlot = destinationSharedBalances.filter(
    (row) => row.groupId === undefined && row.containerId === null
  )
  if (destinationSharedSlot.length > 1)
    throw new Error('Loose Campaign currency has duplicate balances.')
  const destinationSlotAmount =
    BigInt(destinationCharacterSlot?.currency.amount ?? destinationSharedSlot[0]?.amount ?? 0) +
    amount
  if (destinationSlotAmount > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error('Inventory amount exceeds the supported range.')

  if (destination.kind === 'CHARACTER') {
    if (destinationCharacterSlot) {
      Object.assign(destinationCharacterSlot.currency, identity, {
        amount: Number(destinationSlotAmount)
      })
    } else {
      let group = destination.character.state.currency.find((candidate) => !candidate.containerId)
      if (!group) {
        group = { id: crypto.randomUUID(), currencies: [] }
        destination.character.state.currency.push(group)
      }
      group.currencies.push({ ...identity, amount: Number(destinationSlotAmount) })
    }
  } else if (destinationSharedSlot[0]) {
    await ctx.db.patch(destinationSharedSlot[0]._id, { amount: Number(destinationSlotAmount) })
  } else {
    await ctx.db.insert(
      'campaignPartyCurrencies',
      campaignStoredPartyCurrencySchema.parse({
        campaignId: campaign.id,
        ...(destination.vehicleId === undefined ? {} : { vehicleId: destination.vehicleId }),
        id: crypto.randomUUID(),
        denominationId,
        ...(campaignCurrencySystemId === undefined ? {} : { campaignCurrencySystemId }),
        amount: Number(destinationSlotAmount),
        containerId: null
      })
    )
  }

  let remaining = amount
  if (source.kind === 'CHARACTER') {
    const changedGroups = new Set<string>()
    const consumed = new Set<(typeof sourceCharacterBalances)[number]['currency']>()
    for (const entry of sourceCharacterBalances) {
      if (remaining === 0n) break
      const used =
        BigInt(entry.currency.amount) < remaining ? BigInt(entry.currency.amount) : remaining
      if (used === 0n) continue
      const next = BigInt(entry.currency.amount) - used
      changedGroups.add(entry.group.id)
      if (next === 0n) consumed.add(entry.currency)
      else Object.assign(entry.currency, identity, { amount: Number(next) })
      remaining -= used
    }
    source.character.state.currency = source.character.state.currency.flatMap((group) => {
      if (!changedGroups.has(group.id)) return [group]
      const currencies = group.currencies.filter((currency) => !consumed.has(currency))
      return currencies.length === 0 ? [] : [{ ...group, currencies }]
    })
  } else {
    for (const row of sourceSharedBalances) {
      if (remaining === 0n) break
      const used = BigInt(row.amount) < remaining ? BigInt(row.amount) : remaining
      if (used === 0n) continue
      const next = BigInt(row.amount) - used
      if (next === 0n) await ctx.db.delete(row._id)
      else await ctx.db.patch(row._id, { amount: Number(next) })
      remaining -= used
    }
  }
  if (remaining !== 0n)
    throw new Error('Currency settlement did not preserve the exact transfer amount.')
  const ownerId = (owner: InventoryCustodyOwner) =>
    owner.ref.kind === 'CHARACTER'
      ? owner.ref.characterId
      : owner.ref.kind === 'VEHICLE'
        ? owner.ref.vehicleId
        : owner.ref.campaignId
  return {
    kind: 'CURRENCY',
    action: 'CUSTODY_TRANSFER',
    source: source.ref,
    destination: destination.ref,
    custodyContext: { sourceOwnerId: ownerId(source), destinationOwnerId: ownerId(destination) },
    denominationId,
    ...(campaignCurrencySystemId === undefined ? {} : { campaignCurrencySystemId }),
    denominationLabel: denomination.label,
    amount: input.amount,
    beforeAmount: sourceBefore.toString(),
    afterSourceAmount: (sourceBefore - amount).toString(),
    beforeDestinationAmount: destinationBefore.toString(),
    afterDestinationAmount: (destinationBefore + amount).toString()
  }
}
