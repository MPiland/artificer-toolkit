// @vitest-environment node
import { makeFunctionReference } from 'convex/server'
import { expect, it } from 'vitest'
import { campaignEventDtoSchema } from '@artificer-toolkit/schema/api/campaignLiveState'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { cart } from '@artificer-toolkit/source-data/srd/vehicles/cart.js'
import { backpack } from '@artificer-toolkit/source-data/srd/equipment/backpack.js'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { verifyCampaignInventory } from '../../tests/developmentCampaignInventory'
import type { DevelopmentClient } from '../../tests/developmentClient'
import { importedSubject } from '../../tests/fixtures/publication'
import { readySheetFixture } from '../../tests/fixtures/readyCharacter'
import { api, components, internal } from '../_generated/api'

const removeFixtureState = makeFunctionReference<
  'mutation',
  { ownerUserId: string; playerUserId: string; campaignId: string },
  null
>('campaigns/developmentInventory:removeFixtureState')
const removeFixtureCampaign = makeFunctionReference<
  'mutation',
  { ownerUserId: string; playerUserId: string; campaignId: string; characterId: string },
  null
>('encounters/developmentCampaign:removeFixtureCampaign')

it('proves the authenticated Campaign inventory subset through public handlers', async () => {
  const base = await readySheetFixture()
  await base.t.run(async (ctx) => {
    for (const [index, userId] of [base.other.userId, base.owner.userId].entries()) {
      const profile = await ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (query) => query.eq('userId', userId))
        .unique()
      if (!profile) throw new Error('Inventory proof fixture profile is unavailable.')
      await ctx.runMutation(components.betterAuth.adapter.updateOne, {
        input: {
          model: 'user',
          where: [{ field: '_id', value: profile.authUserId }],
          update: { email: `draft_123456abcde${index}@example.invalid` }
        }
      })
    }
  })
  await base.t.mutation(internal.content.import.importSubjects, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [
      importedSubject({ subjectKind: 'VEHICLE', ...cart, document: cart }),
      importedSubject({ subjectKind: 'EQUIPMENT', ...backpack, document: backpack })
    ]
  })
  const campaign = await base.other.caller.mutation(api.campaigns.create.create, {
    name: 'Encounter execution fixture',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  const preservedCampaign = await base.owner.caller.mutation(api.campaigns.create.create, {
    name: 'Preserved Campaign',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  await base.owner.caller.mutation(api.campaigns.partyInventoryCommands.mutate, {
    input: {
      kind: 'ITEM_ADD',
      campaignId: preservedCampaign.id,
      equipmentId: club.id,
      quantity: 1,
      expectedOwnerVersion: 0,
      idempotencyKey: crypto.randomUUID()
    }
  })
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
  const client = (caller: typeof base.owner.caller): DevelopmentClient => ({
    query: (query, ...args) => caller.run((ctx) => ctx.runQuery(query, ...args)),
    mutation: (mutation, ...args) => caller.run((ctx) => ctx.runMutation(mutation, ...args))
  })
  const anonymous: DevelopmentClient = {
    query: (query, ...args) => base.t.run((ctx) => ctx.runQuery(query, ...args)),
    mutation: (mutation, ...args) => base.t.run((ctx) => ctx.runMutation(mutation, ...args))
  }
  await verifyCampaignInventory({
    owner: client(base.other.caller),
    player: client(base.owner.caller),
    anonymous,
    campaignId: campaign.id
  })
  const scopedRows = () =>
    base.t.run(async (ctx) => ({
      inventories: await ctx.db
        .query('campaignPartyInventories')
        .withIndex('by_campaignId', (query) => query.eq('campaignId', campaign.id))
        .collect(),
      items: await ctx.db
        .query('campaignPartyItems')
        .withIndex('by_campaignId_id', (query) => query.eq('campaignId', campaign.id))
        .collect(),
      currencies: await ctx.db
        .query('campaignPartyCurrencies')
        .withIndex('by_campaignId_id', (query) => query.eq('campaignId', campaign.id))
        .collect(),
      groups: await ctx.db
        .query('campaignPartyCurrencyGroups')
        .withIndex('by_campaignId_id', (query) => query.eq('campaignId', campaign.id))
        .collect(),
      vehicles: await ctx.db
        .query('campaignVehicles')
        .withIndex('by_campaignId_id', (query) => query.eq('campaignId', campaign.id))
        .collect(),
      systems: await ctx.db
        .query('campaignCurrencySystems')
        .withIndex('by_campaignId_id', (query) => query.eq('campaignId', campaign.id))
        .collect(),
      denominations: await ctx.db
        .query('campaignCurrencyDenominations')
        .withIndex('by_campaignId_id', (query) => query.eq('campaignId', campaign.id))
        .collect(),
      events: await ctx.db
        .query('campaignEvents')
        .withIndex('by_campaignId_id', (query) => query.eq('campaignId', campaign.id))
        .collect()
    }))
  const preservedBefore = await base.t.run(async (ctx) => ({
    fixtureCampaign: await ctx.db
      .query('campaigns')
      .withIndex('by_publicId', (query) => query.eq('id', campaign.id))
      .unique(),
    campaign: await ctx.db
      .query('campaigns')
      .withIndex('by_publicId', (query) => query.eq('id', preservedCampaign.id))
      .unique(),
    memberships: await ctx.db
      .query('campaignMemberships')
      .withIndex('by_campaignId_userId', (query) => query.eq('campaignId', campaign.id))
      .collect()
  }))
  const preservedInventoryBefore = await base.owner.caller.query(
    api.campaigns.partyInventory.items,
    {
      campaignId: preservedCampaign.id,
      paginationOpts: { cursor: null, numItems: 48 }
    }
  )
  const beforeTamper = await scopedRows()
  const evacuation = beforeTamper.events.find(
    (event) => event.type === 'CAMPAIGN_VEHICLE_EVACUATED'
  )
  if (!evacuation) throw new Error('Inventory proof evacuation receipt is unavailable.')
  const evacuationPayload = campaignEventDtoSchema.shape.payload.parse(
    JSON.parse(evacuation.payloadJson)
  )
  if (
    evacuationPayload === null ||
    typeof evacuationPayload !== 'object' ||
    Array.isArray(evacuationPayload)
  )
    throw new Error('Inventory proof evacuation payload is unavailable.')
  await base.t.run((ctx) =>
    ctx.db.patch(evacuation._id, {
      payloadJson: JSON.stringify({
        ...evacuationPayload,
        removalEventId: crypto.randomUUID()
      })
    })
  )
  const mismatchedReceipt = await scopedRows()
  await expect(
    base.t.mutation(removeFixtureState, {
      ownerUserId: base.other.userId,
      playerUserId: base.owner.userId,
      campaignId: campaign.id
    })
  ).rejects.toThrow('receipt mismatch')
  expect(await scopedRows()).toEqual(mismatchedReceipt)
  await base.t.run((ctx) => ctx.db.patch(evacuation._id, { payloadJson: evacuation.payloadJson }))
  expect(await scopedRows()).toEqual(beforeTamper)
  const injected = await base.t.run((ctx) =>
    ctx.db.insert('campaignPartyItems', {
      campaignId: campaign.id,
      id: crypto.randomUUID(),
      equipmentId: backpack.id,
      quantity: 1,
      containerId: crypto.randomUUID()
    })
  )
  const malformed = await scopedRows()
  await expect(
    base.t.mutation(removeFixtureState, {
      ownerUserId: base.other.userId,
      playerUserId: base.owner.userId,
      campaignId: campaign.id
    })
  ).rejects.toThrow('mismatch')
  expect(await scopedRows()).toEqual(malformed)
  await base.t.run((ctx) => ctx.db.delete(injected))
  expect(await scopedRows()).toEqual(beforeTamper)
  await expect(
    base.t.mutation(removeFixtureState, {
      ownerUserId: base.other.userId,
      playerUserId: base.owner.userId,
      campaignId: campaign.id
    })
  ).resolves.toBeNull()
  expect(await scopedRows()).toEqual({
    inventories: [],
    items: [],
    currencies: [],
    groups: [],
    vehicles: [],
    systems: [],
    denominations: [],
    events: []
  })
  expect(
    await base.t.run(async (ctx) => ({
      fixtureCampaign: await ctx.db
        .query('campaigns')
        .withIndex('by_publicId', (query) => query.eq('id', campaign.id))
        .unique(),
      campaign: await ctx.db
        .query('campaigns')
        .withIndex('by_publicId', (query) => query.eq('id', preservedCampaign.id))
        .unique(),
      memberships: await ctx.db
        .query('campaignMemberships')
        .withIndex('by_campaignId_userId', (query) => query.eq('campaignId', campaign.id))
        .collect()
    }))
  ).toEqual(preservedBefore)
  expect(
    await base.owner.caller.query(api.campaigns.partyInventory.items, {
      campaignId: preservedCampaign.id,
      paginationOpts: { cursor: null, numItems: 48 }
    })
  ).toEqual(preservedInventoryBefore)
  await expect(
    base.t.mutation(removeFixtureState, {
      ownerUserId: base.other.userId,
      playerUserId: base.owner.userId,
      campaignId: campaign.id
    })
  ).resolves.toBeNull()
  await expect(
    base.t.mutation(removeFixtureCampaign, {
      ownerUserId: base.other.userId,
      playerUserId: base.owner.userId,
      campaignId: campaign.id,
      characterId: crypto.randomUUID()
    })
  ).resolves.toBeNull()
  expect(
    await base.t.run((ctx) =>
      ctx.db
        .query('campaigns')
        .withIndex('by_publicId', (query) => query.eq('id', campaign.id))
        .unique()
    )
  ).toBeNull()
  expect(
    await base.t.run((ctx) =>
      ctx.db
        .query('campaigns')
        .withIndex('by_publicId', (query) => query.eq('id', preservedCampaign.id))
        .unique()
    )
  ).toEqual(preservedBefore.campaign)
  const ownedVehicles = await base.other.caller.query(api.content.catalogue.list, {
    subjectKind: 'VEHICLE',
    systemId: srdSystemRecord.id,
    source: 'OWNED',
    paginationOpts: { cursor: null, numItems: 8 }
  })
  expect(ownedVehicles.isDone).toBe(true)
  expect(ownedVehicles.page).toHaveLength(1)
  await base.other.caller.mutation(api.content.deletion.deleteActive, {
    subjectKind: 'VEHICLE',
    subjectId: ownedVehicles.page[0]!.id
  })
  expect(
    (
      await base.other.caller.query(api.content.catalogue.list, {
        subjectKind: 'VEHICLE',
        systemId: srdSystemRecord.id,
        source: 'OWNED',
        paginationOpts: { cursor: null, numItems: 8 }
      })
    ).page
  ).toEqual([])
}, 30000)
