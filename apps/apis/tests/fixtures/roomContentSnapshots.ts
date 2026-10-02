import type { TestConvex } from 'convex-test'
import { gzipSync } from 'node:zlib'
import {
  contentSnapshotObjectKey,
  type ContentSnapshotHead,
  type ContentSnapshotHeader
} from '@artificer-toolkit/schema/api/contentSnapshots'
import { canonicalizeJson } from '@artificer-toolkit/shared/canonicalJson'
import { sha256Hex } from '@artificer-toolkit/shared/sha256'
import type schema from '../../convex/schema'
import type { ContentSnapshotObjectBody } from '../../../session-worker/src/contentSnapshotStorage'
import { readScopeObjects } from './contentSnapshotReaders'

type Caller = Pick<ReturnType<TestConvex<typeof schema>['withIdentity']>, 'run' | 'query'>

/**
 * Builds the Campaign's content snapshots as the publisher would (SOURCE scopes of its Game System
 * and the CAMPAIGN scope) from the content stored now, records their heads, and serves the objects
 * from an in-memory bucket the room's real loader reads.
 */
export async function installContentSnapshots(caller: Caller, campaignId: string) {
  const gameSystemId = await caller.run(async (ctx) => {
    const campaign = await ctx.db
      .query('campaigns')
      .withIndex('by_publicId', (q) => q.eq('id', campaignId))
      .unique()
    if (!campaign) throw new Error('Content snapshot Campaign is unavailable.')
    return campaign.gameSystemId
  })
  const sources = await caller.run((ctx) =>
    ctx.db
      .query('contentSources')
      .withIndex('by_gameSystemId', (q) => q.eq('gameSystemId', gameSystemId))
      .collect()
  )
  const scopes = [
    ...sources.map((source) => ({ scope: 'SOURCE' as const, scopeId: source.id })),
    { scope: 'CAMPAIGN' as const, scopeId: campaignId }
  ]
  const objects = new Map<string, Uint8Array>()
  for (const scope of scopes) {
    const kinds: ContentSnapshotHead['kinds'] = {}
    for (const object of await readScopeObjects(caller, scope)) {
      const json = canonicalizeJson(object)
      const ref = {
        sha256: sha256Hex(json),
        byteLength: new TextEncoder().encode(json).byteLength,
        rootCount: object.roots.length
      }
      const header: ContentSnapshotHeader = {
        format: object.format,
        scope: object.scope,
        scopeId: object.scopeId,
        kind: object.kind,
        part: object.part
      }
      objects.set(contentSnapshotObjectKey(header, ref.sha256), gzipSync(json))
      const refs = kinds[object.kind] ?? { index: ref, list: ref, documents: ref }
      refs[object.part] = ref
      kinds[object.kind] = refs
    }
    if (!Object.keys(kinds).length) continue
    await caller.run(async (ctx) => {
      const existing = await ctx.db
        .query('contentSnapshotHeads')
        .withIndex('by_scope_scopeId', (q) =>
          q.eq('scope', scope.scope).eq('scopeId', scope.scopeId)
        )
        .unique()
      if (existing) await ctx.db.patch(existing._id, { kinds, builtRevision: existing.revision })
      else
        await ctx.db.insert('contentSnapshotHeads', {
          ...scope,
          revision: 1,
          builtRevision: 1,
          kinds
        })
    })
  }
  const get = async (key: string): Promise<ContentSnapshotObjectBody | null> => {
    const bytes = objects.get(key)
    return bytes
      ? {
          body: new Blob([new Uint8Array(bytes).buffer]).stream(),
          httpEtag: 'room-fixture',
          customMetadata: {},
          httpMetadata: { contentType: 'application/json', contentEncoding: 'gzip' }
        }
      : null
  }
  return { CONTENT_SNAPSHOTS: { get }, CONVEX_SITE_URL: 'http://127.0.0.1:3211' }
}
