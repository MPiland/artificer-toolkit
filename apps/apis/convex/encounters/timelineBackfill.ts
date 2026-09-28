import { Migrations } from '@convex-dev/migrations'
import { components, internal } from '../_generated/api'
import schema from '../schema'
import { presentTimelineEntry } from '@artificer-toolkit/encounter-persistence/timelineEntries'
import { internalMutation } from '../lib/mutations'

const migrations = new Migrations(components.migrations, { schema, internalMutation })

export const receipts = migrations.define({
  table: 'encounterRunCommands',
  // Receipts contain snapshots that can approach the document size limit.
  batchSize: 1,
  migrateOne: async (ctx, command) => {
    const { id, version, visibility } = presentTimelineEntry(command)
    if (
      command.id === undefined ||
      command.version === undefined ||
      command.visibility === undefined
    )
      await ctx.db.patch(command._id, { id, version, visibility })
  }
})

export const run = migrations.runner([internal.encounters.timelineBackfill.receipts])
