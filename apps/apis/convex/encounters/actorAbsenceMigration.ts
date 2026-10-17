import { Migrations } from '@convex-dev/migrations'
import { runActorPlayState } from '@artificer-toolkit/rules-runtime/encounterActorStorage'
import {
  restoreStoredRunActor,
  serializeStoredRunActor
} from '@artificer-toolkit/encounter-persistence/actorProjectionFacts'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { components, internal } from '../_generated/api'
import schema from '../schema'
import { internalMutation } from '../lib/mutations'

/**
 * D128 backfill: a stored Run actor's `outOfInitiative` flag becomes `absence`. D82's flag was
 * written only by the GM's removal command, so a set flag is always a GM removal; Plane Shift
 * departures (D128) never existed in stored data. Idempotent: a migrated row has no flag.
 */
const migrations = new Migrations(components.migrations, { schema, internalMutation })

export const runActorAbsence = migrations.define({
  table: 'encounterRunActors',
  // Actor state can approach the document size limit.
  batchSize: 1,
  migrateOne: async (ctx, row) => {
    const stored: unknown = JSON.parse(row.stateJson)
    if (typeof stored !== 'object' || stored === null || !('outOfInitiative' in stored)) return
    const { outOfInitiative, ...current } = stored
    const actor = restoreStoredRunActor(row, {
      ...current,
      absence: outOfInitiative === true ? 'GM_REMOVED' : null
    })
    await ctx.db.patch(row._id, {
      stateJson: serializeStoredRunActor(actor),
      stateChecksum: checksumCanonicalJson(runActorPlayState(actor))
    })
  }
})

export const run = migrations.runner([internal.encounters.actorAbsenceMigration.runActorAbsence])
