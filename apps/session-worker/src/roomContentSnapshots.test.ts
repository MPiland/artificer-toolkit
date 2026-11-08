import { createHash } from 'node:crypto'
import { gzipSync } from 'node:zlib'

import {
  contentSnapshotObjectKey,
  type ContentSnapshotManifestDto
} from '@artificer-toolkit/schema/api/contentSnapshots'
import { canonicalizeJson } from '@artificer-toolkit/shared/canonicalJson'
import { createSnapshotReaders } from '@artificer-toolkit/rules-runtime/character/snapshotReaders'
import { describe, expect, it, vi } from 'vitest'

import { startLocalR2 } from '../../apis/tests/localR2.js'
import { RoomContentSnapshots } from './roomContentSnapshots.js'
import {
  contentSnapshotBucket,
  contentSnapshotFixtureIds,
  headerOf,
  raceDocuments,
  raceIndex
} from './testing/contentSnapshotFixture.js'

const { systemId, sourceId, rootId } = contentSnapshotFixtureIds
const campaignId = '00000000-0000-4000-8000-000000000003'

function fixture() {
  const { stored, add, get } = contentSnapshotBucket()
  const source = add(raceDocuments('SOURCE', sourceId), true)
  const campaign = add(raceDocuments('CAMPAIGN', campaignId, 'Campaign share'))
  const manifest: ContentSnapshotManifestDto = {
    systemId,
    sources: [{ contentSourceId: sourceId, kind: 'USER', head: source.head }],
    campaign: { id: campaignId, contentMaturity: 'STANDARD', head: campaign.head }
  }
  const environment = {
    CONTENT_SNAPSHOTS: { get: vi.fn(get) },
    CONVEX_SITE_URL: 'http://127.0.0.1:3211'
  }
  return {
    stored,
    add,
    sourceKey: source.documentsKey,
    campaignKey: campaign.documentsKey,
    manifest,
    environment
  }
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
    await expect(new RoomContentSnapshots(environment).load(manifest, campaignId)).resolves.toEqual(
      []
    )
    expect(environment.CONTENT_SNAPSHOTS.get).not.toHaveBeenCalled()
    for (const head of [source, campaign]) {
      head.kinds = kinds
      await expect(
        new RoomContentSnapshots(environment).load(manifest, campaignId)
      ).rejects.toThrow('head')
      expect(environment.CONTENT_SNAPSHOTS.get).not.toHaveBeenCalled()
      head.kinds = {}
    }
  })

  it('reads private gzip source documents before Campaign shares without a content token', async () => {
    const { environment, manifest, sourceKey, campaignKey } = fixture()
    const objects = await new RoomContentSnapshots(environment).load(manifest, campaignId)
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
    expect(
      (await createSnapshotReaders(objects).readPublication(rootId))?.presentation?.label
    ).toBe('Source race')
    expect((await createSnapshotReaders(objects).readRaces()).map((race) => race.label)).toEqual([
      'Source race'
    ])
    expect(environment.CONTENT_SNAPSHOTS.get.mock.calls.map(([key]) => key)).toEqual([
      contentSnapshotObjectKey(
        { ...headerOf(raceDocuments('SOURCE', sourceId)), part: 'index' },
        manifest.sources[0]!.head!.kinds.RACE!.index.sha256
      ),
      sourceKey,
      contentSnapshotObjectKey(
        { ...headerOf(raceDocuments('CAMPAIGN', campaignId)), part: 'index' },
        manifest.campaign!.head!.kinds.RACE!.index.sha256
      ),
      campaignKey
    ])
  })

  it('reads each stored object once for every manifest that shares it, at most six at a time', async () => {
    const { add, environment, manifest, stored } = fixture()
    const sources = Array.from({ length: 4 }, (_, index) => {
      const id = `00000000-0000-4000-8000-0000000001${index.toString(16).padStart(2, '0')}`
      return {
        contentSourceId: id,
        kind: 'USER' as const,
        head: add(raceDocuments('SOURCE', id)).head
      }
    })
    const shared = { ...manifest, sources: [...manifest.sources, ...sources] }
    let open = 0
    let peak = 0
    const read = environment.CONTENT_SNAPSHOTS.get.getMockImplementation()!
    environment.CONTENT_SNAPSHOTS.get.mockImplementation(async (key) => {
      peak = Math.max(peak, ++open)
      await new Promise((resolve) => setTimeout(resolve, 5))
      open--
      return read(key)
    })
    const snapshots = new RoomContentSnapshots(environment)
    const loaded = await Promise.all([
      snapshots.load(shared, campaignId),
      snapshots.load(shared, campaignId),
      snapshots.load(manifest, campaignId)
    ])
    expect(loaded.map((objects) => objects.length)).toEqual([12, 12, 4])
    expect(loaded[2]).toEqual(loaded[0]!.slice(0, 2).concat(loaded[0]!.slice(10)))
    expect(environment.CONTENT_SNAPSHOTS.get).toHaveBeenCalledTimes(stored.size)
    expect(new Set(environment.CONTENT_SNAPSHOTS.get.mock.calls.map(([key]) => key)).size).toBe(
      stored.size
    )
    expect(peak).toBe(6)
  })

  it('reads a failed object again on the next load instead of keeping the failure', async () => {
    const { environment, manifest, stored } = fixture()
    environment.CONTENT_SNAPSHOTS.get.mockResolvedValueOnce(null)
    const snapshots = new RoomContentSnapshots(environment)
    await expect(snapshots.load(manifest, campaignId)).rejects.toThrow('unavailable')
    expect(await snapshots.load(manifest, campaignId)).toHaveLength(4)
    // Only the failed object is read again; the verified ones are shared.
    expect(environment.CONTENT_SNAPSHOTS.get).toHaveBeenCalledTimes(stored.size + 1)
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
      await expect(
        new RoomContentSnapshots(environment).load(manifest, campaignId)
      ).rejects.toThrow()
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
          part === 'index'
            ? raceIndex(raceDocuments('SOURCE', sourceId))
            : raceDocuments('SOURCE', sourceId)
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
                ? {
                    versions: [...original.versions, ...original.versions],
                    compilations: [...original.compilations, ...original.compilations]
                  }
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
        await expect(
          new RoomContentSnapshots(environment).load(manifest, campaignId)
        ).rejects.toThrow()
      }
    }
  })

  it('rejects BOM-prefixed noncanonical content even with its authoritative matching hash and size', async () => {
    for (const part of ['index', 'documents'] as const) {
      const { manifest, environment, stored } = fixture()
      const ref = manifest.sources[0]!.head!.kinds.RACE![part]
      const original =
        part === 'index'
          ? raceIndex(raceDocuments('SOURCE', sourceId))
          : raceDocuments('SOURCE', sourceId)
      const json = '\ufeff' + canonicalizeJson(original)
      ref.sha256 = createHash('sha256').update(json).digest('hex')
      ref.byteLength = new TextEncoder().encode(json).byteLength
      stored.set(contentSnapshotObjectKey(headerOf(original), ref.sha256), {
        bytes: gzipSync(json),
        gzip: true
      })
      await expect(
        new RoomContentSnapshots(environment).load(manifest, campaignId)
      ).rejects.toThrow()
    }
  })

  it('cancels a stored stream when it exceeds the authoritative byte bound', async () => {
    const { manifest, environment } = fixture()
    const cancel = vi.fn()
    // Only the first object is oversized; the others read in parallel stay within their bounds.
    environment.CONTENT_SNAPSHOTS.get.mockImplementationOnce(async () => ({
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(4096))
        },
        cancel
      }),
      httpEtag: 'oversized',
      httpMetadata: { contentEncoding: 'gzip' }
    }))
    await expect(new RoomContentSnapshots(environment).load(manifest, campaignId)).rejects.toThrow(
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
      expect(
        (await new RoomContentSnapshots(environment).load(state.manifest, campaignId)).length
      ).toBe(4)
      expect(state.environment.CONTENT_SNAPSHOTS.get).not.toHaveBeenCalled()
      const reads = local.methods.length
      await expect(
        new RoomContentSnapshots({
          ...environment,
          CONVEX_SITE_URL: 'https://managed.example'
        }).load(state.manifest, campaignId)
      ).rejects.toThrow('loopback')
      for (const origin of [
        'http://localhost:8026',
        'https://127.0.0.1:8026',
        'http://127.0.0.1',
        'http://192.168.0.1:8026'
      ])
        await expect(
          new RoomContentSnapshots({
            ...environment,
            LOCAL_CONTENT_SNAPSHOT_ORIGIN: origin
          }).load(state.manifest, campaignId)
        ).rejects.toThrow()
      expect(local.methods.length).toBe(reads)
    } finally {
      await local.close()
    }
  })
})
