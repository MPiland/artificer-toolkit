import { paginator } from 'convex-helpers/server/pagination'
import schema from '../schema'
import { makeFunctionReference } from 'convex/server'
import { ConvexError, v } from 'convex/values'
import {
  campaignStoredVehicleCleanupSchema,
  campaignStoredVehicleCleanupTotalSchema,
  campaignStoredVehicleCleanupSegmentSchema,
  campaignStoredVehicleSchema,
  vehicleCleanupGrantSchema,
  vehicleCleanupAcknowledgementSchema,
  vehicleCleanupSummarySchema,
  type VehicleCleanupGrant,
  type VehicleCleanupJob,
  type VehicleCleanupAcknowledgement
} from '@artificer-toolkit/schema/projections/campaignVehicleCleanupPersistence'
import {
  campaignStoredPartyInventorySchema,
  campaignStoredPartyItemSchema,
  campaignStoredPartyCurrencyGroupSchema,
  campaignStoredPartyCurrencySchema
} from '@artificer-toolkit/schema/projections/campaignInventoryPersistence'
import { campaignStoredEventSchema } from '@artificer-toolkit/schema/projections/campaignEventPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { internalMutation } from '../lib/mutations'
import type { MutationCtx } from '../_generated/server'
import type { Doc } from '../_generated/dataModel'

const PAGE = 8
const BYTES = 1024 * 1024
const runRef = makeFunctionReference<'mutation', { jobId: string }, null>(
  'campaigns/vehicleCleanup:run'
)
const stepRef = makeFunctionReference<'mutation', { jobId: string }, null>(
  'campaigns/vehicleCleanup:step'
)
const zeroCounts = () => ({ items: 0, topLevelItems: 0, currencyGroups: 0, currencies: 0 })
type JobRow = Doc<'campaignVehicleCleanupJobs'>
type TotalRow = Doc<'campaignVehicleCleanupTotals'>

function invalid(message: string): never {
  throw new ConvexError({ vehicleCleanupValidation: true, message })
}
function parsed<T>(schema: { parse(value: unknown): T }, value: unknown): T {
  try {
    return schema.parse(value)
  } catch {
    return invalid('Stored Vehicle cleanup data is invalid.')
  }
}
function stored<T extends { _id: unknown; _creationTime: number }>(row: T) {
  const { _id, _creationTime, ...value } = row
  return value
}
function checksum(grant: VehicleCleanupGrant) {
  return checksumCanonicalJson({ operation: 'VEHICLE_CLEANUP_GRANT', grant })
}
function acknowledgement(job: VehicleCleanupJob): VehicleCleanupAcknowledgement {
  return vehicleCleanupAcknowledgementSchema.parse({
    jobId: job.id,
    campaignId: job.grant.campaignId,
    vehicleId: job.grant.vehicleId,
    eventId: job.grant.eventId,
    status: job.status
  })
}
async function findJob(ctx: MutationCtx, jobId: string) {
  const matches = await ctx.db
    .query('campaignVehicleCleanupJobs')
    .withIndex('by_publicId', (q) => q.eq('id', jobId))
    .take(2)
  if (matches.length > 1) invalid('Vehicle cleanup holder identity is duplicated.')
  const row = matches[0]
  if (!row) return null
  const job = parsed(campaignStoredVehicleCleanupSchema, stored(row))
  if (job.grantChecksum !== checksum(job.grant)) invalid('Stored Vehicle cleanup grant mismatch.')
  if (job.pending.length && job.phase !== 'VALIDATE_ITEMS')
    invalid('Invalid cleanup ancestry phase.')
  if (job.applyStarted && job.phase.startsWith('VALIDATE_'))
    invalid('Cleanup cannot revalidate after apply.')
  if (!job.applyStarted && Object.values(job.applied).some((count) => count !== 0))
    invalid('Cleanup physical apply fence is missing.')
  return { row, job }
}
async function save(
  ctx: MutationCtx,
  row: JobRow,
  job: VehicleCleanupJob,
  patch: Partial<VehicleCleanupJob>
) {
  const next = parsed(campaignStoredVehicleCleanupSchema, {
    ...job,
    ...patch,
    updatedAt: new Date().toISOString()
  })
  await ctx.db.patch(row._id, next)
  return next
}
async function schedule(ctx: MutationCtx, jobId: string, delay = 0) {
  await ctx.scheduler.runAfter(delay, runRef, { jobId })
}
function pageOpts(cursor: string | null = null) {
  return { cursor, numItems: PAGE, maximumRowsRead: PAGE, maximumBytesRead: BYTES }
}

/** Execution dispatch only: this is not an inventory size quota. */
export async function probeVehicleCleanup(
  ctx: MutationCtx,
  campaignId: string,
  vehicleId: string,
  mode: 'RETURN' | 'DESTROY' = 'RETURN',
  deferOverflow = false
) {
  const opts = { cursor: null, numItems: 33, maximumRowsRead: 33, maximumBytesRead: 1024 * 1024 }
  const db = paginator(ctx.db, schema)
  const pages = await Promise.all([
    db
      .query('campaignPartyItems')
      .withIndex('by_campaignId_vehicleId_id', (q) =>
        q.eq('campaignId', campaignId).eq('vehicleId', vehicleId)
      )
      .paginate(opts),
    db
      .query('campaignPartyCurrencyGroups')
      .withIndex('by_campaignId_vehicleId_id', (q) =>
        q.eq('campaignId', campaignId).eq('vehicleId', vehicleId)
      )
      .paginate(opts),
    db
      .query('campaignPartyCurrencies')
      .withIndex('by_campaignId_vehicleId_id', (q) =>
        q.eq('campaignId', campaignId).eq('vehicleId', vehicleId)
      )
      .paginate(opts)
  ])
  const rows = pages.reduce((total, page) => total + page.page.length, 0)
  const bytes = pages.reduce(
    (total, page) =>
      total +
      page.page.reduce(
        (size, row) => size + new TextEncoder().encode(JSON.stringify(row)).length,
        0
      ),
    0
  )
  const ordinary = pages.every((page) => page.isDone) && rows <= 32 && bytes <= 1024 * 1024
  if (!ordinary || mode === 'DESTROY') return { ordinary }
  let targetPending = false
  const looseTotals = new Map<string, bigint>()
  const balances = pages[2].page.map((source) =>
    parsed(campaignStoredPartyCurrencySchema, stored(source))
  )
  for (const balance of balances) {
    if (balance.campaignId !== campaignId || balance.vehicleId !== vehicleId)
      invalid('Currency cleanup probe source scope mismatch.')
    if (balance.groupId !== undefined || balance.containerId !== null) continue
    const slot = JSON.stringify([balance.campaignCurrencySystemId ?? null, balance.denominationId])
    looseTotals.set(slot, (looseTotals.get(slot) ?? 0n) + BigInt(balance.amount))
  }
  for (const balance of balances) {
    if (balance.groupId !== undefined || balance.containerId !== null) continue
    const target = await destinationSlot(ctx, campaignId, balance)
    const destination = target ? parsed(campaignStoredPartyCurrencySchema, stored(target)) : null
    const slot = JSON.stringify([balance.campaignCurrencySystemId ?? null, balance.denominationId])
    if (
      deferOverflow &&
      looseTotals.get(slot)! + BigInt(destination?.amount ?? 0) > BigInt(Number.MAX_SAFE_INTEGER)
    )
      targetPending = true
    if (!destination?.cleanupJobId) continue
    const holder = await findJob(ctx, destination.cleanupJobId)
    if (
      !holder ||
      holder.job.grant.campaignId !== campaignId ||
      holder.job.grant.mode !== 'RETURN' ||
      holder.job.status === 'PURGED'
    )
      invalid('Currency cleanup holder metadata is unavailable or inconsistent.')
    if (holder.job.status !== 'COMPLETED') targetPending = true
  }
  return { ordinary: !targetPending }
}

/** Trusted caller performs current authority/replay checks in this same transaction before begin. */
export async function beginVehicleCleanup(
  ctx: MutationCtx,
  input: VehicleCleanupGrant
): Promise<VehicleCleanupAcknowledgement> {
  const grant = vehicleCleanupGrantSchema.parse(input)
  const prior = await ctx.db
    .query('campaignVehicleCleanupJobs')
    .withIndex('by_campaignId_eventId', (q) =>
      q.eq('grant.campaignId', grant.campaignId).eq('grant.eventId', grant.eventId)
    )
    .unique()
  if (prior) {
    const found = await findJob(ctx, prior.id)
    if (!found || found.job.grantChecksum !== checksum(grant))
      invalid('Cleanup event was reused with different input.')
    return acknowledgement(found.job)
  }
  const [campaign, vehicle, inventory] = await Promise.all([
    ctx.db
      .query('campaigns')
      .withIndex('by_publicId', (q) => q.eq('id', grant.campaignId))
      .unique(),
    ctx.db
      .query('campaignVehicles')
      .withIndex('by_campaignId_id', (q) =>
        q.eq('campaignId', grant.campaignId).eq('id', grant.vehicleId)
      )
      .unique(),
    ctx.db
      .query('campaignPartyInventories')
      .withIndex('by_campaignId_vehicleId', (q) =>
        q.eq('campaignId', grant.campaignId).eq('vehicleId', grant.vehicleId)
      )
      .unique()
  ])
  if (!campaign || !vehicle) invalid('Cleanup owner is unavailable.')
  const metadata = parsed(campaignStoredVehicleSchema, stored(vehicle))
  if (metadata.cleanupJobId) invalid('Vehicle already has a cleanup job.')
  if (inventory) parsed(campaignStoredPartyInventorySchema, stored(inventory))
  else {
    const cargo = await Promise.all([
      ctx.db
        .query('campaignPartyItems')
        .withIndex('by_campaignId_vehicleId_id', (q) =>
          q.eq('campaignId', grant.campaignId).eq('vehicleId', grant.vehicleId)
        )
        .first(),
      ctx.db
        .query('campaignPartyCurrencyGroups')
        .withIndex('by_campaignId_vehicleId_id', (q) =>
          q.eq('campaignId', grant.campaignId).eq('vehicleId', grant.vehicleId)
        )
        .first(),
      ctx.db
        .query('campaignPartyCurrencies')
        .withIndex('by_campaignId_vehicleId_id', (q) =>
          q.eq('campaignId', grant.campaignId).eq('vehicleId', grant.vehicleId)
        )
        .first()
    ])
    if (cargo.some(Boolean)) invalid('Vehicle inventory owner is unavailable.')
  }
  if (
    campaign.version !== grant.campaignVersion ||
    metadata.version !== grant.vehicleVersion ||
    (inventory?.version ?? 0) !== grant.sourceInventoryVersion ||
    metadata.vehicleDefinitionId !== grant.vehicleDefinitionId ||
    metadata.label !== grant.label ||
    (metadata.availability ?? 'AVAILABLE') !== grant.beforeAvailability
  )
    invalid('Vehicle cleanup capture changed.')
  const now = new Date().toISOString()
  const sourceInventoryVersion = grant.sourceInventoryVersion + 1
  const job = campaignStoredVehicleCleanupSchema.parse({
    id: crypto.randomUUID(),
    grant,
    grantChecksum: checksum(grant),
    status: 'RUNNING',
    phase: 'VALIDATE_ITEMS',
    cursor: null,
    pageDone: false,
    pending: [],
    validated: zeroCounts(),
    applied: zeroCounts(),
    sequence: 0,
    applyStarted: false,
    releaseComplete: false,
    purgeTable: 0,
    sourceInventoryVersion,
    destinationInventoryVersion: null,
    failureReason: null,
    createdAt: now,
    updatedAt: now
  })
  await ctx.db.insert('campaignVehicleCleanupJobs', job)
  await ctx.db.patch(vehicle._id, {
    cleanupJobId: job.id,
    version: metadata.version + 1,
    updatedAt: new Date(Math.max(Date.now(), Date.parse(metadata.updatedAt) + 1)).toISOString()
  })
  if (inventory) await ctx.db.patch(inventory._id, { version: sourceInventoryVersion })
  else
    await ctx.db.insert(
      'campaignPartyInventories',
      campaignStoredPartyInventorySchema.parse({
        campaignId: grant.campaignId,
        vehicleId: grant.vehicleId,
        version: sourceInventoryVersion
      })
    )
  await schedule(ctx, job.id)
  return acknowledgement(job)
}

async function sourceItem(ctx: MutationCtx, job: VehicleCleanupJob, id: string) {
  const rows = await ctx.db
    .query('campaignPartyItems')
    .withIndex('by_campaignId_id', (q) => q.eq('campaignId', job.grant.campaignId).eq('id', id))
    .take(2)
  if (rows.length !== 1) invalid('Vehicle item identity is unavailable or duplicated.')
  const row = rows[0]!
  const item = parsed(campaignStoredPartyItemSchema, stored(row))
  if (item.vehicleId !== job.grant.vehicleId || item.cleanupJobId !== undefined)
    invalid('Vehicle item containment crosses custody.')
  return row
}
async function parent(ctx: MutationCtx, job: VehicleCleanupJob, id: string | null) {
  return id === null ? null : (await sourceItem(ctx, job, id)).containerId
}
async function validateItems(ctx: MutationCtx, row: JobRow, job: VehicleCleanupJob) {
  if (job.pending.length) {
    const [walk, ...pending] = job.pending
    if (!walk) invalid('Cleanup ancestry cursor is missing.')
    // One bounded Floyd round per transaction; retained single-row mechanics may be large.
    const slow = await parent(ctx, job, walk.slow)
    const fast = await parent(ctx, job, await parent(ctx, job, walk.fast))
    if (slow !== null && fast !== null && slow === fast)
      invalid('Vehicle item containers contain a cycle.')
    if (slow !== null && fast !== null) pending.push({ id: walk.id, slow, fast })
    await save(ctx, row, job, {
      pending,
      phase: pending.length || !job.pageDone ? 'VALIDATE_ITEMS' : 'VALIDATE_GROUPS',
      cursor: pending.length || !job.pageDone ? job.cursor : null
    })
    return
  }
  const page = await ctx.db
    .query('campaignPartyItems')
    .withIndex('by_campaignId_vehicleId_id', (q) =>
      q.eq('campaignId', job.grant.campaignId).eq('vehicleId', job.grant.vehicleId)
    )
    .paginate(pageOpts(job.cursor))
  const pending: VehicleCleanupJob['pending'] = []
  let topLevelItems = 0
  for (const item of page.page) {
    await sourceItem(ctx, job, item.id)
    if (item.containerId === null) topLevelItems++
    else pending.push({ id: item.id, slow: item.id, fast: item.id })
  }
  await save(ctx, row, job, {
    pending,
    cursor: page.isDone ? null : page.continueCursor,
    pageDone: page.isDone,
    validated: {
      ...job.validated,
      items: job.validated.items + page.page.length,
      topLevelItems: job.validated.topLevelItems + topLevelItems
    },
    phase: !pending.length && page.isDone ? 'VALIDATE_GROUPS' : 'VALIDATE_ITEMS'
  })
}
async function sourceGroup(ctx: MutationCtx, job: VehicleCleanupJob, id: string) {
  const rows = await ctx.db
    .query('campaignPartyCurrencyGroups')
    .withIndex('by_campaignId_id', (q) => q.eq('campaignId', job.grant.campaignId).eq('id', id))
    .take(2)
  if (rows.length !== 1) invalid('Vehicle currency group identity is unavailable or duplicated.')
  const group = parsed(campaignStoredPartyCurrencyGroupSchema, stored(rows[0]!))
  if (group.vehicleId !== job.grant.vehicleId || group.cleanupJobId !== undefined)
    invalid('Vehicle currency group scope mismatch.')
  if (group.containerId !== null) await sourceItem(ctx, job, group.containerId)
  return group
}
async function validateGroups(ctx: MutationCtx, row: JobRow, job: VehicleCleanupJob) {
  const page = await ctx.db
    .query('campaignPartyCurrencyGroups')
    .withIndex('by_campaignId_vehicleId_id', (q) =>
      q.eq('campaignId', job.grant.campaignId).eq('vehicleId', job.grant.vehicleId)
    )
    .paginate(pageOpts(job.cursor))
  for (const group of page.page) await sourceGroup(ctx, job, group.id)
  await save(ctx, row, job, {
    cursor: page.isDone ? null : page.continueCursor,
    phase: page.isDone ? 'VALIDATE_CURRENCIES' : job.phase,
    validated: { ...job.validated, currencyGroups: job.validated.currencyGroups + page.page.length }
  })
}
async function sourceBalance(
  ctx: MutationCtx,
  job: VehicleCleanupJob,
  row: Doc<'campaignPartyCurrencies'>
) {
  const balance = parsed(campaignStoredPartyCurrencySchema, stored(row))
  const matches = await ctx.db
    .query('campaignPartyCurrencies')
    .withIndex('by_campaignId_id', (q) =>
      q.eq('campaignId', job.grant.campaignId).eq('id', balance.id)
    )
    .take(2)
  if (
    matches.length !== 1 ||
    matches[0]!._id !== row._id ||
    balance.campaignId !== job.grant.campaignId ||
    balance.vehicleId !== job.grant.vehicleId ||
    balance.cleanupJobId !== undefined
  )
    invalid('Vehicle currency identity or scope mismatch.')
  if (balance.groupId !== undefined) {
    const group = await sourceGroup(ctx, job, balance.groupId)
    if (balance.containerId !== group.containerId)
      invalid('Vehicle currency group placement mismatch.')
  } else if (balance.containerId !== null) await sourceItem(ctx, job, balance.containerId)
  return balance
}
async function totalFor(
  ctx: MutationCtx,
  job: VehicleCleanupJob,
  systemId: string | undefined,
  denominationId: string
) {
  const row = await ctx.db
    .query('campaignVehicleCleanupTotals')
    .withIndex('by_jobId_slot', (q) =>
      q
        .eq('jobId', job.id)
        .eq('campaignCurrencySystemId', systemId)
        .eq('denominationId', denominationId)
    )
    .unique()
  if (row) parsed(campaignStoredVehicleCleanupTotalSchema, stored(row))
  return row
}
async function validateCurrencies(ctx: MutationCtx, row: JobRow, job: VehicleCleanupJob) {
  const page = await ctx.db
    .query('campaignPartyCurrencies')
    .withIndex('by_campaignId_vehicleId_id', (q) =>
      q.eq('campaignId', job.grant.campaignId).eq('vehicleId', job.grant.vehicleId)
    )
    .paginate(pageOpts(job.cursor))
  for (const source of page.page) {
    const balance = await sourceBalance(ctx, job, source)
    if (
      job.grant.mode !== 'RETURN' ||
      balance.groupId !== undefined ||
      balance.containerId !== null
    )
      continue
    const total = await totalFor(ctx, job, balance.campaignCurrencySystemId, balance.denominationId)
    const sourceAmount = (BigInt(total?.sourceAmount ?? '0') + BigInt(balance.amount)).toString()
    if (total) await ctx.db.patch(total._id, { sourceAmount })
    else
      await ctx.db.insert(
        'campaignVehicleCleanupTotals',
        campaignStoredVehicleCleanupTotalSchema.parse({
          jobId: job.id,
          campaignCurrencySystemId: balance.campaignCurrencySystemId,
          denominationId: balance.denominationId,
          sourceAmount,
          targetId: null,
          targetBeforeAmount: 0,
          placeholder: false,
          locked: false,
          applied: false
        })
      )
  }
  await save(ctx, row, job, {
    cursor: page.isDone ? null : page.continueCursor,
    phase: page.isDone ? 'VALIDATE_TOTALS' : job.phase,
    validated: { ...job.validated, currencies: job.validated.currencies + page.page.length }
  })
}
async function destinationSlot(
  ctx: MutationCtx,
  campaignId: string,
  total: Pick<TotalRow, 'campaignCurrencySystemId' | 'denominationId'>
) {
  const matches = await ctx.db
    .query('campaignPartyCurrencies')
    .withIndex('by_owner_system_denomination_container', (q) =>
      q
        .eq('campaignId', campaignId)
        .eq('vehicleId', undefined)
        .eq('campaignCurrencySystemId', total.campaignCurrencySystemId)
        .eq('denominationId', total.denominationId)
        .eq('groupId', undefined)
        .eq('containerId', null)
    )
    .take(2)
  if (matches.length > 1) invalid('Destination loose currency slot has duplicate balances.')
  return matches[0] ?? null
}
async function validateTotals(ctx: MutationCtx, row: JobRow, job: VehicleCleanupJob) {
  // All jobs acquire exact loose slots in the same namespace/denomination order.
  const page = await ctx.db
    .query('campaignVehicleCleanupTotals')
    .withIndex('by_jobId_slot', (q) => q.eq('jobId', job.id))
    .paginate(pageOpts(job.cursor))
  for (const totalRow of page.page) {
    const total = parsed(campaignStoredVehicleCleanupTotalSchema, stored(totalRow))
    if (total.locked) continue
    const target = await destinationSlot(ctx, job.grant.campaignId, totalRow)
    if (target) {
      parsed(campaignStoredPartyCurrencySchema, stored(target))
      const identities = await ctx.db
        .query('campaignPartyCurrencies')
        .withIndex('by_campaignId_id', (q) =>
          q.eq('campaignId', job.grant.campaignId).eq('id', target.id)
        )
        .take(2)
      if (identities.length !== 1 || identities[0]!._id !== target._id)
        invalid('Destination currency public ID is unavailable or duplicated.')
    }
    if (target?.cleanupJobId && target.cleanupJobId !== job.id) {
      const holder = await findJob(ctx, target.cleanupJobId)
      if (!holder || holder.job.grant.campaignId !== job.grant.campaignId)
        invalid('Currency cleanup lock metadata is unavailable.')
      if (holder.job.status !== 'COMPLETED') {
        await schedule(ctx, job.id, 1000)
        return true
      }
    }
    const targetBeforeAmount = target?.amount ?? 0
    if (BigInt(total.sourceAmount) + BigInt(targetBeforeAmount) > BigInt(Number.MAX_SAFE_INTEGER))
      invalid('Inventory amount exceeds the supported range.')
    const targetId = target?.id ?? crypto.randomUUID()
    if (target) await ctx.db.patch(target._id, { cleanupJobId: job.id })
    else
      await ctx.db.insert(
        'campaignPartyCurrencies',
        campaignStoredPartyCurrencySchema.parse({
          id: targetId,
          campaignId: job.grant.campaignId,
          cleanupJobId: job.id,
          campaignCurrencySystemId: total.campaignCurrencySystemId,
          denominationId: total.denominationId,
          amount: 0,
          containerId: null
        })
      )
    await ctx.db.patch(totalRow._id, {
      targetId,
      targetBeforeAmount,
      placeholder: !target,
      locked: true
    })
  }
  await save(ctx, row, job, {
    cursor: page.isDone ? null : page.continueCursor,
    phase: page.isDone ? 'APPLY_ITEMS' : job.phase
  })
  return false
}
async function segment(
  ctx: MutationCtx,
  job: VehicleCleanupJob,
  ids: string[],
  beforeAmounts: number[] = [],
  afterAmounts: number[] = []
) {
  await ctx.db.insert(
    'campaignVehicleCleanupSegments',
    parsed(campaignStoredVehicleCleanupSegmentSchema, {
      jobId: job.id,
      sequence: job.sequence,
      phase: job.phase,
      ids,
      beforeAmounts,
      afterAmounts,
      createdAt: new Date().toISOString()
    })
  )
}
async function applyItems(ctx: MutationCtx, row: JobRow, job: VehicleCleanupJob) {
  const page = await ctx.db
    .query('campaignPartyItems')
    .withIndex('by_campaignId_vehicleId_id', (q) =>
      q.eq('campaignId', job.grant.campaignId).eq('vehicleId', job.grant.vehicleId)
    )
    .paginate(pageOpts())
  for (const item of page.page) {
    parsed(campaignStoredPartyItemSchema, stored(item))
    if (job.grant.mode === 'RETURN')
      await ctx.db.patch(item._id, { vehicleId: undefined, cleanupJobId: job.id })
    else await ctx.db.delete(item._id)
  }
  await segment(
    ctx,
    job,
    page.page.map((item) => item.id)
  )
  await save(ctx, row, job, {
    phase: page.isDone ? 'APPLY_GROUPS' : job.phase,
    sequence: job.sequence + 1,
    applyStarted: job.applyStarted || page.page.length > 0,
    applied: {
      ...job.applied,
      items: job.applied.items + page.page.length,
      topLevelItems:
        job.applied.topLevelItems + page.page.filter((item) => item.containerId === null).length
    }
  })
}
async function applyGroups(ctx: MutationCtx, row: JobRow, job: VehicleCleanupJob) {
  const page = await ctx.db
    .query('campaignPartyCurrencyGroups')
    .withIndex('by_campaignId_vehicleId_id', (q) =>
      q.eq('campaignId', job.grant.campaignId).eq('vehicleId', job.grant.vehicleId)
    )
    .paginate(pageOpts())
  for (const group of page.page) {
    parsed(campaignStoredPartyCurrencyGroupSchema, stored(group))
    if (job.grant.mode === 'RETURN')
      await ctx.db.patch(group._id, { vehicleId: undefined, cleanupJobId: job.id })
    else await ctx.db.delete(group._id)
  }
  await segment(
    ctx,
    job,
    page.page.map((group) => group.id)
  )
  await save(ctx, row, job, {
    phase: page.isDone ? 'APPLY_CURRENCIES' : job.phase,
    sequence: job.sequence + 1,
    applyStarted: job.applyStarted || page.page.length > 0,
    applied: { ...job.applied, currencyGroups: job.applied.currencyGroups + page.page.length }
  })
}
async function applyCurrencies(ctx: MutationCtx, row: JobRow, job: VehicleCleanupJob) {
  const page = await ctx.db
    .query('campaignPartyCurrencies')
    .withIndex('by_campaignId_vehicleId_id', (q) =>
      q.eq('campaignId', job.grant.campaignId).eq('vehicleId', job.grant.vehicleId)
    )
    .paginate(pageOpts())
  for (const balance of page.page) {
    parsed(campaignStoredPartyCurrencySchema, stored(balance))
    if (
      job.grant.mode === 'RETURN' &&
      (balance.groupId !== undefined || balance.containerId !== null)
    )
      await ctx.db.patch(balance._id, { vehicleId: undefined, cleanupJobId: job.id })
    else await ctx.db.delete(balance._id)
  }
  await segment(
    ctx,
    job,
    page.page.map((balance) => balance.id),
    page.page.map((balance) => balance.amount),
    page.page.map((balance) =>
      job.grant.mode === 'RETURN' && (balance.groupId !== undefined || balance.containerId !== null)
        ? balance.amount
        : 0
    )
  )
  await save(ctx, row, job, {
    phase: page.isDone ? 'APPLY_TOTALS' : job.phase,
    sequence: job.sequence + 1,
    applyStarted: job.applyStarted || page.page.length > 0,
    applied: { ...job.applied, currencies: job.applied.currencies + page.page.length }
  })
}
async function targetBalance(ctx: MutationCtx, job: VehicleCleanupJob, total: TotalRow) {
  const identities = await ctx.db
    .query('campaignPartyCurrencies')
    .withIndex('by_campaignId_id', (q) =>
      q.eq('campaignId', job.grant.campaignId).eq('id', total.targetId ?? '')
    )
    .take(2)
  if (identities.length !== 1) invalid('Locked currency public ID is unavailable or duplicated.')
  const target = identities[0]!
  const balance = parsed(campaignStoredPartyCurrencySchema, stored(target))
  if (
    balance.vehicleId !== undefined ||
    balance.cleanupJobId !== job.id ||
    balance.campaignCurrencySystemId !== total.campaignCurrencySystemId ||
    balance.denominationId !== total.denominationId ||
    balance.containerId !== null ||
    balance.groupId !== undefined
  )
    invalid('Locked currency target scope mismatch.')
  const slot = await destinationSlot(ctx, job.grant.campaignId, total)
  if (slot?._id !== target._id) invalid('Locked currency target slot changed.')
  return target
}
async function applyTotals(ctx: MutationCtx, row: JobRow, job: VehicleCleanupJob) {
  const page = await ctx.db
    .query('campaignVehicleCleanupTotals')
    .withIndex('by_jobId_slot', (q) => q.eq('jobId', job.id))
    .paginate(pageOpts(job.cursor))
  const ids: string[] = [],
    before: number[] = [],
    after: number[] = []
  for (const totalRow of page.page) {
    const total = parsed(campaignStoredVehicleCleanupTotalSchema, stored(totalRow))
    if (total.applied) continue
    if (!total.locked || !total.targetId) invalid('Currency slot validation is incomplete.')
    const target = await targetBalance(ctx, job, totalRow)
    if (target.amount !== total.targetBeforeAmount) invalid('Locked currency amount changed.')
    const exact = BigInt(total.targetBeforeAmount) + BigInt(total.sourceAmount)
    if (exact > BigInt(Number.MAX_SAFE_INTEGER))
      invalid('Inventory amount exceeds the supported range.')
    await ctx.db.patch(target._id, { amount: Number(exact) })
    await ctx.db.patch(totalRow._id, { applied: true })
    ids.push(target.id)
    before.push(total.targetBeforeAmount)
    after.push(Number(exact))
  }
  await segment(ctx, job, ids, before, after)
  await save(ctx, row, job, {
    cursor: page.isDone ? null : page.continueCursor,
    phase: page.isDone ? 'FINALIZE' : job.phase,
    applyStarted: job.applyStarted || ids.length > 0,
    sequence: job.sequence + 1
  })
}
async function release(ctx: MutationCtx, row: JobRow, job: VehicleCleanupJob) {
  if (job.applyStarted) invalid('Applied cleanup cannot release locks.')
  const page = await ctx.db
    .query('campaignVehicleCleanupTotals')
    .withIndex('by_jobId_slot', (q) => q.eq('jobId', job.id))
    .paginate(pageOpts())
  for (const total of page.page) {
    parsed(campaignStoredVehicleCleanupTotalSchema, stored(total))
    if (total.locked) {
      const target = await targetBalance(ctx, job, total)
      if (target.amount !== total.targetBeforeAmount || total.applied)
        invalid('Validation lock amount changed.')
      if (total.placeholder) {
        if (target.amount !== 0) invalid('Validation placeholder is not empty.')
        await ctx.db.delete(target._id)
      } else await ctx.db.patch(target._id, { cleanupJobId: undefined })
    }
    await ctx.db.delete(total._id)
  }
  await save(ctx, row, job, { releaseComplete: page.isDone })
  if (!page.isDone) await schedule(ctx, job.id)
}
async function finalize(ctx: MutationCtx, row: JobRow, job: VehicleCleanupJob) {
  if (JSON.stringify(job.validated) !== JSON.stringify(job.applied))
    invalid('Vehicle cleanup counts did not reconcile.')
  const [vehicle, source, destination, prior] = await Promise.all([
    ctx.db
      .query('campaignVehicles')
      .withIndex('by_campaignId_id', (q) =>
        q.eq('campaignId', job.grant.campaignId).eq('id', job.grant.vehicleId)
      )
      .unique(),
    ctx.db
      .query('campaignPartyInventories')
      .withIndex('by_campaignId_vehicleId', (q) =>
        q.eq('campaignId', job.grant.campaignId).eq('vehicleId', job.grant.vehicleId)
      )
      .unique(),
    ctx.db
      .query('campaignPartyInventories')
      .withIndex('by_campaignId_vehicleId', (q) =>
        q.eq('campaignId', job.grant.campaignId).eq('vehicleId', undefined)
      )
      .unique(),
    ctx.db
      .query('campaignEvents')
      .withIndex('by_campaignId_id', (q) =>
        q.eq('campaignId', job.grant.campaignId).eq('id', job.grant.eventId)
      )
      .unique()
  ])
  if (!vehicle || !source || prior) invalid('Vehicle cleanup final identity mismatch.')
  if (destination) parsed(campaignStoredPartyInventorySchema, stored(destination))
  const destinationInventoryVersion =
    job.grant.mode === 'RETURN' ? (destination?.version ?? 0) + 1 : null
  if (destinationInventoryVersion !== null) {
    if (destination) await ctx.db.patch(destination._id, { version: destinationInventoryVersion })
    else
      await ctx.db.insert(
        'campaignPartyInventories',
        campaignStoredPartyInventorySchema.parse({
          campaignId: job.grant.campaignId,
          version: destinationInventoryVersion
        })
      )
  }
  const summary = parsed(vehicleCleanupSummarySchema, {
    jobId: job.id,
    vehicleId: job.grant.vehicleId,
    vehicleDefinitionId: job.grant.vehicleDefinitionId,
    removalEventId: job.grant.removalEventId,
    mode: job.grant.mode,
    counts: job.applied,
    sourceInventoryVersion: job.sourceInventoryVersion,
    destinationInventoryVersion
  })
  await ctx.db.insert(
    'campaignEvents',
    parsed(campaignStoredEventSchema, {
      id: job.grant.eventId,
      campaignId: job.grant.campaignId,
      actorUserId: job.grant.actorUserId,
      type: job.grant.removalEventId ? 'CAMPAIGN_VEHICLE_EVACUATED' : 'VEHICLE_LIFECYCLE',
      visibility: 'OWNER',
      subjectCharacterId: null,
      payloadJson: JSON.stringify(summary),
      visibleInHistory: true,
      inventoryAudit: true,
      commandId: job.grant.commandId,
      inputFingerprint: job.grant.inputFingerprint,
      createdAt: new Date().toISOString()
    })
  )
  await ctx.db.delete(source._id)
  await ctx.db.delete(vehicle._id)
  await save(ctx, row, job, {
    status: 'COMPLETED',
    destinationInventoryVersion,
    failureReason: null
  })
}
async function purge(ctx: MutationCtx, row: JobRow, job: VehicleCleanupJob) {
  const marker = job.phase === 'PURGE_MARKERS'
  const index = job.purgeTable
  // Literal table branches preserve schema-derived document/index types.
  if (index === 0) {
    const query = ctx.db.query('campaignPartyItems')
    const page = await (
      marker
        ? query.withIndex('by_cleanupJobId', (q) => q.eq('cleanupJobId', job.id))
        : query.withIndex('by_campaignId_vehicleId_id', (q) =>
            q.eq('campaignId', job.grant.campaignId).eq('vehicleId', job.grant.vehicleId)
          )
    ).paginate(pageOpts())
    for (const item of page.page) {
      if (item.campaignId !== job.grant.campaignId)
        invalid('Purge marker crosses Campaign custody.')
      await ctx.db.delete(item._id)
    }
    await save(ctx, row, job, { purgeTable: page.isDone ? 1 : 0 })
    return
  }
  if (index === 1) {
    const query = ctx.db.query('campaignPartyCurrencyGroups')
    const page = await (
      marker
        ? query.withIndex('by_cleanupJobId', (q) => q.eq('cleanupJobId', job.id))
        : query.withIndex('by_campaignId_vehicleId_id', (q) =>
            q.eq('campaignId', job.grant.campaignId).eq('vehicleId', job.grant.vehicleId)
          )
    ).paginate(pageOpts())
    for (const group of page.page) {
      if (group.campaignId !== job.grant.campaignId)
        invalid('Purge marker crosses Campaign custody.')
      await ctx.db.delete(group._id)
    }
    await save(ctx, row, job, { purgeTable: page.isDone ? 2 : 1 })
    return
  }
  if (index === 2) {
    const query = ctx.db.query('campaignPartyCurrencies')
    const page = await (
      marker
        ? query.withIndex('by_cleanupJobId', (q) => q.eq('cleanupJobId', job.id))
        : query.withIndex('by_campaignId_vehicleId_id', (q) =>
            q.eq('campaignId', job.grant.campaignId).eq('vehicleId', job.grant.vehicleId)
          )
    ).paginate(pageOpts())
    for (const balance of page.page) {
      if (balance.campaignId !== job.grant.campaignId)
        invalid('Purge marker crosses Campaign custody.')
      await ctx.db.delete(balance._id)
    }
    await save(ctx, row, job, { purgeTable: page.isDone ? 3 : 2 })
    return
  }
  if (!marker) {
    await save(ctx, row, job, { phase: 'PURGE_MARKERS', purgeTable: 0 })
    return
  }
  const totals = await ctx.db
    .query('campaignVehicleCleanupTotals')
    .withIndex('by_jobId_slot', (q) => q.eq('jobId', job.id))
    .paginate(pageOpts())
  for (const total of totals.page) await ctx.db.delete(total._id)
  if (!totals.isDone) return
  const [vehicle, source] = await Promise.all([
    ctx.db
      .query('campaignVehicles')
      .withIndex('by_campaignId_id', (q) =>
        q.eq('campaignId', job.grant.campaignId).eq('id', job.grant.vehicleId)
      )
      .unique(),
    ctx.db
      .query('campaignPartyInventories')
      .withIndex('by_campaignId_vehicleId', (q) =>
        q.eq('campaignId', job.grant.campaignId).eq('vehicleId', job.grant.vehicleId)
      )
      .unique()
  ])
  if (source) await ctx.db.delete(source._id)
  if (vehicle) await ctx.db.delete(vehicle._id)
  await save(ctx, row, job, { status: 'PURGED', pending: [], cursor: null, failureReason: null })
}

export const step = internalMutation({
  args: { jobId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const found = await findJob(ctx, args.jobId)
    if (!found || found.job.status === 'COMPLETED' || found.job.status === 'PURGED') return null
    const { row, job } = found
    const campaign = await ctx.db
      .query('campaigns')
      .withIndex('by_publicId', (q) => q.eq('id', job.grant.campaignId))
      .unique()
    if (!campaign) {
      if (job.phase !== 'PURGE_SOURCE' && job.phase !== 'PURGE_MARKERS') {
        await save(ctx, row, job, {
          status: 'RUNNING',
          phase: 'PURGE_SOURCE',
          pending: [],
          cursor: null,
          purgeTable: 0
        })
      } else await purge(ctx, row, job)
      await schedule(ctx, job.id)
      return null
    }
    if (job.status === 'FAILED') {
      if (job.phase === 'RELEASE' && !job.releaseComplete) await release(ctx, row, job)
      return null
    }
    const [vehicle, inventory] = await Promise.all([
      ctx.db
        .query('campaignVehicles')
        .withIndex('by_campaignId_id', (q) =>
          q.eq('campaignId', job.grant.campaignId).eq('id', job.grant.vehicleId)
        )
        .unique(),
      ctx.db
        .query('campaignPartyInventories')
        .withIndex('by_campaignId_vehicleId', (q) =>
          q.eq('campaignId', job.grant.campaignId).eq('vehicleId', job.grant.vehicleId)
        )
        .unique()
    ])
    if (!vehicle || !inventory) invalid('Campaign Vehicle disappeared while cleanup was pending.')
    parsed(campaignStoredVehicleSchema, stored(vehicle))
    parsed(campaignStoredPartyInventorySchema, stored(inventory))
    if (
      vehicle.cleanupJobId !== job.id ||
      vehicle.version !== job.grant.vehicleVersion + 1 ||
      inventory.version !== job.sourceInventoryVersion
    )
      invalid('Vehicle cleanup source lock changed.')
    let waiting = false
    switch (job.phase) {
      case 'VALIDATE_ITEMS':
        await validateItems(ctx, row, job)
        break
      case 'VALIDATE_GROUPS':
        await validateGroups(ctx, row, job)
        break
      case 'VALIDATE_CURRENCIES':
        await validateCurrencies(ctx, row, job)
        break
      case 'VALIDATE_TOTALS':
        waiting = await validateTotals(ctx, row, job)
        break
      case 'APPLY_ITEMS':
        await applyItems(ctx, row, job)
        break
      case 'APPLY_GROUPS':
        await applyGroups(ctx, row, job)
        break
      case 'APPLY_CURRENCIES':
        await applyCurrencies(ctx, row, job)
        break
      case 'APPLY_TOTALS':
        await applyTotals(ctx, row, job)
        break
      case 'FINALIZE':
        await finalize(ctx, row, job)
        break
      default:
        invalid('Unexpected active Vehicle cleanup phase.')
    }
    if (!waiting) await schedule(ctx, job.id)
    return null
  }
})

export const run = internalMutation({
  args: { jobId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      await ctx.runMutation(stepRef, args)
    } catch (error) {
      // Native/platform failures propagate for native scheduler retries; only typed application validation is recorded.
      if (
        !(error instanceof ConvexError) ||
        typeof error.data !== 'object' ||
        error.data === null ||
        !('vehicleCleanupValidation' in error.data) ||
        error.data.vehicleCleanupValidation !== true
      )
        throw error
      const found = await findJob(ctx, args.jobId)
      if (!found || found.job.status === 'COMPLETED' || found.job.status === 'PURGED') return null
      const reason =
        'message' in error.data && typeof error.data.message === 'string'
          ? error.data.message
          : 'Vehicle cleanup failed.'
      await save(ctx, found.row, found.job, {
        status: 'FAILED',
        failureReason: reason.slice(0, 500),
        phase: found.job.applyStarted ? found.job.phase : 'RELEASE',
        pending: found.job.applyStarted ? found.job.pending : [],
        cursor: found.job.applyStarted ? found.job.cursor : null,
        releaseComplete: false
      })
      if (!found.job.applyStarted) await schedule(ctx, found.job.id)
    }
    return null
  }
})

/** Root exposes this only after current OWNER authority. It never re-grants worker authority. */
export const retry = internalMutation({
  args: { jobId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const found = await findJob(ctx, args.jobId)
    if (!found || found.job.status !== 'FAILED') return null
    const { row, job } = found
    if (!job.applyStarted && !job.releaseComplete)
      invalid('Vehicle cleanup lock release is still pending.')
    await save(
      ctx,
      row,
      job,
      job.applyStarted
        ? {
            status: 'RUNNING',
            failureReason: null
          }
        : {
            status: 'RUNNING',
            phase: 'VALIDATE_ITEMS',
            cursor: null,
            pending: [],
            pageDone: false,
            validated: zeroCounts(),
            applied: zeroCounts(),
            releaseComplete: false,
            failureReason: null
          }
    )
    await schedule(ctx, job.id)
    return null
  }
})
