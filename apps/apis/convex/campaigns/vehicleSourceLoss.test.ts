import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { campaignContentRemovalReceiptDtoSchema } from '@artificer-toolkit/schema/api/campaignCore'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
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
import { readySheetFixture } from '../../tests/fixtures/readyCharacter'
import { importedSubject, importSeededSubjects } from '../../tests/fixtures/publication'
import { api, internal } from '../_generated/api'

type Producer = 'AUTHORED_DELETED' | 'MEMBER_LEFT' | 'MEMBER_REMOVED'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

const campaignInput = {
  name: 'Vehicle source loss',
  format: 'ONGOING' as const,
  toneTags: ['HEROIC' as const],
  contentMaturity: 'STANDARD' as const,
  gameSystemId: srdSystemRecord.id,
  primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
}

function idFor(index: number): string {
  return `8a000000-0000-4000-8000-${String(index).padStart(12, '0')}`
}

async function setup(overflow = false) {
  const base = await readySheetFixture()
  await importSeededSubjects(base.t, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [importedSubject({ subjectKind: 'VEHICLE', ...cart, document: cart })]
  })
  const draft = await base.owner.caller.mutation(api.content.drafts.duplicate, {
    subjectKind: 'VEHICLE',
    subjectId: cart.id
  })
  if (!draft.updatedAt) throw new Error('Missing Vehicle draft revision.')
  const publication = await base.owner.caller.mutation(api.content.publication.publishDraft, {
    subjectKind: 'VEHICLE',
    subjectId: draft.subjectId,
    expectedDraftUpdatedAt: draft.updatedAt
  })
  const campaign = await base.other.caller.mutation(api.campaigns.create.create, campaignInput)
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
  await base.owner.caller.mutation(api.campaigns.contentShares.share, {
    campaignId: campaign.id,
    subjectKind: 'VEHICLE',
    subjectId: publication.subjectId
  })
  const vehicles = await Promise.all([
    base.other.caller.mutation(api.campaigns.vehicles.create, {
      campaignId: campaign.id,
      vehicleDefinitionId: publication.subjectId
    }),
    base.other.caller.mutation(api.campaigns.vehicles.create, {
      campaignId: campaign.id,
      vehicleDefinitionId: publication.subjectId
    }),
    base.other.caller.mutation(api.campaigns.vehicles.create, {
      campaignId: campaign.id,
      vehicleDefinitionId: cart.id
    })
  ])
  const [first, second, unrelated] = vehicles
  const targetVehicles = [first, second]
  const denominationId = srdSystemRecord.currencies[0]!.id
  const sourceRows = targetVehicles.map((vehicle, index) => ({
    vehicle,
    parentId: idFor(index * 10 + 1),
    childId: idFor(index * 10 + 2),
    groupId: idFor(index * 10 + 3),
    groupedBalanceId: idFor(index * 10 + 4),
    looseBalanceId: idFor(index * 10 + 5),
    amount: index + 7
  }))
  await base.t.run(async (ctx) => {
    await ctx.db.insert(
      'campaignPartyInventories',
      campaignStoredPartyInventorySchema.parse({ campaignId: campaign.id, version: 4 })
    )
    await ctx.db.insert(
      'campaignPartyInventories',
      campaignStoredPartyInventorySchema.parse({
        campaignId: campaign.id,
        vehicleId: unrelated.id,
        version: 9
      })
    )
    await ctx.db.insert(
      'campaignPartyItems',
      campaignStoredPartyItemSchema.parse({
        campaignId: campaign.id,
        vehicleId: unrelated.id,
        id: idFor(90),
        equipmentId: club.id,
        quantity: 3,
        containerId: null
      })
    )
    await ctx.db.insert(
      'campaignPartyCurrencies',
      campaignStoredPartyCurrencySchema.parse({
        campaignId: campaign.id,
        id: idFor(91),
        denominationId,
        amount: overflow ? Number.MAX_SAFE_INTEGER : 13,
        containerId: null
      })
    )
    await ctx.db.insert(
      'campaignPartyCurrencies',
      campaignStoredPartyCurrencySchema.parse({
        campaignId: campaign.id,
        vehicleId: unrelated.id,
        id: idFor(92),
        denominationId,
        amount: 19,
        containerId: null
      })
    )
    for (const row of sourceRows) {
      await ctx.db.insert(
        'campaignPartyInventories',
        campaignStoredPartyInventorySchema.parse({
          campaignId: campaign.id,
          vehicleId: row.vehicle.id,
          version: 2
        })
      )
      for (const [id, containerId] of [
        [row.parentId, null],
        [row.childId, row.parentId]
      ] as const)
        await ctx.db.insert(
          'campaignPartyItems',
          campaignStoredPartyItemSchema.parse({
            campaignId: campaign.id,
            vehicleId: row.vehicle.id,
            id,
            equipmentId: club.id,
            quantity: 1,
            containerId
          })
        )
      await ctx.db.insert(
        'campaignPartyCurrencyGroups',
        campaignStoredPartyCurrencyGroupSchema.parse({
          campaignId: campaign.id,
          vehicleId: row.vehicle.id,
          id: row.groupId,
          containerId: row.parentId
        })
      )
      await ctx.db.insert(
        'campaignPartyCurrencies',
        campaignStoredPartyCurrencySchema.parse({
          campaignId: campaign.id,
          vehicleId: row.vehicle.id,
          id: row.groupedBalanceId,
          denominationId,
          amount: row.amount,
          groupId: row.groupId,
          containerId: row.parentId
        })
      )
      await ctx.db.insert(
        'campaignPartyCurrencies',
        campaignStoredPartyCurrencySchema.parse({
          campaignId: campaign.id,
          vehicleId: row.vehicle.id,
          id: row.looseBalanceId,
          denominationId,
          amount: overflow ? 1 : row.amount,
          containerId: null
        })
      )
    }
  })
  return { base, campaign, publication, targetVehicles, unrelated, sourceRows, denominationId }
}

async function applyProducer(producer: Producer, fixture: Awaited<ReturnType<typeof setup>>) {
  if (producer === 'AUTHORED_DELETED')
    return fixture.base.owner.caller.mutation(api.content.deletion.deleteActive, {
      subjectKind: 'VEHICLE',
      subjectId: fixture.publication.subjectId
    })
  const campaign = await fixture.base.t.run((ctx) =>
    ctx.db
      .query('campaigns')
      .withIndex('by_publicId', (q) => q.eq('id', fixture.campaign.id))
      .unique()
  )
  if (!campaign) throw new Error('Missing Campaign.')
  const request = {
    campaignId: fixture.campaign.id,
    expectedCampaignVersion: campaign.version,
    expectedMembershipAccessStartedAt: fixture.campaign.createdAt,
    commandId: crypto.randomUUID()
  }
  return producer === 'MEMBER_LEFT'
    ? fixture.base.owner.caller.mutation(api.campaigns.membershipDeparture.leave, request)
    : fixture.base.other.caller.mutation(api.campaigns.membershipDeparture.removeMember, {
        ...request,
        userId: fixture.base.owner.userId
      })
}

describe('native Vehicle source-loss producers', () => {
  it.each([
    ['authored deletion', 'AUTHORED_DELETED', 'TABLE'],
    ['member departure', 'MEMBER_LEFT', 'OWNER'],
    ['member removal', 'MEMBER_REMOVED', 'OWNER']
  ] as const)(
    '%s evacuates every affected Vehicle and retains unrelated custody',
    async (_name, producer, removalVisibility) => {
      const fixture = await setup()
      const unrelatedBefore = await fixture.base.t.run(async (ctx) => ({
        vehicle: await ctx.db
          .query('campaignVehicles')
          .withIndex('by_campaignId_id', (q) =>
            q.eq('campaignId', fixture.campaign.id).eq('id', fixture.unrelated.id)
          )
          .unique(),
        inventory: await ctx.db
          .query('campaignPartyInventories')
          .withIndex('by_campaignId_vehicleId', (q) =>
            q.eq('campaignId', fixture.campaign.id).eq('vehicleId', fixture.unrelated.id)
          )
          .unique(),
        item: await ctx.db
          .query('campaignPartyItems')
          .withIndex('by_campaignId_vehicleId_id', (q) =>
            q
              .eq('campaignId', fixture.campaign.id)
              .eq('vehicleId', fixture.unrelated.id)
              .eq('id', idFor(90))
          )
          .unique(),
        currency: await ctx.db
          .query('campaignPartyCurrencies')
          .withIndex('by_campaignId_vehicleId_id', (q) =>
            q
              .eq('campaignId', fixture.campaign.id)
              .eq('vehicleId', fixture.unrelated.id)
              .eq('id', idFor(92))
          )
          .unique()
      }))
      await applyProducer(producer, fixture)
      const state = await fixture.base.t.run(async (ctx) => ({
        root: await ctx.db
          .query('authoredRoots')
          .withIndex('by_publicId', (q) => q.eq('id', fixture.publication.subjectId))
          .unique(),
        vehicles: await ctx.db.query('campaignVehicles').collect(),
        inventories: await ctx.db.query('campaignPartyInventories').collect(),
        items: await ctx.db.query('campaignPartyItems').collect(),
        groups: await ctx.db.query('campaignPartyCurrencyGroups').collect(),
        currencies: await ctx.db.query('campaignPartyCurrencies').collect(),
        events: await ctx.db.query('campaignEvents').collect()
      }))
      const sourceVehicleIds = new Set(fixture.targetVehicles.map((vehicle) => vehicle.id))
      expect(state.vehicles.filter((vehicle) => sourceVehicleIds.has(vehicle.id))).toEqual([])
      expect(state.vehicles.find((vehicle) => vehicle.id === fixture.unrelated.id)).toEqual(
        unrelatedBefore.vehicle
      )
      expect(state.inventories.find((row) => row.vehicleId === fixture.unrelated.id)).toEqual(
        unrelatedBefore.inventory
      )
      expect(state.items.find((row) => row.id === idFor(90))).toEqual(unrelatedBefore.item)
      expect(state.currencies.find((row) => row.id === idFor(92))).toEqual(unrelatedBefore.currency)
      expect(state.inventories.filter((row) => row.vehicleId === undefined)).toHaveLength(1)
      expect(state.inventories.find((row) => row.vehicleId === undefined)).toMatchObject({
        version: 6
      })
      for (const row of fixture.sourceRows) {
        const parent = state.items.find((item) => item.id === row.parentId)
        const child = state.items.find((item) => item.id === row.childId)
        const group = state.groups.find((candidate) => candidate.id === row.groupId)
        const balance = state.currencies.find((candidate) => candidate.id === row.groupedBalanceId)
        expect(parent).toMatchObject({ id: row.parentId, containerId: null })
        expect(child).toMatchObject({ id: row.childId, containerId: row.parentId })
        expect(group).toMatchObject({ id: row.groupId, containerId: row.parentId })
        expect(balance).toMatchObject({
          id: row.groupedBalanceId,
          groupId: row.groupId,
          containerId: row.parentId,
          amount: row.amount
        })
        expect(parent).not.toHaveProperty('vehicleId')
        expect(child).not.toHaveProperty('vehicleId')
        expect(group).not.toHaveProperty('vehicleId')
        expect(balance).not.toHaveProperty('vehicleId')
      }
      expect(state.currencies.find((row) => row.id === idFor(91))).toMatchObject({ amount: 28 })
      expect(
        state.currencies.filter((row) =>
          fixture.sourceRows.some((source) => source.looseBalanceId === row.id)
        )
      ).toEqual([])
      if (producer === 'AUTHORED_DELETED') expect(state.root).toBeNull()
      const removals = state.events.filter(
        (event) => event.type === 'CAMPAIGN_CONTENT_SHARES_REMOVED'
      )
      const evacuations = state.events.filter(
        (event) => event.type === 'CAMPAIGN_VEHICLE_EVACUATED'
      )
      expect(removals).toEqual([
        expect.objectContaining({
          visibility: removalVisibility,
          actorUserId:
            producer === 'MEMBER_REMOVED' ? fixture.base.other.userId : fixture.base.owner.userId
        })
      ])
      expect(evacuations).toHaveLength(2)
      expect(evacuations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ visibility: 'OWNER' }),
          expect.objectContaining({ visibility: 'OWNER' })
        ])
      )
      const receipt = JSON.parse(removals[0]!.payloadJson) as {
        receipt: { evacuatedVehicles: unknown[] }
      }
      expect(receipt.receipt.evacuatedVehicles).toHaveLength(2)
      for (const event of evacuations)
        expect(JSON.parse(event.payloadJson)).toMatchObject({
          reason: producer,
          removalEventId: removals[0]!.id
        })
    },
    30_000
  )

  it.each(['AUTHORED_DELETED', 'MEMBER_LEFT', 'MEMBER_REMOVED'] as const)(
    '%s removes its source and defers an unsafe loose-currency merge for recovery',
    async (producer) => {
      const fixture = await setup(true)
      const beforeCargo = await fixture.base.t.run(async (ctx) => ({
        vehicles: await ctx.db.query('campaignVehicles').collect(),
        items: await ctx.db.query('campaignPartyItems').collect(),
        currencies: await ctx.db.query('campaignPartyCurrencies').collect(),
        groups: await ctx.db.query('campaignPartyCurrencyGroups').collect(),
        inventories: await ctx.db.query('campaignPartyInventories').collect()
      }))
      await applyProducer(producer, fixture)
      const captured = await fixture.base.t.run(async (ctx) => ({
        root: await ctx.db
          .query('authoredRoots')
          .withIndex('by_publicId', (q) => q.eq('id', fixture.publication.subjectId))
          .unique(),
        memberships: await ctx.db.query('campaignMemberships').collect(),
        shares: await ctx.db.query('campaignContentShares').collect(),
        events: await ctx.db.query('campaignEvents').collect(),
        jobs: await ctx.db.query('campaignVehicleCleanupJobs').collect()
      }))
      const removal = captured.events.find(
        (event) => event.type === 'CAMPAIGN_CONTENT_SHARES_REMOVED'
      )!
      const receipt = campaignContentRemovalReceiptDtoSchema.parse(
        JSON.parse(removal.payloadJson).receipt
      )
      const jobs = captured.jobs.filter((job) => job.grant.campaignId === fixture.campaign.id)
      expect([...receipt.pendingVehicleCleanupIds!].sort()).toEqual(
        jobs.map((job) => job.id).sort()
      )
      expect(jobs).toHaveLength(2)
      expect(jobs.map((job) => job.grant.vehicleId).sort()).toEqual(
        fixture.targetVehicles.map((vehicle) => vehicle.id).sort()
      )
      for (const job of jobs) {
        const source = fixture.targetVehicles.find((vehicle) => vehicle.id === job.grant.vehicleId)!
        expect(job.grant).toMatchObject({
          campaignId: fixture.campaign.id,
          vehicleId: source.id,
          vehicleVersion: source.version,
          sourceInventoryVersion: 2,
          vehicleDefinitionId: fixture.publication.subjectId,
          label: source.label,
          actorUserId:
            producer === 'MEMBER_REMOVED' ? fixture.base.other.userId : fixture.base.owner.userId,
          removalEventId: receipt.eventId,
          mode: 'RETURN'
        })
        expect(job.grantChecksum).toBe(
          checksumCanonicalJson({ operation: 'VEHICLE_CLEANUP_GRANT', grant: job.grant })
        )
      }
      if (producer === 'AUTHORED_DELETED') expect(captured.root).toBeNull()
      else
        expect(
          captured.memberships.find(
            (row) =>
              row.campaignId === fixture.campaign.id && row.userId === fixture.base.owner.userId
          )?.status
        ).not.toBe('ACTIVE')
      expect(
        captured.shares.some((share) => share.subjectId === fixture.publication.subjectId)
      ).toBe(false)
      await fixture.base.t.finishAllScheduledFunctions(vi.runAllTimers)
      const failed = await fixture.base.t.run(async (ctx) => ({
        jobs: await ctx.db.query('campaignVehicleCleanupJobs').collect(),
        vehicles: await ctx.db.query('campaignVehicles').collect(),
        items: await ctx.db.query('campaignPartyItems').collect(),
        currencies: await ctx.db.query('campaignPartyCurrencies').collect(),
        groups: await ctx.db.query('campaignPartyCurrencyGroups').collect(),
        inventories: await ctx.db.query('campaignPartyInventories').collect()
      }))
      const failedJobs = failed.jobs.filter((job) =>
        jobs.some((original) => original.id === job.id)
      )
      expect(failedJobs).toHaveLength(2)
      for (const job of failedJobs) {
        const original = jobs.find((candidate) => candidate.id === job.id)!
        expect(job).toMatchObject({ status: 'FAILED', releaseComplete: true, applyStarted: false })
        expect(job.grant).toEqual(original.grant)
        expect(job.grantChecksum).toBe(original.grantChecksum)
      }
      expect({ items: failed.items, currencies: failed.currencies, groups: failed.groups }).toEqual(
        {
          items: beforeCargo.items,
          currencies: beforeCargo.currencies,
          groups: beforeCargo.groups
        }
      )
      expect(failed.inventories).toEqual(
        beforeCargo.inventories.map((row) => ({
          ...row,
          version: fixture.targetVehicles.some((vehicle) => vehicle.id === row.vehicleId)
            ? row.version + 1
            : row.version
        }))
      )
      const owner = await fixture.base.t.run((ctx) =>
        ctx.db
          .query('campaignPartyInventories')
          .withIndex('by_campaignId_vehicleId', (q) =>
            q.eq('campaignId', fixture.campaign.id).eq('vehicleId', undefined)
          )
          .unique()
      )
      await fixture.base.other.caller.mutation(api.campaigns.partyInventoryCommands.mutate, {
        input: {
          kind: 'CURRENCY_ADJUST',
          campaignId: fixture.campaign.id,
          expectedOwnerVersion: owner!.version,
          idempotencyKey: crypto.randomUUID(),
          denominationId: fixture.denominationId,
          campaignCurrencySystemId: null,
          amount: -20,
          containerId: null
        }
      })
      for (const job of jobs)
        await fixture.base.other.caller.mutation(api.campaigns.inventoryCleanup.retry, {
          campaignId: fixture.campaign.id,
          jobId: job.id
        })
      await fixture.base.t.finishAllScheduledFunctions(vi.runAllTimers)
      const completed = await fixture.base.t.run(async (ctx) => ({
        jobs: await ctx.db.query('campaignVehicleCleanupJobs').collect(),
        vehicles: await ctx.db.query('campaignVehicles').collect(),
        balances: await ctx.db.query('campaignPartyCurrencies').collect(),
        items: await ctx.db.query('campaignPartyItems').collect(),
        groups: await ctx.db.query('campaignPartyCurrencyGroups').collect(),
        inventories: await ctx.db.query('campaignPartyInventories').collect()
      }))
      const completedJobs = completed.jobs.filter((job) =>
        jobs.some((original) => original.id === job.id)
      )
      expect(completedJobs).toHaveLength(2)
      for (const job of completedJobs) {
        const original = jobs.find((candidate) => candidate.id === job.id)!
        expect(job.status).toBe('COMPLETED')
        expect(job.grant).toEqual(original.grant)
        expect(job.grantChecksum).toBe(original.grantChecksum)
      }
      expect(
        completed.vehicles.some((vehicle) =>
          fixture.targetVehicles.some((target) => target.id === vehicle.id)
        )
      ).toBe(false)
      expect(completed.balances.find((balance) => balance.id === idFor(91))).toMatchObject({
        amount: Number.MAX_SAFE_INTEGER - 18
      })
      expect(completed.vehicles).toEqual(
        beforeCargo.vehicles.filter(
          (vehicle) => !fixture.targetVehicles.some((target) => target.id === vehicle.id)
        )
      )
      expect(completed.items).toEqual(
        beforeCargo.items.map((row) => {
          const job = jobs.find((candidate) => candidate.grant.vehicleId === row.vehicleId)
          return job ? { ...row, vehicleId: undefined, cleanupJobId: job.id } : row
        })
      )
      expect(completed.groups).toEqual(
        beforeCargo.groups.map((row) => {
          const job = jobs.find((candidate) => candidate.grant.vehicleId === row.vehicleId)
          return job ? { ...row, vehicleId: undefined, cleanupJobId: job.id } : row
        })
      )
      const destination = completed.balances.find((row) => row.id === idFor(91))!
      expect(jobs.map((job) => job.id)).toContain(destination.cleanupJobId)
      expect(completed.balances).toEqual(
        beforeCargo.currencies
          .filter((row) => {
            const job = jobs.find((candidate) => candidate.grant.vehicleId === row.vehicleId)
            return !job || row.groupId !== undefined || row.containerId !== null
          })
          .map((row) => {
            if (row.id === idFor(91))
              return {
                ...row,
                amount: Number.MAX_SAFE_INTEGER - 18,
                cleanupJobId: destination.cleanupJobId
              }
            const job = jobs.find((candidate) => candidate.grant.vehicleId === row.vehicleId)
            return job ? { ...row, vehicleId: undefined, cleanupJobId: job.id } : row
          })
      )
      expect(completed.inventories).toEqual(
        beforeCargo.inventories
          .filter((row) => !fixture.targetVehicles.some((vehicle) => vehicle.id === row.vehicleId))
          .map((row) => ({
            ...row,
            version:
              row.campaignId === fixture.campaign.id && row.vehicleId === undefined
                ? row.version + 3
                : row.version
          }))
      )
      const replay = await fixture.base.t.run((ctx) =>
        ctx.db.query('campaignPartyCurrencies').collect()
      )
      for (const job of jobs) {
        await fixture.base.t.mutation(internal.campaigns.vehicleCleanup.run, { jobId: job.id })
        await fixture.base.other.caller.mutation(api.campaigns.inventoryCleanup.retry, {
          campaignId: fixture.campaign.id,
          jobId: job.id
        })
      }
      expect(
        await fixture.base.t.run((ctx) => ctx.db.query('campaignPartyCurrencies').collect())
      ).toEqual(replay)
    },
    30_000
  )
})
