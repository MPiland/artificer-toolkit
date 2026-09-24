import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import { acolyte } from '@artificer-toolkit/source-data/srd/backgrounds/acolyte.js'
import { championMartialArchetype } from '@artificer-toolkit/source-data/srd/classes/champion.js'
import { fighter } from '@artificer-toolkit/source-data/srd/classes/fighter.js'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import type {
  AuthoredCataloguePage,
  AuthoredCatalogueSearchBackfillResult,
  AuthoredCatalogueSearchInput
} from '@artificer-toolkit/schema/api/authoredCatalogue'
import { jsonValueSchema } from '@artificer-toolkit/schema/projections/identity'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { api, internal } from '../_generated/api'
import { importedSubject, publicationFixture } from '../../tests/fixtures/publication'

const search = makeFunctionReference<'query', AuthoredCatalogueSearchInput, AuthoredCataloguePage>(
  'content/catalogue:search'
)
const backfill = makeFunctionReference<
  'mutation',
  { paginationOpts: { cursor: string | null; numItems: number } },
  AuthoredCatalogueSearchBackfillResult
>('content/catalogueSearchBackfill:backfill')
const list = makeFunctionReference<
  'query',
  {
    subjectKind: 'BACKGROUND'
    systemId: string
    paginationOpts: { cursor: string | null; numItems: number }
  },
  AuthoredCataloguePage
>('content/catalogue:list')

async function fixture() {
  return publicationFixture(
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
}

async function classFixture() {
  return publicationFixture(
    import.meta.glob('/apps/apis/convex/**/*.*s'),
    import.meta.glob('../betterAuth/**/*.*s'),
    [
      [
        importedSubject({
          subjectKind: 'CLASS',
          ...fighter,
          document: fighter
        }),
        importedSubject({
          subjectKind: 'CLASS',
          ...championMartialArchetype,
          document: championMartialArchetype
        })
      ]
    ]
  )
}

const input = {
  subjectKind: 'BACKGROUND' as const,
  source: 'MASTER' as const,
  query: 'acoly',
  paginationOpts: { cursor: null, numItems: 10 }
}

const classInput = {
  subjectKind: 'CLASS' as const,
  source: 'MASTER' as const,
  query: 'champion',
  paginationOpts: { cursor: null, numItems: 10 }
}

describe('native catalogue search', () => {
  it('uses native prefix search, preserves source privacy, and fails closed before backfill', async () => {
    const { t, first, second } = await fixture()
    await t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', acolyte.id))
        .unique()
      if (!root?.catalogue) throw new Error('Missing catalogue fixture')
      const { search: _search, ...catalogue } = root.catalogue
      await ctx.db.patch(root._id, { catalogue })
    })
    await expect(t.query(search, input)).rejects.toThrow('backfill is incomplete')
    expect(
      (
        await t.query(list, {
          subjectKind: 'BACKGROUND',
          systemId: acolyte.systemId,
          paginationOpts: { cursor: null, numItems: 10 }
        })
      ).page
    ).toHaveLength(1)
    const firstPass = await t.mutation(backfill, {
      paginationOpts: { cursor: null, numItems: 8 }
    })
    expect(firstPass.processed).toBe(1)
    const master = await t.query(search, input)
    expect(master.page.map((row) => row.id)).toEqual([acolyte.id])
    expect(await t.query(search, { ...input, source: 'OWNED' })).toEqual({
      page: [],
      isDone: true,
      continueCursor: ''
    })
    const draft = await first.caller.mutation(api.content.drafts.duplicate, {
      subjectKind: 'BACKGROUND',
      subjectId: acolyte.id
    })
    const owned = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'BACKGROUND',
      subjectId: draft.subjectId,
      systemId: draft.systemId,
      label: 'Acolyte transientcatalogueterm',
      payload: draft.payload
    })
    if (!owned.subjectId || !owned.updatedAt) throw new Error('Missing owned draft identity')
    await first.caller.mutation(api.content.publication.publishDraft, {
      subjectKind: 'BACKGROUND',
      subjectId: owned.subjectId,
      expectedDraftUpdatedAt: owned.updatedAt
    })
    expect(
      (
        await first.caller.query(search, {
          ...input,
          source: 'OWNED',
          query: 'transientcatalogueterm'
        })
      ).page.map((row) => row.id)
    ).toEqual([owned.subjectId])
    expect((await first.caller.query(search, { ...input, source: 'OWNED' })).page).toHaveLength(1)
    expect((await second.caller.query(search, { ...input, source: 'OWNED' })).page).toHaveLength(0)
    const twinDraft = await first.caller.mutation(api.content.drafts.duplicate, {
      subjectKind: 'BACKGROUND',
      subjectId: acolyte.id
    })
    const twin = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'BACKGROUND',
      subjectId: twinDraft.subjectId,
      systemId: twinDraft.systemId,
      label: 'Acolyte twin',
      payload: twinDraft.payload
    })
    if (!twin.subjectId || !twin.updatedAt) throw new Error('Missing twin draft identity')
    await first.caller.mutation(api.content.publication.publishDraft, {
      subjectKind: 'BACKGROUND',
      subjectId: twin.subjectId,
      expectedDraftUpdatedAt: twin.updatedAt
    })
    const foreignDraft = await second.caller.mutation(api.content.drafts.duplicate, {
      subjectKind: 'BACKGROUND',
      subjectId: acolyte.id
    })
    const foreign = await second.caller.mutation(api.content.drafts.save, {
      subjectKind: 'BACKGROUND',
      subjectId: foreignDraft.subjectId,
      systemId: foreignDraft.systemId,
      label: 'Acolyte foreign',
      payload: foreignDraft.payload
    })
    if (!foreign.subjectId || !foreign.updatedAt) throw new Error('Missing foreign draft identity')
    await second.caller.mutation(api.content.publication.publishDraft, {
      subjectKind: 'BACKGROUND',
      subjectId: foreign.subjectId,
      expectedDraftUpdatedAt: foreign.updatedAt
    })
    const ownedIds: string[] = []
    let ownedCursor: string | null = null
    let serialized = ''
    do {
      const page: AuthoredCataloguePage = await first.caller.query(search, {
        ...input,
        source: 'OWNED',
        paginationOpts: { cursor: ownedCursor, numItems: 1 }
      } satisfies AuthoredCatalogueSearchInput)
      ownedIds.push(...page.page.map((row) => row.id))
      serialized += JSON.stringify(page)
      ownedCursor = page.isDone ? null : page.continueCursor
    } while (ownedCursor !== null)
    expect(ownedIds).toEqual(expect.arrayContaining([owned.subjectId, twin.subjectId]))
    expect(ownedIds).toHaveLength(2)
    expect(new Set(ownedIds).size).toBe(2)
    expect(serialized).not.toContain(foreign.subjectId)
    expect(serialized).not.toContain('Acolyte foreign')
    const replacement = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'BACKGROUND',
      subjectId: owned.subjectId,
      systemId: owned.systemId,
      label: 'Renamed homebrew',
      payload: owned.payload
    })
    if (!replacement.subjectId || !replacement.updatedAt)
      throw new Error('Missing replacement draft identity')
    await first.caller.mutation(api.content.publication.publishDraft, {
      subjectKind: 'BACKGROUND',
      subjectId: replacement.subjectId,
      expectedDraftUpdatedAt: replacement.updatedAt
    })
    expect(
      (
        await first.caller.query(search, {
          ...input,
          source: 'OWNED',
          query: 'transientcatalogueterm'
        })
      ).page
    ).toEqual([])
    expect(
      (
        await first.caller.query(search, {
          ...input,
          source: 'OWNED',
          query: 'renam'
        })
      ).page
    ).toHaveLength(1)
  }, 30_000)

  it('uses description-only and category filters with native continuation cursors', async () => {
    const subjects = Array.from({ length: 3 }, (_, index) => {
      const id = `00000000-0000-4000-8000-00000000010${index}`
      const document = {
        ...club,
        id,
        label: `Club ${index}`,
        description: `Description-only catalogue match ${index}`
      }
      return importedSubject({
        subjectKind: 'EQUIPMENT',
        id,
        systemId: club.systemId,
        label: document.label,
        document
      })
    })
    const { t } = await publicationFixture(
      import.meta.glob('/apps/apis/convex/**/*.*s'),
      import.meta.glob('../betterAuth/**/*.*s'),
      [subjects]
    )
    const ids: string[] = []
    let cursor: string | null = null
    do {
      const page: AuthoredCataloguePage = await t.query(search, {
        subjectKind: 'EQUIPMENT',
        source: 'MASTER',
        query: 'description-only',
        category: 'WEAPON',
        paginationOpts: { cursor, numItems: 1 }
      } satisfies AuthoredCatalogueSearchInput)
      ids.push(...page.page.map((row) => row.id))
      cursor = page.isDone ? null : page.continueCursor
    } while (cursor !== null)
    expect(new Set(ids).size).toBe(3)
    expect(ids).toHaveLength(3)
  }, 30_000)

  it('returns a subclass parent UUID and label from the readable BASE Class', async () => {
    const { t } = await classFixture()
    const result = await t.query(search, classInput)
    expect(result.page).toEqual([
      expect.objectContaining({
        id: championMartialArchetype.id,
        parentClassId: fighter.id,
        parentClassLabel: fighter.label
      })
    ])
  })

  it('rejects a subclass whose parent projection is missing', async () => {
    const { t } = await classFixture()
    await t.run(async (ctx) => {
      const subclass = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', championMartialArchetype.id))
        .unique()
      if (!subclass) throw new Error('Missing subclass fixture')
      await ctx.db.patch(subclass._id, { parentClassId: undefined })
    })
    await expect(t.query(search, classInput)).rejects.toThrow('Class parent projection is invalid')
    await expect(
      t.mutation(backfill, { paginationOpts: { cursor: null, numItems: 8 } })
    ).rejects.toThrow('Class parent projection mismatch')
  })

  it('rejects a subclass whose parent projection differs from its authored pointer', async () => {
    const { t } = await classFixture()
    await t.run(async (ctx) => {
      const subclass = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', championMartialArchetype.id))
        .unique()
      if (!subclass) throw new Error('Missing subclass fixture')
      await ctx.db.patch(subclass._id, { parentClassId: crypto.randomUUID() })
    })
    await expect(
      t.mutation(backfill, { paginationOpts: { cursor: null, numItems: 8 } })
    ).rejects.toThrow('Class parent projection mismatch')
  })

  it('rejects a subclass whose projected parent is not a BASE Class', async () => {
    const { t } = await classFixture()
    await t.run(async (ctx) => {
      const base = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', fighter.id))
        .unique()
      if (!base?.catalogue) throw new Error('Missing base Class fixture')
      await ctx.db.patch(base._id, {
        catalogue: { ...base.catalogue, category: 'SUBCLASS' }
      })
    })
    await expect(t.query(search, classInput)).rejects.toThrow('class parent metadata is stale')
  })

  it('rolls back a multi-root backfill and preserves immutable projections on retry', async () => {
    const laterId = '00000000-0000-4000-8000-000000000099'
    const finalId = '00000000-0000-4000-8000-000000000100'
    const ids = [acolyte.id, laterId, finalId]
    expect([...ids].sort()).toEqual(ids)
    const laterDocument = { ...acolyte, id: laterId, label: 'Later acolyte' }
    const finalDocument = { ...acolyte, id: finalId, label: 'Final acolyte' }
    const { t } = await publicationFixture(
      import.meta.glob('/apps/apis/convex/**/*.*s'),
      import.meta.glob('../betterAuth/**/*.*s'),
      [
        [
          importedSubject({
            subjectKind: 'BACKGROUND',
            ...acolyte,
            document: acolyte
          }),
          importedSubject({
            subjectKind: 'BACKGROUND',
            id: laterId,
            systemId: acolyte.systemId,
            label: laterDocument.label,
            document: laterDocument
          }),
          importedSubject({
            subjectKind: 'BACKGROUND',
            id: finalId,
            systemId: acolyte.systemId,
            label: finalDocument.label,
            document: finalDocument
          })
        ]
      ]
    )
    const initial = await t.run(async (ctx) => {
      const roots = await Promise.all(
        ids.map(async (id) => {
          const root = await ctx.db
            .query('authoredRoots')
            .withIndex('by_publicId', (q) => q.eq('id', id))
            .unique()
          if (!root) throw new Error('Missing catalogue fixture')
          return { root, version: await ctx.db.get(root.currentVersionId) }
        })
      )
      const count = await ctx.db
        .query('authoredCatalogueCounts')
        .withIndex('by_source_kind', (q) =>
          q.eq('contentSourceId', roots[0].root.contentSourceId).eq('subjectKind', 'BACKGROUND')
        )
        .unique()
      return { roots, count }
    })
    await t.run(async (ctx) => {
      for (const { root } of initial.roots) {
        if (!root.catalogue) throw new Error('Missing catalogue fixture')
        const { search: _search, ...catalogue } = root.catalogue
        await ctx.db.patch(root._id, { catalogue })
      }
    })
    const stripped = await t.run(async (ctx) =>
      Promise.all(initial.roots.map(({ root }) => ctx.db.get(root._id)))
    )
    for (const [index, root] of stripped.entries()) {
      const initialRoot = initial.roots[index].root
      if (!root?.catalogue || !initialRoot.catalogue) throw new Error('Missing stripped fixture')
      const { search: _initialSearch, ...initialCatalogue } = initialRoot.catalogue
      expect(root.catalogue).toEqual(initialCatalogue)
    }
    await t.run(async (ctx) => {
      const later = await ctx.db.get(initial.roots[1].root._id)
      if (!later?.catalogue) throw new Error('Missing later catalogue fixture')
      await ctx.db.patch(later._id, {
        catalogue: { ...later.catalogue, nameKey: 'corrupt' }
      })
    })
    const beforeFailure = await t.run(async (ctx) =>
      Promise.all(initial.roots.map(({ root }) => ctx.db.get(root._id)))
    )
    await expect(
      t.mutation(backfill, { paginationOpts: { cursor: null, numItems: 8 } })
    ).rejects.toThrow('metadata mismatch')
    expect(
      await t.run(async (ctx) => Promise.all(initial.roots.map(({ root }) => ctx.db.get(root._id))))
    ).toEqual(beforeFailure)
    await t.run(async (ctx) => {
      const later = await ctx.db.get(initial.roots[1].root._id)
      if (!later?.catalogue) throw new Error('Missing later catalogue fixture')
      await ctx.db.patch(later._id, {
        catalogue: {
          ...later.catalogue,
          nameKey: initial.roots[1].root.label.toLowerCase()
        }
      })
    })
    const firstRetry = await t.mutation(backfill, {
      paginationOpts: { cursor: null, numItems: 8 }
    })
    expect(firstRetry).toMatchObject({ processed: 2, isDone: false })
    const finalRetry = await t.mutation(backfill, {
      paginationOpts: { cursor: firstRetry.continueCursor, numItems: 8 }
    })
    expect(finalRetry).toMatchObject({ processed: 1, isDone: true })
    const idempotentFirst = await t.mutation(backfill, {
      paginationOpts: { cursor: null, numItems: 8 }
    })
    expect(idempotentFirst).toMatchObject({ processed: 2, isDone: false })
    const idempotentFinal = await t.mutation(backfill, {
      paginationOpts: { cursor: idempotentFirst.continueCursor, numItems: 8 }
    })
    expect(idempotentFinal).toMatchObject({ processed: 1, isDone: true })
    const recovered = await t.run(async (ctx) => {
      const roots = await Promise.all(
        initial.roots.map(async ({ root }) => ({
          root: await ctx.db.get(root._id),
          version: await ctx.db.get(root.currentVersionId)
        }))
      )
      const count = await ctx.db
        .query('authoredCatalogueCounts')
        .withIndex('by_source_kind', (q) =>
          q
            .eq('contentSourceId', initial.roots[0].root.contentSourceId)
            .eq('subjectKind', 'BACKGROUND')
        )
        .unique()
      return { roots, count }
    })
    expect(recovered.count).toEqual(initial.count)
    for (const [index, restored] of recovered.roots.entries()) {
      const before = initial.roots[index]
      if (!restored.root?.catalogue || !before.root.catalogue)
        throw new Error('Missing restored catalogue fixture')
      expect(restored.root.id).toBe(before.root.id)
      expect(restored.root.checksum).toBe(before.root.checksum)
      expect(restored.root.currentVersionId).toBe(before.root.currentVersionId)
      expect(restored.version).toEqual(before.version)
      const { search: _beforeSearch, ...beforeCatalogue } = before.root.catalogue
      const { search: restoredSearch, ...restoredCatalogue } = restored.root.catalogue
      expect(restoredCatalogue).toEqual(beforeCatalogue)
      expect(restoredSearch).toEqual(before.root.catalogue.search)
    }
  })

  it('rejects a marker-only database write', async () => {
    const { t } = await fixture()
    await expect(
      t.run(async (ctx) => {
        const root = await ctx.db
          .query('authoredRoots')
          .withIndex('by_publicId', (q) => q.eq('id', acolyte.id))
          .unique()
        if (!root?.catalogue) throw new Error('Missing catalogue fixture')
        await ctx.db.patch(root._id, {
          catalogue: {
            ...root.catalogue,
            // @ts-expect-error Convex table validator requires the paired search text.
            search: { version: 1 }
          }
        })
      })
    ).rejects.toThrow()
  })

  it('keeps native search System filtering inside the index', async () => {
    const { t } = await fixture()
    const otherSystemId = '10000000-0000-4000-8000-000000000002'
    const otherSourceId = '20000000-0000-4000-8000-000000000002'
    const otherCatalogueId = '30000000-0000-4000-8000-000000000002'
    const otherSubjectId = '40000000-0000-4000-8000-000000000002'
    const otherSystem = { ...srdSystemRecord, id: otherSystemId }
    const otherDocument = {
      ...acolyte,
      id: otherSubjectId,
      systemId: otherSystemId,
      label: 'Acolyte other System'
    }
    await t.mutation(internal.content.import.bootstrap, {
      systems: [
        {
          id: otherSystemId,
          document: jsonValueSchema.parse(JSON.parse(JSON.stringify(otherSystem))),
          checksum: checksumRuleDocument(otherSystem)
        }
      ],
      contentSource: {
        ...SRD_CONTENT_SOURCE,
        id: otherSourceId,
        gameSystemId: otherSystemId
      },
      catalogue: {
        ...SRD_RULES_CATALOGUE,
        id: otherCatalogueId,
        gameSystemId: otherSystemId
      }
    })
    await t.mutation(internal.content.import.importSubjects, {
      contentSourceId: otherSourceId,
      subjects: [
        importedSubject({
          subjectKind: 'BACKGROUND',
          id: otherSubjectId,
          systemId: otherSystemId,
          label: otherDocument.label,
          document: otherDocument
        })
      ]
    })
    expect((await t.query(search, input)).page).toHaveLength(2)
    expect((await t.query(search, { ...input, systemId: acolyte.systemId })).page).toHaveLength(1)
  })
  it('hides staged native imports from search until their job completes', async () => {
    const { t } = await fixture()
    const jobId = crypto.randomUUID()
    const now = Date.now()
    await t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', acolyte.id))
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
    expect((await t.query(search, input)).page).toEqual([])
    await t.run(async (ctx) => {
      const job = await ctx.db
        .query('importJobs')
        .withIndex('by_publicId', (q) => q.eq('id', jobId))
        .unique()
      if (!job) throw new Error('Missing staged import job')
      await ctx.db.patch(job._id, { status: 'COMPLETED', phase: 'PUBLISHING' })
    })
    expect((await t.query(search, input)).page.map((row) => row.id)).toEqual([acolyte.id])
  })
})
