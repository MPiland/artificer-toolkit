import { makeFunctionReference } from 'convex/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type {
  CampaignContentRemovalReceiptDto,
  CampaignDetailDto,
  CreateCampaignInput,
  UnshareCampaignContentInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  CampaignVehicleDto,
  CreateCampaignVehicleInput
} from '@artificer-toolkit/schema/api/campaignVehicles'
import type {
  AuthoredPublicationResult,
  AuthoredPublishDraftInput
} from '@artificer-toolkit/schema/api/authoredPublication'
import {
  campaignStoredPartyCurrencyGroupSchema,
  campaignStoredPartyCurrencySchema,
  campaignStoredPartyInventorySchema,
  campaignStoredPartyItemSchema
} from '@artificer-toolkit/schema/projections/campaignInventoryPersistence'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { cart } from '@artificer-toolkit/source-data/srd/vehicles/cart.js'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { api, internal } from '../_generated/api'
import { readySheetFixture } from '../../tests/fixtures/readyCharacter'
import { importedSubject } from '../../tests/fixtures/publication'

const createCampaign = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
const createVehicle = makeFunctionReference<
  'mutation',
  CreateCampaignVehicleInput,
  CampaignVehicleDto
>('campaigns/vehicles:create')
const publish = makeFunctionReference<
  'mutation',
  AuthoredPublishDraftInput,
  AuthoredPublicationResult
>('content/publication:publishDraft')
const unshare = makeFunctionReference<
  'mutation',
  UnshareCampaignContentInput,
  CampaignContentRemovalReceiptDto
>('campaigns/contentShares:unshare')

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

const idFor = (index: number) => `81000000-0000-4000-8000-${String(index).padStart(12, '0')}`

async function setup() {
  const base = await readySheetFixture()
  await base.t.mutation(internal.content.import.importSubjects, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [importedSubject({ subjectKind: 'VEHICLE', ...cart, document: cart })]
  })
  const campaign = await base.owner.caller.mutation(createCampaign, {
    name: 'Vehicle source loss',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  const draft = await base.owner.caller.mutation(api.content.drafts.duplicate, {
    subjectKind: 'VEHICLE',
    subjectId: cart.id
  })
  if (!draft.updatedAt) throw new Error('Missing Vehicle draft revision.')
  const publication = await base.owner.caller.mutation(publish, {
    subjectKind: 'VEHICLE',
    subjectId: draft.subjectId,
    expectedDraftUpdatedAt: draft.updatedAt
  })
  await base.owner.caller.mutation(api.campaigns.contentShares.share, {
    campaignId: campaign.id,
    subjectKind: 'VEHICLE',
    subjectId: publication.subjectId
  })
  const vehicle = await base.owner.caller.mutation(createVehicle, {
    campaignId: campaign.id,
    vehicleDefinitionId: publication.subjectId
  })
  return { ...base, campaign, publication, vehicle }
}

function request(base: Awaited<ReturnType<typeof setup>>): UnshareCampaignContentInput {
  return {
    campaignId: base.campaign.id,
    subjectKind: 'VEHICLE',
    subjectId: base.publication.subjectId,
    sharedBy: base.owner.userId,
    expectedCampaignVersion: base.campaign.version,
    commandId: crypto.randomUUID()
  }
}

describe('native Campaign Vehicle source-loss evacuation', () => {
  it('preserves item trees and explicit currency groups while merging only flat loose currency', async () => {
    const base = await setup()
    const denominationId = srdSystemRecord.currencies[0]!.id
    await base.t.run(async (ctx) => {
      await ctx.db.insert(
        'campaignPartyInventories',
        campaignStoredPartyInventorySchema.parse({
          campaignId: base.campaign.id,
          version: 4
        })
      )
      await ctx.db.insert(
        'campaignPartyInventories',
        campaignStoredPartyInventorySchema.parse({
          campaignId: base.campaign.id,
          vehicleId: base.vehicle.id,
          version: 3
        })
      )
      await ctx.db.insert(
        'campaignPartyItems',
        campaignStoredPartyItemSchema.parse({
          campaignId: base.campaign.id,
          vehicleId: base.vehicle.id,
          id: idFor(1),
          equipmentId: club.id,
          quantity: 1,
          containerId: null
        })
      )
      await ctx.db.insert(
        'campaignPartyItems',
        campaignStoredPartyItemSchema.parse({
          campaignId: base.campaign.id,
          vehicleId: base.vehicle.id,
          id: idFor(2),
          equipmentId: club.id,
          quantity: 2,
          containerId: idFor(1)
        })
      )
      await ctx.db.insert(
        'campaignPartyCurrencyGroups',
        campaignStoredPartyCurrencyGroupSchema.parse({
          campaignId: base.campaign.id,
          vehicleId: base.vehicle.id,
          id: idFor(3),
          containerId: idFor(1)
        })
      )
      await ctx.db.insert(
        'campaignPartyCurrencies',
        campaignStoredPartyCurrencySchema.parse({
          campaignId: base.campaign.id,
          vehicleId: base.vehicle.id,
          id: idFor(4),
          groupId: idFor(3),
          denominationId,
          amount: 7,
          containerId: idFor(1)
        })
      )
      await ctx.db.insert(
        'campaignPartyCurrencies',
        campaignStoredPartyCurrencySchema.parse({
          campaignId: base.campaign.id,
          vehicleId: base.vehicle.id,
          id: idFor(5),
          denominationId,
          amount: 11,
          containerId: idFor(1)
        })
      )
      await ctx.db.insert(
        'campaignPartyCurrencies',
        campaignStoredPartyCurrencySchema.parse({
          campaignId: base.campaign.id,
          vehicleId: base.vehicle.id,
          id: idFor(6),
          denominationId,
          amount: 13,
          containerId: null
        })
      )
      await ctx.db.insert(
        'campaignPartyCurrencies',
        campaignStoredPartyCurrencySchema.parse({
          campaignId: base.campaign.id,
          id: idFor(7),
          denominationId,
          amount: 17,
          containerId: null
        })
      )
    })
    const receipt = await base.owner.caller.mutation(unshare, request(base))
    expect(receipt.evacuatedVehicles).toEqual([
      {
        vehicleId: base.vehicle.id,
        vehicleDefinitionId: base.publication.subjectId,
        transferredTopLevelItemIds: [idFor(1)],
        transferredCurrencyGroupIds: [idFor(3)]
      }
    ])
    const state = await base.t.run(async (ctx) => ({
      vehicle: await ctx.db
        .query('campaignVehicles')
        .withIndex('by_campaignId_id', (q) =>
          q.eq('campaignId', base.campaign.id).eq('id', base.vehicle.id)
        )
        .unique(),
      inventories: await ctx.db.query('campaignPartyInventories').collect(),
      items: await ctx.db.query('campaignPartyItems').collect(),
      groups: await ctx.db.query('campaignPartyCurrencyGroups').collect(),
      balances: await ctx.db.query('campaignPartyCurrencies').collect(),
      evacuationEvent: await ctx.db
        .query('campaignEvents')
        .filter((q) => q.eq(q.field('type'), 'CAMPAIGN_VEHICLE_EVACUATED'))
        .unique()
    }))
    expect(state.vehicle).toBeNull()
    expect(state.inventories).toEqual([expect.objectContaining({ version: 5 })])
    expect(state.inventories[0]).not.toHaveProperty('vehicleId')
    expect(state.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: idFor(1), containerId: null }),
        expect.objectContaining({ id: idFor(2), containerId: idFor(1) })
      ])
    )
    expect(state.items.every((item) => !('vehicleId' in item))).toBe(true)
    expect(state.groups).toEqual([expect.objectContaining({ id: idFor(3), containerId: idFor(1) })])
    expect(state.groups[0]).not.toHaveProperty('vehicleId')
    expect(state.balances).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: idFor(4),
          groupId: idFor(3),
          amount: 7,
          containerId: idFor(1)
        }),
        expect.objectContaining({
          id: idFor(5),
          containerId: idFor(1),
          amount: 11
        }),
        expect.objectContaining({ id: idFor(7), containerId: null, amount: 30 })
      ])
    )
    expect(state.balances.some((balance) => balance.id === idFor(6))).toBe(false)
    expect(state.balances.every((balance) => !('vehicleId' in balance))).toBe(true)
    expect(
      state.balances
        .filter((balance) => balance.id === idFor(5) || balance.id === idFor(7))
        .every((balance) => !('groupId' in balance))
    ).toBe(true)
    expect(JSON.parse(state.evacuationEvent!.payloadJson)).toMatchObject({
      sourceInventoryVersion: 4,
      destinationInventoryVersion: 5
    })
  })

  it('unshares immediately and captures an unsafe loose-currency merge for recovery', async () => {
    const base = await setup()
    const denominationId = srdSystemRecord.currencies[0]!.id
    await base.t.run(async (ctx) => {
      await ctx.db.insert(
        'campaignPartyInventories',
        campaignStoredPartyInventorySchema.parse({ campaignId: base.campaign.id, version: 1 })
      )
      await ctx.db.insert(
        'campaignPartyInventories',
        campaignStoredPartyInventorySchema.parse({
          campaignId: base.campaign.id,
          vehicleId: base.vehicle.id,
          version: 1
        })
      )
      for (const row of [
        { id: idFor(8), vehicleId: undefined, amount: Number.MAX_SAFE_INTEGER },
        { id: idFor(9), vehicleId: base.vehicle.id, amount: 1 }
      ])
        await ctx.db.insert(
          'campaignPartyCurrencies',
          campaignStoredPartyCurrencySchema.parse({
            campaignId: base.campaign.id,
            ...row,
            denominationId,
            containerId: null
          })
        )
    })
    const receipt = await base.owner.caller.mutation(unshare, request(base))
    expect(receipt.pendingVehicleCleanupIds).toHaveLength(1)
    const job = await base.t.run(async (ctx) => {
      const jobs = await ctx.db.query('campaignVehicleCleanupJobs').collect()
      return jobs.find((candidate) => candidate.id === receipt.pendingVehicleCleanupIds![0])!
    })
    expect(job.grant).toMatchObject({
      campaignId: base.campaign.id,
      vehicleId: base.vehicle.id,
      actorUserId: base.owner.userId,
      removalEventId: receipt.eventId,
      mode: 'RETURN'
    })
    expect(job.grantChecksum).toBe(
      checksumCanonicalJson({ operation: 'VEHICLE_CLEANUP_GRANT', grant: job.grant })
    )
    expect(await base.t.run((ctx) => ctx.db.query('campaignContentShares').collect())).toEqual([])
    await base.t.finishAllScheduledFunctions(vi.runAllTimers)
    const failed = await base.t.run(async (ctx) => ({
      job: (await ctx.db.query('campaignVehicleCleanupJobs').collect()).find(
        (candidate) => candidate.id === job.id
      )!,
      vehicle: await ctx.db
        .query('campaignVehicles')
        .withIndex('by_campaignId_id', (q) =>
          q.eq('campaignId', base.campaign.id).eq('id', base.vehicle.id)
        )
        .unique(),
      source: await ctx.db
        .query('campaignPartyCurrencies')
        .withIndex('by_campaignId_vehicleId_id', (q) =>
          q.eq('campaignId', base.campaign.id).eq('vehicleId', base.vehicle.id).eq('id', idFor(9))
        )
        .unique(),
      destination: await ctx.db
        .query('campaignPartyCurrencies')
        .withIndex('by_campaignId_vehicleId_id', (q) =>
          q.eq('campaignId', base.campaign.id).eq('vehicleId', undefined).eq('id', idFor(8))
        )
        .unique()
    }))
    expect(failed.job).toMatchObject({
      status: 'FAILED',
      releaseComplete: true,
      applyStarted: false
    })
    expect(failed.vehicle).not.toBeNull()
    expect(failed.source).toMatchObject({ amount: 1, vehicleId: base.vehicle.id })
    expect(failed.destination).toMatchObject({ amount: Number.MAX_SAFE_INTEGER })
    expect(failed.destination?.vehicleId).toBeUndefined()
    expect(failed.job.grant).toEqual(job.grant)
    expect(failed.job.grantChecksum).toBe(job.grantChecksum)
    const owner = await base.t.run((ctx) =>
      ctx.db
        .query('campaignPartyInventories')
        .withIndex('by_campaignId_vehicleId', (q) =>
          q.eq('campaignId', base.campaign.id).eq('vehicleId', undefined)
        )
        .unique()
    )
    await base.owner.caller.mutation(api.campaigns.partyInventoryCommands.mutate, {
      input: {
        kind: 'CURRENCY_ADJUST',
        campaignId: base.campaign.id,
        expectedOwnerVersion: owner!.version,
        idempotencyKey: crypto.randomUUID(),
        denominationId,
        campaignCurrencySystemId: null,
        amount: -20,
        containerId: null
      }
    })
    await base.owner.caller.mutation(api.campaigns.inventoryCleanup.retry, {
      campaignId: base.campaign.id,
      jobId: job.id
    })
    await base.t.finishAllScheduledFunctions(vi.runAllTimers)
    const completed = await base.t.run(async (ctx) => ({
      job: (await ctx.db.query('campaignVehicleCleanupJobs').collect()).find(
        (candidate) => candidate.id === job.id
      )!,
      vehicle: await ctx.db
        .query('campaignVehicles')
        .withIndex('by_campaignId_id', (q) =>
          q.eq('campaignId', base.campaign.id).eq('id', base.vehicle.id)
        )
        .unique(),
      balances: await ctx.db.query('campaignPartyCurrencies').collect()
    }))
    expect(completed.job.status).toBe('COMPLETED')
    expect(completed.job.grant).toEqual(job.grant)
    expect(completed.job.grantChecksum).toBe(job.grantChecksum)
    expect(completed.vehicle).toBeNull()
    expect(completed.balances.find((balance) => balance.id === idFor(8))).toMatchObject({
      amount: Number.MAX_SAFE_INTEGER - 19
    })
    const replay = completed.balances
    await base.t.mutation(internal.campaigns.vehicleCleanup.run, { jobId: job.id })
    await base.owner.caller.mutation(api.campaigns.inventoryCleanup.retry, {
      campaignId: base.campaign.id,
      jobId: job.id
    })
    expect(await base.t.run((ctx) => ctx.db.query('campaignPartyCurrencies').collect())).toEqual(
      replay
    )
  })
})
