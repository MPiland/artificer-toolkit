import { defineSchema, defineTable, makeFunctionReference } from 'convex/server'
import { v } from 'convex/values'
import type { TestConvex } from 'convex-test'
import { convexTest } from '../../tests/convexTest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  BeginImportJobInput,
  ImportJobListInput,
  ImportJobListPage,
  ImportJobLookup,
  ImportJobProgressDto,
  ImportPreviewSessionRefDto
} from '@artificer-toolkit/schema/api/importJobs'
import type {
  ImportUploadIntentRequestDto,
  ImportUploadIntentResultDto
} from '@artificer-toolkit/schema/api/imports'
import {
  AUTHORED_CHUNKED_PAYLOAD_MARKER,
  AUTHORED_PAYLOAD_CHUNK_MAX_BYTES
} from '@artificer-toolkit/schema/api/authoredDrafts'
import type { ImportStoredPreviewDescriptor } from '@artificer-toolkit/schema/projections/importJobPersistence'
import { checksumCanonicalRuleDocument } from '@artificer-toolkit/shared/rules/checksum'
import { components } from '../_generated/api'
import authSchema from '../betterAuth/schema'
import { characterTables } from '../characters/schema'
import { buildContentTables } from '../content/schema'
import { encodeUtf8PayloadChunks } from '@artificer-toolkit/shared/jsonPayloadChunks'
import { sceneTables } from '../scenes/schema'
import { importTables } from './schema'
import { loadSourceRef } from './runnerState'

const contentTables = buildContentTables()
const modules = {
  ...Object.fromEntries(
    Object.entries(import.meta.glob('../**/*.*s')).map(([path, load]) => [
      './' + path.slice(3),
      load
    ])
  ),
  './imports/jobs.ts': () => import('./jobs'),
  './imports/jobCleanup.ts': () => import('./jobCleanup'),
  './imports/runnerState.ts': () => import('./runnerState'),
  './imports/uploads.ts': () => import('./uploads')
}
const testSchema = defineSchema({
  userProfiles: defineTable({ userId: v.string(), authUserId: v.string() })
    .index('by_authUserId', ['authUserId'])
    .index('by_userId', ['userId']),
  accountUsageEntries: defineTable({
    resource: v.string(),
    sourceId: v.string(),
    ownerUserId: v.string(),
    importJobId: v.optional(v.string())
  }).index('by_importJobId_sourceId', ['importJobId', 'sourceId']),
  productRows: defineTable({ value: v.string() }),
  authoredImportRefs: contentTables.authoredImportRefs,
  authoredImageSlots: contentTables.authoredImageSlots,
  authoredRoots: contentTables.authoredRoots,
  authoredSourceFacts: contentTables.authoredSourceFacts,
  authoredSpellClasses: contentTables.authoredSpellClasses,
  authoredDrafts: contentTables.authoredDrafts,
  authoredDraftPayloads: contentTables.authoredDraftPayloads,
  authoredDraftPayloadChunks: contentTables.authoredDraftPayloadChunks,
  authoredRouteIds: contentTables.authoredRouteIds,
  authoredRouteSequence: contentTables.authoredRouteSequence,
  authoredVersions: contentTables.authoredVersions,
  authoredVersionPayloadChunks: contentTables.authoredVersionPayloadChunks,
  authoredVersionCompilations: contentTables.authoredVersionCompilations,
  characterDrafts: characterTables.characterDrafts,
  characterDraftPayloads: characterTables.characterDraftPayloads,
  characterDraftPayloadChunks: characterTables.characterDraftPayloadChunks,
  sceneVisionRevisions: sceneTables.sceneVisionRevisions,
  ...importTables
})

const createUpload = makeFunctionReference<
  'mutation',
  ImportUploadIntentRequestDto,
  ImportUploadIntentResultDto
>('imports/uploads:create')

const createPreview = makeFunctionReference<
  'mutation',
  { descriptor: ImportStoredPreviewDescriptor },
  ImportPreviewSessionRefDto
>('imports/uploads:createPreview')
const begin = makeFunctionReference<'mutation', BeginImportJobInput, ImportJobProgressDto>(
  'imports/jobs:begin'
)
const progress = makeFunctionReference<'query', ImportJobLookup, ImportJobProgressDto>(
  'imports/jobs:progress'
)
const list = makeFunctionReference<'query', ImportJobListInput, ImportJobListPage>(
  'imports/jobs:list'
)
const cancel = makeFunctionReference<'mutation', ImportJobLookup, ImportJobProgressDto>(
  'imports/jobs:cancel'
)
const fail = makeFunctionReference<'mutation', { jobId: string; failureReason: string }, null>(
  'imports/jobs:fail'
)
const cleanup = makeFunctionReference<'mutation', { jobId: string }, null>(
  'imports/jobCleanup:cleanup'
)
const cleanupPreview = makeFunctionReference<
  'mutation',
  { previewId: string; expiresAt: number },
  null
>('imports/jobCleanup:cleanupPreview')
const cleanupUpload = makeFunctionReference<
  'mutation',
  { claimId: string; expiresAt: number },
  null
>('imports/uploads:cleanup')

type TestBackend = TestConvex<typeof testSchema>

function backend() {
  const t = convexTest(testSchema, modules)
  t.registerComponent('betterAuth', authSchema, import.meta.glob('../betterAuth/**/*.*s'))
  return t
}

async function actor(t: TestBackend, email: string) {
  const user = await t.run((ctx) =>
    ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: 'user',
        data: {
          name: 'Import owner',
          email,
          emailVerified: true,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      }
    })
  )
  const userId = crypto.randomUUID()
  await t.run((ctx) => ctx.db.insert('userProfiles', { userId, authUserId: user._id }))
  const session = await t.run((ctx) =>
    ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: 'session',
        data: {
          userId: user._id,
          token: crypto.randomUUID(),
          expiresAt: Date.now() + 7 * 24 * 60 * 60_000,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      }
    })
  )
  return {
    userId,
    caller: t.withIdentity({ subject: user._id, sessionId: session._id })
  }
}

async function readyClaim(
  t: TestBackend,
  owner: Awaited<ReturnType<typeof actor>>,
  entryId = 'entry-1',
  name = 'entry.json'
) {
  const intent = await owner.caller.mutation(createUpload, {
    entryId,
    name,
    declaredBytes: 2
  })
  const storageId = await t.run((ctx) =>
    ctx.storage.store(new Blob(['{}'], { type: 'application/json' }))
  )
  await t.run(async (ctx) => {
    const claim = await ctx.db
      .query('importUploadClaims')
      .withIndex('by_claimId', (query) => query.eq('claimId', intent.claimId))
      .unique()
    if (!claim) throw new Error('Missing test upload claim.')
    await ctx.db.patch(claim._id, {
      actualBytes: 2,
      storageId,
      status: 'READY'
    })
  })
  return {
    ref: { claimId: intent.claimId, entryId, name },
    storageId,
    claimExpiresAt: Date.parse(intent.expiresAt)
  }
}

async function preview(t: TestBackend, owner: Awaited<ReturnType<typeof actor>>) {
  const claim = await readyClaim(t, owner)
  const session = await owner.caller.mutation(createPreview, {
    descriptor: { source: 'ARTIFICER_JSON', entries: [claim.ref] }
  })
  return { claim, session }
}

function command(previewId: string, commandId = crypto.randomUUID()): BeginImportJobInput {
  return {
    commandId,
    previewId,
    selectedEntryIds: ['entry-1'],
    resolutions: [],
    customContentChoices: []
  }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('native import jobs', () => {
  it('binds one preview atomically, isolates the owner, and replays only exact commands', async () => {
    const t = backend()
    const owner = await actor(t, 'import-owner@example.invalid')
    const other = await actor(t, 'import-other@example.invalid')
    const firstClaim = await readyClaim(t, owner)
    const secondClaim = await readyClaim(t, owner, 'entry-2', 'second.json')
    const session = await owner.caller.mutation(createPreview, {
      descriptor: {
        source: 'ARTIFICER_JSON',
        entries: [firstClaim.ref, secondClaim.ref]
      }
    })
    const prepared = { claim: firstClaim, session }
    const input = command(prepared.session.previewId)

    const first = await owner.caller.mutation(begin, input)
    expect(first).toMatchObject({
      previewId: prepared.session.previewId,
      status: 'RUNNING',
      phase: 'PLANNING',
      processedEntries: 0,
      totalEntries: 2,
      result: null
    })
    expect(await owner.caller.mutation(begin, input)).toEqual(first)
    const source = await t.query(loadSourceRef, { jobId: first.jobId })
    expect(source).toMatchObject({
      ownerUserId: owner.userId,
      descriptor: { source: 'ARTIFICER_JSON' }
    })
    expect(source.claims.map(({ entryId, name }) => ({ entryId, name }))).toEqual([
      { entryId: 'entry-1', name: 'entry.json' },
      { entryId: 'entry-2', name: 'second.json' }
    ])
    await expect(owner.caller.mutation(begin, { ...input, selectedEntryIds: [] })).rejects.toThrow(
      'different input'
    )
    await expect(other.caller.query(progress, { jobId: first.jobId })).rejects.toThrow('not found')
    await expect(other.caller.mutation(cancel, { jobId: first.jobId })).rejects.toThrow('not found')
    expect(
      await other.caller.query(list, {
        paginationOpts: { cursor: null, numItems: 10 }
      })
    ).toMatchObject({ page: [], isDone: true })
    await expect(
      owner.caller.mutation(createPreview, {
        descriptor: {
          source: 'ARTIFICER_JSON',
          entries: [prepared.claim.ref]
        }
      })
    ).rejects.toThrow('unavailable')

    const stored = await t.run(async (ctx) => ({
      jobs: await ctx.db.query('importJobs').collect(),
      sessions: await ctx.db.query('importPreviewSessions').collect(),
      claims: await ctx.db.query('importUploadClaims').collect()
    }))
    expect(stored.jobs).toHaveLength(1)
    const scheduled = await t.run((ctx) => ctx.db.system.query('_scheduled_functions').collect())
    expect(scheduled.filter((entry) => entry.name === 'imports/runner:run')).toHaveLength(1)
    expect(stored.sessions[0]).toMatchObject({
      status: 'CLAIMED',
      jobId: first.jobId
    })
    expect(stored.claims).toHaveLength(2)
    expect(
      stored.claims.every(
        (claim) =>
          claim.status === 'BOUND' &&
          claim.previewId === prepared.session.previewId &&
          claim.jobId === first.jobId
      )
    ).toBe(true)
  })

  it('rejects deployment-compatible descriptor-less previews as unavailable', async () => {
    const t = backend()
    const owner = await actor(t, 'legacy-preview@example.invalid')
    const previewId = crypto.randomUUID()
    const now = new Date().toISOString()
    await t.run((ctx) =>
      ctx.db.insert('importPreviewSessions', {
        id: previewId,
        ownerUserId: owner.userId,
        source: 'ARTIFICER_JSON',
        entries: [
          {
            claimId: crypto.randomUUID(),
            entryId: 'entry-1',
            name: 'entry.json'
          }
        ],
        status: 'READY',
        jobId: null,
        expiresAt: Date.now() + 60_000,
        createdAt: now,
        updatedAt: now
      })
    )

    await expect(owner.caller.mutation(begin, command(previewId))).rejects.toThrow('unavailable')
    expect(await t.run((ctx) => ctx.db.query('importJobs').collect())).toEqual([])
  })
  it('enforces preview expiry and removes only the expired preview infrastructure', async () => {
    vi.useFakeTimers()
    try {
      const t = backend()
      const owner = await actor(t, 'expired-import@example.invalid')
      const prepared = await preview(t, owner)
      const expiresAt = Date.parse(prepared.session.expiresAt)
      vi.setSystemTime(expiresAt + 1)

      await expect(
        owner.caller.mutation(begin, command(prepared.session.previewId))
      ).rejects.toThrow('unavailable')
      await t.mutation(cleanupPreview, {
        previewId: prepared.session.previewId,
        expiresAt
      })

      expect(await t.run((ctx) => ctx.db.query('importPreviewSessions').collect())).toEqual([])
      expect(await t.run((ctx) => ctx.db.query('importUploadClaims').collect())).toEqual([])
      expect(await t.run((ctx) => ctx.db.system.get(prepared.claim.storageId))).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('fences cancellation and pages job-tagged product cleanup', async () => {
    vi.useFakeTimers()
    try {
      const t = backend()
      const owner = await actor(t, 'cancel-import@example.invalid')
      const prepared = await preview(t, owner)
      const started = await owner.caller.mutation(begin, command(prepared.session.previewId))
      const productId = await t.run((ctx) => ctx.db.insert('productRows', { value: 'keep' }))
      await t.run((ctx) =>
        ctx.db.insert('importJobResults', {
          jobId: started.jobId,
          entryId: 'entry-1',
          sequence: 0,
          resultJson: '{}'
        })
      )
      const taggedSubjectId = crypto.randomUUID()
      const unrelatedSubjectId = crypto.randomUUID()
      const unrelatedJobId = crypto.randomUUID()
      const productState = await t.run(async (ctx) => {
        const insertPayload = async (subjectId: string, importJobId: string) => {
          const id = crypto.randomUUID()
          const systemId = crypto.randomUUID()
          const payloadJson = JSON.stringify({ id: subjectId })
          const chunks = encodeUtf8PayloadChunks(payloadJson, AUTHORED_PAYLOAD_CHUNK_MAX_BYTES)
          await ctx.db.insert('authoredDraftPayloads', {
            id,
            subjectId,
            systemId,
            importJobId,
            payloadJson: AUTHORED_CHUNKED_PAYLOAD_MARKER,
            checksum: checksumCanonicalRuleDocument(payloadJson),
            chunkCount: chunks.length,
            totalByteLength: chunks.reduce((total, chunk) => total + chunk.byteLength, 0)
          })
          for (const [chunkIndex, bytes] of chunks.entries())
            await ctx.db.insert('authoredDraftPayloadChunks', {
              subjectId,
              systemId,
              payloadId: id,
              chunkIndex,
              bytes
            })
          return id
        }
        const taggedPayloadId = await insertPayload(taggedSubjectId, started.jobId)
        const unrelatedPayloadId = await insertPayload(unrelatedSubjectId, unrelatedJobId)
        await ctx.db.insert('authoredRouteSequence', { key: 'authored', lastNumber: 42 })
        await ctx.db.insert('authoredRouteIds', {
          subjectKind: 'SPELL',
          subjectId: taggedSubjectId,
          importJobId: started.jobId,
          routeNumber: 41,
          publicId: 'spells/41'
        })
        await ctx.db.insert('authoredRouteIds', {
          subjectKind: 'SPELL',
          subjectId: unrelatedSubjectId,
          importJobId: unrelatedJobId,
          routeNumber: 42,
          publicId: 'spells/42'
        })
        const taggedChunks = await ctx.db
          .query('authoredDraftPayloadChunks')
          .withIndex('by_subjectId_payloadId_chunkIndex', (query) =>
            query.eq('subjectId', taggedSubjectId).eq('payloadId', taggedPayloadId)
          )
          .collect()
        return { taggedPayloadId, unrelatedPayloadId, unrelatedJobId, taggedChunks }
      })
      expect(productState.taggedChunks.length).toBeGreaterThan(0)

      vi.setSystemTime(Date.parse(prepared.session.expiresAt) + 1)
      await t.mutation(cleanupUpload, {
        claimId: prepared.claim.ref.claimId,
        expiresAt: prepared.claim.claimExpiresAt
      })
      await t.mutation(cleanupPreview, {
        previewId: prepared.session.previewId,
        expiresAt: Date.parse(prepared.session.expiresAt)
      })
      expect(await t.run((ctx) => ctx.db.system.get(prepared.claim.storageId))).not.toBeNull()

      const cancelling = await owner.caller.mutation(cancel, {
        jobId: started.jobId
      })
      expect(cancelling.status).toBe('CLEANING')
      expect(await owner.caller.mutation(cancel, { jobId: started.jobId })).toEqual(cancelling)
      await t.mutation(fail, {
        jobId: started.jobId,
        failureReason: 'stale runner failure'
      })

      for (let page = 0; page < 40; page += 1) await t.mutation(cleanup, { jobId: started.jobId })

      expect(await owner.caller.query(progress, { jobId: started.jobId })).toMatchObject({
        status: 'CANCELLED',
        phase: 'CLEANING',
        result: null
      })
      expect(await t.run((ctx) => ctx.db.query('importUploadClaims').collect())).toEqual([])
      expect(await t.run((ctx) => ctx.db.query('importPreviewSessions').collect())).toEqual([])
      expect(await t.run((ctx) => ctx.db.query('importJobResults').collect())).toEqual([])
      expect(await t.run((ctx) => ctx.db.system.get(prepared.claim.storageId))).toBeNull()
      expect(await t.run((ctx) => ctx.db.get(productId))).toMatchObject({
        value: 'keep'
      })
      const cleanedProducts = await t.run(async (ctx) => ({
        payloads: await ctx.db.query('authoredDraftPayloads').collect(),
        chunks: await ctx.db.query('authoredDraftPayloadChunks').collect(),
        routes: await ctx.db.query('authoredRouteIds').collect(),
        routeSequences: await ctx.db.query('authoredRouteSequence').collect()
      }))
      expect(cleanedProducts.payloads.map((payload) => payload.id)).toEqual([
        productState.unrelatedPayloadId
      ])
      expect(
        cleanedProducts.chunks.every(
          (chunk) =>
            chunk.payloadId === productState.unrelatedPayloadId &&
            chunk.subjectId === unrelatedSubjectId
        )
      ).toBe(true)
      expect(cleanedProducts.routes).toHaveLength(1)
      expect(cleanedProducts.routes[0]).toMatchObject({
        importJobId: productState.unrelatedJobId,
        subjectId: unrelatedSubjectId,
        routeNumber: 42
      })
      expect(cleanedProducts.routeSequences).toHaveLength(1)
      expect(cleanedProducts.routeSequences[0]).toMatchObject({ key: 'authored', lastNumber: 42 })

      const snapshot = await t.run(async (ctx) => ({
        jobs: await ctx.db.query('importJobs').collect(),
        products: await ctx.db.query('productRows').collect(),
        payloads: await ctx.db.query('authoredDraftPayloads').collect(),
        chunks: await ctx.db.query('authoredDraftPayloadChunks').collect(),
        routes: await ctx.db.query('authoredRouteIds').collect(),
        routeSequences: await ctx.db.query('authoredRouteSequence').collect()
      }))
      await t.mutation(cleanup, { jobId: started.jobId })
      await t.mutation(fail, {
        jobId: started.jobId,
        failureReason: 'later stale runner failure'
      })
      expect(
        await t.run(async (ctx) => ({
          jobs: await ctx.db.query('importJobs').collect(),
          products: await ctx.db.query('productRows').collect(),
          payloads: await ctx.db.query('authoredDraftPayloads').collect(),
          chunks: await ctx.db.query('authoredDraftPayloadChunks').collect(),
          routes: await ctx.db.query('authoredRouteIds').collect(),
          routeSequences: await ctx.db.query('authoredRouteSequence').collect()
        }))
      ).toEqual(snapshot)
    } finally {
      vi.useRealTimers()
    }
  })

  it('releases completed source bytes while retaining the completed job and result rows', async () => {
    const t = backend()
    const owner = await actor(t, 'completed-import@example.invalid')
    const prepared = await preview(t, owner)
    const started = await owner.caller.mutation(begin, command(prepared.session.previewId))
    const summary = { created: 1, updated: 0, skipped: 0, failed: 0 }
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query('importJobs')
        .withIndex('by_publicId', (query) => query.eq('id', started.jobId))
        .unique()
      if (!row) throw new Error('Missing import job.')
      await ctx.db.insert('importJobResults', {
        jobId: started.jobId,
        entryId: 'entry-1',
        sequence: 0,
        resultJson: JSON.stringify({
          entryId: 'entry-1',
          name: 'entry.json',
          outcome: 'CREATED',
          issues: []
        })
      })
      await ctx.db.patch(row._id, {
        status: 'COMPLETED',
        phase: 'PUBLISHING',
        processedEntries: 1,
        summary,
        updatedAt: new Date().toISOString()
      })
    })

    await t.mutation(cleanup, { jobId: started.jobId })
    await t.mutation(cleanup, { jobId: started.jobId })
    await t.mutation(cleanup, { jobId: started.jobId })

    expect(await owner.caller.query(progress, { jobId: started.jobId })).toMatchObject({
      status: 'COMPLETED',
      result: { source: 'ARTIFICER_JSON', summary }
    })
    expect(await t.run((ctx) => ctx.db.query('importJobs').collect())).toHaveLength(1)
    expect(await t.run((ctx) => ctx.db.query('importJobResults').collect())).toHaveLength(1)
    expect(await t.run((ctx) => ctx.db.query('importUploadClaims').collect())).toEqual([])
    expect(await t.run((ctx) => ctx.db.query('importPreviewSessions').collect())).toEqual([])
    expect(await t.run((ctx) => ctx.db.system.get(prepared.claim.storageId))).toBeNull()
  })
})
