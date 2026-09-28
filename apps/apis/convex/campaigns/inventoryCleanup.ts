import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import { v } from 'convex/values'
import {
  campaignInventoryCleanupListInputSchema,
  campaignInventoryCleanupPageSchema,
  campaignInventoryCleanupRetryInputSchema,
  type CampaignInventoryCleanupPage
} from '@artificer-toolkit/schema/api/campaignInventoryCleanup'
import {
  campaignStoredPartyItemSchema,
  campaignStoredPartyCurrencyGroupSchema,
  campaignStoredPartyCurrencySchema
} from '@artificer-toolkit/schema/projections/campaignInventoryPersistence'
import { query } from '../lib/queries'
import { mutation } from '../lib/mutations'
import { internal } from '../_generated/api'
import { requireIdentity } from '../lib/identity'
import { requireCampaignAuthority } from './authority'
import { requireCampaignVehicleCargoAccess } from './vehicleDocuments'
import { readVehicleCleanupJob, readVehicleCleanupLock } from './vehicleCleanupDocuments'

/** Only selected source cargo or already marked incoming party custody is disclosed. */
export const pending = query({
  args: zodToConvexFields(campaignInventoryCleanupListInputSchema.shape),
  returns: zodToConvex(campaignInventoryCleanupPageSchema),
  handler: async (ctx, args): Promise<CampaignInventoryCleanupPage> => {
    const input = campaignInventoryCleanupListInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    const { campaign, membership } = await requireCampaignAuthority(ctx, input.campaignId, userId)
    const vehicleId = input.vehicleId?.toLowerCase()
    if (vehicleId !== undefined) {
      const vehicle = await requireCampaignVehicleCargoAccess(ctx, campaign, membership, vehicleId)
      await readVehicleCleanupLock(ctx, vehicle)
    }
    const rows = ctx.db.query('campaignVehicleCleanupJobs')
    const selected =
      vehicleId === undefined
        ? rows.withIndex('by_campaignId_status_id', (q) => q.eq('grant.campaignId', campaign.id))
        : rows.withIndex('by_campaignId_vehicleId', (q) =>
            q.eq('grant.campaignId', campaign.id).eq('grant.vehicleId', vehicleId)
          )
    const result = await selected.paginate({
      ...input.paginationOpts,
      maximumRowsRead: 8,
      maximumBytesRead: 1024 * 1024
    })
    const page: CampaignInventoryCleanupPage['page'] = []
    for (const row of result.page) {
      if (
        (row.status !== 'RUNNING' && row.status !== 'FAILED') ||
        (vehicleId === undefined && row.grant.mode !== 'RETURN')
      )
        continue
      const job = await readVehicleCleanupJob(ctx, row.id, campaign.id)
      if (job.status !== 'RUNNING' && job.status !== 'FAILED')
        throw new Error('Inventory cleanup notice is inconsistent.')
      if (vehicleId === undefined) {
        const [item, group, currency] = await Promise.all([
          ctx.db
            .query('campaignPartyItems')
            .withIndex('by_cleanupJobId', (q) => q.eq('cleanupJobId', job.id))
            .first(),
          ctx.db
            .query('campaignPartyCurrencyGroups')
            .withIndex('by_cleanupJobId', (q) => q.eq('cleanupJobId', job.id))
            .first(),
          ctx.db
            .query('campaignPartyCurrencies')
            .withIndex('by_cleanupJobId', (q) => q.eq('cleanupJobId', job.id))
            .first()
        ])
        if (!item && !group && !currency) continue
        for (const candidate of [item, group, currency]) {
          if (
            candidate &&
            (candidate.campaignId !== campaign.id || candidate.vehicleId !== undefined)
          )
            throw new Error('Inventory cleanup destination scope is inconsistent.')
        }
        if (item) {
          const { _id, _creationTime, ...stored } = item
          campaignStoredPartyItemSchema.parse(stored)
        }
        if (group) {
          const { _id, _creationTime, ...stored } = group
          campaignStoredPartyCurrencyGroupSchema.parse(stored)
        }
        if (currency) {
          const { _id, _creationTime, ...stored } = currency
          campaignStoredPartyCurrencySchema.parse(stored)
        }
      } else if (job.grant.vehicleId !== vehicleId) {
        throw new Error('Inventory cleanup source scope is inconsistent.')
      }
      page.push({
        jobId: job.id,
        status: job.status,
        retryReady:
          membership.role === 'OWNER' &&
          job.status === 'FAILED' &&
          (job.applyStarted || job.releaseComplete)
      })
    }
    return campaignInventoryCleanupPageSchema.parse({ ...result, page })
  }
})

/** Finishes the existing trusted grant; it cannot create or alter one. */
export const retry = mutation({
  args: zodToConvexFields(campaignInventoryCleanupRetryInputSchema.shape),
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const input = campaignInventoryCleanupRetryInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    const { campaign, membership } = await requireCampaignAuthority(ctx, input.campaignId, userId)
    if (membership.role !== 'OWNER')
      throw new Error('Only the Campaign owner can retry inventory cleanup.')
    await readVehicleCleanupJob(ctx, input.jobId, campaign.id)
    return ctx.runMutation(internal.campaigns.vehicleCleanup.retry, { jobId: input.jobId })
  }
})
