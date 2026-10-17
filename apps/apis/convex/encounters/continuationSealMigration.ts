import { Migrations } from '@convex-dev/migrations'
import {
  readStoredPendingSnapshot,
  writePendingSnapshot
} from '@artificer-toolkit/encounter-persistence/pendingSnapshots'
import { components, internal } from '../_generated/api'
import schema from '../schema'
import { createConvexEncounterStore } from '../lib/convexEncounterStore'
import { internalMutation } from '../lib/mutations'

/**
 * Q23 (PLATFORM-24): rule continuations are no longer sealed. A decision paused before the change
 * stores a kernel-evidence snapshot with a `seal` the schema now refuses, so it is cancelled rather
 * than stripped, as ADR 0033 cancelled decisions paused across its migration: the occurrence is
 * voided and its snapshot parts and checksum are removed. Idempotent: current snapshots carry no
 * seal and settled occurrences have none.
 */
const migrations = new Migrations(components.migrations, { schema, internalMutation })

export const cancelSealedDecisions = migrations.define({
  table: 'encounterRuleOccurrences',
  // A pending snapshot can approach the document size limit.
  batchSize: 1,
  migrateOne: async (ctx, row) => {
    if (row.state !== 'PENDING') return
    const store = { db: createConvexEncounterStore(ctx) }
    const stored = await readStoredPendingSnapshot(store, row)
    if (typeof stored !== 'object' || stored === null || !('seal' in stored)) return
    const now = new Date().toISOString()
    await ctx.db.patch(row._id, {
      state: 'VOIDED',
      version: row.version + 1,
      pendingSnapshotChecksum: await writePendingSnapshot(store, row, null),
      completedAt: now,
      updatedAt: now
    })
  }
})

export const run = migrations.runner([
  internal.encounters.continuationSealMigration.cancelSealedDecisions
])
