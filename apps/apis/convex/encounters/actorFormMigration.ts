import { Migrations } from '@convex-dev/migrations'
import { runActorPlayState } from '@artificer-toolkit/rules-runtime/encounterActorStorage'
import { encounterStoredRunActorStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { components, internal } from '../_generated/api'
import schema from '../schema'
import { internalMutation } from '../lib/mutations'

/**
 * D130 backfill: a stored Creature or custom Run actor gains `form: null` (it has never been in a
 * creature form) and every actor row without one gains `formOriginSnapshotChecksum: null`.
 * Idempotent: a migrated row, possibly in a form by now, has both and is left alone.
 */
const migrations = new Migrations(components.migrations, { schema, internalMutation })

export const runActorForm = migrations.define({
  table: 'encounterRunActors',
  // Actor state can approach the document size limit.
  batchSize: 1,
  migrateOne: async (ctx, row) => {
    const stored: unknown = JSON.parse(row.stateJson)
    if (typeof stored !== 'object' || stored === null) return
    // A Character is never in a form, so its stored state is unchanged.
    const lacksForm = !('form' in stored) && !('kind' in stored && stored.kind === 'CHARACTER')
    if (row.formOriginSnapshotChecksum !== undefined && !lacksForm) return
    const actor = encounterStoredRunActorStateSchema.parse(
      lacksForm ? { ...stored, form: null } : stored
    )
    await ctx.db.patch(row._id, {
      stateJson: JSON.stringify(actor),
      stateChecksum: checksumCanonicalJson(runActorPlayState(actor)),
      formOriginSnapshotChecksum: row.formOriginSnapshotChecksum ?? null
    })
  }
})

export const run = migrations.runner([internal.encounters.actorFormMigration.runActorForm])
