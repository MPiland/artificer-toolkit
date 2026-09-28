import { Migrations } from '@convex-dev/migrations'
import { components, internal } from '../_generated/api'
import schema from '../schema'
import { internalMutation } from '../lib/mutations'

const migrations = new Migrations(components.migrations, { schema, internalMutation })

/**
 * Recounts one Campaign's entries and Scenes and overwrites its counter row. Idempotent, so live
 * trigger updates made before or during the backfill converge on the same totals.
 */
export const campaigns = migrations.define({
  table: 'campaigns',
  batchSize: 1,
  migrateOne: async (ctx, campaign) => {
    let entries = 0
    for (const table of [
      'campaignNotebookSections',
      'campaignAttachments',
      'campaignVehicles'
    ] as const)
      for await (const _row of ctx.db
        .query(table)
        .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaign.id)))
        entries++
    let scenes = 0
    for await (const _row of ctx.db
      .query('sceneDefinitions')
      .withIndex('by_campaignId_updatedAt_id', (q) => q.eq('campaignId', campaign.id)))
      scenes++
    const row = await ctx.db
      .query('campaignContentUsage')
      .withIndex('by_campaignId', (q) => q.eq('campaignId', campaign.id))
      .unique()
    if (entries === 0 && scenes === 0) {
      if (row) await ctx.db.delete(row._id)
    } else if (row) await ctx.db.patch(row._id, { entries, scenes })
    else await ctx.db.insert('campaignContentUsage', { campaignId: campaign.id, entries, scenes })
  }
})

export const run = migrations.runner([internal.campaigns.contentUsageBackfill.campaigns])
