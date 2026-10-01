import { afterEach, expect, it, vi } from 'vitest'
import { gzipSync } from 'node:zlib'
import {
  contentSnapshotObjectKey,
  type ContentSnapshotHead,
  type ContentSnapshotHeader,
  type ContentSnapshotManifestDto
} from '@artificer-toolkit/schema/api/contentSnapshots'
import type { LiveRoomInputsScope } from '@artificer-toolkit/schema/api/liveRoomInputs'
import { canonicalizeJson } from '@artificer-toolkit/shared/canonicalJson'
import { sha256Hex } from '@artificer-toolkit/shared/sha256'
import { acolyte } from '@artificer-toolkit/source-data/srd/backgrounds/acolyte.js'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { human } from '@artificer-toolkit/source-data/srd/races/human.js'
import { liveSessionCharacterRulesInputSchema } from '@artificer-toolkit/schema/api/liveSessionCharacterRules'
import {
  prepareNativeLiveCharacterSheet,
  prepareLiveCharacterSheetFacts
} from '../../../session-worker/src/nativeCharacterRules'
import { prepareRoomLiveCharacterSheet } from '../../../session-worker/src/roomCharacterRules'
import { loadRoomContentSnapshots } from '../../../session-worker/src/roomContentSnapshots'
import { RoomInputs } from '../../../session-worker/src/roomInputs'
import { RoomEncounterStore } from '../../../session-worker/src/roomEncounterStore'
import { createNodeSqliteRoomStorage } from '../../../session-worker/src/testing/nodeSqliteRoomStorage'
import type { ContentSnapshotObjectBody } from '../../../session-worker/src/contentSnapshotStorage'
import { setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import { readScopeObjects } from '../../tests/fixtures/contentSnapshotReaders'
import { makePublishedRootOwned } from '../../tests/fixtures/publication'
import { api, internal } from '../_generated/api'
import { loadCharacterSheetFacts } from '../characters/sheetFacts'
import { readCharacterRulesCapture } from './characterRulesCapture'
import { withSceneVisionTracking } from '../lib/mutations'
import {
  insertActiveLiveAuthority,
  stubLiveSessionFetch,
  workerEnvironment
} from '../../tests/fixtures/liveSessionWorker'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

it('prepares capture-equivalent facts from verified v2 snapshots and warmed SQLite room inputs', async () => {
  const fixture = await setupCharacterRun()
  await fixture.t.run((ctx) => makePublishedRootOwned(ctx, acolyte.id, fixture.player.userId))
  await fixture.t.run((ctx) => makePublishedRootOwned(ctx, human.id, fixture.owner.userId))
  await fixture.owner.caller.mutation(api.campaigns.contentShares.share, {
    campaignId: fixture.campaign.id,
    subjectKind: 'RACE',
    subjectId: human.id
  })
  const epoch = crypto.randomUUID()
  await fixture.t.run((ctx) =>
    insertActiveLiveAuthority(ctx, {
      campaignId: fixture.campaign.id,
      epoch,
      createdAt: fixture.campaign.createdAt
    })
  )
  const scopes = await fixture.t.run(async (ctx) => {
    const sources = await ctx.db
      .query('contentSources')
      .withIndex('by_gameSystemId', (q) => q.eq('gameSystemId', fixture.campaign.gameSystemId))
      .collect()
    return [
      ...sources.map((source) => ({ scope: 'SOURCE' as const, scopeId: source.id })),
      { scope: 'CAMPAIGN' as const, scopeId: fixture.campaign.id }
    ]
  })
  const objects = new Map<string, Uint8Array>()
  for (const scope of scopes) {
    const kinds: ContentSnapshotHead['kinds'] = {}
    for (const object of await readScopeObjects(fixture.t, scope)) {
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
    await fixture.t.run(async (ctx) => {
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
  const get = vi.fn(async (key: string): Promise<ContentSnapshotObjectBody | null> => {
    const bytes = objects.get(key)
    return bytes
      ? {
          body: new Blob([new Uint8Array(bytes).buffer]).stream(),
          httpEtag: 'private-fixture',
          customMetadata: {},
          httpMetadata: { contentType: 'application/json', contentEncoding: 'gzip' }
        }
      : null
  })
  const environment = { CONTENT_SNAPSHOTS: { get }, CONVEX_SITE_URL: 'http://127.0.0.1:3211' }
  const read = vi.fn((authorityEpoch: string, scope: LiveRoomInputsScope) =>
    fixture.t.query(internal.liveSessions.roomInputs.read, {
      campaignId: fixture.campaign.id,
      epoch: authorityEpoch,
      scope
    })
  )
  const load = vi.fn((manifest: ContentSnapshotManifestDto) =>
    loadRoomContentSnapshots(environment, manifest, fixture.campaign.id)
  )
  const { storage, database } = createNodeSqliteRoomStorage()
  try {
    const store = new RoomEncounterStore(storage)
    const room = new RoomInputs(store, read, load)
    await room.hydrate({ epoch, encounterId: fixture.run.id })
    const scope = {
      campaignId: fixture.campaign.id,
      authorityEpoch: epoch,
      expectedUserId: fixture.owner.userId,
      expectedRole: 'OWNER' as const,
      characterId: fixture.character.id
    }
    const captured = await fixture.owner.caller.run((ctx) =>
      readCharacterRulesCapture(ctx, {
        ...scope,
        request: { kind: 'INPUTS' }
      })
    )
    let expected: Awaited<ReturnType<typeof prepareLiveCharacterSheetFacts>> | undefined
    await fixture.owner.caller.run(async (ctx) => {
      expected = await prepareLiveCharacterSheetFacts(
        { ...scope, request: { kind: 'INPUTS' } },
        (request) => readCharacterRulesCapture(ctx, { ...scope, request })
      )
    })
    if (!expected) throw new Error('Missing expected Character facts.')
    const privatePin = expected.sourceIdentities.find(
      (identity) => identity.subjectId === acolyte.id
    )
    if (!privatePin) throw new Error('Missing private Background publication.')
    expect(privatePin.contentSourceId).not.toBe(SRD_CONTENT_SOURCE.id)
    expect(
      expected.sourceVersions.every(
        (source) => Number.isInteger(source.version) && source.version > 0
      )
    ).toBe(true)
    const reads = read.mock.calls.length
    const loads = load.mock.calls.length
    const objectReads = get.mock.calls.length
    const captureHttp = vi.fn(() => {
      throw new Error('Warm room preparation attempted HTTP capture.')
    })
    vi.stubGlobal('fetch', captureHttp)
    await expect(
      prepareRoomLiveCharacterSheet(
        store,
        room,
        { ...scope, authorityEpoch: crypto.randomUUID() },
        captured.revisions
      )
    ).rejects.toThrow(/epoch/i)
    for (let repetition = 0; repetition < 3; repetition++) {
      const actual = await prepareRoomLiveCharacterSheet(store, room, scope, captured.revisions)
      expect(actual.prepared.character).toEqual(expected.prepared.character)
      expect(actual.prepared.resolution).toEqual(expected.prepared.resolution)
      expect(actual.ruleEvaluation).toEqual(expected.ruleEvaluation)
      expect(actual.adjustments).toEqual(expected.adjustments)
      expect(actual.sheetState).toEqual(expected.sheetState)
      expect(actual.sourceIdentities).toEqual(expected.sourceIdentities)
      expect(actual.sourceVersions).toEqual(expected.sourceVersions)
    }
    expect(read.mock.calls.length).toBe(reads)
    expect(load.mock.calls.length).toBe(loads)
    expect(get.mock.calls.length).toBe(objectReads)
    expect(captureHttp).not.toHaveBeenCalled()

    await fixture.t.run(async (rawCtx) => {
      const ctx = withSceneVisionTracking(rawCtx)
      const source = await ctx.db
        .query('contentSources')
        .withIndex('by_publicId', (q) => q.eq('id', privatePin.contentSourceId))
        .unique()
      const campaign = await ctx.db
        .query('campaigns')
        .withIndex('by_publicId', (q) => q.eq('id', fixture.campaign.id))
        .unique()
      if (!source || !campaign) throw new Error('Missing source invalidation fixture.')
      await ctx.db.delete(source._id)
      await ctx.db.patch(campaign._id, { attunementSlotOverride: 4 })
    })
    const fresh = await read(epoch, {
      kind: 'CHARACTERS',
      characterIds: [fixture.character.id],
      cursor: null
    })
    if (fresh.kind !== 'CHARACTERS' || fresh.parts[0]?.status !== 'ASSIGNED')
      throw new Error('Missing fresh Character input.')
    const reloaded = await room.contentObjects(fixture.character.id, fresh.parts[0].revisions)
    expect(
      reloaded.some(
        (object) => object.scope === 'SOURCE' && object.scopeId === privatePin.contentSourceId
      )
    ).toBe(false)
    expect(reloaded.some((object) => object.roots.some((root) => root.id === acolyte.id))).toBe(
      false
    )
    expect(load.mock.calls.length).toBeGreaterThan(loads)
  } finally {
    database.close()
  }
})

it('prepares the same Character facts in the Worker through authenticated capture HTTP', async () => {
  const fixture = await setupCharacterRun()
  const authorityEpoch = crypto.randomUUID()
  await fixture.t.run((ctx) =>
    insertActiveLiveAuthority(ctx, {
      campaignId: fixture.campaign.id,
      epoch: authorityEpoch,
      createdAt: fixture.campaign.createdAt
    })
  )
  const scope = {
    campaignId: fixture.campaign.id,
    authorityEpoch,
    expectedUserId: fixture.owner.userId,
    expectedRole: 'OWNER' as const,
    characterId: fixture.character.id
  }
  const secret = 'private-character-rules-test-secret-at-least-32-bytes'
  vi.stubEnv('LIVE_SESSION_WORKER_SECRET', secret)
  const path = '/live-sessions/character-rules'
  const input = { ...scope, request: { kind: 'INPUTS' } }
  const request = { body: JSON.stringify(input), method: 'POST' }
  const missingSecret = await fixture.owner.caller.fetch(path, request)
  expect(missingSecret.status).toBe(401)
  const missingIdentity = await fixture.t.fetch(path, {
    ...request,
    headers: { 'x-artificer-live-session-secret': secret }
  })
  expect(missingIdentity.status).toBe(401)
  expect(missingIdentity.headers.get('Cache-Control')).toBe('no-store')

  const requests: ReturnType<typeof liveSessionCharacterRulesInputSchema.parse>[] = []
  stubLiveSessionFetch(async (pathname, init) => {
    expect(pathname).toBe(path)
    const headers = new Headers(init?.headers)
    expect(headers.get('authorization')).toBe('Bearer fixture-access-token')
    expect(headers.get('x-artificer-live-session-secret')).toBe(secret)
    if (typeof init?.body !== 'string') throw new Error('Missing capture body.')
    requests.push(liveSessionCharacterRulesInputSchema.parse(JSON.parse(init.body)))
    return fixture.owner.caller.fetch(pathname, init)
  })
  const actual = await prepareNativeLiveCharacterSheet(
    workerEnvironment(secret),
    'fixture-access-token',
    scope
  )
  expect(actual.campaignContext.viewer).toBe('CAMPAIGN_OWNER')
  expect(requests.map((read) => read.request.kind)).toEqual(['INPUTS', 'PUBLICATIONS'])
  expect(actual.dependencies.map((dependency) => dependency.request)).toEqual(
    requests.map((read) => read.request)
  )
  await fixture.owner.caller.run(async (ctx) => {
    const expected = await loadCharacterSheetFacts(
      ctx,
      fixture.owner.userId,
      fixture.character.id,
      fixture.campaign.id
    )
    if (!expected) throw new Error('Missing Character facts.')
    expect(actual.prepared.character).toEqual(expected.prepared.character)
    expect(actual.prepared.resolution).toEqual(expected.prepared.resolution)
    expect(actual.ruleEvaluation).toEqual(expected.ruleEvaluation)
    expect(actual.adjustments).toEqual(expected.adjustments)
    expect(actual.sheetState).toEqual(expected.sheetState)
    for (const dependency of actual.dependencies) {
      const current = await readCharacterRulesCapture(ctx, {
        ...scope,
        request: dependency.request
      })
      expect(current.readChecksum).toBe(dependency.readChecksum)
    }
  })

  // A later source page must not combine a changed Campaign with the old Sheet inputs.
  stubLiveSessionFetch(async (pathname, init) => {
    const response = await fixture.owner.caller.fetch(pathname, init)
    if (typeof init?.body !== 'string') throw new Error('Missing capture body.')
    const input = liveSessionCharacterRulesInputSchema.parse(JSON.parse(init.body))
    if (input.request.kind === 'INPUTS') {
      await fixture.t.run(async (rawCtx) => {
        const ctx = withSceneVisionTracking(rawCtx)
        const row = await ctx.db
          .query('campaigns')
          .withIndex('by_publicId', (q) => q.eq('id', fixture.campaign.id))
          .unique()
        if (!row) throw new Error('Missing Campaign.')
        await ctx.db.patch(row._id, { attunementSlotOverride: 4 })
      })
    }
    return response
  })
  await expect(
    prepareNativeLiveCharacterSheet(workerEnvironment(secret), 'fixture-access-token', scope)
  ).rejects.toThrow(/revision|changed/i)
})
