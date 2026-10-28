'use node'

import { gzipSync } from 'node:zlib'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { v } from 'convex/values'
import {
  CONTENT_SNAPSHOT_PUBLIC_METADATA,
  contentSnapshotKindSchema,
  contentSnapshotObjectKey,
  type ContentSnapshotHead
} from '@artificer-toolkit/schema/api/contentSnapshots'
import {
  buildContentSnapshotKind,
  type ContentSnapshotListSource
} from '@artificer-toolkit/rules-runtime/contentSnapshots'
import { components, internal } from '../_generated/api'
import { internalAction } from '../_generated/server'
import { CONTENT_SNAPSHOT_FIRST_RETRY_MS, CONTENT_SNAPSHOT_PAGE_MAX_ROOTS } from './heads'
import {
  CONTENT_SNAPSHOT_BUILD_DELAY_MS,
  scheduleContentSnapshotBuild,
  vContentSnapshotScopeRef
} from './marking'
import { createContentSnapshotStorage } from './storage'

/**
 * Rebuilds every kind of one scope from its current publications and commits the head with a
 * compare-and-set. Parts are content-addressed, so unchanged kinds keep their keys and upload
 * nothing. ponytail: each build rereads the whole scope; rebuild only marked kinds if measured
 * source or Campaign scopes make that read cost matter.
 */
export const build = internalAction({
  args: vContentSnapshotScopeRef,
  returns: v.null(),
  handler: async (ctx, ref): Promise<null> => {
    // Missing storage configuration is not transient: it fails without retries, and the lease
    // lets the first mark after it expires rebuild.
    const storage = createContentSnapshotStorage()
    try {
      const start = await ctx.runQuery(internal.contentSnapshots.heads.readBuildStart, ref)
      if (!start) return null
      const kinds: ContentSnapshotHead['kinds'] = {}
      const objects = new Map<string, string>()
      for (const kind of contentSnapshotKindSchema.options) {
        if (!start.scopeExists) break
        // Pages read separate snapshots; a write between them bumps `revision`, so the commit
        // schedules another build.
        const sources: ContentSnapshotListSource[] = []
        let cursor: string | null = null
        for (let isDone = false; !isDone;) {
          const page:
            | { sources: string[]; continueCursor: string; isDone: boolean }
            | { pendingCompilation: true } = await ctx.runQuery(
            internal.contentSnapshots.heads.readScopeKind,
            {
              ...ref,
              kind,
              paginationOpts: { numItems: CONTENT_SNAPSHOT_PAGE_MAX_ROOTS, cursor }
            }
          )
          if ('pendingCompilation' in page) {
            // Marks keep the head hot while content is written (a seed marks it several times a
            // second), so a build that was marked meanwhile reschedules without writing the head.
            const latest = await ctx.runQuery(internal.contentSnapshots.heads.readBuildStart, ref)
            if (latest && latest.revision > start.revision) {
              await scheduleContentSnapshotBuild(
                ctx.scheduler,
                ref,
                CONTENT_SNAPSHOT_BUILD_DELAY_MS
              )
              return null
            }
            await ctx.runMutation(internal.contentSnapshots.heads.awaitCompilation, {
              ...ref,
              revisionBuiltFrom: start.revision
            })
            return null
          }
          // Parsed from the query's own serialization; the part build validates every root.
          for (const json of page.sources)
            sources.push(JSON.parse(json) as ContentSnapshotListSource)
          cursor = page.continueCursor
          isDone = page.isDone
        }
        if (sources.length === 0) continue
        const header = { format: 3 as const, ...ref, kind }
        const parts = buildContentSnapshotKind(header, sources)
        for (const part of ['index', 'list', 'documents'] as const)
          objects.set(
            contentSnapshotObjectKey({ ...header, part }, parts[part].sha256),
            parts[part].json
          )
        const refOf = ({ sha256, byteLength, rootCount }: typeof parts.index) => ({
          sha256,
          byteLength,
          rootCount
        })
        kinds[kind] = {
          index: refOf(parts.index),
          list: refOf(parts.list),
          documents: refOf(parts.documents)
        }
      }
      const uploadedKeys = await ctx.runQuery(
        internal.contentSnapshots.heads.readAbsentObjectKeys,
        {
          keys: [...objects.keys()]
        }
      )
      const absent = new Set(uploadedKeys)
      for (const [key, json] of objects) {
        if (!absent.has(key)) continue
        await storage.client.send(
          new PutObjectCommand({
            Bucket: storage.config.bucket,
            Key: key,
            Body: gzipSync(json),
            ContentType: 'application/json',
            ContentEncoding: 'gzip',
            ...(start.publicAccess ? { Metadata: { ...CONTENT_SNAPSHOT_PUBLIC_METADATA } } : {})
          })
        )
      }
      await ctx.runMutation(internal.contentSnapshots.heads.commitBuild, {
        ...ref,
        revisionBuiltFrom: start.revision,
        kinds,
        uploadedKeys,
        scopeExists: start.scopeExists
      })
      return null
    } catch (error) {
      // failBuild writes the head too and can lose every retry to the marks; the lease must still
      // end in a scheduled build, so the action schedules the first backoff itself.
      await ctx
        .runMutation(internal.contentSnapshots.heads.failBuild, ref)
        .catch(() =>
          scheduleContentSnapshotBuild(ctx.scheduler, ref, CONTENT_SNAPSHOT_FIRST_RETRY_MS)
        )
      throw error
    }
  }
})

/** Daily: deletes objects superseded for more than seven days, one confirmed batch at a time. */
export const deleteSupersededObjects = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx): Promise<null> => {
    const storage = createContentSnapshotStorage()
    for (;;) {
      const keys = await ctx.runMutation(internal.contentSnapshots.heads.claimSupersededObjects, {})
      if (keys.length === 0) return null
      // Unlike R2.deleteObject(), this returns only after provider confirmation.
      for (const key of keys)
        await ctx.runAction(components.r2.lib.deleteR2Object, { ...storage.config, key })
      await ctx.runMutation(internal.contentSnapshots.heads.finishDeletedObjects, { keys })
    }
  }
})
