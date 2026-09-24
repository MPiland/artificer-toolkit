import { v } from 'convex/values'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  currencySystemDtoSchema,
  saveCampaignCurrencySystemInputSchema,
  deleteCampaignCurrencySystemInputSchema
} from '@artificer-toolkit/schema/api/campaignInventory'

import {
  campaignStoredCurrencySystemSchema,
  campaignStoredCurrencyDenominationSchema,
  campaignStoredPartyCurrencySchema,
  campaignStoredPartyInventorySchema
} from '@artificer-toolkit/schema/projections/campaignInventoryPersistence'

import { internalMutation } from '../lib/mutations'
import type { QueryCtx, MutationCtx } from '../_generated/server'
import type { Doc } from '../_generated/dataModel'
import { requireIdentity } from '../lib/identity'
import { requireCampaignAuthority } from './authority'
import {
  requireInventoryRowEditable,
  requireInventoryVehicleEditable
} from './inventoryCleanupGuards'
import { readCampaignCurrencyPlacement, readCampaignInventory } from './partyInventoryDocuments'
import {
  applyCampaignCharacterCurrencyRewrites,
  prepareCampaignCharacterCurrencyRewrites
} from './characterCurrencyLifecycle'
import {
  readCurrencySystem,
  validateCurrencySystem,
  presentCurrencySystem
} from './currencySystemDocuments'

async function readSystemBalances(ctx: QueryCtx, campaignId: string, systemId: string) {
  const balances: Doc<'campaignPartyCurrencies'>[] = []
  const guardedVehicleIds = new Set<string>()
  let cursor: string | null = null
  while (true) {
    const batch: Doc<'campaignPartyCurrencies'>[] = await ctx.db
      .query('campaignPartyCurrencies')
      .withIndex('by_campaign_currencySystem_id', (q) => {
        const scope = q.eq('campaignId', campaignId).eq('campaignCurrencySystemId', systemId)
        return cursor === null ? scope : scope.gt('id', cursor)
      })
      .take(48)
    for (const row of batch) {
      if (row.vehicleId !== undefined && !guardedVehicleIds.has(row.vehicleId)) {
        await requireInventoryVehicleEditable(ctx, campaignId, row.vehicleId)
        guardedVehicleIds.add(row.vehicleId)
      }
      await requireInventoryRowEditable(ctx, row)
      const { _id, _creationTime, ...stored } = row
      campaignStoredPartyCurrencySchema.parse(stored)
      await readCampaignCurrencyPlacement(ctx, row)
    }
    balances.push(...batch)
    if (batch.length < 48) return balances
    cursor = batch.at(-1)!.id
  }
}

async function incrementInventoryVersion(ctx: MutationCtx, campaignId: string, vehicleId?: string) {
  const inventory = await readCampaignInventory(ctx, campaignId, vehicleId)
  if (!inventory) throw new Error('Stored Campaign inventory owner is unavailable.')
  const next = campaignStoredPartyInventorySchema.parse({
    campaignId,
    ...(vehicleId !== undefined ? { vehicleId } : {}),
    version: inventory.version + 1
  })
  await ctx.db.patch(inventory._id, { version: next.version })
}

export const save = internalMutation({
  args: zodToConvexFields(saveCampaignCurrencySystemInputSchema.shape),
  returns: zodToConvex(currencySystemDtoSchema),
  handler: async (ctx, args) => {
    const input = saveCampaignCurrencySystemInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    const { campaign, membership } = await requireCampaignAuthority(ctx, input.campaignId, userId)
    if (membership.role !== 'OWNER')
      throw new Error('Only the Campaign owner can manage currency systems.')
    if (campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
    const systemId = input.systemId?.toLowerCase() ?? crypto.randomUUID()
    const current = input.systemId
      ? await ctx.db
          .query('campaignCurrencySystems')
          .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaign.id).eq('id', systemId))
          .unique()
      : null
    if (input.systemId && !current) throw new Error('Campaign currency system is unavailable.')
    const prior = current ? await readCurrencySystem(ctx, current) : null
    if (
      current &&
      (input.expectedVersion === undefined || current.version !== input.expectedVersion)
    )
      throw new Error('Currency system changed before this update completed.')
    const reference = await ctx.db
      .query('campaignCurrencySystems')
      .withIndex('by_campaignId_isReference', (q) =>
        q.eq('campaignId', campaign.id).eq('isReference', true)
      )
      .unique()
    const first = await ctx.db
      .query('campaignCurrencySystems')
      .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaign.id))
      .first()
    if (first && !reference) throw new Error('Stored Campaign reference currency is unavailable.')
    const isReference = !first || input.isReference
    if (current?.isReference && !isReference)
      throw new Error('Set another reference system before changing this one.')
    const document = validateCurrencySystem({
      id: systemId,
      label: input.label,
      isReference,
      version: current ? current.version + 1 : 0,
      denominations: input.denominations.map((denomination) => ({
        ...denomination,
        id: denomination.id?.toLowerCase() ?? crypto.randomUUID()
      }))
    })
    for (const denomination of document.denominations) {
      const existing = await ctx.db
        .query('campaignCurrencyDenominations')
        .withIndex('by_publicId', (q) => q.eq('id', denomination.id))
        .unique()
      if (existing && (existing.campaignId !== campaign.id || existing.systemId !== systemId))
        throw new Error('Currency denomination ID already belongs to another system.')
    }
    const balances = current ? await readSystemBalances(ctx, campaign.id, systemId) : []
    const oldDenominations = new Map(
      prior?.document.denominations.map((entry) => [entry.id, entry]) ?? []
    )
    const proposed = new Map(document.denominations.map((entry) => [entry.id, entry]))
    const slots = new Set<string>()
    const rewrites = balances.map((balance) => {
      const previous = oldDenominations.get(balance.denominationId)
      const next = proposed.get(balance.denominationId)
      if (!previous) throw new Error('Stored currency denomination is unavailable.')
      if (!next && balance.amount > 0)
        throw new Error('A denomination with a positive balance cannot be removed.')
      const replacement = next ?? document.denominations[0]!
      const value = BigInt(balance.amount) * BigInt(previous.scaleInReference)
      const scale = BigInt(replacement.scaleInReference)
      if (value % scale !== 0n)
        throw new Error('Currency conversion must preserve every balance exactly.')
      const amount = value / scale
      if (amount > BigInt(Number.MAX_SAFE_INTEGER))
        throw new Error('Inventory amount exceeds the supported range.')
      const placement =
        balance.groupId === undefined
          ? `container:${balance.containerId ?? ''}`
          : `group:${balance.groupId}`
      const slot = `${balance.vehicleId ?? ''}:${placement}:${replacement.id}`
      if (slots.has(slot)) throw new Error('Currency replacement would duplicate a balance.')
      slots.add(slot)
      return { rowId: balance._id, denominationId: replacement.id, amount: Number(amount) }
    })
    const characterRewrites = current
      ? await prepareCampaignCharacterCurrencyRewrites(ctx, {
          campaign,
          systemId,
          oldDenominations,
          nextDenominations: document.denominations,
          remove: false
        })
      : []
    if (isReference && reference && reference.id !== systemId) {
      const previous = (await readCurrencySystem(ctx, reference)).document
      const demoted = campaignStoredCurrencySystemSchema.parse({
        campaignId: campaign.id,
        id: previous.id,
        label: previous.label,
        isReference: false,
        version: previous.version + 1
      })
      await ctx.db.patch(reference._id, demoted)
    }
    const { denominations, ...metadata } = document
    const stored = campaignStoredCurrencySystemSchema.parse({
      ...metadata,
      campaignId: campaign.id
    })
    if (current) await ctx.db.patch(current._id, stored)
    else await ctx.db.insert('campaignCurrencySystems', stored)
    for (const row of prior?.rows ?? []) await ctx.db.delete(row._id)
    for (const [sortOrder, denomination] of denominations.entries())
      await ctx.db.insert(
        'campaignCurrencyDenominations',
        campaignStoredCurrencyDenominationSchema.parse({
          ...denomination,
          campaignId: campaign.id,
          systemId,
          sortOrder
        })
      )
    for (const rewrite of rewrites)
      await ctx.db.patch(rewrite.rowId, {
        denominationId: rewrite.denominationId,
        amount: rewrite.amount
      })
    await applyCampaignCharacterCurrencyRewrites(ctx, characterRewrites)
    for (const vehicleId of new Set(balances.map((balance) => balance.vehicleId)))
      await incrementInventoryVersion(ctx, campaign.id, vehicleId)
    return presentCurrencySystem(document, campaign)
  }
})

export const remove = internalMutation({
  args: zodToConvexFields(deleteCampaignCurrencySystemInputSchema.shape),
  returns: v.null(),
  handler: async (ctx, args) => {
    const input = deleteCampaignCurrencySystemInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    const { campaign, membership } = await requireCampaignAuthority(ctx, input.campaignId, userId)
    if (membership.role !== 'OWNER')
      throw new Error('Only the Campaign owner can manage currency systems.')
    if (campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
    const current = await ctx.db
      .query('campaignCurrencySystems')
      .withIndex('by_campaignId_id', (q) =>
        q.eq('campaignId', campaign.id).eq('id', input.systemId.toLowerCase())
      )
      .unique()
    if (!current) throw new Error('Campaign currency system is unavailable.')
    const { rows } = await readCurrencySystem(ctx, current)
    if (current.version !== input.expectedVersion)
      throw new Error('Currency system changed before deletion.')
    if (current.isReference) {
      const systems = await ctx.db
        .query('campaignCurrencySystems')
        .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaign.id))
        .take(2)
      if (systems.length > 1)
        throw new Error('Set another reference system before deleting this one.')
    }
    const characterRewrites = await prepareCampaignCharacterCurrencyRewrites(ctx, {
      campaign,
      systemId: current.id,
      oldDenominations: new Map(rows.map((denomination) => [denomination.id, denomination])),
      nextDenominations: [],
      remove: true
    })
    const balances = await readSystemBalances(ctx, campaign.id, current.id)
    if (
      balances.some(
        (balance) => !rows.some((denomination) => denomination.id === balance.denominationId)
      )
    )
      throw new Error('Stored currency denomination is unavailable.')
    if (balances.some((balance) => balance.amount > 0))
      throw new Error('Currency system has positive balances.')
    for (const balance of balances) await ctx.db.delete(balance._id)
    for (const vehicleId of new Set(balances.map((balance) => balance.vehicleId)))
      await incrementInventoryVersion(ctx, campaign.id, vehicleId)
    await applyCampaignCharacterCurrencyRewrites(ctx, characterRewrites)
    for (const row of rows) await ctx.db.delete(row._id)
    await ctx.db.delete(current._id)
    return null
  }
})
