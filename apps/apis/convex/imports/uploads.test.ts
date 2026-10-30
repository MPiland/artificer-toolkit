import { defineSchema, defineTable, makeFunctionReference } from 'convex/server'
import { v } from 'convex/values'
import type { TestConvex } from 'convex-test'
import { convexTest } from '../../tests/convexTest'
import { describe, expect, it, vi } from 'vitest'
import {
  IMPORT_MAX_ENTRY_BYTES,
  type ImportUploadCompletionRequestDto,
  type ImportUploadCompletionResultDto,
  type ImportUploadIntentRequestDto,
  type ImportUploadIntentResultDto
} from '@artificer-toolkit/schema/api/imports'
import type { ImportPreviewSessionRefDto } from '@artificer-toolkit/schema/api/importJobs'
import type { ImportStoredPreviewDescriptor } from '@artificer-toolkit/schema/projections/importJobPersistence'
import { components } from '../_generated/api'
import type { Id } from '../_generated/dataModel'
import authSchema from '../betterAuth/schema'
import { importTables } from './schema'
import { decideImportUploadMetadata } from './uploads'

const modules = {
  ...Object.fromEntries(
    Object.entries(import.meta.glob('../**/*.*s')).map(([path, load]) => [
      './' + path.slice(3),
      load
    ])
  ),
  './imports/uploads.ts': () => import('./uploads')
}
const testSchema = defineSchema({
  userProfiles: defineTable({ userId: v.string(), authUserId: v.string() })
    .index('by_authUserId', ['authUserId'])
    .index('by_userId', ['userId']),
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
const finalizeUpload = makeFunctionReference<
  'mutation',
  ImportUploadCompletionRequestDto,
  ImportUploadCompletionResultDto
>('imports/uploads:finalize')
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
  await t.run((ctx) =>
    ctx.db.insert('userProfiles', {
      userId: crypto.randomUUID(),
      authUserId: user._id
    })
  )
  const session = await t.run((ctx) =>
    ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: 'session',
        data: {
          userId: user._id,
          token: crypto.randomUUID(),
          expiresAt: Date.now() + 60_000,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      }
    })
  )
  return t.withIdentity({ subject: user._id, sessionId: session._id })
}

async function store(t: TestBackend, text: string): Promise<Id<'_storage'>> {
  return t.run((ctx) => ctx.storage.store(new Blob([text], { type: 'application/json' })))
}

async function bind(t: TestBackend, claimId: string, storageId: Id<'_storage'>) {
  await t.run(async (ctx) => {
    const claim = await ctx.db
      .query('importUploadClaims')
      .withIndex('by_claimId', (query) => query.eq('claimId', claimId))
      .unique()
    if (!claim) throw new Error('Missing test claim.')
    await ctx.db.patch(claim._id, {
      actualBytes: 2,
      storageId,
      status: 'READY'
    })
  })
}

async function stored(t: TestBackend, storageId: Id<'_storage'>) {
  return t.run((ctx) => ctx.db.system.get(storageId))
}

describe('native import upload claims', () => {
  it('accepts exact metadata and replays the owner-bound storage id', async () => {
    expect(decideImportUploadMetadata(2, 2)).toEqual({
      status: 'READY',
      actualBytes: 2
    })
    const t = backend()
    const owner = await actor(t, 'import-owner@example.invalid')
    const claim = await owner.mutation(createUpload, {
      entryId: 'entry-1',
      name: 'entry.json',
      declaredBytes: 2
    })
    const storageId = await store(t, '{}')
    await bind(t, claim.claimId, storageId)

    expect(
      await owner.mutation(finalizeUpload, {
        claimId: claim.claimId,
        storageId
      })
    ).toEqual({
      claimId: claim.claimId,
      status: 'READY'
    })
  })

  it('stores strict source descriptors and derives compatibility entries from claims', async () => {
    const t = backend()
    const owner = await actor(t, 'preview-owner@example.invalid')
    const systemId = crypto.randomUUID()
    const primaryRulesCatalogueId = crypto.randomUUID()
    const longUrl = `https://www.dndbeyond.com/characters/1?${'source='.repeat(50)}`
    const cases = [
      {
        entryId: 'dnd-entry',
        name: 'Fetched hero',
        descriptor: (claimId: string) => ({
          source: 'DND_BEYOND' as const,
          systemId,
          primaryRulesCatalogueId,
          entries: [{ claimId, entryId: 'dnd-entry', url: longUrl }]
        })
      },
      {
        entryId: 'foundry-entry',
        name: 'foundry.json',
        descriptor: (claimId: string) => ({
          source: 'FOUNDRY_DND5E' as const,
          systemId,
          primaryRulesCatalogueId,
          entries: [
            {
              claimId,
              entryId: 'foundry-entry',
              name: 'foundry.json'
            }
          ]
        })
      },
      {
        entryId: 'artificer-entry',
        name: 'artificer.json',
        descriptor: (claimId: string) => ({
          source: 'ARTIFICER_JSON' as const,
          entries: [
            {
              claimId,
              entryId: 'artificer-entry',
              name: 'artificer.json'
            }
          ]
        })
      }
    ]

    for (const testCase of cases) {
      const claim = await owner.mutation(createUpload, {
        entryId: testCase.entryId,
        name: testCase.name,
        declaredBytes: 2
      })
      const storageId = await store(t, '{}')
      await bind(t, claim.claimId, storageId)
      const descriptor = testCase.descriptor(claim.claimId)
      const session = await owner.mutation(createPreview, { descriptor })
      const storedPreview = await t.run((ctx) =>
        ctx.db
          .query('importPreviewSessions')
          .withIndex('by_publicId', (query) => query.eq('id', session.previewId))
          .unique()
      )

      expect(storedPreview).toMatchObject({
        source: descriptor.source,
        descriptor,
        entries: [
          {
            claimId: claim.claimId,
            entryId: testCase.entryId,
            name: testCase.name
          }
        ]
      })
    }

    expect(longUrl.length).toBeGreaterThan(255)
    const mismatched = await owner.mutation(createUpload, {
      entryId: 'mismatched-entry',
      name: 'actual.json',
      declaredBytes: 2
    })
    const mismatchedStorageId = await store(t, '{}')
    await bind(t, mismatched.claimId, mismatchedStorageId)
    await expect(
      owner.mutation(createPreview, {
        descriptor: {
          source: 'ARTIFICER_JSON',
          entries: [
            {
              claimId: mismatched.claimId,
              entryId: 'mismatched-entry',
              name: 'different.json'
            }
          ]
        }
      })
    ).rejects.toThrow('unavailable')
    const unboundClaim = await t.run((ctx) =>
      ctx.db
        .query('importUploadClaims')
        .withIndex('by_claimId', (query) => query.eq('claimId', mismatched.claimId))
        .unique()
    )
    expect(unboundClaim).toMatchObject({ status: 'READY' })
    expect(unboundClaim).not.toHaveProperty('previewId')
  })
  it('refuses a foreign owner without deleting the submitted upload', async () => {
    const t = backend()
    const owner = await actor(t, 'import-owner@example.invalid')
    const other = await actor(t, 'import-other@example.invalid')
    const claim = await owner.mutation(createUpload, {
      entryId: 'entry-1',
      name: 'entry.json',
      declaredBytes: 2
    })
    const storageId = await store(t, '{}')

    await expect(
      other.mutation(finalizeUpload, { claimId: claim.claimId, storageId })
    ).rejects.toThrow('unavailable')
    expect(await stored(t, storageId)).not.toBeNull()
  })

  it('rejects mismatched, empty, missing, and oversized metadata with the right cleanup decision', () => {
    expect(decideImportUploadMetadata(2, 3)).toEqual({
      status: 'REJECTED',
      deleteStorage: true
    })
    expect(decideImportUploadMetadata(2, 0)).toEqual({
      status: 'REJECTED',
      deleteStorage: true
    })
    expect(decideImportUploadMetadata(2, null)).toEqual({
      status: 'REJECTED',
      deleteStorage: false
    })
    expect(decideImportUploadMetadata(2, IMPORT_MAX_ENTRY_BYTES + 1)).toEqual({
      status: 'REJECTED',
      deleteStorage: true
    })
  })

  it('refuses a changed storage replay without deleting another bound claim', async () => {
    const t = backend()
    const owner = await actor(t, 'import-owner@example.invalid')
    const first = await owner.mutation(createUpload, {
      entryId: 'entry-1',
      name: 'entry.json',
      declaredBytes: 2
    })
    const second = await owner.mutation(createUpload, {
      entryId: 'entry-2',
      name: 'second.json',
      declaredBytes: 2
    })
    const firstStorageId = await store(t, '{}')
    const secondStorageId = await store(t, '[]')
    await bind(t, first.claimId, firstStorageId)
    await bind(t, second.claimId, secondStorageId)

    expect(
      await owner.mutation(finalizeUpload, {
        claimId: first.claimId,
        storageId: secondStorageId
      })
    ).toEqual({ claimId: first.claimId, status: 'REJECTED' })
    expect(await stored(t, firstStorageId)).not.toBeNull()
    expect(await stored(t, secondStorageId)).not.toBeNull()
  })

  it('honors the expiry fence and then removes the bound object and claim', async ({
    onTestFinished
  }) => {
    vi.useFakeTimers()
    onTestFinished(() => {
      vi.useRealTimers()
    })
    const t = backend()
    const owner = await actor(t, 'import-owner@example.invalid')
    const claim = await owner.mutation(createUpload, {
      entryId: 'entry-1',
      name: 'entry.json',
      declaredBytes: 2
    })
    const storageId = await store(t, '{}')
    await bind(t, claim.claimId, storageId)
    const expiresAt = Date.parse(claim.expiresAt)

    await t.mutation(cleanupUpload, {
      claimId: claim.claimId,
      expiresAt: expiresAt + 1
    })
    expect(await stored(t, storageId)).not.toBeNull()
    vi.advanceTimersByTime(expiresAt - Date.now())
    await t.finishInProgressScheduledFunctions()

    expect(await stored(t, storageId)).toBeNull()
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('importUploadClaims')
          .withIndex('by_claimId', (query) => query.eq('claimId', claim.claimId))
          .unique()
      )
    ).toBeNull()
  })
})
