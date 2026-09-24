import { makeFunctionReference } from 'convex/server'
import { v } from 'convex/values'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  campaignInventoryPurgeGrantSchema,
  campaignInventoryPurgePhaseSchema,
  type CampaignInventoryPurgeGrant,
  type CampaignInventoryPurgePhase,
  type CampaignInventoryPurgeRun
} from '@artificer-toolkit/schema/projections/campaignInventoryPurge'
import { uuidSchema } from '@artificer-toolkit/schema/api/campaignContractSchemas'
import { campaignStoredVehicleCleanupSchema } from '@artificer-toolkit/schema/projections/campaignVehicleCleanupPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { internalMutation } from '../lib/mutations'

const PAGE_SIZE = 8
const PAGE_BYTES = 1024 * 1024
const purgeReference = makeFunctionReference<'mutation', CampaignInventoryPurgeRun, null>(
  'campaigns/inventoryPurge:run'
)
const grantFields = zodToConvexFields(campaignInventoryPurgeGrantSchema.shape)
const runArgs = {
  grant: v.object({ ...grantFields, campaignRootId: v.id('campaigns') }),
  phase: zodToConvex(campaignInventoryPurgePhaseSchema),
  jobId: v.optional(zodToConvex(uuidSchema))
}

type Capture = Omit<CampaignInventoryPurgeGrant, 'cleanupId' | 'grantChecksum'>

function grantChecksum(grant: Omit<CampaignInventoryPurgeGrant, 'grantChecksum'>) {
  return checksumCanonicalJson({ operation: 'CAMPAIGN_INVENTORY_PURGE_GRANT', grant })
}

function parseGrant(value: unknown) {
  const grant = campaignInventoryPurgeGrantSchema.parse(value)
  const { grantChecksum: capturedChecksum, ...unsignedGrant } = grant
  if (capturedChecksum !== grantChecksum(unsignedGrant))
    throw new Error('Campaign inventory purge grant checksum mismatch.')
  return grant
}

function pageOptions() {
  return {
    cursor: null,
    numItems: PAGE_SIZE,
    maximumRowsRead: PAGE_SIZE,
    maximumBytesRead: PAGE_BYTES
  }
}

async function schedule(
  ctx: MutationCtx,
  grant: CampaignInventoryPurgeGrant,
  phase: CampaignInventoryPurgePhase,
  jobId?: string
) {
  await ctx.scheduler.runAfter(0, purgeReference, { grant, phase, ...(jobId ? { jobId } : {}) })
}

/** The owning DELETE mutation captures its current authority before removing the Campaign root. */
export async function scheduleCampaignInventoryPurge(ctx: MutationCtx, capture: Capture) {
  const unsignedGrant = { ...capture, cleanupId: crypto.randomUUID() }
  const authorized = campaignInventoryPurgeGrantSchema.parse({
    ...unsignedGrant,
    grantChecksum: grantChecksum(unsignedGrant)
  })
  await schedule(ctx, authorized, 'VEHICLE_JOB')
}

async function ensureDeletedCampaign(
  ctx: MutationCtx,
  grant: CampaignInventoryPurgeGrant,
  campaignRootId: Id<'campaigns'>
) {
  const [capturedRoot, currentRoot] = await Promise.all([
    ctx.db.get(campaignRootId),
    ctx.db
      .query('campaigns')
      .withIndex('by_publicId', (q) => q.eq('id', grant.campaignId))
      .unique()
  ])
  if (capturedRoot || currentRoot)
    throw new Error('Campaign inventory purge refuses a live or recreated Campaign root.')
}

function stored<T extends { _id: unknown; _creationTime: number }>(row: T) {
  const { _id, _creationTime, ...value } = row
  return value
}

async function readJob(ctx: MutationCtx, campaignId: string, jobId: string) {
  const row = await ctx.db
    .query('campaignVehicleCleanupJobs')
    .withIndex('by_publicId', (q) => q.eq('id', jobId))
    .unique()
  if (!row) return null
  const job = campaignStoredVehicleCleanupSchema.parse(stored(row))
  if (
    job.grant.campaignId !== campaignId ||
    job.grantChecksum !==
      checksumCanonicalJson({ operation: 'VEHICLE_CLEANUP_GRANT', grant: job.grant })
  )
    throw new Error('Campaign inventory purge Vehicle cleanup scope mismatch.')
  return row
}

async function purgeVehicleJob(ctx: MutationCtx, grant: CampaignInventoryPurgeGrant) {
  const page = await ctx.db
    .query('campaignVehicleCleanupJobs')
    .withIndex('by_campaignId_status_id', (q) => q.eq('grant.campaignId', grant.campaignId))
    .paginate({ ...pageOptions(), numItems: 1, maximumRowsRead: 1 })
  const row = page.page[0]
  if (!row) return schedule(ctx, grant, page.isDone ? 'PARTY_ITEMS' : 'VEHICLE_JOB')
  const job = await readJob(ctx, grant.campaignId, row.id)
  if (!job || job._id !== row._id)
    throw new Error('Campaign inventory purge Vehicle cleanup identity mismatch.')
  await schedule(ctx, grant, 'VEHICLE_JOB_TOTALS', job.id)
}

async function purgeVehicleJobTotals(
  ctx: MutationCtx,
  grant: CampaignInventoryPurgeGrant,
  jobId: string
) {
  const job = await readJob(ctx, grant.campaignId, jobId)
  if (!job) return schedule(ctx, grant, 'VEHICLE_JOB')
  const page = await ctx.db
    .query('campaignVehicleCleanupTotals')
    .withIndex('by_jobId_slot', (q) => q.eq('jobId', jobId))
    .paginate(pageOptions())
  for (const row of page.page) {
    if (row.jobId !== jobId) throw new Error('Campaign inventory purge total scope mismatch.')
    await ctx.db.delete(row._id)
  }
  await schedule(ctx, grant, page.isDone ? 'VEHICLE_JOB_SEGMENTS' : 'VEHICLE_JOB_TOTALS', jobId)
}

async function purgeVehicleJobSegments(
  ctx: MutationCtx,
  grant: CampaignInventoryPurgeGrant,
  jobId: string
) {
  const job = await readJob(ctx, grant.campaignId, jobId)
  if (!job) return schedule(ctx, grant, 'VEHICLE_JOB')
  const page = await ctx.db
    .query('campaignVehicleCleanupSegments')
    .withIndex('by_jobId_sequence', (q) => q.eq('jobId', jobId))
    .paginate(pageOptions())
  for (const row of page.page) {
    if (row.jobId !== jobId) throw new Error('Campaign inventory purge segment scope mismatch.')
    await ctx.db.delete(row._id)
  }
  if (!page.isDone) return schedule(ctx, grant, 'VEHICLE_JOB_SEGMENTS', jobId)
  await ctx.db.delete(job._id)
  await schedule(ctx, grant, 'VEHICLE_JOB')
}

async function purgePartyItems(ctx: MutationCtx, grant: CampaignInventoryPurgeGrant) {
  const page = await ctx.db
    .query('campaignPartyItems')
    .withIndex('by_campaignId_id', (q) => q.eq('campaignId', grant.campaignId))
    .paginate(pageOptions())
  for (const row of page.page) {
    if (row.campaignId !== grant.campaignId)
      throw new Error('Campaign inventory item scope mismatch.')
    await ctx.db.delete(row._id)
  }
  await schedule(ctx, grant, page.isDone ? 'PARTY_CURRENCY_GROUPS' : 'PARTY_ITEMS')
}

async function purgePartyCurrencyGroups(ctx: MutationCtx, grant: CampaignInventoryPurgeGrant) {
  const page = await ctx.db
    .query('campaignPartyCurrencyGroups')
    .withIndex('by_campaignId_id', (q) => q.eq('campaignId', grant.campaignId))
    .paginate(pageOptions())
  for (const row of page.page) {
    if (row.campaignId !== grant.campaignId)
      throw new Error('Campaign inventory currency group scope mismatch.')
    await ctx.db.delete(row._id)
  }
  await schedule(ctx, grant, page.isDone ? 'PARTY_CURRENCIES' : 'PARTY_CURRENCY_GROUPS')
}

async function purgePartyCurrencies(ctx: MutationCtx, grant: CampaignInventoryPurgeGrant) {
  const page = await ctx.db
    .query('campaignPartyCurrencies')
    .withIndex('by_campaignId_id', (q) => q.eq('campaignId', grant.campaignId))
    .paginate(pageOptions())
  for (const row of page.page) {
    if (row.campaignId !== grant.campaignId)
      throw new Error('Campaign inventory currency scope mismatch.')
    await ctx.db.delete(row._id)
  }
  await schedule(ctx, grant, page.isDone ? 'PARTY_INVENTORIES' : 'PARTY_CURRENCIES')
}

async function purgePartyInventories(ctx: MutationCtx, grant: CampaignInventoryPurgeGrant) {
  const page = await ctx.db
    .query('campaignPartyInventories')
    .withIndex('by_campaignId', (q) => q.eq('campaignId', grant.campaignId))
    .paginate(pageOptions())
  for (const row of page.page) {
    if (row.campaignId !== grant.campaignId)
      throw new Error('Campaign inventory owner scope mismatch.')
    await ctx.db.delete(row._id)
  }
  await schedule(ctx, grant, page.isDone ? 'CURRENCY_DENOMINATIONS' : 'PARTY_INVENTORIES')
}

async function purgeCurrencyDenominations(ctx: MutationCtx, grant: CampaignInventoryPurgeGrant) {
  const page = await ctx.db
    .query('campaignCurrencyDenominations')
    .withIndex('by_campaignId_id', (q) => q.eq('campaignId', grant.campaignId))
    .paginate(pageOptions())
  for (const row of page.page) {
    if (row.campaignId !== grant.campaignId)
      throw new Error('Campaign currency denomination scope mismatch.')
    await ctx.db.delete(row._id)
  }
  await schedule(ctx, grant, page.isDone ? 'CURRENCY_SYSTEMS' : 'CURRENCY_DENOMINATIONS')
}

async function purgeCurrencySystems(ctx: MutationCtx, grant: CampaignInventoryPurgeGrant) {
  const page = await ctx.db
    .query('campaignCurrencySystems')
    .withIndex('by_campaignId_id', (q) => q.eq('campaignId', grant.campaignId))
    .paginate(pageOptions())
  for (const row of page.page) {
    if (row.campaignId !== grant.campaignId)
      throw new Error('Campaign currency system scope mismatch.')
    await ctx.db.delete(row._id)
  }
  await schedule(ctx, grant, page.isDone ? 'VEHICLES' : 'CURRENCY_SYSTEMS')
}

async function purgeVehicles(ctx: MutationCtx, grant: CampaignInventoryPurgeGrant) {
  const page = await ctx.db
    .query('campaignVehicles')
    .withIndex('by_campaignId_id', (q) => q.eq('campaignId', grant.campaignId))
    .paginate(pageOptions())
  for (const row of page.page) {
    if (row.campaignId !== grant.campaignId) throw new Error('Campaign Vehicle scope mismatch.')
    await ctx.db.delete(row._id)
  }
  if (!page.isDone) await schedule(ctx, grant, 'VEHICLES')
}

export const run = internalMutation({
  args: runArgs,
  returns: v.null(),
  handler: async (ctx, args) => {
    const grant = parseGrant(args.grant)
    await ensureDeletedCampaign(ctx, grant, args.grant.campaignRootId)
    switch (args.phase) {
      case 'VEHICLE_JOB':
        await purgeVehicleJob(ctx, grant)
        break
      case 'VEHICLE_JOB_TOTALS':
        if (!args.jobId) throw new Error('Campaign inventory purge Vehicle cleanup ID is missing.')
        await purgeVehicleJobTotals(ctx, grant, args.jobId)
        break
      case 'VEHICLE_JOB_SEGMENTS':
        if (!args.jobId) throw new Error('Campaign inventory purge Vehicle cleanup ID is missing.')
        await purgeVehicleJobSegments(ctx, grant, args.jobId)
        break
      case 'PARTY_ITEMS':
        await purgePartyItems(ctx, grant)
        break
      case 'PARTY_CURRENCY_GROUPS':
        await purgePartyCurrencyGroups(ctx, grant)
        break
      case 'PARTY_CURRENCIES':
        await purgePartyCurrencies(ctx, grant)
        break
      case 'PARTY_INVENTORIES':
        await purgePartyInventories(ctx, grant)
        break
      case 'CURRENCY_DENOMINATIONS':
        await purgeCurrencyDenominations(ctx, grant)
        break
      case 'CURRENCY_SYSTEMS':
        await purgeCurrencySystems(ctx, grant)
        break
      case 'VEHICLES':
        await purgeVehicles(ctx, grant)
        break
    }
    return null
  }
})
