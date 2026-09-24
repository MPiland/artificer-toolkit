import { makeFunctionReference } from 'convex/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  CampaignDeletionResult,
  CreateCampaignInput,
  DeleteCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import {
  campaignInventoryPurgeRunSchema,
  type CampaignInventoryPurgeRun
} from '@artificer-toolkit/schema/projections/campaignInventoryPurge'
import {
  campaignStoredVehicleCleanupSchema,
  campaignStoredVehicleCleanupSegmentSchema,
  campaignStoredVehicleCleanupTotalSchema,
  type VehicleCleanupJob
} from '@artificer-toolkit/schema/projections/campaignVehicleCleanupPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { backpack } from '@artificer-toolkit/source-data/srd/equipment/backpack.js'
import { cart } from '@artificer-toolkit/source-data/srd/vehicles/cart.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { api, internal } from '../_generated/api'
import type { Id, TableNames } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import schema from '../schema'
import * as accountUsage from '../lib/accountUsage'
import type { DevelopmentClient } from '../../tests/developmentClient'
import { populateCampaignLifecycleInventory } from '../../tests/developmentCampaignLifecycleInventory'
import { readySheetFixture } from '../../tests/fixtures/readyCharacter'
import { importedSubject } from '../../tests/fixtures/publication'
import * as deletionState from './deletionState'

const remove = makeFunctionReference<'mutation', DeleteCampaignInput, CampaignDeletionResult>(
  'campaigns/deletion:remove'
)
const purge = makeFunctionReference<'mutation', CampaignInventoryPurgeRun, null>(
  'campaigns/inventoryPurge:run'
)
beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

const campaignInput: CreateCampaignInput = {
  name: 'Purge',
  format: 'ONGOING',
  toneTags: ['HEROIC'],
  contentMaturity: 'STANDARD',
  gameSystemId: srdSystemRecord.id,
  primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
}

async function setup(itemCount: number) {
  const base = await readySheetFixture()
  const target = await base.other.caller.mutation(api.campaigns.create.create, campaignInput)
  const unrelated = await base.owner.caller.mutation(api.campaigns.create.create, {
    ...campaignInput,
    name: 'Unrelated'
  })
  await base.t.run(async (ctx) => {
    for (const campaignId of [target.id, unrelated.id]) {
      await ctx.db.insert('campaignPartyInventories', { campaignId, version: 0 })
      for (let index = 0; index < itemCount; index++)
        await ctx.db.insert('campaignPartyItems', {
          campaignId,
          id: crypto.randomUUID(),
          equipmentId: club.id,
          quantity: 1,
          containerId: null
        })
    }
  })
  return { base, target, unrelated }
}
async function items(base: Awaited<ReturnType<typeof readySheetFixture>>, campaignId: string) {
  return base.t.run((ctx) =>
    ctx.db
      .query('campaignPartyItems')
      .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaignId))
      .collect()
  )
}
async function grant(base: Awaited<ReturnType<typeof readySheetFixture>>) {
  return base.t.run(async (ctx) => {
    const row = (await ctx.db.system.query('_scheduled_functions').collect()).find(
      (job) => job.name === 'campaigns/inventoryPurge:run'
    )
    if (!row) throw new Error('Missing native purge schedule.')
    return campaignInventoryPurgeRunSchema.parse(row.args[0])
  })
}

const inventoryTableNames = [
  'campaignPartyItems',
  'campaignPartyCurrencyGroups',
  'campaignPartyCurrencies',
  'campaignPartyInventories',
  'campaignCurrencyDenominations',
  'campaignCurrencySystems',
  'campaignVehicles'
] as const
const tableNames = Object.keys(schema.tables) as TableNames[]
type Fixture = Awaited<ReturnType<typeof readySheetFixture>>
const snapshot = (base: Fixture) =>
  base.t.run(async (ctx) => ({
    tables: Object.fromEntries(
      await Promise.all(
        tableNames.map(async (name) => [name, await ctx.db.query(name).collect()] as const)
      )
    ) as Record<string, unknown[]>,
    scheduled: await ctx.db.system.query('_scheduled_functions').collect()
  }))
async function inventoryRows(base: Fixture, campaignId: string) {
  return base.t.run(async (ctx) => ({
    campaignPartyItems: await ctx.db
      .query('campaignPartyItems')
      .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaignId))
      .collect(),
    campaignPartyCurrencyGroups: await ctx.db
      .query('campaignPartyCurrencyGroups')
      .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaignId))
      .collect(),
    campaignPartyCurrencies: await ctx.db
      .query('campaignPartyCurrencies')
      .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaignId))
      .collect(),
    campaignPartyInventories: await ctx.db
      .query('campaignPartyInventories')
      .withIndex('by_campaignId', (q) => q.eq('campaignId', campaignId))
      .collect(),
    campaignCurrencyDenominations: await ctx.db
      .query('campaignCurrencyDenominations')
      .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaignId))
      .collect(),
    campaignCurrencySystems: await ctx.db
      .query('campaignCurrencySystems')
      .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaignId))
      .collect(),
    campaignVehicles: await ctx.db
      .query('campaignVehicles')
      .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaignId))
      .collect()
  }))
}
async function importInventorySources(base: Fixture) {
  await base.t.mutation(internal.content.import.importSubjects, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [
      importedSubject({ subjectKind: 'EQUIPMENT', ...backpack, document: backpack }),
      importedSubject({ subjectKind: 'VEHICLE', ...cart, document: cart })
    ]
  })
}
function cleanupJob(campaignId: string, actorUserId: string, status: 'RUNNING' | 'COMPLETED') {
  const grant = {
    campaignId,
    campaignVersion: 0,
    vehicleId: crypto.randomUUID(),
    vehicleVersion: 0,
    sourceInventoryVersion: 0,
    actorUserId,
    eventId: crypto.randomUUID(),
    commandId: crypto.randomUUID(),
    inputFingerprint: checksumCanonicalJson({ fixture: 'campaign-inventory-purge' }),
    mode: 'DESTROY' as const,
    beforeAvailability: 'UNAVAILABLE' as const,
    label: null,
    vehicleDefinitionId: crypto.randomUUID()
  }
  const now = new Date().toISOString()
  return campaignStoredVehicleCleanupSchema.parse({
    id: crypto.randomUUID(),
    grant,
    grantChecksum: checksumCanonicalJson({ operation: 'VEHICLE_CLEANUP_GRANT', grant }),
    status,
    phase: status === 'RUNNING' ? 'VALIDATE_ITEMS' : 'FINALIZE',
    cursor: null,
    pageDone: true,
    pending: [],
    validated: { items: 0, topLevelItems: 0, currencyGroups: 0, currencies: 0 },
    applied: { items: 0, topLevelItems: 0, currencyGroups: 0, currencies: 0 },
    sequence: 0,
    applyStarted: false,
    releaseComplete: status === 'COMPLETED',
    purgeTable: 0,
    sourceInventoryVersion: 0,
    destinationInventoryVersion: null,
    failureReason: null,
    createdAt: now,
    updatedAt: now
  })
}
async function seedCleanupRows(ctx: MutationCtx, job: VehicleCleanupJob, rows = 9) {
  await ctx.db.insert('campaignVehicleCleanupJobs', job)
  for (let index = 0; index < rows; index++) {
    await ctx.db.insert(
      'campaignVehicleCleanupTotals',
      campaignStoredVehicleCleanupTotalSchema.parse({
        jobId: job.id,
        denominationId: crypto.randomUUID(),
        sourceAmount: '0',
        targetId: null,
        targetBeforeAmount: 0,
        placeholder: false,
        locked: false,
        applied: false
      })
    )
    await ctx.db.insert(
      'campaignVehicleCleanupSegments',
      campaignStoredVehicleCleanupSegmentSchema.parse({
        jobId: job.id,
        sequence: index,
        phase: 'FINALIZE',
        ids: [],
        beforeAmounts: [],
        afterAmounts: [],
        createdAt: new Date().toISOString()
      })
    )
  }
}
async function cleanupRows(base: Fixture, campaignId: string) {
  return base.t.run(async (ctx) => {
    const jobs = await ctx.db
      .query('campaignVehicleCleanupJobs')
      .withIndex('by_campaignId_status_id', (q) => q.eq('grant.campaignId', campaignId))
      .collect()
    const jobIds = new Set(jobs.map((job) => job.id))
    const [totals, segments] = await Promise.all([
      ctx.db.query('campaignVehicleCleanupTotals').collect(),
      ctx.db.query('campaignVehicleCleanupSegments').collect()
    ])
    return {
      jobs,
      totals: totals.filter((row) => jobIds.has(row.jobId)),
      segments: segments.filter((row) => jobIds.has(row.jobId))
    }
  })
}

describe('native Campaign inventory purge candidate', () => {
  it('deletes ordinary inventory in the public transaction without a scheduler grant', async () => {
    const { base, target } = await setup(2)
    await expect(
      base.other.caller.mutation(remove, {
        campaignId: target.id,
        expectedVersion: target.version,
        confirmation: 'DELETE'
      })
    ).resolves.toEqual({ ok: true })
    expect(await items(base, target.id)).toEqual([])
    expect(
      await base.t.run((ctx) => ctx.db.system.query('_scheduled_functions').collect())
    ).not.toContainEqual(expect.objectContaining({ name: 'campaigns/inventoryPurge:run' }))
  })

  it('uses the actual public-delete grant, refuses tampering, and deletes only eight target rows per invocation', async () => {
    const { base, target, unrelated } = await setup(33)
    const unrelatedBefore = await items(base, unrelated.id)
    await base.other.caller.mutation(remove, {
      campaignId: target.id,
      expectedVersion: target.version,
      confirmation: 'DELETE'
    })
    const captured = await grant(base)
    await expect(
      base.t.mutation(purge, {
        ...captured,
        grant: { ...captured.grant, grantChecksum: '0'.repeat(64) }
      })
    ).rejects.toThrow('checksum')
    await base.t.mutation(purge, { ...captured, phase: 'PARTY_ITEMS' })
    expect(await items(base, target.id)).toHaveLength(25)
    for (let index = 0; index < 5; index++)
      await base.t.mutation(purge, { ...captured, phase: 'PARTY_ITEMS' })
    expect(await items(base, target.id)).toEqual([])
    expect(await items(base, unrelated.id)).toEqual(unrelatedBefore)
  })

  it('refuses a purge job while the native root is live and rolls back a failed purge page', async () => {
    const { base, target } = await setup(33)
    await base.other.caller.mutation(remove, { campaignId: target.id, expectedVersion: target.version, confirmation: 'DELETE' })
    const step = makeFunctionReference<'mutation', { jobId: Id<'campaignDeletionJobs'>; revision: number }, null>('campaigns/deletionJobs:step')
    const readJob = async () => {
      const job = await base.t.run((ctx) => ctx.db.query('campaignDeletionJobs').withIndex('by_campaignId', (q) => q.eq('campaignId', target.id)).unique())
      if (!job) throw new Error('Missing deletion job.')
      return job
    }
    const initial = await readJob()
    await base.t.run((ctx) => ctx.db.patch(initial._id, { stage: 'PURGE' }))
    const fenced = await snapshot(base)
    await expect(base.t.mutation(step, { jobId: initial._id, revision: initial.revision })).rejects.toThrow('live or recreated Campaign root')
    expect(await snapshot(base)).toEqual(fenced)
    await base.t.run((ctx) => ctx.db.patch(initial._id, { stage: 'DRAIN_ROOM' }))
    for (let page = 0; page < 20; page++) {
      const job = await readJob()
      if (job.stage === 'PURGE') break
      await base.t.mutation(step, { jobId: job._id, revision: job.revision })
    }
    const job = await readJob()
    expect(job.stage).toBe('PURGE')
    const before = await snapshot(base)
    const original = deletionState.removeCampaignState
    let observed = false
    const guard = vi
      .spyOn(deletionState, 'removeCampaignState')
      .mockImplementation(async (ctx, captured) => {
        await original(ctx, captured)
        observed = true
        throw new Error('Injected Campaign purge rollback')
      })
    try {
      await expect(base.t.mutation(step, { jobId: job._id, revision: job.revision })).rejects.toThrow('Injected Campaign purge rollback')
      expect(observed).toBe(true)
      expect(await snapshot(base)).toEqual(before)
    } finally {
      guard.mockRestore()
    }
    await expect(base.t.mutation(step, { jobId: job._id, revision: job.revision })).resolves.toBeNull()
  })

  it('refuses an actual grant after recreating the public UUID with a new native Campaign root', async () => {
    const { base, target } = await setup(33)
    const originalRoot = await base.t.run((ctx) =>
      ctx.db
        .query('campaigns')
        .withIndex('by_publicId', (q) => q.eq('id', target.id))
        .unique()
    )
    if (!originalRoot) throw new Error('Missing Campaign root.')
    await base.other.caller.mutation(remove, {
      campaignId: target.id,
      expectedVersion: target.version,
      confirmation: 'DELETE'
    })
    const captured = await grant(base)
    const replacementId = await base.t.run(async (ctx) => {
      const { _id, _creationTime, ...replacement } = originalRoot
      return ctx.db.insert('campaigns', replacement)
    })
    expect(replacementId).not.toBe(originalRoot._id)
    const beforeRefusal = await snapshot(base)
    await expect(base.t.mutation(purge, captured)).rejects.toThrow(
      'live or recreated Campaign root'
    )
    expect(await snapshot(base)).toEqual(beforeRefusal)
  })

  it('drains more than eight totals and segments for RUNNING and COMPLETED target jobs while retaining foreign jobs', async () => {
    const base = await readySheetFixture()
    const target = await base.other.caller.mutation(api.campaigns.create.create, campaignInput)
    const unrelated = await base.owner.caller.mutation(api.campaigns.create.create, {
      ...campaignInput,
      name: 'Foreign cleanup Campaign'
    })
    const targetJobs = [
      cleanupJob(target.id, base.other.userId, 'RUNNING'),
      cleanupJob(target.id, base.other.userId, 'COMPLETED')
    ]
    const foreignJob = cleanupJob(unrelated.id, base.owner.userId, 'RUNNING')
    await base.t.run(async (ctx) => {
      for (const job of targetJobs) await seedCleanupRows(ctx, job)
      await seedCleanupRows(ctx, foreignJob)
    })
    expect(await inventoryRows(base, target.id)).toEqual({
      campaignPartyItems: [],
      campaignPartyCurrencyGroups: [],
      campaignPartyCurrencies: [],
      campaignPartyInventories: [],
      campaignCurrencyDenominations: [],
      campaignCurrencySystems: [],
      campaignVehicles: []
    })
    const foreignBefore = await cleanupRows(base, unrelated.id)
    await base.other.caller.mutation(remove, {
      campaignId: target.id,
      expectedVersion: target.version,
      confirmation: 'DELETE'
    })
    await base.t.finishAllScheduledFunctions(vi.runAllTimers)
    const targetAfter = await base.t.run(async (ctx) => {
      const jobIds = new Set(targetJobs.map((job) => job.id))
      const [jobs, totals, segments] = await Promise.all([
        ctx.db
          .query('campaignVehicleCleanupJobs')
          .withIndex('by_campaignId_status_id', (q) => q.eq('grant.campaignId', target.id))
          .collect(),
        ctx.db.query('campaignVehicleCleanupTotals').collect(),
        ctx.db.query('campaignVehicleCleanupSegments').collect()
      ])
      return {
        jobs,
        totals: totals.filter((row) => jobIds.has(row.jobId)),
        segments: segments.filter((row) => jobIds.has(row.jobId))
      }
    })
    expect(targetAfter).toEqual({ jobs: [], totals: [], segments: [] })
    expect(await cleanupRows(base, unrelated.id)).toEqual(foreignBefore)
  })

  it('drains all seven inventory tables through the real scheduler and retains unrelated state', async () => {
    const base = await readySheetFixture()
    await importInventorySources(base)
    const target = await base.other.caller.mutation(api.campaigns.create.create, campaignInput)
    const unrelated = await base.owner.caller.mutation(api.campaigns.create.create, {
      ...campaignInput,
      name: 'Unrelated all-table Campaign'
    })
    const client: DevelopmentClient = {
      query: (reference, ...args) =>
        base.other.caller.run((ctx) => ctx.runQuery(reference, ...args)),
      mutation: (reference, ...args) =>
        base.other.caller.run((ctx) => ctx.runMutation(reference, ...args))
    }
    await populateCampaignLifecycleInventory(client, target.id)
    await base.t.run(async (ctx) => {
      await ctx.db.insert('campaignPartyCurrencyGroups', {
        campaignId: target.id,
        id: crypto.randomUUID(),
        containerId: null
      })
      for (let index = 0; index < 33; index++)
        await ctx.db.insert('campaignPartyItems', {
          campaignId: target.id,
          id: crypto.randomUUID(),
          equipmentId: backpack.id,
          quantity: 1,
          containerId: null
        })
      await ctx.db.insert('campaignPartyInventories', { campaignId: unrelated.id, version: 0 })
      await ctx.db.insert('campaignPartyItems', {
        campaignId: unrelated.id,
        id: crypto.randomUUID(),
        equipmentId: backpack.id,
        quantity: 1,
        containerId: null
      })
    })
    const targetBefore = await inventoryRows(base, target.id)
    const foreignBefore = await inventoryRows(base, unrelated.id)
    for (const table of inventoryTableNames) expect(targetBefore[table], table).not.toEqual([])
    expect(
      inventoryTableNames.reduce((total, table) => total + targetBefore[table].length, 0)
    ).toBeGreaterThan(32)
    await base.other.caller.mutation(remove, {
      campaignId: target.id,
      expectedVersion: target.version,
      confirmation: 'DELETE'
    })
    await base.t.finishAllScheduledFunctions(vi.runAllTimers)
    const targetAfter = await inventoryRows(base, target.id)
    for (const table of inventoryTableNames) expect(targetAfter[table], table).toEqual([])
    expect(await inventoryRows(base, unrelated.id)).toEqual(foreignBefore)
  })

  it('rolls back every table and scheduled function when syncAccountUsage fails after public DELETE', async () => {
    const { base, target } = await setup(33)
    const before = await snapshot(base)
    const original = accountUsage.syncAccountUsage
    const fault = vi
      .spyOn(accountUsage, 'syncAccountUsage')
      .mockImplementation(async (ctx, resource, sourceId) => {
        await original(ctx, resource, sourceId)
        if (resource === 'activeHostedCampaigns' && sourceId === target.id)
          throw new Error('Injected Campaign inventory purge usage rollback')
      })
    try {
      await expect(
        base.other.caller.mutation(remove, {
          campaignId: target.id,
          expectedVersion: target.version,
          confirmation: 'DELETE'
        })
      ).rejects.toThrow('Injected Campaign inventory purge usage rollback')
      expect(await snapshot(base)).toEqual(before)
    } finally {
      fault.mockRestore()
    }
  })
})
