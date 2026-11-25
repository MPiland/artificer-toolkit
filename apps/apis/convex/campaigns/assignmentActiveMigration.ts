import { Migrations } from '@convex-dev/migrations'
import { components, internal } from '../_generated/api'
import schema from '../schema'
import { eagerInternalMutation } from '../lib/mutations'

/**
 * D236 backfill: every Character assigned before the bench existed was its player's only one, so
 * it is the Active Character. Idempotent: a migrated row already carries `active`.
 */
const migrations = new Migrations(components.migrations, {
  schema,
  internalMutation: eagerInternalMutation
})

export const markAssignmentsActive = migrations.define({
  table: 'campaignCharacterAssignments',
  migrateOne: (_ctx, assignment) => (assignment.active === undefined ? { active: true } : undefined)
})

export const run = migrations.runner([
  internal.campaigns.assignmentActiveMigration.markAssignmentsActive
])
