import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  CampaignVehicleDto,
  CreateCampaignVehicleInput
} from '@artificer-toolkit/schema/api/campaignVehicles'
import type {
  CampaignPartyCurrencyPage,
  CampaignPartyItemPage,
  CampaignVehicleInventoryListInput
} from '@artificer-toolkit/schema/api/campaignInventoryPages'
import type {
  CurrencySystemDto,
  SaveCampaignCurrencySystemInput
} from '@artificer-toolkit/schema/api/campaignInventory'
import {
  campaignStoredPartyCurrencyGroupSchema,
  campaignStoredPartyCurrencySchema,
  campaignStoredPartyInventorySchema,
  campaignStoredPartyItemSchema
} from '@artificer-toolkit/schema/projections/campaignInventoryPersistence'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { cart } from '@artificer-toolkit/source-data/srd/vehicles/cart.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { importedSubject, importSeededSubjects } from '../../tests/fixtures/publication'
import { readySheetFixture } from '../../tests/fixtures/readyCharacter'

const createCampaign = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
const createVehicle = makeFunctionReference<
  'mutation',
  CreateCampaignVehicleInput,
  CampaignVehicleDto
>('campaigns/vehicles:create')
const archiveCampaign = makeFunctionReference<
  'mutation',
  { campaignId: string; expectedVersion: number },
  CampaignDetailDto
>('campaigns/archive:archive')
const items = makeFunctionReference<
  'query',
  CampaignVehicleInventoryListInput,
  CampaignPartyItemPage
>('campaigns/vehicleInventory:items')
const currencies = makeFunctionReference<
  'query',
  CampaignVehicleInventoryListInput,
  CampaignPartyCurrencyPage
>('campaigns/vehicleInventory:currencies')
const saveSystem = makeFunctionReference<
  'mutation',
  SaveCampaignCurrencySystemInput,
  CurrencySystemDto
>('campaigns/currencySystems:save')

const campaignInput: CreateCampaignInput = {
  name: 'Vehicle inventory',
  format: 'ONGOING',
  toneTags: ['HEROIC'],
  contentMaturity: 'STANDARD',
  gameSystemId: srdSystemRecord.id,
  primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
}
const idFor = (index: number) => `30000000-0000-4000-8000-${String(index).padStart(12, '0')}`
const input = (
  campaignId: string,
  vehicleId: string,
  cursor: string | null = null,
  numItems = 48
): CampaignVehicleInventoryListInput => ({
  campaignId,
  vehicleId,
  paginationOpts: { cursor, numItems }
})

async function setup() {
  const base = await readySheetFixture()
  await importSeededSubjects(base.t, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [importedSubject({ subjectKind: 'VEHICLE', ...cart, document: cart })]
  })
  const campaign = await base.other.caller.mutation(createCampaign, campaignInput)
  await base.t.run((ctx) =>
    ctx.db.insert('campaignMemberships', {
      campaignId: campaign.id,
      userId: base.owner.userId,
      role: 'PLAYER',
      status: 'ACTIVE',
      accessStartedAt: campaign.createdAt,
      joinedAt: campaign.createdAt,
      leftAt: null
    })
  )
  const vehicle = await base.other.caller.mutation(createVehicle, {
    campaignId: campaign.id,
    vehicleDefinitionId: cart.id
  })
  const otherVehicle = await base.other.caller.mutation(createVehicle, {
    campaignId: campaign.id,
    vehicleDefinitionId: cart.id
  })
  return { ...base, campaign, vehicle, otherVehicle }
}

async function seedOwner(
  t: Awaited<ReturnType<typeof setup>>['t'],
  campaignId: string,
  vehicleId: string,
  version = 3
) {
  await t.run((ctx) =>
    ctx.db.insert(
      'campaignPartyInventories',
      campaignStoredPartyInventorySchema.parse({ campaignId, vehicleId, version })
    )
  )
}

describe('native Campaign Vehicle inventory reads', () => {
  it('reads only the requested Vehicle scope, permits active Players and archived Campaigns, and preserves v0 empty owners', async () => {
    const base = await setup()
    await seedOwner(base.t, base.campaign.id, base.vehicle.id, 4)
    await seedOwner(base.t, base.campaign.id, base.otherVehicle.id, 8)
    const foreignCampaign = await base.owner.caller.mutation(createCampaign, {
      ...campaignInput,
      name: 'Foreign cargo'
    })
    const foreignVehicle = await base.owner.caller.mutation(createVehicle, {
      campaignId: foreignCampaign.id,
      vehicleDefinitionId: cart.id
    })
    await seedOwner(base.t, foreignCampaign.id, foreignVehicle.id)
    await base.t.run(async (ctx) => {
      await ctx.db.insert(
        'campaignPartyInventories',
        campaignStoredPartyInventorySchema.parse({
          campaignId: base.campaign.id,
          version: 1
        })
      )
      await ctx.db.insert(
        'campaignPartyItems',
        campaignStoredPartyItemSchema.parse({
          campaignId: base.campaign.id,
          id: idFor(1),
          equipmentId: club.id,
          quantity: 9,
          containerId: null
        })
      )
      for (let index = 0; index < 10; index++)
        await ctx.db.insert(
          'campaignPartyItems',
          campaignStoredPartyItemSchema.parse({
            campaignId: base.campaign.id,
            vehicleId: base.vehicle.id,
            id: idFor(10 + index),
            equipmentId: club.id,
            quantity: index + 1,
            containerId: null
          })
        )
      await ctx.db.insert(
        'campaignPartyItems',
        campaignStoredPartyItemSchema.parse({
          campaignId: base.campaign.id,
          vehicleId: base.otherVehicle.id,
          id: idFor(2),
          equipmentId: club.id,
          quantity: 3,
          containerId: null
        })
      )
      await ctx.db.insert(
        'campaignPartyItems',
        campaignStoredPartyItemSchema.parse({
          campaignId: foreignCampaign.id,
          vehicleId: foreignVehicle.id,
          id: idFor(3),
          equipmentId: club.id,
          quantity: 4,
          containerId: null
        })
      )
    })
    const storedBefore = await base.t.run((ctx) =>
      Promise.all([
        ctx.db.query('campaignVehicles').collect(),
        ctx.db.query('campaignPartyInventories').collect(),
        ctx.db.query('campaignPartyItems').collect(),
        ctx.db.query('campaignPartyCurrencies').collect()
      ])
    )
    const vehicleItems: CampaignPartyItemPage['page'] = []
    let cursor: string | null = null
    let vehiclePage: CampaignPartyItemPage | undefined
    for (let pageNumber = 0; pageNumber < 4; pageNumber++) {
      vehiclePage = await base.owner.caller.query(
        items,
        input(base.campaign.id.toUpperCase(), base.vehicle.id.toUpperCase(), cursor)
      )
      expect(vehiclePage.owner).toEqual({ kind: 'VEHICLE', vehicleId: base.vehicle.id })
      expect(vehiclePage.version).toBe(4)
      expect(vehiclePage.page.length).toBeLessThanOrEqual(48)
      vehicleItems.push(...vehiclePage.page)
      if (vehiclePage.isDone) break
      cursor = vehiclePage.continueCursor
    }
    expect(vehiclePage?.isDone).toBe(true)
    expect(vehicleItems).toEqual(
      Array.from({ length: 10 }, (_, index) => ({
        id: idFor(10 + index),
        label: club.label,
        quantity: index + 1,
        containerId: null,
        isContainer: false
      }))
    )
    expect(new Set(vehicleItems.map((row) => row.id)).size).toBe(10)
    expect(
      await base.owner.caller.query(items, input(base.campaign.id, base.otherVehicle.id))
    ).toMatchObject({
      page: [expect.objectContaining({ id: idFor(2), quantity: 3 })],
      owner: { kind: 'VEHICLE', vehicleId: base.otherVehicle.id },
      version: 8
    })
    expect(
      await base.t.run((ctx) =>
        Promise.all([
          ctx.db.query('campaignVehicles').collect(),
          ctx.db.query('campaignPartyInventories').collect(),
          ctx.db.query('campaignPartyItems').collect(),
          ctx.db.query('campaignPartyCurrencies').collect()
        ])
      )
    ).toEqual(storedBefore)
    const empty = await base.other.caller.mutation(createVehicle, {
      campaignId: base.campaign.id,
      vehicleDefinitionId: cart.id
    })
    expect(await base.other.caller.query(items, input(base.campaign.id, empty.id))).toMatchObject({
      owner: { kind: 'VEHICLE', vehicleId: empty.id },
      version: 0,
      page: []
    })
    expect(
      await base.other.caller.query(currencies, input(base.campaign.id, empty.id))
    ).toMatchObject({ owner: { kind: 'VEHICLE', vehicleId: empty.id }, version: 0, page: [] })
    await base.other.caller.mutation(archiveCampaign, {
      campaignId: base.campaign.id,
      expectedVersion: 0
    })
    await expect(
      base.owner.caller.query(items, input(base.campaign.id, base.vehicle.id))
    ).resolves.toMatchObject({ version: 4 })
  })

  it('isolates currency scopes, traverses more than 48 rows completely, and retains original stored text', async () => {
    const base = await setup()
    const system = await base.other.caller.mutation(saveSystem, {
      campaignId: base.campaign.id,
      label: 'Fucking Coins',
      isReference: true,
      denominations: [
        {
          id: srdSystemRecord.currencies[3]!.id,
          label: 'Shit Coin',
          abbreviation: 'shit',
          scaleInReference: 1
        }
      ]
    })
    const denominationId = system.denominations[0]!.id
    await base.t.run(async (ctx) => {
      await ctx.db.insert(
        'campaignPartyInventories',
        campaignStoredPartyInventorySchema.parse({
          campaignId: base.campaign.id,
          version: 1
        })
      )
      await ctx.db.insert(
        'campaignPartyCurrencies',
        campaignStoredPartyCurrencySchema.parse({
          campaignId: base.campaign.id,
          id: idFor(97),
          denominationId,
          campaignCurrencySystemId: system.id,
          amount: 99,
          containerId: null
        })
      )
      await ctx.db.insert(
        'campaignPartyInventories',
        campaignStoredPartyInventorySchema.parse({
          campaignId: base.campaign.id,
          vehicleId: base.vehicle.id,
          version: 6
        })
      )
      await ctx.db.insert(
        'campaignPartyInventories',
        campaignStoredPartyInventorySchema.parse({
          campaignId: base.campaign.id,
          vehicleId: base.otherVehicle.id,
          version: 9
        })
      )
      await ctx.db.insert(
        'campaignPartyCurrencies',
        campaignStoredPartyCurrencySchema.parse({
          campaignId: base.campaign.id,
          vehicleId: base.vehicle.id,
          id: idFor(99),
          denominationId: srdSystemRecord.currencies[3]!.id,
          amount: 77,
          containerId: null
        })
      )
      await ctx.db.insert(
        'campaignPartyCurrencies',
        campaignStoredPartyCurrencySchema.parse({
          campaignId: base.campaign.id,
          vehicleId: base.otherVehicle.id,
          id: idFor(98),
          denominationId,
          campaignCurrencySystemId: system.id,
          amount: 88,
          containerId: null
        })
      )
      for (let index = 0; index < 49; index++) {
        const groupId = idFor(200 + index)
        await ctx.db.insert(
          'campaignPartyCurrencyGroups',
          campaignStoredPartyCurrencyGroupSchema.parse({
            campaignId: base.campaign.id,
            vehicleId: base.vehicle.id,
            id: groupId,
            containerId: null
          })
        )
        await ctx.db.insert(
          'campaignPartyCurrencies',
          campaignStoredPartyCurrencySchema.parse({
            campaignId: base.campaign.id,
            vehicleId: base.vehicle.id,
            id: idFor(100 + index),
            groupId,
            denominationId,
            campaignCurrencySystemId: system.id,
            amount: index + 1,
            containerId: null
          })
        )
      }
    })
    const storedBefore = await base.t.run((ctx) =>
      Promise.all([
        ctx.db.query('campaignCurrencySystems').collect(),
        ctx.db.query('campaignCurrencyDenominations').collect(),
        ctx.db.query('campaignPartyCurrencyGroups').collect(),
        ctx.db.query('campaignPartyCurrencies').collect(),
        ctx.db.query('campaignPartyInventories').collect()
      ])
    )
    let cursor: string | null = null
    const found: string[] = []
    const allRows: CampaignPartyCurrencyPage['page'] = []
    let last: CampaignPartyCurrencyPage | undefined
    for (let pageNumber = 0; pageNumber < 4; pageNumber++) {
      last = await base.owner.caller.query(
        currencies,
        input(base.campaign.id, base.vehicle.id, cursor)
      )
      expect(last.page.length).toBeLessThanOrEqual(48)
      expect(last.owner).toEqual({ kind: 'VEHICLE', vehicleId: base.vehicle.id })
      expect(last.version).toBe(6)
      allRows.push(...last.page)
      found.push(
        ...last.page.map((row) => `${row.denominationId}:${row.amount}:${row.containerId ?? ''}`)
      )
      if (last.isDone) break
      cursor = last.continueCursor
    }
    expect(last?.isDone).toBe(true)
    expect(found).toHaveLength(50)
    expect(new Set(found).size).toBe(50)
    const systemCurrency = srdSystemRecord.currencies[3]!
    expect(allRows).toEqual([
      {
        kind: 'RULESET',
        denominationId: systemCurrency.id,
        label: systemCurrency.label,
        abbreviation: systemCurrency.short ?? systemCurrency.code,
        amount: 77,
        containerId: null
      },
      ...Array.from({ length: 49 }, (_, index) => ({
        kind: 'CAMPAIGN',
        campaignCurrencySystemId: system.id,
        denominationId,
        label: '**** Coin',
        abbreviation: '****',
        amount: index + 1,
        containerId: null
      }))
    ])
    expect(storedBefore[0]).toEqual([expect.objectContaining({ label: 'Fucking Coins' })])
    expect(storedBefore[1]).toEqual([
      expect.objectContaining({ label: 'Shit Coin', abbreviation: 'shit' })
    ])
    expect(
      await base.t.run((ctx) =>
        Promise.all([
          ctx.db.query('campaignCurrencySystems').collect(),
          ctx.db.query('campaignCurrencyDenominations').collect(),
          ctx.db.query('campaignPartyCurrencyGroups').collect(),
          ctx.db.query('campaignPartyCurrencies').collect(),
          ctx.db.query('campaignPartyInventories').collect()
        ])
      )
    ).toEqual(storedBefore)
  })

  it('allows missing Vehicle definitions but fails closed for missing owners, malformed rows, and missing Equipment', async () => {
    const base = await setup()
    await seedOwner(base.t, base.campaign.id, base.vehicle.id)
    await base.t.run(async (ctx) =>
      ctx.db.insert(
        'campaignPartyItems',
        campaignStoredPartyItemSchema.parse({
          campaignId: base.campaign.id,
          vehicleId: base.vehicle.id,
          id: idFor(30),
          equipmentId: club.id,
          quantity: 1,
          containerId: null
        })
      )
    )
    const rootId = await base.t.run(
      async (ctx) =>
        (await ctx.db
          .query('authoredRoots')
          .withIndex('by_publicId', (q) => q.eq('id', cart.id))
          .unique())!._id
    )
    await base.t.run((ctx) => ctx.db.delete(rootId))
    await expect(
      base.other.caller.query(items, input(base.campaign.id, base.vehicle.id))
    ).resolves.toMatchObject({ version: 3, page: [{ id: idFor(30) }] })
    await base.t.run(async (ctx) => {
      const row = await ctx.db
        .query('campaignPartyItems')
        .withIndex('by_campaignId_vehicleId_id', (q) =>
          q.eq('campaignId', base.campaign.id).eq('vehicleId', base.vehicle.id).eq('id', idFor(30))
        )
        .unique()
      if (!row) throw new Error('Missing item')
      await ctx.db.patch(row._id, { quantity: 0 })
    })
    await expect(
      base.other.caller.query(items, input(base.campaign.id, base.vehicle.id))
    ).rejects.toThrow()
    await base.t.run(async (ctx) => {
      const row = await ctx.db
        .query('campaignPartyItems')
        .withIndex('by_campaignId_vehicleId_id', (q) =>
          q.eq('campaignId', base.campaign.id).eq('vehicleId', base.vehicle.id).eq('id', idFor(30))
        )
        .unique()
      if (!row) throw new Error('Missing item')
      await ctx.db.patch(row._id, { quantity: 1, equipmentId: idFor(31) })
    })
    await expect(
      base.other.caller.query(items, input(base.campaign.id, base.vehicle.id))
    ).rejects.toThrow('unavailable')
    await base.t.run(async (ctx) => {
      const owner = await ctx.db
        .query('campaignPartyInventories')
        .withIndex('by_campaignId_vehicleId', (q) =>
          q.eq('campaignId', base.campaign.id).eq('vehicleId', base.vehicle.id)
        )
        .unique()
      if (!owner) throw new Error('Missing owner')
      await ctx.db.delete(owner._id)
    })
    await expect(
      base.other.caller.query(items, input(base.campaign.id, base.vehicle.id))
    ).rejects.toThrow('owner')
    await expect(
      base.other.caller.query(currencies, input(base.campaign.id, base.vehicle.id))
    ).rejects.toThrow('owner')
  })

  it('rejects anonymous, foreign, LEFT, missing, and malformed Vehicle requests', async () => {
    const base = await setup()
    await seedOwner(base.t, base.campaign.id, base.vehicle.id)
    const foreign = await base.owner.caller.mutation(createCampaign, {
      ...campaignInput,
      name: 'Foreign inventory'
    })
    await base.t.run((ctx) =>
      ctx.db.insert(
        'campaignPartyCurrencies',
        campaignStoredPartyCurrencySchema.parse({
          campaignId: base.campaign.id,
          vehicleId: base.vehicle.id,
          id: idFor(40),
          denominationId: srdSystemRecord.currencies[3]!.id,
          amount: 2,
          containerId: null
        })
      )
    )
    await expect(base.t.query(items, input(base.campaign.id, base.vehicle.id))).rejects.toThrow(
      'Unauthenticated'
    )
    await expect(
      base.t.query(currencies, input(base.campaign.id, base.vehicle.id))
    ).rejects.toThrow('Unauthenticated')
    await expect(
      base.other.caller.query(items, input(foreign.id, base.vehicle.id))
    ).rejects.toThrow('Campaign not found')
    await expect(
      base.owner.caller.query(items, input(foreign.id, base.vehicle.id))
    ).rejects.toThrow('unavailable')
    await expect(
      base.owner.caller.query(currencies, input(foreign.id, base.vehicle.id))
    ).rejects.toThrow('unavailable')
    await expect(
      base.other.caller.query(items, input(base.campaign.id, crypto.randomUUID()))
    ).rejects.toThrow('unavailable')
    await expect(
      base.other.caller.query(currencies, input(base.campaign.id, crypto.randomUUID()))
    ).rejects.toThrow('unavailable')
    await expect(
      base.other.caller.query(items, {
        campaignId: base.campaign.id,
        vehicleId: base.vehicle.id,
        paginationOpts: { cursor: null, numItems: 0 }
      })
    ).rejects.toThrow()
    await expect(
      base.other.caller.query(currencies, {
        campaignId: base.campaign.id,
        vehicleId: base.vehicle.id,
        paginationOpts: { cursor: null, numItems: 0 }
      })
    ).rejects.toThrow()
    await expect(
      base.other.caller.query(items, input(base.campaign.id, 'not-a-uuid'))
    ).rejects.toThrow()
    await expect(
      base.other.caller.query(currencies, input(base.campaign.id, 'not-a-uuid'))
    ).rejects.toThrow()
    await base.t.run(async (ctx) => {
      const membership = await ctx.db
        .query('campaignMemberships')
        .withIndex('by_campaignId_userId', (q) =>
          q.eq('campaignId', base.campaign.id).eq('userId', base.owner.userId)
        )
        .unique()
      if (!membership) throw new Error('Missing membership')
      await ctx.db.patch(membership._id, { status: 'LEFT', leftAt: new Date().toISOString() })
    })
    await expect(
      base.owner.caller.query(items, input(base.campaign.id, base.vehicle.id))
    ).rejects.toThrow('Campaign not found')
    await expect(
      base.owner.caller.query(currencies, input(base.campaign.id, base.vehicle.id))
    ).rejects.toThrow('Campaign not found')
  })
})
