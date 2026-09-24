import { ConvexError } from 'convex/values'
import type { QueryCtx } from '../_generated/server'
import {
  campaignStoredPartyItemSchema,
  campaignStoredPartyCurrencyGroupSchema
} from '@artificer-toolkit/schema/projections/campaignInventoryPersistence'
import {
  readVehicleCleanupLock,
  requireVehicleCleanupRowEditable,
  vehicleCleanupRowAvailable
} from './vehicleCleanupDocuments'

/** Mutation-only source/destination fence; public cargo reads retain their own visibility rules. */
export async function requireInventoryVehicleEditable(
  ctx: QueryCtx,
  campaignId: string,
  vehicleId: string | undefined
) {
  if (vehicleId === undefined) return
  const vehicle = await ctx.db
    .query('campaignVehicles')
    .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaignId).eq('id', vehicleId))
    .unique()
  if (!vehicle) throw new Error('Campaign Vehicle inventory owner is unavailable.')
  const lock = await readVehicleCleanupLock(ctx, vehicle)
  if (vehicle.cleanupJobId !== undefined && lock === null)
    throw new Error('Campaign Vehicle cleanup source fence is inconsistent.')
  if (lock) throw new ConvexError({ inventoryCleanupPending: true, jobId: lock.jobId })
}

type InventoryPlacement = {
  campaignId: string
  vehicleId?: string
  cleanupJobId?: string
  containerId: string | null
  groupId?: string
}

async function readInventoryRowPlacements(ctx: QueryCtx, row: InventoryPlacement) {
  const placements: InventoryPlacement[] = []
  if (row.groupId !== undefined) {
    const group = await ctx.db
      .query('campaignPartyCurrencyGroups')
      .withIndex('by_campaignId_id', (q) =>
        q.eq('campaignId', row.campaignId).eq('id', row.groupId!)
      )
      .unique()
    if (!group || group.vehicleId !== row.vehicleId || group.containerId !== row.containerId)
      throw new Error('Stored Campaign currency group placement mismatch.')
    const { _id, _creationTime, ...storedGroup } = group
    campaignStoredPartyCurrencyGroupSchema.parse(storedGroup)
    placements.push(group)
  }
  if (row.containerId !== null) {
    const container = await ctx.db
      .query('campaignPartyItems')
      .withIndex('by_campaignId_vehicleId_id', (q) =>
        q.eq('campaignId', row.campaignId).eq('vehicleId', row.vehicleId).eq('id', row.containerId!)
      )
      .unique()
    if (!container) throw new Error('Stored Campaign inventory container is unavailable.')
    const { _id, _creationTime, ...storedContainer } = container
    campaignStoredPartyItemSchema.parse(storedContainer)
    placements.push(container)
  }
  return placements
}

/** Guard the selected row and its exact persisted placement before parsing or hydrating it. */
export async function requireInventoryRowEditable(ctx: QueryCtx, row: InventoryPlacement) {
  await requireVehicleCleanupRowEditable(ctx, row)
  for (const placement of await readInventoryRowPlacements(ctx, row))
    await requireVehicleCleanupRowEditable(ctx, placement)
}

/** Totals validate every marker, including hidden incoming cargo, before summing committed custody. */
export async function readInventoryRowAvailable(ctx: QueryCtx, row: InventoryPlacement) {
  let available = await vehicleCleanupRowAvailable(ctx, row)
  for (const placement of await readInventoryRowPlacements(ctx, row))
    available = (await vehicleCleanupRowAvailable(ctx, placement)) && available
  return available
}
