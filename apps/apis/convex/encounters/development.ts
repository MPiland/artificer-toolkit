import { v } from 'convex/values'
import { internalMutation } from '../lib/mutations'
import { requireFixtureAccount } from '../lib/developmentFixtures'
import { syncAccountUsage } from '../lib/accountUsage'

export const removeFixtureBlueprint = internalMutation({
  args: { userId: v.string(), blueprintId: v.string() },
  returns: v.null(),
  handler: async (ctx, { userId, blueprintId }) => {
    await requireFixtureAccount(ctx, userId)
    const blueprint = await ctx.db
      .query('encounterBlueprints')
      .withIndex('by_publicId', (q) => q.eq('id', blueprintId))
      .unique()
    if (!blueprint) return null
    if (blueprint.ownerUserId !== userId) throw new Error('Fixture Blueprint ownership mismatch.')
    const receipts = await ctx.db
      .query('encounterBlueprintUpdates')
      .withIndex('by_blueprintId', (q) => q.eq('blueprintId', blueprintId))
      .take(11)
    // ponytail: development proofs create <=10 update receipts; larger fixtures need pagination.
    if (receipts.length > 10 || receipts.some((receipt) => receipt.ownerUserId !== userId))
      throw new Error('Fixture Blueprint update receipt bounds or ownership mismatch.')
    for (const receipt of receipts) await ctx.db.delete(receipt._id)
    await ctx.db.delete(blueprint._id)
    await syncAccountUsage(ctx, 'savedEncounters', blueprint.id)
    return null
  }
})
