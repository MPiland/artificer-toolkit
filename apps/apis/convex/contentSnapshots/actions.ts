'use node'

import { gzipSync } from 'node:zlib'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { v } from 'convex/values'
import {
  contentSnapshotKindSchema,
  type ContentSnapshotHead
} from '@artificer-toolkit/schema/api/contentSnapshots'
import {
  buildContentSnapshotPart,
  contentSnapshotObjectKey,
  toContentSnapshotIndexEntry,
  type ContentSnapshotIndexSource
} from '@artificer-toolkit/rules-runtime/contentSnapshots'
import { components, internal } from '../_generated/api'
import { internalAction } from '../_generated/server'
import { vContentSnapshotScopeRef } from './marking'
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
        const sources = (
          await ctx.runQuery(internal.contentSnapshots.heads.readScopeKind, { ...ref, kind })
        ).map(
          // Parsed from the query's own serialization; the part build validates every root.
          (json) => JSON.parse(json) as ContentSnapshotIndexSource
        )
        if (sources.length === 0) continue
        const header = { format: 1 as const, ...ref, kind }
        const index = buildContentSnapshotPart(
          { ...header, part: 'index' },
          sources.map((source) => toContentSnapshotIndexEntry(source))
        )
        const documents = buildContentSnapshotPart(
          { ...header, part: 'documents' },
          sources.map((source) => source.document)
        )
        objects.set(
          contentSnapshotObjectKey({ ...header, part: 'index' }, index.sha256),
          index.json
        )
        objects.set(
          contentSnapshotObjectKey({ ...header, part: 'documents' }, documents.sha256),
          documents.json
        )
        const refOf = ({ sha256, byteLength, rootCount }: typeof index) => ({
          sha256,
          byteLength,
          rootCount
        })
        kinds[kind] = { index: refOf(index), documents: refOf(documents) }
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
            ContentEncoding: 'gzip'
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
      await ctx.runMutation(internal.contentSnapshots.heads.failBuild, ref)
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
