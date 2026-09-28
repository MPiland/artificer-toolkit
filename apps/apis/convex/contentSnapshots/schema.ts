import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  contentSnapshotHeadSchema,
  contentSnapshotScopeSchema
} from '@artificer-toolkit/schema/api/contentSnapshots'

// ADR 0036. `docs/architecture/persistence.md` records the build and cleanup protocol.
export const contentSnapshotTables = {
  contentSnapshotHeads: defineTable({
    ...zodToConvexFields(contentSnapshotHeadSchema.shape),
    // Set while a build is scheduled or running; a lease older than the action limit is lost.
    buildScheduledAt: v.optional(v.number()),
    // Consecutive failed builds since the last commit; bounds automatic retries.
    failedBuilds: v.optional(v.number())
  }).index('by_scope_scopeId', ['scope', 'scopeId']),
  contentSnapshotObjects: defineTable({
    key: v.string(),
    scope: zodToConvex(contentSnapshotScopeSchema),
    scopeId: v.string(),
    createdAt: v.number(),
    supersededAt: v.optional(v.number()),
    // Claimed by cleanup: the R2 object may already be gone, so no build may reuse this key.
    deletingAt: v.optional(v.number())
  })
    .index('by_key', ['key'])
    .index('by_supersededAt', ['supersededAt'])
}
