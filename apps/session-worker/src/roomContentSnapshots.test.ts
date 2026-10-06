import { createHash } from 'node:crypto'
import { gzipSync } from 'node:zlib'

import {
  contentSnapshotDocumentsObjectSchema,
  contentSnapshotIndexObjectSchema,
  contentSnapshotObjectKey,
  type ContentSnapshotDocumentsObject,
  type ContentSnapshotHeader,
  type ContentSnapshotHead,
  type ContentSnapshotManifestDto
} from '@artificer-toolkit/schema/api/contentSnapshots'
import { canonicalizeJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { createSnapshotReaders } from '@artificer-toolkit/rules-runtime/character/snapshotReaders'
import { describe, expect, it, vi } from 'vitest'

import { startLocalR2 } from '../../apis/tests/localR2.js'
import { type ContentSnapshotObjectBody } from './contentSnapshotStorage.js'
import { loadRoomContentSnapshots } from './roomContentSnapshots.js'

const systemId = '00000000-0000-4000-8000-000000000001'
const sourceId = '00000000-0000-4000-8000-000000000002'
const campaignId = '00000000-0000-4000-8000-000000000003'
const rootId = '00000000-0000-4000-8000-000000000004'

function headerOf({ format, scope, scopeId, kind, part }: ContentSnapshotHeader) {
  return { format, scope, scopeId, kind, part }
}

function document(scope: 'SOURCE' | 'CAMPAIGN', scopeId: string, label = 'Source race') {
  const root = {
    id: rootId,
    label,
    userId: sourceId,
    systemId,
    category: 'BASE',
    selectionMode: 'DIRECT',
    size: 'MEDIUM',
    speeds: []
  }
  return contentSnapshotDocumentsObjectSchema.parse({
    format: 2,
    scope,
    scopeId,
    kind: 'RACE',
    part: 'documents',
    roots: [root],
    versions: [
      {
        identity: {
          subjectKind: 'RACE',
          subjectId: rootId,
          systemId,
          contentSourceId: scope === 'SOURCE' ? scopeId : sourceId,
          versionId: rootId,
          checksum: checksumRuleDocument(root)
        },
        version: 1,
        storedParentId: null
      }
    ]
  })
}

function indexOf(object: ContentSnapshotDocumentsObject) {
  return contentSnapshotIndexObjectSchema.parse({
    ...headerOf(object),
    part: 'index',
    roots: object.roots.map(({ id, label }) => ({
      id,
      label,
      category: 'BASE',
      selectionMode: 'DIRECT',
      size: 'MEDIUM',
      speeds: [],
      abilityScoreIncreaseFacts: []
    }))
  })
}

function fixture() {
  const stored = new Map<string, { bytes: Uint8Array; gzip: boolean }>()
  const heads: ContentSnapshotHead[] = []
  function add(object: ContentSnapshotDocumentsObject, gzip = false) {
    const index = indexOf(object)
    const parts = [index, object].map((part) => {
      const json = canonicalizeJson(part)
      const ref = {
        sha256: createHash('sha256').update(json).digest('hex'),
        byteLength: new TextEncoder().encode(json).byteLength,
        rootCount: part.roots.length
      }
      const key = contentSnapshotObjectKey(headerOf(part), ref.sha256)
      stored.set(key, { bytes: gzip ? gzipSync(json) : new TextEncoder().encode(json), gzip })
      return { key, ref }
    })
    const head: ContentSnapshotHead = {
      scope: object.scope,
      scopeId: object.scopeId,
      revision: 1,
      builtRevision: 1,
      kinds: { RACE: { index: parts[0]!.ref, list: parts[1]!.ref, documents: parts[1]!.ref } }
    }
    heads.push(head)
    return parts[1]!.key
  }
  const sourceKey = add(document('SOURCE', sourceId), true)
  const campaignKey = add(document('CAMPAIGN', campaignId, 'Campaign share'))
  const manifest: ContentSnapshotManifestDto = {
    systemId,
    sources: [{ contentSourceId: sourceId, kind: 'USER', head: heads[0]! }],
    campaign: { id: campaignId, contentMaturity: 'STANDARD', head: heads[1]! }
  }
  const get = vi.fn(async (key: string): Promise<ContentSnapshotObjectBody | null> => {
    const object = stored.get(key)
    return object
      ? {
          body: new Blob([object.bytes]).stream(),
          httpEtag: 'fixture-etag',
          customMetadata: {},
          httpMetadata: {
            contentType: 'application/json',
            contentEncoding: object.gzip ? 'gzip' : undefined
          }
        }
      : null
  })
  const environment = { CONTENT_SNAPSHOTS: { get }, CONVEX_SITE_URL: 'http://127.0.0.1:3211' }
  return { stored, add, sourceKey, campaignKey, manifest, environment }
}

describe('room content snapshots', () => {
  it('accepts privately proven empty scopes without storage reads and refuses populated zero-revision heads', async () => {
    const { manifest, environment } = fixture()
    const source = manifest.sources[0]!.head!
    const campaign = manifest.campaign!.head!
    const kinds = source.kinds
    for (const head of [source, campaign]) {
      head.revision = 0
      head.builtRevision = 0
      head.kinds = {}
    }
    await expect(loadRoomContentSnapshots(environment, manifest, campaignId)).resolves.toEqual([])
    expect(environment.CONTENT_SNAPSHOTS.get).not.toHaveBeenCalled()
    for (const head of [source, campaign]) {
      head.kinds = kinds
      await expect(loadRoomContentSnapshots(environment, manifest, campaignId)).rejects.toThrow(
        'head'
      )
      expect(environment.CONTENT_SNAPSHOTS.get).not.toHaveBeenCalled()
      head.kinds = {}
    }
  })

  it('reads private gzip source documents before Campaign shares without a content token', async () => {
    const { environment, manifest, sourceKey, campaignKey } = fixture()
    const objects = await loadRoomContentSnapshots(environment, manifest, campaignId)
    expect(objects.map((object) => [object.scope, object.part])).toEqual([
      ['SOURCE', 'index'],
      ['SOURCE', 'documents'],
      ['CAMPAIGN', 'index'],
      ['CAMPAIGN', 'documents']
    ])
    expect(objects.map((object) => object.roots[0]?.label)).toEqual([
      'Source race',
      'Source race',
      'Campaign share',
      'Campaign share'
    ])
    expect((await createSnapshotReaders(objects).readPublication(rootId))?.document.label).toBe(
      'Source race'
    )
    expect((await createSnapshotReaders(objects).readRaces()).map((race) => race.label)).toEqual([
      'Source race'
    ])
    expect(environment.CONTENT_SNAPSHOTS.get.mock.calls.map(([key]) => key)).toEqual([
      contentSnapshotObjectKey(
        { ...headerOf(document('SOURCE', sourceId)), part: 'index' },
        manifest.sources[0]!.head!.kinds.RACE!.index.sha256
      ),
      sourceKey,
      contentSnapshotObjectKey(
        { ...headerOf(document('CAMPAIGN', campaignId)), part: 'index' },
        manifest.campaign!.head!.kinds.RACE!.index.sha256
      ),
      campaignKey
    ])
  })

  it('refuses mismatched, duplicate, SYSTEM, null, unbuilt and stale heads before storage reads', async () => {
    for (const mutate of [
      (manifest: ContentSnapshotManifestDto) => {
        manifest.campaign!.id = sourceId
      },
      (manifest: ContentSnapshotManifestDto) => {
        manifest.sources[0]!.head!.scopeId = campaignId
      },
      (manifest: ContentSnapshotManifestDto) => {
        manifest.campaign!.head!.scopeId = sourceId
      },
      (manifest: ContentSnapshotManifestDto) => {
        manifest.sources.push(manifest.sources[0]!)
      },
      (manifest: ContentSnapshotManifestDto) => {
        manifest.sources[0]!.head!.scope = 'SYSTEM'
      },
      (manifest: ContentSnapshotManifestDto) => {
        manifest.sources[0]!.head = null
      },
      (manifest: ContentSnapshotManifestDto) => {
        manifest.campaign = null
      },
      (manifest: ContentSnapshotManifestDto) => {
        manifest.campaign!.head = null
      },
      (manifest: ContentSnapshotManifestDto) => {
        manifest.sources[0]!.head!.builtRevision = 0
      },
      (manifest: ContentSnapshotManifestDto) => {
        manifest.sources[0]!.head!.revision = 2
      }
    ]) {
      const { manifest, environment } = fixture()
      mutate(manifest)
      await expect(loadRoomContentSnapshots(environment, manifest, campaignId)).rejects.toThrow()
      expect(environment.CONTENT_SNAPSHOTS.get).not.toHaveBeenCalled()
    }
  })

  it('rejects missing objects, bad hashes, counts, sizes, headers and noncanonical content in either part', async () => {
    for (const part of ['index', 'documents'] as const) {
      for (const failure of [
        'missing',
        'hash',
        'count',
        'size',
        'header',
        'schema',
        'canonical',
        'duplicate-roots'
      ]) {
        const { manifest, environment, stored } = fixture()
        const ref = manifest.sources[0]!.head!.kinds.RACE![part]
        const original =
          part === 'index' ? indexOf(document('SOURCE', sourceId)) : document('SOURCE', sourceId)
        const key = contentSnapshotObjectKey(headerOf(original), ref.sha256)
        let json = canonicalizeJson(original)
        if (failure === 'missing') stored.delete(key)
        else if (failure === 'count') ref.rootCount = 2
        else if (failure === 'size') ref.byteLength -= 1
        else {
          if (failure === 'hash') json = json.replace('Source race', 'Source Race')
          if (failure === 'header')
            json = canonicalizeJson({
              ...original,
              scopeId: campaignId,
              ...(original.part === 'documents'
                ? {
                    versions: original.versions.map((pin) => ({
                      ...pin,
                      identity: { ...pin.identity, contentSourceId: campaignId }
                    }))
                  }
                : {})
            })
          if (failure === 'schema')
            json = canonicalizeJson({ ...original, roots: [{ id: rootId }] })
          if (failure === 'canonical') json = JSON.stringify(original, null, 2)
          if (failure === 'duplicate-roots')
            json = canonicalizeJson({
              ...original,
              roots: [...original.roots, ...original.roots],
              ...(original.part === 'documents'
                ? { versions: [...original.versions, ...original.versions] }
                : {})
            })
          if (failure !== 'hash') {
            ref.sha256 = createHash('sha256').update(json).digest('hex')
            ref.byteLength = new TextEncoder().encode(json).byteLength
            if (failure === 'duplicate-roots') ref.rootCount = 2
          }
          stored.set(contentSnapshotObjectKey(headerOf(original), ref.sha256), {
            bytes: gzipSync(json),
            gzip: true
          })
        }
        await expect(loadRoomContentSnapshots(environment, manifest, campaignId)).rejects.toThrow()
      }
    }
  })

  it('rejects BOM-prefixed noncanonical content even with its authoritative matching hash and size', async () => {
    for (const part of ['index', 'documents'] as const) {
      const { manifest, environment, stored } = fixture()
      const ref = manifest.sources[0]!.head!.kinds.RACE![part]
      const original =
        part === 'index' ? indexOf(document('SOURCE', sourceId)) : document('SOURCE', sourceId)
      const json = '\ufeff' + canonicalizeJson(original)
      ref.sha256 = createHash('sha256').update(json).digest('hex')
      ref.byteLength = new TextEncoder().encode(json).byteLength
      stored.set(contentSnapshotObjectKey(headerOf(original), ref.sha256), {
        bytes: gzipSync(json),
        gzip: true
      })
      await expect(loadRoomContentSnapshots(environment, manifest, campaignId)).rejects.toThrow()
    }
  })

  it('cancels a stored stream when it exceeds the authoritative byte bound', async () => {
    const { manifest, environment } = fixture()
    const cancel = vi.fn()
    environment.CONTENT_SNAPSHOTS.get.mockImplementation(async () => ({
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(4096))
        },
        cancel
      }),
      httpEtag: 'oversized',
      httpMetadata: { contentEncoding: 'gzip' }
    }))
    await expect(loadRoomContentSnapshots(environment, manifest, campaignId)).rejects.toThrow(
      'byte length'
    )
    expect(cancel).toHaveBeenCalledOnce()
  })

  it('reads the same local fixture raw gzip path and rejects a managed Convex site', async () => {
    const state = fixture()
    const local = await startLocalR2()
    try {
      for (const [key, object] of state.stored) {
        const response = await fetch(`${local.endpoint}/artificer-local-content-snapshots/${key}`, {
          method: 'PUT',
          body: object.bytes,
          headers: {
            authorization: 'AWS4-HMAC-SHA256 Credential=local-media-access-key/local-fixture',
            'content-type': 'application/json',
            ...(object.gzip ? { 'content-encoding': 'gzip' } : {})
          }
        })
        expect(response.ok).toBe(true)
      }
      // Any loopback port is local development, so the fixture's ephemeral port needs no bridge.
      const environment = {
        ...state.environment,
        LOCAL_CONTENT_SNAPSHOT_ORIGIN: local.endpoint
      }
      expect((await loadRoomContentSnapshots(environment, state.manifest, campaignId)).length).toBe(
        4
      )
      expect(state.environment.CONTENT_SNAPSHOTS.get).not.toHaveBeenCalled()
      const reads = local.methods.length
      await expect(
        loadRoomContentSnapshots(
          { ...environment, CONVEX_SITE_URL: 'https://managed.example' },
          state.manifest,
          campaignId
        )
      ).rejects.toThrow('loopback')
      for (const origin of [
        'http://localhost:8026',
        'https://127.0.0.1:8026',
        'http://127.0.0.1',
        'http://192.168.0.1:8026'
      ])
        await expect(
          loadRoomContentSnapshots(
            { ...environment, LOCAL_CONTENT_SNAPSHOT_ORIGIN: origin },
            state.manifest,
            campaignId
          )
        ).rejects.toThrow()
      expect(local.methods.length).toBe(reads)
    } finally {
      await local.close()
    }
  })
})
