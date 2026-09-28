import type { GenericDatabaseWriter, Scheduler } from 'convex/server'
import { v } from 'convex/values'
import type { ContentSnapshotScope } from '@artificer-toolkit/schema/api/contentSnapshots'
import { internal } from '../_generated/api'
import type { DataModel } from '../_generated/dataModel'

/** Coalesces a burst of publishes into one build. */
export const CONTENT_SNAPSHOT_BUILD_DELAY_MS = 2_000
// Longer than the 10-minute action limit, so an expired lease means the build is gone.
const BUILD_LEASE_MS = 15 * 60_000

// ponytail: SYSTEM-scope content (System, vocabulary, definitions) has no object format yet, so
// no SYSTEM head is built. Every content source, PLATFORM or USER, is its own SOURCE scope.
export type ContentSnapshotScopeRef = {
  scope: Exclude<ContentSnapshotScope, 'SYSTEM'>
  scopeId: string
}
export const vContentSnapshotScopeRef = {
  scope: v.union(v.literal('SOURCE'), v.literal('CAMPAIGN')),
  scopeId: v.string()
}

export function readContentSnapshotHead(
  db: GenericDatabaseWriter<DataModel>,
  { scope, scopeId }: ContentSnapshotScopeRef
) {
  return db
    .query('contentSnapshotHeads')
    .withIndex('by_scope_scopeId', (q) => q.eq('scope', scope).eq('scopeId', scopeId))
    .unique()
}

/** The caller records `buildScheduledAt` in the same transaction. */
export async function scheduleContentSnapshotBuild(
  scheduler: Scheduler,
  { scope, scopeId }: ContentSnapshotScopeRef,
  delayMs: number
) {
  await scheduler.runAfter(delayMs, internal.contentSnapshots.actions.build, { scope, scopeId })
}

/**
 * Records that a scope's published content changed and schedules a build unless one is pending.
 * `create` is false for changes that only affect an existing scope (Campaign settings, members, a
 * source record), so they never create heads for scopes that have no content.
 */
export async function markContentSnapshotScope(
  { db, scheduler }: { db: GenericDatabaseWriter<DataModel>; scheduler: Scheduler },
  ref: ContentSnapshotScopeRef,
  create: boolean
) {
  const head = await readContentSnapshotHead(db, ref)
  const now = Date.now()
  if (!head) {
    if (!create) return false
    await db.insert('contentSnapshotHeads', {
      ...ref,
      revision: 1,
      builtRevision: 0,
      kinds: {},
      buildScheduledAt: now
    })
    await scheduleContentSnapshotBuild(scheduler, ref, CONTENT_SNAPSHOT_BUILD_DELAY_MS)
    return true
  }
  const scheduled =
    head.buildScheduledAt !== undefined && head.buildScheduledAt >= now - BUILD_LEASE_MS
  await db.patch(head._id, {
    revision: head.revision + 1,
    ...(scheduled ? {} : { buildScheduledAt: now })
  })
  if (!scheduled)
    await scheduleContentSnapshotBuild(scheduler, ref, CONTENT_SNAPSHOT_BUILD_DELAY_MS)
  return true
}
