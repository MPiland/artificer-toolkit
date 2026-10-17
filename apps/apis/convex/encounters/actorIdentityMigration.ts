import { Migrations } from '@convex-dev/migrations'
import {
  readStoredRunActor,
  serializeStoredRunActor
} from '@artificer-toolkit/encounter-persistence/actorProjectionFacts'
import { components, internal } from '../_generated/api'
import schema from '../schema'
import { internalMutation } from '../lib/mutations'

/**
 * A stored Run actor no longer repeats its identity and the checksums its row columns carry
 * (`serializeStoredRunActor`). Idempotent: a trimmed row serializes to the same JSON.
 */
const migrations = new Migrations(components.migrations, { schema, internalMutation })

export const runActorIdentity = migrations.define({
  table: 'encounterRunActors',
  // Actor state can approach the document size limit.
  batchSize: 1,
  migrateOne: async (ctx, row) => {
    const stateJson = serializeStoredRunActor(readStoredRunActor(row))
    if (stateJson !== row.stateJson) await ctx.db.patch(row._id, { stateJson })
  }
})

export const run = migrations.runner([internal.encounters.actorIdentityMigration.runActorIdentity])
