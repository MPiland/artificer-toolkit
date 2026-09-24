import {
  campaignStoredVehicleCleanupSchema,
  vehicleCleanupProgressSchema,
  type VehicleCleanupProgress
} from '@artificer-toolkit/schema/projections/campaignVehicleCleanupPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { ConvexError } from 'convex/values'
import type { QueryCtx } from '../_generated/server'
import type { Doc } from '../_generated/dataModel'

export async function readVehicleCleanupJob(ctx: QueryCtx, jobId: string, campaignId: string) {
  const row = await ctx.db
    .query('campaignVehicleCleanupJobs')
    .withIndex('by_publicId', (q) => q.eq('id', jobId))
    .unique()
  if (!row) throw new Error('Inventory cleanup metadata is unavailable.')
  const { _id, _creationTime, ...stored } = row
  const job = campaignStoredVehicleCleanupSchema.parse(stored)
  if (
    job.grant.campaignId !== campaignId ||
    job.grantChecksum !==
      checksumCanonicalJson({
        operation: 'VEHICLE_CLEANUP_GRANT',
        grant: job.grant
      })
  )
    throw new Error('Inventory cleanup metadata scope mismatch.')
  return job
}

/** Root authenticates current Campaign membership before calling; no contents/actor identities are projected. */
export async function readVehicleCleanupProgress(
  ctx: QueryCtx,
  campaignId: string,
  jobId: string,
  role: 'OWNER' | 'PLAYER'
): Promise<VehicleCleanupProgress> {
  const job = await readVehicleCleanupJob(ctx, jobId, campaignId)
  if (role !== 'OWNER' && job.grant.beforeAvailability === 'UNAVAILABLE')
    throw new Error('Campaign Vehicle inventory owner is unavailable.')
  return vehicleCleanupProgressSchema.parse({
    jobId: job.id,
    campaignId,
    vehicleId: job.grant.vehicleId,
    eventId: job.grant.eventId,
    status: job.status,
    phase: job.phase,
    validated: job.validated,
    applied: job.applied,
    retryReady:
      role === 'OWNER' && job.status === 'FAILED' && (job.applyStarted || job.releaseComplete),
    failureReason: job.failureReason
  })
}

/** Source cargo is unmarked; its persisted Vehicle fence must be checked separately from each row marker. */
export async function readVehicleCleanupLock(ctx: QueryCtx, vehicle: Doc<'campaignVehicles'>) {
  if (vehicle.cleanupJobId === undefined) return null
  const job = await readVehicleCleanupJob(ctx, vehicle.cleanupJobId, vehicle.campaignId)
  if (job.grant.vehicleId !== vehicle.id || job.status === 'COMPLETED' || job.status === 'PURGED')
    throw new Error('Campaign Vehicle cleanup source fence is inconsistent.')
  return { jobId: job.id, status: job.status }
}

/** Call before parsing/hydration; incomplete relocated rows and zero placeholders never become public cargo. */
export async function vehicleCleanupRowAvailable(
  ctx: QueryCtx,
  row: { campaignId: string; vehicleId?: string; cleanupJobId?: string }
) {
  if (row.cleanupJobId === undefined) return true
  const job = await readVehicleCleanupJob(ctx, row.cleanupJobId, row.campaignId)
  if (row.vehicleId !== undefined || job.grant.mode !== 'RETURN')
    throw new Error('Campaign inventory cleanup destination fence is inconsistent.')
  return job.status === 'COMPLETED'
}

/** Apply to the specific row/placement/loose slot being changed; it does not lock party inventory globally. */
export async function requireVehicleCleanupRowEditable(
  ctx: QueryCtx,
  row: { campaignId: string; vehicleId?: string; cleanupJobId?: string }
) {
  if (await vehicleCleanupRowAvailable(ctx, row)) return
  throw new ConvexError({ inventoryCleanupPending: true, jobId: row.cleanupJobId ?? null })
}
