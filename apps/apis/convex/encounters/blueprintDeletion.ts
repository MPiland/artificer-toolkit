import { v } from 'convex/values'
import { internal } from '../_generated/api'
import type { Doc } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { ACCOUNT_DELETION_BATCH } from '../accountDeletionJobs'
import { syncAccountUsage } from '../lib/accountUsage'
import { internalMutation } from '../lib/mutations'

/** The one cascade for a deleted Encounter Blueprint row; Runs keep their own snapshots. */
export async function deleteBlueprintRow(ctx: MutationCtx, blueprint: Doc<'encounterBlueprints'>) {
  await ctx.db.delete(blueprint._id)
  await syncAccountUsage(ctx, 'savedEncounters', blueprint.id)
}

/** Removes a deleted Blueprint's update receipts in bounded batches, rescheduling while rows remain. */
export const purgeUpdates = internalMutation({
  args: () => ({ blueprintId: v.string() }),
  returns: () => v.null(),
  handler: async (ctx, { blueprintId }) => {
    const updates = await ctx.db
      .query('encounterBlueprintUpdates')
      .withIndex('by_blueprintId', (q) => q.eq('blueprintId', blueprintId))
      .take(ACCOUNT_DELETION_BATCH)
    for (const update of updates) await ctx.db.delete(update._id)
    if (updates.length === ACCOUNT_DELETION_BATCH)
      await ctx.scheduler.runAfter(0, internal.encounters.blueprintDeletion.purgeUpdates, {
        blueprintId
      })
    return null
  }
})
