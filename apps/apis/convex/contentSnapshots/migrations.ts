import { Migrations } from '@convex-dev/migrations'
import { components, internal } from '../_generated/api'
import schema from '../schema'
import { internalMutation } from '../lib/mutations'
import { markContentSnapshotScope } from './marking'

/**
 * Marks every content scope for a rebuild: a deployment's first build (ADR 0036) and any change to
 * the object format. Marking coalesces per scope, so each scope builds once however many rows mark it.
 */
const migrations = new Migrations(components.migrations, { schema, internalMutation })

export const sources = migrations.define({
  table: 'contentSources',
  migrateOne: async (ctx, source) => {
    await markContentSnapshotScope(ctx, { scope: 'SOURCE', scopeId: source.id }, true)
  }
})

export const campaignShares = migrations.define({
  table: 'campaignContentShares',
  migrateOne: async (ctx, share) => {
    await markContentSnapshotScope(ctx, { scope: 'CAMPAIGN', scopeId: share.campaignId }, true)
  }
})

export const rebuild = migrations.runner([
  internal.contentSnapshots.migrations.sources,
  internal.contentSnapshots.migrations.campaignShares
])
