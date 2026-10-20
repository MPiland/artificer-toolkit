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
  CampaignPartyInventoryMutationInput,
  CurrencySystemDto,
  SaveCampaignCurrencySystemInput
} from '@artificer-toolkit/schema/api/campaignInventory'
import type {
  CampaignPartyCurrencyPage,
  CampaignPartyItemPage,
  CampaignPartyInventoryListInput
} from '@artificer-toolkit/schema/api/campaignInventoryPages'
import {
  campaignStoredPartyCurrencySchema,
  campaignStoredPartyInventorySchema,
  campaignStoredPartyItemSchema
} from '@artificer-toolkit/schema/projections/campaignInventoryPersistence'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { cart } from '@artificer-toolkit/source-data/srd/vehicles/cart.js'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
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
const removeVehicle = makeFunctionReference<
  'mutation',
  { campaignId: string; vehicleId: string; expectedVersion: number },
  null
>('campaigns/vehicles:remove')
const listItems = makeFunctionReference<
  'query',
  CampaignPartyInventoryListInput,
  CampaignPartyItemPage
>('campaigns/partyInventory:items')
const listCurrencies = makeFunctionReference<
  'query',
  CampaignPartyInventoryListInput,
  CampaignPartyCurrencyPage
>('campaigns/partyInventory:currencies')
const mutateParty = makeFunctionReference<
  'mutation',
  { input: CampaignPartyInventoryMutationInput },
  { eventId: string }
>('campaigns/partyInventoryCommands:mutate')
const saveSystem = makeFunctionReference<
  'mutation',
  SaveCampaignCurrencySystemInput,
  CurrencySystemDto
>('campaigns/currencySystems:save')
const removeSystem = makeFunctionReference<
  'mutation',
  { campaignId: string; systemId: string; expectedVersion: number },
  null
>('campaigns/currencySystems:remove')

const campaignInput: CreateCampaignInput = {
  name: 'Vehicle custody',
  format: 'ONGOING',
  toneTags: ['HEROIC'],
  contentMaturity: 'STANDARD',
  gameSystemId: srdSystemRecord.id,
  primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
}
const idFor = (index: number) => `20000000-0000-4000-8000-${String(index).padStart(12, '0')}`
const denomination = (id: string, label: string, scaleInReference: number) => ({
  id,
  label,
  abbreviation: label.slice(0, 2).toLowerCase(),
  scaleInReference
})
const page = (campaignId: string): CampaignPartyInventoryListInput => ({
  campaignId,
  paginationOpts: { cursor: null, numItems: 48 }
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
  const secondVehicle = await base.other.caller.mutation(createVehicle, {
    campaignId: campaign.id,
    vehicleDefinitionId: cart.id
  })
  return { ...base, campaign, vehicle, secondVehicle }
}

async function seedOwners(
  t: Awaited<ReturnType<typeof setup>>['t'],
  campaignId: string,
  vehicleIds: string[]
) {
  await t.run(async (ctx) => {
    await ctx.db.insert(
      'campaignPartyInventories',
      campaignStoredPartyInventorySchema.parse({ campaignId, version: 0 })
    )
    for (const vehicleId of vehicleIds)
      await ctx.db.insert(
        'campaignPartyInventories',
        campaignStoredPartyInventorySchema.parse({ campaignId, vehicleId, version: 0 })
      )
  })
}

describe('native Campaign Vehicle custody boundaries', () => {
  it('isolates party reads and mutations from Vehicle balances and items', async () => {
    const base = await setup()
    const system = await base.other.caller.mutation(saveSystem, {
      campaignId: base.campaign.id,
      label: 'Coins',
      isReference: true,
      denominations: [denomination(idFor(1), 'Base', 1)]
    })
    await seedOwners(base.t, base.campaign.id, [base.vehicle.id])
    await base.t.run(async (ctx) => {
      for (const vehicleId of [undefined, base.vehicle.id]) {
        await ctx.db.insert(
          'campaignPartyCurrencies',
          campaignStoredPartyCurrencySchema.parse({
            campaignId: base.campaign.id,
            ...(vehicleId ? { vehicleId } : {}),
            id: crypto.randomUUID(),
            denominationId: idFor(1),
            campaignCurrencySystemId: system.id,
            amount: vehicleId ? 20 : 10,
            containerId: null
          })
        )
        await ctx.db.insert(
          'campaignPartyItems',
          campaignStoredPartyItemSchema.parse({
            campaignId: base.campaign.id,
            ...(vehicleId ? { vehicleId } : {}),
            id: crypto.randomUUID(),
            equipmentId: club.id,
            quantity: 2,
            containerId: null
          })
        )
      }
    })
    expect((await base.other.caller.query(listCurrencies, page(base.campaign.id))).page).toEqual([
      expect.objectContaining({ amount: 10 })
    ])
    const partyItems = await base.other.caller.query(listItems, page(base.campaign.id))
    expect(partyItems.page).toHaveLength(1)
    await expect(
      base.other.caller.mutation(mutateParty, {
        input: {
          campaignId: base.campaign.id,
          expectedOwnerVersion: 0,
          idempotencyKey: crypto.randomUUID(),
          kind: 'CURRENCY_ADJUST',
          denominationId: idFor(1),
          amount: -11
        }
      })
    ).rejects.toThrow('enough currency')
    await base.other.caller.mutation(mutateParty, {
      input: {
        campaignId: base.campaign.id,
        expectedOwnerVersion: 0,
        idempotencyKey: crypto.randomUUID(),
        kind: 'CURRENCY_ADJUST',
        denominationId: idFor(1),
        amount: -4
      }
    })
    await base.other.caller.mutation(mutateParty, {
      input: {
        campaignId: base.campaign.id,
        expectedOwnerVersion: 1,
        idempotencyKey: crypto.randomUUID(),
        kind: 'CURRENCY_ADJUST',
        denominationId: idFor(1),
        amount: 2
      }
    })
    await expect(
      base.other.caller.mutation(mutateParty, {
        input: {
          campaignId: base.campaign.id,
          expectedOwnerVersion: 2,
          idempotencyKey: crypto.randomUUID(),
          kind: 'ITEM_CONSUME',
          itemId: (await base.t.run((ctx) =>
            ctx.db
              .query('campaignPartyItems')
              .withIndex('by_campaignId_vehicleId_id', (q) =>
                q.eq('campaignId', base.campaign.id).eq('vehicleId', base.vehicle.id)
              )
              .unique()
          ))!.id,
          amount: 1
        }
      })
    ).rejects.toThrow('not available')
    const owners = await base.t.run((ctx) =>
      ctx.db
        .query('campaignPartyInventories')
        .withIndex('by_campaignId_vehicleId', (q) => q.eq('campaignId', base.campaign.id))
        .collect()
    )
    expect(owners).toHaveLength(2)
    expect(owners.find((row) => row.vehicleId === undefined)?.version).toBe(2)
    expect(owners.find((row) => row.vehicleId === base.vehicle.id)?.version).toBe(0)
    expect(
      (
        await base.t.run((ctx) =>
          ctx.db
            .query('campaignPartyCurrencies')
            .withIndex('by_campaignId_vehicleId_id', (q) =>
              q.eq('campaignId', base.campaign.id).eq('vehicleId', undefined)
            )
            .collect()
        )
      )[0]
    ).toMatchObject({ amount: 8 })
    expect(
      (
        await base.t.run((ctx) =>
          ctx.db
            .query('campaignPartyCurrencies')
            .withIndex('by_campaignId_vehicleId_id', (q) =>
              q.eq('campaignId', base.campaign.id).eq('vehicleId', base.vehicle.id)
            )
            .collect()
        )
      )[0]
    ).toMatchObject({ amount: 20 })
  })

  it('rescales party and Vehicle balances independently and rejects a lossy Vehicle conversion atomically', async () => {
    const base = await setup()
    const high = idFor(2)
    const system = await base.other.caller.mutation(saveSystem, {
      campaignId: base.campaign.id,
      label: 'Scale',
      isReference: true,
      denominations: [denomination(idFor(1), 'Base', 1), denomination(high, 'High', 2)]
    })
    await seedOwners(base.t, base.campaign.id, [base.vehicle.id])
    await base.t.run(async (ctx) => {
      for (const vehicleId of [undefined, base.vehicle.id])
        await ctx.db.insert(
          'campaignPartyCurrencies',
          campaignStoredPartyCurrencySchema.parse({
            campaignId: base.campaign.id,
            ...(vehicleId ? { vehicleId } : {}),
            id: crypto.randomUUID(),
            denominationId: high,
            campaignCurrencySystemId: system.id,
            amount: vehicleId ? 3 : 4,
            containerId: null
          })
        )
    })
    const converted = await base.other.caller.mutation(saveSystem, {
      campaignId: base.campaign.id,
      systemId: system.id,
      expectedVersion: 0,
      label: 'Scale',
      isReference: true,
      denominations: [denomination(idFor(1), 'Base', 2), denomination(high, 'High', 1)]
    })
    expect(converted.version).toBe(1)
    const convertedBalances = await base.t.run((ctx) =>
      ctx.db
        .query('campaignPartyCurrencies')
        .withIndex('by_campaign_currencySystem_id', (q) =>
          q.eq('campaignId', base.campaign.id).eq('campaignCurrencySystemId', system.id)
        )
        .collect()
    )
    expect(convertedBalances).toHaveLength(2)
    expect(convertedBalances.find((row) => row.vehicleId === undefined)?.amount).toBe(8)
    expect(convertedBalances.find((row) => row.vehicleId === base.vehicle.id)?.amount).toBe(6)
    const convertedOwners = await base.t.run((ctx) =>
      ctx.db
        .query('campaignPartyInventories')
        .withIndex('by_campaignId_vehicleId', (q) => q.eq('campaignId', base.campaign.id))
        .collect()
    )
    expect(convertedOwners).toHaveLength(2)
    expect(convertedOwners.find((row) => row.vehicleId === undefined)?.version).toBe(1)
    expect(convertedOwners.find((row) => row.vehicleId === base.vehicle.id)?.version).toBe(1)
    const vehicleBefore = await base.t.run((ctx) =>
      ctx.db
        .query('campaignVehicles')
        .withIndex('by_campaignId_id', (q) =>
          q.eq('campaignId', base.campaign.id).eq('id', base.vehicle.id)
        )
        .unique()
    )
    expect(vehicleBefore?.version).toBe(0)
    await base.t.run(async (ctx) => {
      const row = await ctx.db
        .query('campaignPartyCurrencies')
        .withIndex('by_campaignId_vehicleId_id', (q) =>
          q.eq('campaignId', base.campaign.id).eq('vehicleId', base.vehicle.id)
        )
        .unique()
      if (!row) throw new Error('Missing balance')
      await ctx.db.patch(row._id, { amount: 1 })
    })
    const before = await base.t.run((ctx) =>
      Promise.all([
        ctx.db.query('campaignCurrencySystems').collect(),
        ctx.db.query('campaignCurrencyDenominations').collect(),
        ctx.db.query('campaignPartyCurrencies').collect(),
        ctx.db.query('campaignPartyInventories').collect()
      ])
    )
    await expect(
      base.other.caller.mutation(saveSystem, {
        campaignId: base.campaign.id,
        systemId: system.id,
        expectedVersion: 1,
        label: 'Lossy',
        isReference: true,
        denominations: [denomination(idFor(1), 'Base', 1), denomination(high, 'High', 4)]
      })
    ).rejects.toThrow('preserve')
    expect(
      await base.t.run((ctx) =>
        Promise.all([
          ctx.db.query('campaignCurrencySystems').collect(),
          ctx.db.query('campaignCurrencyDenominations').collect(),
          ctx.db.query('campaignPartyCurrencies').collect(),
          ctx.db.query('campaignPartyInventories').collect()
        ])
      )
    ).toEqual(before)
    expect(
      await base.t.run((ctx) =>
        ctx.db
          .query('campaignVehicles')
          .withIndex('by_campaignId_id', (q) =>
            q.eq('campaignId', base.campaign.id).eq('id', base.vehicle.id)
          )
          .unique()
      )
    ).toEqual(vehicleBefore)
  })

  it('removes zero balances across custody scopes but rolls back for positive or missing Vehicle ownership', async () => {
    const base = await setup()
    const system = await base.other.caller.mutation(saveSystem, {
      campaignId: base.campaign.id,
      label: 'Remove',
      isReference: true,
      denominations: [denomination(idFor(3), 'Base', 1)]
    })
    await seedOwners(base.t, base.campaign.id, [base.vehicle.id])
    await base.t.run(async (ctx) => {
      for (const vehicleId of [undefined, base.vehicle.id])
        await ctx.db.insert(
          'campaignPartyCurrencies',
          campaignStoredPartyCurrencySchema.parse({
            campaignId: base.campaign.id,
            ...(vehicleId ? { vehicleId } : {}),
            id: crypto.randomUUID(),
            denominationId: idFor(3),
            campaignCurrencySystemId: system.id,
            amount: vehicleId ? 1 : 0,
            containerId: null
          })
        )
    })
    const before = await base.t.run((ctx) =>
      Promise.all([
        ctx.db.query('campaignCurrencySystems').collect(),
        ctx.db.query('campaignCurrencyDenominations').collect(),
        ctx.db.query('campaignPartyCurrencies').collect(),
        ctx.db.query('campaignPartyInventories').collect()
      ])
    )
    await expect(
      base.other.caller.mutation(removeSystem, {
        campaignId: base.campaign.id,
        systemId: system.id,
        expectedVersion: 0
      })
    ).rejects.toThrow('positive balances')
    expect(
      await base.t.run((ctx) =>
        Promise.all([
          ctx.db.query('campaignCurrencySystems').collect(),
          ctx.db.query('campaignCurrencyDenominations').collect(),
          ctx.db.query('campaignPartyCurrencies').collect(),
          ctx.db.query('campaignPartyInventories').collect()
        ])
      )
    ).toEqual(before)
    await base.t.run(async (ctx) => {
      const row = await ctx.db
        .query('campaignPartyCurrencies')
        .withIndex('by_campaignId_vehicleId_id', (q) =>
          q.eq('campaignId', base.campaign.id).eq('vehicleId', base.vehicle.id)
        )
        .unique()
      if (!row) throw new Error('Missing balance')
      await ctx.db.patch(row._id, { amount: 0 })
      await ctx.db.delete(
        (await ctx.db
          .query('campaignPartyInventories')
          .withIndex('by_campaignId_vehicleId', (q) =>
            q.eq('campaignId', base.campaign.id).eq('vehicleId', base.vehicle.id)
          )
          .unique())!._id
      )
    })
    const beforeMissingOwner = await base.t.run((ctx) =>
      Promise.all([
        ctx.db.query('campaignCurrencySystems').collect(),
        ctx.db.query('campaignCurrencyDenominations').collect(),
        ctx.db.query('campaignPartyCurrencies').collect(),
        ctx.db.query('campaignPartyInventories').collect()
      ])
    )
    await expect(
      base.other.caller.mutation(removeSystem, {
        campaignId: base.campaign.id,
        systemId: system.id,
        expectedVersion: 0
      })
    ).rejects.toThrow('owner is unavailable')
    expect(
      await base.t.run((ctx) =>
        Promise.all([
          ctx.db.query('campaignCurrencySystems').collect(),
          ctx.db.query('campaignCurrencyDenominations').collect(),
          ctx.db.query('campaignPartyCurrencies').collect(),
          ctx.db.query('campaignPartyInventories').collect()
        ])
      )
    ).toEqual(beforeMissingOwner)
    await base.t.run((ctx) =>
      ctx.db.insert(
        'campaignPartyInventories',
        campaignStoredPartyInventorySchema.parse({
          campaignId: base.campaign.id,
          vehicleId: base.vehicle.id,
          version: 0
        })
      )
    )
    await base.other.caller.mutation(removeSystem, {
      campaignId: base.campaign.id,
      systemId: system.id,
      expectedVersion: 0
    })
    expect(
      await base.t.run((ctx) =>
        Promise.all([
          ctx.db.query('campaignCurrencySystems').collect(),
          ctx.db.query('campaignCurrencyDenominations').collect(),
          ctx.db.query('campaignPartyCurrencies').collect()
        ])
      )
    ).toEqual([[], [], []])
    const removedOwners = await base.t.run((ctx) =>
      ctx.db
        .query('campaignPartyInventories')
        .withIndex('by_campaignId_vehicleId', (q) => q.eq('campaignId', base.campaign.id))
        .collect()
    )
    expect(removedOwners).toHaveLength(2)
    expect(removedOwners.find((row) => row.vehicleId === undefined)?.version).toBe(1)
    expect(removedOwners.find((row) => row.vehicleId === base.vehicle.id)?.version).toBe(1)
  })

  it('blocks nonempty Vehicle removal and cleans only an empty Vehicle owner', async () => {
    const base = await setup()
    await seedOwners(base.t, base.campaign.id, [base.vehicle.id, base.secondVehicle.id])
    const itemId = crypto.randomUUID()
    await base.t.run((ctx) =>
      ctx.db.insert(
        'campaignPartyItems',
        campaignStoredPartyItemSchema.parse({
          campaignId: base.campaign.id,
          vehicleId: base.vehicle.id,
          id: itemId,
          equipmentId: club.id,
          quantity: 1,
          containerId: null
        })
      )
    )
    const beforeItemRemoval = await base.t.run((ctx) =>
      Promise.all([
        ctx.db.query('campaignVehicles').collect(),
        ctx.db.query('campaignPartyItems').collect(),
        ctx.db.query('campaignPartyCurrencies').collect(),
        ctx.db.query('campaignPartyInventories').collect()
      ])
    )
    await expect(
      base.other.caller.mutation(removeVehicle, {
        campaignId: base.campaign.id,
        vehicleId: base.vehicle.id,
        expectedVersion: 0
      })
    ).rejects.toThrow('Nonempty Vehicle inventory')
    expect(
      await base.t.run((ctx) =>
        Promise.all([
          ctx.db.query('campaignVehicles').collect(),
          ctx.db.query('campaignPartyItems').collect(),
          ctx.db.query('campaignPartyCurrencies').collect(),
          ctx.db.query('campaignPartyInventories').collect()
        ])
      )
    ).toEqual(beforeItemRemoval)
    await base.t.run(async (ctx) => {
      const row = await ctx.db
        .query('campaignPartyItems')
        .withIndex('by_campaignId_vehicleId_id', (q) =>
          q.eq('campaignId', base.campaign.id).eq('vehicleId', base.vehicle.id).eq('id', itemId)
        )
        .unique()
      if (!row) throw new Error('Missing item')
      await ctx.db.delete(row._id)
      await ctx.db.insert(
        'campaignPartyCurrencies',
        campaignStoredPartyCurrencySchema.parse({
          campaignId: base.campaign.id,
          vehicleId: base.vehicle.id,
          id: crypto.randomUUID(),
          denominationId: srdSystemRecord.currencies[0]!.id,
          amount: 1,
          containerId: null
        })
      )
    })
    const beforeCurrencyRemoval = await base.t.run((ctx) =>
      Promise.all([
        ctx.db.query('campaignVehicles').collect(),
        ctx.db.query('campaignPartyItems').collect(),
        ctx.db.query('campaignPartyCurrencies').collect(),
        ctx.db.query('campaignPartyInventories').collect()
      ])
    )
    await expect(
      base.other.caller.mutation(removeVehicle, {
        campaignId: base.campaign.id,
        vehicleId: base.vehicle.id,
        expectedVersion: 0
      })
    ).rejects.toThrow('Nonempty Vehicle inventory')
    expect(
      await base.t.run((ctx) =>
        Promise.all([
          ctx.db.query('campaignVehicles').collect(),
          ctx.db.query('campaignPartyItems').collect(),
          ctx.db.query('campaignPartyCurrencies').collect(),
          ctx.db.query('campaignPartyInventories').collect()
        ])
      )
    ).toEqual(beforeCurrencyRemoval)
    await base.t.run(async (ctx) => {
      const row = await ctx.db
        .query('campaignPartyCurrencies')
        .withIndex('by_campaignId_vehicleId_id', (q) =>
          q.eq('campaignId', base.campaign.id).eq('vehicleId', base.vehicle.id)
        )
        .unique()
      if (!row) throw new Error('Missing currency')
      await ctx.db.delete(row._id)
    })
    await base.other.caller.mutation(removeVehicle, {
      campaignId: base.campaign.id,
      vehicleId: base.vehicle.id,
      expectedVersion: 0
    })
    expect(
      await base.t.run((ctx) =>
        ctx.db
          .query('campaignVehicles')
          .withIndex('by_campaignId_id', (q) => q.eq('campaignId', base.campaign.id))
          .collect()
      )
    ).toEqual([expect.objectContaining({ id: base.secondVehicle.id })])
    const remainingOwners = await base.t.run((ctx) =>
      ctx.db
        .query('campaignPartyInventories')
        .withIndex('by_campaignId_vehicleId', (q) => q.eq('campaignId', base.campaign.id))
        .collect()
    )
    expect(remainingOwners).toHaveLength(2)
    expect(remainingOwners.find((row) => row.vehicleId === undefined)).toMatchObject({ version: 0 })
    expect(remainingOwners.find((row) => row.vehicleId === base.secondVehicle.id)).toMatchObject({
      version: 0
    })
  })

  it('rejects conversion when a scoped Vehicle is moved to another Campaign', async () => {
    const base = await setup()
    const system = await base.other.caller.mutation(saveSystem, {
      campaignId: base.campaign.id,
      label: 'Foreign vehicle',
      isReference: true,
      denominations: [denomination(idFor(4), 'Base', 1), denomination(idFor(5), 'High', 2)]
    })
    await seedOwners(base.t, base.campaign.id, [base.vehicle.id])
    await base.t.run(async (ctx) => {
      for (const vehicleId of [undefined, base.vehicle.id])
        await ctx.db.insert(
          'campaignPartyCurrencies',
          campaignStoredPartyCurrencySchema.parse({
            campaignId: base.campaign.id,
            ...(vehicleId ? { vehicleId } : {}),
            id: crypto.randomUUID(),
            denominationId: idFor(5),
            campaignCurrencySystemId: system.id,
            amount: 2,
            containerId: null
          })
        )
    })
    const foreignCampaign = await base.owner.caller.mutation(createCampaign, {
      ...campaignInput,
      name: 'Foreign Vehicle Campaign'
    })
    await base.t.run(async (ctx) => {
      const vehicle = await ctx.db
        .query('campaignVehicles')
        .withIndex('by_campaignId_id', (q) =>
          q.eq('campaignId', base.campaign.id).eq('id', base.vehicle.id)
        )
        .unique()
      if (!vehicle) throw new Error('Missing Vehicle fixture')
      await ctx.db.patch(vehicle._id, { campaignId: foreignCampaign.id })
    })
    const beforeConversion = await base.t.run((ctx) =>
      Promise.all([
        ctx.db.query('campaignVehicles').collect(),
        ctx.db.query('campaignCurrencySystems').collect(),
        ctx.db.query('campaignCurrencyDenominations').collect(),
        ctx.db.query('campaignPartyCurrencies').collect(),
        ctx.db.query('campaignPartyInventories').collect()
      ])
    )
    await expect(
      base.other.caller.mutation(saveSystem, {
        campaignId: base.campaign.id,
        systemId: system.id,
        expectedVersion: 0,
        label: 'Foreign vehicle',
        isReference: true,
        denominations: [denomination(idFor(4), 'Base', 2), denomination(idFor(5), 'High', 1)]
      })
    ).rejects.toThrow('unavailable')
    const after = await base.t.run((ctx) =>
      Promise.all([
        ctx.db.query('campaignVehicles').collect(),
        ctx.db.query('campaignCurrencySystems').collect(),
        ctx.db.query('campaignCurrencyDenominations').collect(),
        ctx.db.query('campaignPartyCurrencies').collect(),
        ctx.db.query('campaignPartyInventories').collect()
      ])
    )
    expect(after).toEqual(beforeConversion)
  })
})
