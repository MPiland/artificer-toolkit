import { makeFunctionReference } from 'convex/server'
import { describe, expect, it, vi } from 'vitest'
import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  CampaignVehicleDto,
  CampaignVehicleLifecycleInput,
  CampaignVehicleLifecycleResult,
  CreateCampaignVehicleInput
} from '@artificer-toolkit/schema/api/campaignVehicles'
import type {
  CampaignPartyItemPage,
  CampaignVehicleInventoryListInput
} from '@artificer-toolkit/schema/api/campaignInventoryPages'
import {
  campaignStoredPartyCurrencyGroupSchema,
  campaignStoredPartyCurrencySchema,
  campaignStoredPartyInventorySchema,
  campaignStoredPartyItemSchema
} from '@artificer-toolkit/schema/projections/campaignInventoryPersistence'
import { campaignStoredEventSchema } from '@artificer-toolkit/schema/projections/campaignEventPersistence'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { cart } from '@artificer-toolkit/source-data/srd/vehicles/cart.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { api } from '../_generated/api'
import { importedSubject, publicationFixture } from '../../tests/fixtures/publication'

const createCampaign = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
const createVehicle = makeFunctionReference<
  'mutation',
  CreateCampaignVehicleInput,
  CampaignVehicleDto
>('campaigns/vehicles:create')
const lifecycle = makeFunctionReference<
  'mutation',
  { input: CampaignVehicleLifecycleInput },
  CampaignVehicleLifecycleResult
>('campaigns/vehicles:lifecycle')
const vehicleItems = makeFunctionReference<
  'query',
  CampaignVehicleInventoryListInput,
  CampaignPartyItemPage
>('campaigns/vehicleInventory:items')

async function setup() {
  const base = await publicationFixture(
    import.meta.glob('/apps/apis/convex/**/*.*s'),
    import.meta.glob('../betterAuth/**/*.*s'),
    [
      [
        importedSubject({ subjectKind: 'VEHICLE', ...cart, document: cart }),
        importedSubject({ subjectKind: 'EQUIPMENT', ...club, document: club })
      ]
    ]
  )
  const campaign = await base.first.caller.mutation(createCampaign, {
    name: 'Vehicle lifecycle',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  await base.t.run((ctx) =>
    ctx.db.insert('campaignMemberships', {
      campaignId: campaign.id,
      userId: base.second.userId,
      role: 'PLAYER',
      status: 'ACTIVE',
      accessStartedAt: campaign.createdAt,
      joinedAt: campaign.createdAt,
      leftAt: null
    })
  )
  const vehicle = await base.first.caller.mutation(createVehicle, {
    campaignId: campaign.id,
    vehicleDefinitionId: cart.id
  })
  return { base, campaign, vehicle }
}

function lifecycleInput(
  campaignId: string,
  vehicleId: string,
  action: CampaignVehicleLifecycleInput['action'],
  expectedVersion: number,
  idempotencyKey = crypto.randomUUID()
): CampaignVehicleLifecycleInput {
  if (action === 'REMOVE_RETURN_CARGO')
    return {
      action,
      campaignId,
      vehicleId,
      expectedVersion,
      expectedInventoryVersion: 4,
      expectedPartyInventoryVersion: 5,
      idempotencyKey
    }
  if (action === 'REMOVE_DESTROY_CARGO')
    return {
      action,
      campaignId,
      vehicleId,
      expectedVersion,
      expectedInventoryVersion: 4,
      idempotencyKey
    }
  return { action, campaignId, vehicleId, expectedVersion, idempotencyKey }
}

async function seedDestroyCargo({ base, campaign, vehicle }: Awaited<ReturnType<typeof setup>>) {
  const rootItemId = crypto.randomUUID()
  const nestedItemId = crypto.randomUUID()
  const emptyGroupId = crypto.randomUUID()
  const populatedGroupId = crypto.randomUUID()
  const groupedBalanceId = crypto.randomUUID()
  const looseBalanceId = crypto.randomUUID()
  const denominationId = srdSystemRecord.currencies[0]?.id
  if (!denominationId) throw new Error('SRD currency denomination fixture is unavailable.')
  await base.t.run(async (ctx) => {
    await ctx.db.insert(
      'campaignPartyInventories',
      campaignStoredPartyInventorySchema.parse({
        campaignId: campaign.id,
        vehicleId: vehicle.id,
        version: 4
      })
    )
    await ctx.db.insert(
      'campaignPartyInventories',
      campaignStoredPartyInventorySchema.parse({ campaignId: campaign.id, version: 5 })
    )
    await ctx.db.insert(
      'campaignPartyItems',
      campaignStoredPartyItemSchema.parse({
        campaignId: campaign.id,
        vehicleId: vehicle.id,
        id: rootItemId,
        equipmentId: club.id,
        quantity: 1,
        containerId: null
      })
    )
    await ctx.db.insert(
      'campaignPartyItems',
      campaignStoredPartyItemSchema.parse({
        campaignId: campaign.id,
        vehicleId: vehicle.id,
        id: nestedItemId,
        equipmentId: club.id,
        quantity: 2,
        containerId: rootItemId
      })
    )
    await ctx.db.insert(
      'campaignPartyCurrencyGroups',
      campaignStoredPartyCurrencyGroupSchema.parse({
        campaignId: campaign.id,
        vehicleId: vehicle.id,
        id: emptyGroupId,
        containerId: null
      })
    )
    await ctx.db.insert(
      'campaignPartyCurrencyGroups',
      campaignStoredPartyCurrencyGroupSchema.parse({
        campaignId: campaign.id,
        vehicleId: vehicle.id,
        id: populatedGroupId,
        containerId: rootItemId
      })
    )
    await ctx.db.insert(
      'campaignPartyCurrencies',
      campaignStoredPartyCurrencySchema.parse({
        campaignId: campaign.id,
        vehicleId: vehicle.id,
        id: groupedBalanceId,
        groupId: populatedGroupId,
        denominationId,
        amount: 7,
        containerId: rootItemId
      })
    )
    await ctx.db.insert(
      'campaignPartyCurrencies',
      campaignStoredPartyCurrencySchema.parse({
        campaignId: campaign.id,
        vehicleId: vehicle.id,
        id: looseBalanceId,
        denominationId,
        amount: 11,
        containerId: nestedItemId
      })
    )
  })
}

async function cargoSnapshot({ base, campaign, vehicle }: Awaited<ReturnType<typeof setup>>) {
  return base.t.run(async (ctx) => ({
    vehicle: await ctx.db
      .query('campaignVehicles')
      .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaign.id).eq('id', vehicle.id))
      .unique(),
    vehicleInventory: await ctx.db
      .query('campaignPartyInventories')
      .withIndex('by_campaignId_vehicleId', (q) =>
        q.eq('campaignId', campaign.id).eq('vehicleId', vehicle.id)
      )
      .unique(),
    partyInventory: await ctx.db
      .query('campaignPartyInventories')
      .withIndex('by_campaignId_vehicleId', (q) =>
        q.eq('campaignId', campaign.id).eq('vehicleId', undefined)
      )
      .unique(),
    items: await ctx.db
      .query('campaignPartyItems')
      .withIndex('by_campaignId_vehicleId_id', (q) =>
        q.eq('campaignId', campaign.id).eq('vehicleId', vehicle.id)
      )
      .collect(),
    groups: await ctx.db
      .query('campaignPartyCurrencyGroups')
      .withIndex('by_campaignId_vehicleId_id', (q) =>
        q.eq('campaignId', campaign.id).eq('vehicleId', vehicle.id)
      )
      .collect(),
    balances: await ctx.db
      .query('campaignPartyCurrencies')
      .withIndex('by_campaignId_vehicleId_id', (q) =>
        q.eq('campaignId', campaign.id).eq('vehicleId', vehicle.id)
      )
      .collect()
  }))
}

describe('native Campaign Vehicle lifecycle', () => {
  it('hides unavailable Vehicles from Players, lets Owners inspect cargo, restores it, returns cargo, and replays after removal', async () => {
    const { base, campaign, vehicle } = await setup()
    const itemId = crypto.randomUUID()
    await base.t.run(async (ctx) => {
      await ctx.db.insert(
        'campaignPartyInventories',
        campaignStoredPartyInventorySchema.parse({
          campaignId: campaign.id,
          vehicleId: vehicle.id,
          version: 4
        })
      )
      await ctx.db.insert(
        'campaignPartyInventories',
        campaignStoredPartyInventorySchema.parse({ campaignId: campaign.id, version: 5 })
      )
      await ctx.db.insert(
        'campaignPartyItems',
        campaignStoredPartyItemSchema.parse({
          campaignId: campaign.id,
          vehicleId: vehicle.id,
          id: itemId,
          equipmentId: club.id,
          quantity: 1,
          containerId: null
        })
      )
    })
    const unavailable = lifecycleInput(campaign.id, vehicle.id, 'MAKE_UNAVAILABLE', 0)
    await base.first.caller.mutation(lifecycle, { input: unavailable })
    expect(
      (
        await base.first.caller.query(api.campaigns.vehicles.list, {
          campaignId: campaign.id,
          paginationOpts: { cursor: null, numItems: 8 }
        })
      ).page
    ).toEqual([expect.objectContaining({ id: vehicle.id, availability: 'UNAVAILABLE' })])
    expect(
      (
        await base.second.caller.query(api.campaigns.vehicles.list, {
          campaignId: campaign.id,
          paginationOpts: { cursor: null, numItems: 8 }
        })
      ).page
    ).toEqual([])
    expect(
      (
        await base.first.caller.query(vehicleItems, {
          campaignId: campaign.id,
          vehicleId: vehicle.id,
          paginationOpts: { cursor: null, numItems: 8 }
        })
      ).page
    ).toEqual([expect.objectContaining({ id: itemId, label: 'Club', quantity: 1 })])
    await expect(
      base.second.caller.query(vehicleItems, {
        campaignId: campaign.id,
        vehicleId: vehicle.id,
        paginationOpts: { cursor: null, numItems: 8 }
      })
    ).rejects.toThrow('owner is unavailable')

    await base.first.caller.mutation(lifecycle, {
      input: lifecycleInput(campaign.id, vehicle.id, 'RESTORE', 1)
    })
    expect(
      (
        await base.first.caller.query(vehicleItems, {
          campaignId: campaign.id,
          vehicleId: vehicle.id,
          paginationOpts: { cursor: null, numItems: 8 }
        })
      ).page
    ).toEqual([expect.objectContaining({ id: itemId, label: 'Club', quantity: 1 })])
    const remove = lifecycleInput(campaign.id, vehicle.id, 'REMOVE_RETURN_CARGO', 2)
    const result = await base.first.caller.mutation(lifecycle, { input: remove })
    expect(await base.first.caller.mutation(lifecycle, { input: remove })).toEqual(result)
    await expect(base.second.caller.mutation(lifecycle, { input: remove })).rejects.toThrow(
      'Only the Campaign owner'
    )
    await base.t.run(async (ctx) => {
      expect(
        await ctx.db
          .query('campaignVehicles')
          .withIndex('by_campaignId_id', (q) =>
            q.eq('campaignId', campaign.id).eq('id', vehicle.id)
          )
          .unique()
      ).toBeNull()
      expect(
        await ctx.db
          .query('campaignPartyItems')
          .withIndex('by_campaignId_vehicleId_id', (q) =>
            q.eq('campaignId', campaign.id).eq('vehicleId', undefined).eq('id', itemId)
          )
          .unique()
      ).toMatchObject({ id: itemId })
      expect(
        await ctx.db
          .query('campaignEvents')
          .withIndex('by_campaignId_id', (q) =>
            q.eq('campaignId', campaign.id).eq('id', result.eventId)
          )
          .unique()
      ).toMatchObject({ visibility: 'OWNER' })
    })
  })

  it('destroys nested cargo and currencies, preserves the party inventory, and replays after removal', async () => {
    const fixture = await setup()
    await seedDestroyCargo(fixture)
    const stale: Extract<CampaignVehicleLifecycleInput, { action: 'REMOVE_DESTROY_CARGO' }> = {
      action: 'REMOVE_DESTROY_CARGO',
      campaignId: fixture.campaign.id,
      vehicleId: fixture.vehicle.id,
      expectedVersion: 0,
      expectedInventoryVersion: 3,
      idempotencyKey: crypto.randomUUID()
    }
    const before = await cargoSnapshot(fixture)
    await expect(fixture.base.first.caller.mutation(lifecycle, { input: stale })).rejects.toThrow(
      'inventory changed'
    )
    expect(await cargoSnapshot(fixture)).toEqual(before)

    const remove = lifecycleInput(
      fixture.campaign.id,
      fixture.vehicle.id,
      'REMOVE_DESTROY_CARGO',
      0
    )
    const result = await fixture.base.first.caller.mutation(lifecycle, { input: remove })
    expect(await fixture.base.first.caller.mutation(lifecycle, { input: remove })).toEqual(result)
    const after = await cargoSnapshot(fixture)
    expect(after.vehicle).toBeNull()
    expect(after.vehicleInventory).toBeNull()
    expect(after.partyInventory).toEqual(before.partyInventory)
    expect(after.items).toEqual([])
    expect(after.groups).toEqual([])
    expect(after.balances).toEqual([])
  })

  it('rolls back every Vehicle cargo deletion when the final lifecycle audit cannot be stored', async () => {
    const fixture = await setup()
    await seedDestroyCargo(fixture)
    const before = await cargoSnapshot(fixture)
    const parse = vi.spyOn(campaignStoredEventSchema, 'parse').mockImplementationOnce(() => {
      throw new Error('injected lifecycle audit failure')
    })
    try {
      await expect(
        fixture.base.first.caller.mutation(lifecycle, {
          input: lifecycleInput(fixture.campaign.id, fixture.vehicle.id, 'REMOVE_DESTROY_CARGO', 0)
        })
      ).rejects.toThrow('injected lifecycle audit failure')
    } finally {
      parse.mockRestore()
    }
    expect(await cargoSnapshot(fixture)).toEqual(before)
  })

  it('rolls back availability changes when the final lifecycle audit cannot be stored', async () => {
    const { base, campaign, vehicle } = await setup()
    const before = await base.t.run((ctx) =>
      ctx.db
        .query('campaignVehicles')
        .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaign.id).eq('id', vehicle.id))
        .unique()
    )
    const parse = vi.spyOn(campaignStoredEventSchema, 'parse').mockImplementationOnce(() => {
      throw new Error('injected lifecycle audit failure')
    })
    try {
      await expect(
        base.first.caller.mutation(lifecycle, {
          input: lifecycleInput(campaign.id, vehicle.id, 'MAKE_UNAVAILABLE', 0)
        })
      ).rejects.toThrow('injected lifecycle audit failure')
    } finally {
      parse.mockRestore()
    }
    expect(
      await base.t.run((ctx) =>
        ctx.db
          .query('campaignVehicles')
          .withIndex('by_campaignId_id', (q) =>
            q.eq('campaignId', campaign.id).eq('id', vehicle.id)
          )
          .unique()
      )
    ).toEqual(before)
  })
})
