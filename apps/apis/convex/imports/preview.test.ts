import { defineSchema, defineTable, makeFunctionReference } from 'convex/server'
import { v } from 'convex/values'
import { convexTest, type TestConvex } from 'convex-test'
import { describe, expect, it, vi } from 'vitest'
import type {
  ImportPreviewInput,
  ImportPreviewResult
} from '@artificer-toolkit/schema/api/importJobs'
import {
  IMPORT_MAX_BATCH_BYTES,
  IMPORT_MAX_ENTRY_BYTES,
  ImportUploadIntentRequestDto,
  ImportUploadIntentResultDto
} from '@artificer-toolkit/schema/api/imports'
import { components } from '../_generated/api'
import type { Id } from '../_generated/dataModel'
import authSchema from '../betterAuth/schema'
import { characterTables } from '../characters/schema'
import { contentTables } from '../content/schema'
import { materializeRunnerSource, prepareWithNativeLookup, runnerLookupLoaders } from './preview'
import { loadExactForJobRef, loadMasterPageForJobRef } from './previewLookup'
import type { ImportRunnerSource } from './runnerState'
import { importTables } from './schema'

const modules = {
  ...Object.fromEntries(
    Object.entries(import.meta.glob('../**/*.*s')).map(([path, load]) => [
      './' + path.slice(3),
      load
    ])
  ),
  './imports/preview.ts': () => import('./preview'),
  './imports/previewLookup.ts': () => import('./previewLookup'),
  './imports/uploads.ts': () => import('./uploads')
}
const testSchema = defineSchema({
  userProfiles: defineTable({ userId: v.string(), authUserId: v.string() })
    .index('by_authUserId', ['authUserId'])
    .index('by_userId', ['userId']),
  ...characterTables,
  ...contentTables,
  ...importTables
})

const createUpload = makeFunctionReference<
  'mutation',
  ImportUploadIntentRequestDto,
  ImportUploadIntentResultDto
>('imports/uploads:create')
const createPreview = makeFunctionReference<
  'action',
  { input: ImportPreviewInput },
  ImportPreviewResult
>('imports/preview:create')

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

function portableSpell() {
  return JSON.stringify({
    format: 'artificer-content',
    version: 1,
    item: {
      kind: 'SPELL',
      data: { id: 'spell-1', label: 'Spark', systemId: 'system-1' }
    },
    references: []
  })
}

describe('native import preview action', () => {
  it('binds exact owner claims, returns the existing preview, and creates no product rows', async () => {
    const t = backend()
    const owner = await actor(t, 'preview-owner@example.invalid')
    const foreign = await actor(t, 'preview-foreign@example.invalid')
    const text = portableSpell()
    const actualBytes = new TextEncoder().encode(text).byteLength
    const upload = await owner.mutation(createUpload, {
      entryId: 'spell-entry',
      name: 'spell.json',
      declaredBytes: actualBytes
    })
    const storageId = await t.run((ctx) =>
      ctx.storage.store(new Blob([text], { type: 'application/json' }))
    )
    await t.run(async (ctx) => {
      const claim = await ctx.db
        .query('importUploadClaims')
        .withIndex('by_claimId', (query) => query.eq('claimId', upload.claimId))
        .unique()
      if (!claim) throw new Error('Missing test claim.')
      await ctx.db.patch(claim._id, {
        actualBytes,
        storageId,
        status: 'READY'
      })
    })

    const input = {
      source: 'ARTIFICER_JSON' as const,
      entries: [{ claimId: upload.claimId, entryId: 'spell-entry', name: 'spell.json' }]
    }
    await expect(foreign.action(createPreview, { input })).rejects.toThrow('unavailable')
    const result = await owner.action(createPreview, { input })
    expect(result).toMatchObject({
      source: 'ARTIFICER_JSON',
      summary: { ready: 1, needsReview: 0, unable: 0 },
      items: [
        {
          entryId: 'spell-entry',
          status: 'READY',
          label: 'Spark',
          destination: { kind: 'AUTHORED_DRAFT', subjectKind: 'SPELL' }
        }
      ]
    })

    const stored = await t.run(async (ctx) => ({
      claim: await ctx.db
        .query('importUploadClaims')
        .withIndex('by_claimId', (query) => query.eq('claimId', upload.claimId))
        .unique(),
      preview: await ctx.db
        .query('importPreviewSessions')
        .withIndex('by_publicId', (query) => query.eq('id', result.previewId))
        .unique(),
      characters: await ctx.db.query('characters').take(1),
      characterDrafts: await ctx.db.query('characterDrafts').take(1),
      authoredRoots: await ctx.db.query('authoredRoots').take(1),
      authoredDrafts: await ctx.db.query('authoredDrafts').take(1)
    }))
    expect(stored.claim).toMatchObject({
      ownerUserId: expect.any(String),
      status: 'BOUND',
      previewId: result.previewId,
      actualBytes
    })
    expect(stored.preview).toMatchObject({
      id: result.previewId,
      source: 'ARTIFICER_JSON',
      descriptor: {
        source: 'ARTIFICER_JSON',
        entries: [
          {
            claimId: upload.claimId,
            entryId: 'spell-entry',
            name: 'spell.json'
          }
        ]
      }
    })
    expect(stored.characters).toEqual([])
    expect(stored.characterDrafts).toEqual([])
    expect(stored.authoredRoots).toEqual([])
    expect(stored.authoredDrafts).toEqual([])
  })
})
function storageId(): Id<'_storage'> {
  return crypto.randomUUID() as Id<'_storage'>
}

function storageReader(blobs: ReadonlyMap<Id<'_storage'>, Blob>) {
  return { get: async (id: Id<'_storage'>) => blobs.get(id) ?? null }
}

function runnerSource(
  descriptor: ImportRunnerSource['descriptor'],
  claims: ImportRunnerSource['claims']
): ImportRunnerSource {
  return {
    ownerUserId: crypto.randomUUID(),
    command: {
      commandId: crypto.randomUUID(),
      previewId: crypto.randomUUID(),
      selectedEntryIds: descriptor.entries.map((entry) => entry.entryId),
      resolutions: [],
      customContentChoices: []
    },
    descriptor,
    claims
  }
}

describe('native import runner preparation', () => {
  it('materializes every frozen source and prepares D&D without a network fetch', async ({
    onTestFinished
  }) => {
    const artificerText = portableSpell()
    const foundryText = JSON.stringify({ type: 'Actor', name: 'Hero' })
    const dndText = '{}'
    const artificerStorageId = storageId()
    const foundryStorageId = storageId()
    const dndStorageId = storageId()
    const storage = storageReader(
      new Map([
        [artificerStorageId, new Blob([artificerText])],
        [foundryStorageId, new Blob([foundryText])],
        [dndStorageId, new Blob([dndText])]
      ])
    )
    const systemId = crypto.randomUUID()
    const primaryRulesCatalogueId = crypto.randomUUID()
    const sources: ImportRunnerSource[] = [
      runnerSource(
        {
          source: 'ARTIFICER_JSON',
          entries: [{ claimId: 'artificer-claim', entryId: 'artificer', name: 'spell.json' }]
        },
        [
          {
            claimId: 'artificer-claim',
            entryId: 'artificer',
            name: 'spell.json',
            actualBytes: new TextEncoder().encode(artificerText).byteLength,
            storageId: artificerStorageId
          }
        ]
      ),
      runnerSource(
        {
          source: 'FOUNDRY_DND5E',
          systemId,
          primaryRulesCatalogueId,
          entries: [{ claimId: 'foundry-claim', entryId: 'foundry', name: 'actor.json' }]
        },
        [
          {
            claimId: 'foundry-claim',
            entryId: 'foundry',
            name: 'actor.json',
            actualBytes: new TextEncoder().encode(foundryText).byteLength,
            storageId: foundryStorageId
          }
        ]
      ),
      runnerSource(
        {
          source: 'DND_BEYOND',
          systemId,
          primaryRulesCatalogueId,
          entries: [
            {
              claimId: 'dnd-claim',
              entryId: 'dnd',
              url: 'https://www.dndbeyond.com/characters/123'
            }
          ]
        },
        [
          {
            claimId: 'dnd-claim',
            entryId: 'dnd',
            name: 'dnd-beyond-1.json',
            actualBytes: new TextEncoder().encode(dndText).byteLength,
            storageId: dndStorageId
          }
        ]
      )
    ]

    const [artificer, foundry, dnd] = await Promise.all(
      sources.map((source) => materializeRunnerSource(storage, source))
    )
    expect(artificer.batch).toMatchObject({
      source: 'ARTIFICER_JSON',
      entries: [{ entryId: 'artificer', name: 'spell.json', text: artificerText }]
    })
    expect(foundry.batch).toMatchObject({
      source: 'FOUNDRY_DND5E',
      systemId,
      primaryRulesCatalogueId,
      entries: [{ entryId: 'foundry', name: 'actor.json', text: foundryText }]
    })
    expect(dnd.batch).toEqual({
      source: 'DND_BEYOND',
      systemId,
      primaryRulesCatalogueId,
      entries: [{ entryId: 'dnd', url: 'https://www.dndbeyond.com/characters/123' }]
    })
    await expect(dnd.dependencies.loadFrozenDndBeyondPayload?.('dnd', '123')).resolves.toEqual({
      payload: {},
      utf8ByteLength: 2
    })

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network used'))
    onTestFinished(() => fetchSpy.mockRestore())
    const prepared = await prepareWithNativeLookup(
      {
        loadExact: async () => ({
          ownerUserId: sources[0]!.ownerUserId,
          importReferences: [],
          activeAuthored: [],
          authoredDrafts: [],
          characters: [],
          characterDrafts: []
        }),
        loadMasterPage: async () => ({ page: [], isDone: true, continueCursor: '' })
      },
      dnd.batch,
      sources[0]!.ownerUserId,
      dnd.dependencies
    )
    expect(prepared.items[0]).toMatchObject({ kind: 'UNABLE' })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('refuses missing, changed, oversized, malformed, and invalid UTF-8 frozen sources', async () => {
    const validStorageId = storageId()
    const invalidUtf8StorageId = storageId()
    const missingStorageId = storageId()
    const malformedStorageId = storageId()
    const storage = storageReader(
      new Map([
        [validStorageId, new Blob(['{}'])],
        [invalidUtf8StorageId, new Blob([new Uint8Array([0xc3, 0x28])])],
        [malformedStorageId, new Blob(['{'])]
      ])
    )
    const descriptor = {
      source: 'ARTIFICER_JSON' as const,
      entries: [{ claimId: 'claim', entryId: 'entry', name: 'entry.json' }]
    }
    const claim = {
      claimId: 'claim',
      entryId: 'entry',
      name: 'entry.json',
      actualBytes: 2,
      storageId: validStorageId
    }
    const materialize = (source: ImportRunnerSource) => materializeRunnerSource(storage, source)

    await expect(
      materialize(runnerSource(descriptor, [{ ...claim, storageId: missingStorageId }]))
    ).rejects.toThrow('unavailable')
    await expect(
      materialize(runnerSource(descriptor, [{ ...claim, actualBytes: 3 }]))
    ).rejects.toThrow('unavailable')
    await expect(
      materialize(runnerSource(descriptor, [{ ...claim, storageId: invalidUtf8StorageId }]))
    ).rejects.toThrow('UTF-8')
    await expect(
      materialize(runnerSource(descriptor, [{ ...claim, claimId: 'changed' }]))
    ).rejects.toThrow('unavailable')
    await expect(
      materialize(runnerSource(descriptor, [{ ...claim, actualBytes: IMPORT_MAX_ENTRY_BYTES + 1 }]))
    ).rejects.toThrow('unavailable')

    const totalDescriptor = {
      source: 'ARTIFICER_JSON' as const,
      entries: [0, 1, 2].map((index) => ({
        claimId: `claim-${index}`,
        entryId: `entry-${index}`,
        name: `entry-${index}.json`
      }))
    }
    const totalClaims = totalDescriptor.entries.map((entry) => ({
      ...entry,
      actualBytes: Math.floor(IMPORT_MAX_BATCH_BYTES / 3) + 1,
      storageId: validStorageId
    }))
    await expect(materialize(runnerSource(totalDescriptor, totalClaims))).rejects.toThrow(
      'unavailable'
    )

    await expect(
      materialize(
        runnerSource(
          {
            source: 'DND_BEYOND',
            systemId: crypto.randomUUID(),
            primaryRulesCatalogueId: crypto.randomUUID(),
            entries: [
              {
                claimId: 'claim',
                entryId: 'entry',
                url: 'https://www.dndbeyond.com/characters/123'
              }
            ]
          },
          [{ ...claim, storageId: malformedStorageId, actualBytes: 1 }]
        )
      )
    ).rejects.toThrow('unavailable')
  })

  it('passes collision choices through native preparation and binds lookup calls to the job', async () => {
    const ownerUserId = crypto.randomUUID()
    const jobId = crypto.randomUUID()
    const runQuery = vi
      .fn()
      .mockResolvedValueOnce({
        ownerUserId,
        importReferences: [],
        activeAuthored: [],
        authoredDrafts: [],
        characters: [],
        characterDrafts: []
      })
      .mockResolvedValueOnce({ page: [], isDone: true, continueCursor: 'done' })
    const jobLoaders = runnerLookupLoaders({ runQuery }, jobId)
    await jobLoaders.loadExact([
      { kind: 'ACTIVE_AUTHORED', subjectKind: 'SPELL', subjectId: 'spell-1' }
    ])
    await jobLoaders.loadMasterPage('SPELL', null)
    expect(runQuery).toHaveBeenNthCalledWith(1, loadExactForJobRef, {
      jobId,
      requests: [{ kind: 'ACTIVE_AUTHORED', subjectKind: 'SPELL', subjectId: 'spell-1' }]
    })
    expect(runQuery).toHaveBeenNthCalledWith(2, loadMasterPageForJobRef, {
      jobId,
      subjectKind: 'SPELL',
      paginationOpts: { cursor: null, numItems: 96 }
    })

    const prepared = await prepareWithNativeLookup(
      {
        loadExact: async () => ({
          ownerUserId,
          importReferences: [],
          activeAuthored: [
            {
              subjectKind: 'SPELL',
              subjectId: 'spell-1',
              ownerUserId,
              label: 'Spark',
              isMaster: false
            }
          ],
          authoredDrafts: [{ subjectKind: 'SPELL', subjectId: 'spell-1', label: 'Draft' }],
          characters: [],
          characterDrafts: []
        }),
        loadMasterPage: async () => ({ page: [], isDone: true, continueCursor: '' })
      },
      {
        source: 'ARTIFICER_JSON',
        entries: [{ entryId: 'one', name: 'spell.json', text: portableSpell() }]
      },
      ownerUserId,
      { createId: () => 'generated-id' },
      new Map([['one', { choice: 'UPDATE_DRAFT', confirmDraftReplacement: true }]]),
      new Map()
    )
    expect(prepared.items[0]).toMatchObject({ targetId: 'spell-1' })
  })
})
