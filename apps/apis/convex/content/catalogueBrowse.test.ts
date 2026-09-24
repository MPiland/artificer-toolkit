import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import { acolyte } from '@artificer-toolkit/source-data/srd/backgrounds/acolyte.js'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import type {
  AuthoredCataloguePage,
  AuthoredCatalogueReadInput
} from '@artificer-toolkit/schema/api/authoredCatalogue'
import { jsonValueSchema } from '@artificer-toolkit/schema/projections/identity'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { api, internal } from '../_generated/api'
import { importedSubject, publicationFixture } from '../../tests/fixtures/publication'

const list = makeFunctionReference<'query', AuthoredCatalogueReadInput, AuthoredCataloguePage>(
  'content/catalogue:list'
)
const otherSystemId = '10000000-0000-4000-8000-000000000102'
const otherSourceId = '20000000-0000-4000-8000-000000000102'
const otherSubjectId = '40000000-0000-4000-8000-000000000102'
const input = {
  subjectKind: 'BACKGROUND',
  paginationOpts: { cursor: null, numItems: 48 }
} satisfies AuthoredCatalogueReadInput

async function fixture() {
  const result = await publicationFixture(
    import.meta.glob('/apps/apis/convex/**/*.*s'),
    import.meta.glob('../betterAuth/**/*.*s'),
    [
      [
        importedSubject({
          subjectKind: 'BACKGROUND',
          ...acolyte,
          document: acolyte
        })
      ]
    ]
  )
  const system = { ...srdSystemRecord, id: otherSystemId }
  await result.t.mutation(internal.content.import.bootstrap, {
    systems: [
      {
        id: otherSystemId,
        document: jsonValueSchema.parse(JSON.parse(JSON.stringify(system))),
        checksum: checksumRuleDocument(system)
      }
    ],
    contentSource: {
      ...SRD_CONTENT_SOURCE,
      id: otherSourceId,
      gameSystemId: otherSystemId
    },
    catalogue: {
      ...SRD_RULES_CATALOGUE,
      id: '30000000-0000-4000-8000-000000000102',
      gameSystemId: otherSystemId
    }
  })
  await result.t.mutation(internal.content.import.importSubjects, {
    contentSourceId: otherSourceId,
    subjects: [
      { ...acolyte, id: otherSubjectId, systemId: otherSystemId },
      {
        ...acolyte,
        id: '40000000-0000-4000-8000-000000000103',
        systemId: otherSystemId,
        label: 'Zephyr'
      }
    ].map((document) => importedSubject({ subjectKind: 'BACKGROUND', ...document, document }))
  })
  return result
}

describe('native cross-System catalogue browse', () => {
  it('orders all visible Systems by name and UUID with replayable bounded pages', async () => {
    const { t } = await fixture()
    const all = await t.query(list, input)
    expect(all.page.map((row) => row.label)).toEqual(['Acolyte', 'Acolyte', 'Zephyr'])
    expect(all.page.slice(0, 2).map((row) => row.id)).toEqual([acolyte.id, otherSubjectId].sort())
    const ids: string[] = []
    let cursor: string | null = null
    let done = false
    for (let pageNumber = 0; pageNumber < 6 && !done; pageNumber++) {
      const request: AuthoredCatalogueReadInput = {
        ...input,
        paginationOpts: { cursor, numItems: 1 }
      }
      const page = await t.query(list, request)
      expect(await t.query(list, request)).toEqual(page)
      expect(page.page.length).toBeLessThanOrEqual(1)
      ids.push(...page.page.map((row) => row.id))
      cursor = page.continueCursor
      done = page.isDone
    }
    expect(done).toBe(true)
    expect(ids).toEqual(all.page.map((row) => row.id))
    expect(
      (await t.query(list, { ...input, systemId: acolyte.systemId })).page.map((row) => row.id)
    ).toEqual([acolyte.id])
    expect((await t.query(list, { ...input, systemId: otherSystemId })).page).toHaveLength(2)
  })

  it('selects owner visibility before pagination and keeps anonymous OWNED reads empty', async () => {
    const { t, first, second } = await fixture()
    const ownedIds: string[] = []
    let foreignId = ''
    for (const [actor, subjectId] of [
      [first, acolyte.id],
      [first, otherSubjectId],
      [second, otherSubjectId]
    ] as const) {
      const draft = await actor.caller.mutation(api.content.drafts.duplicate, {
        subjectKind: 'BACKGROUND',
        subjectId
      })
      if (!draft.updatedAt) throw new Error('Missing draft revision')
      await actor.caller.mutation(api.content.publication.publishDraft, {
        subjectKind: 'BACKGROUND',
        subjectId: draft.subjectId,
        expectedDraftUpdatedAt: draft.updatedAt
      })
      if (actor === first) ownedIds.push(draft.subjectId)
      else foreignId = draft.subjectId
    }
    const owned = await first.caller.query(list, { ...input, source: 'OWNED' })
    expect(owned.page.map((row) => row.id).sort()).toEqual(ownedIds.sort())
    expect(new Set(owned.page.map((row) => row.systemId)).size).toBe(2)
    const visible = await first.caller.query(list, input)
    expect(visible.page).toHaveLength(5)
    expect(JSON.stringify(visible)).not.toContain(foreignId)
    expect((await first.caller.query(list, { ...input, source: 'MASTER' })).page).toHaveLength(3)
    expect((await t.query(list, input)).page).toHaveLength(3)
    expect(await t.query(list, { ...input, source: 'OWNED' })).toEqual({
      page: [],
      isDone: true,
      continueCursor: ''
    })

    const foreignPage = await second.caller.query(list, {
      ...input,
      source: 'OWNED',
      paginationOpts: { cursor: null, numItems: 1 }
    })
    // A cursor from another owner may be rejected or yield no rows, never widen access.
    const borrowed = await first.caller
      .query(list, {
        ...input,
        source: 'OWNED',
        paginationOpts: { cursor: foreignPage.continueCursor, numItems: 1 }
      })
      .then(
        (page) => page.page,
        () => []
      )
    expect(borrowed.every((row) => ownedIds.includes(row.id))).toBe(true)

    await t.run(async (ctx) => {
      const foreign = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', foreignId))
        .unique()
      if (!foreign) throw new Error('Missing foreign fixture')
      await ctx.db.patch(foreign._id, { catalogue: undefined })
    })
    expect((await first.caller.query(list, input)).page).toHaveLength(5)
    await expect(second.caller.query(list, input)).rejects.toThrow('backfill is incomplete')
  })

  it('rejects an incomplete global catalogue without breaking a complete exact-System scope', async () => {
    const { t } = await fixture()
    await t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', otherSubjectId))
        .unique()
      if (!root) throw new Error('Missing other-System fixture')
      await ctx.db.patch(root._id, { catalogue: undefined })
    })
    await expect(t.query(list, input)).rejects.toThrow('backfill is incomplete')
    expect((await t.query(list, { ...input, systemId: acolyte.systemId })).page).toHaveLength(1)
  })
  it('hides staged imports across bounded list continuations until completion', async () => {
    const { t } = await fixture()
    const jobId = crypto.randomUUID()
    const now = Date.now()
    await t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', otherSubjectId))
        .unique()
      if (!root) throw new Error('Missing staged root')
      await ctx.db.insert('importJobs', {
        id: jobId,
        ownerUserId: crypto.randomUUID(),
        previewId: crypto.randomUUID(),
        command: {
          commandId: crypto.randomUUID(),
          previewId: crypto.randomUUID(),
          selectedEntryIds: ['entry-1'],
          resolutions: [],
          customContentChoices: []
        },
        inputFingerprint: '0'.repeat(64),
        source: 'ARTIFICER_JSON',
        status: 'RUNNING',
        terminalStatus: null,
        phase: 'STAGING',
        entryIndex: 0,
        cursor: null,
        processedEntries: 0,
        totalEntries: 1,
        expectedStageCount: 0,
        stagedStageCount: 0,
        failureReason: null,
        summary: null,
        cleanupTableIndex: 0,
        cleanupCursor: null,
        expiresAt: Date.now() + 60_000,
        createdAt: new Date(now).toISOString(),
        updatedAt: new Date(now).toISOString()
      })
      await ctx.db.patch(root._id, { importJobId: jobId })
    })
    const ids: string[] = []
    let cursor: string | null = null
    let done = false
    for (let pageNumber = 0; pageNumber < 4 && !done; pageNumber++) {
      const page: AuthoredCataloguePage = await t.query(list, {
        ...input,
        paginationOpts: { cursor, numItems: 1 }
      })
      ids.push(...page.page.map((row) => row.id))
      cursor = page.continueCursor
      done = page.isDone
    }
    expect(done).toBe(true)
    expect(ids).toEqual([acolyte.id, '40000000-0000-4000-8000-000000000103'])
    await t.run(async (ctx) => {
      const job = await ctx.db
        .query('importJobs')
        .withIndex('by_publicId', (q) => q.eq('id', jobId))
        .unique()
      if (!job) throw new Error('Missing staged import job')
      await ctx.db.patch(job._id, { status: 'COMPLETED', phase: 'PUBLISHING' })
    })
    expect((await t.query(list, input)).page.map((row) => row.id)).toContain(otherSubjectId)
  })
})
