import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import { acolyte } from '@artificer-toolkit/source-data/srd/backgrounds/acolyte.js'
import { championMartialArchetype } from '@artificer-toolkit/source-data/srd/classes/champion.js'
import { fighter } from '@artificer-toolkit/source-data/srd/classes/fighter.js'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import type {
  AuthoredCatalogueSummary,
  AuthoredCatalogueSummaryInput
} from '@artificer-toolkit/schema/api/authoredCatalogue'
import { api, internal } from '../_generated/api'
import { importedSubject, publicationFixture } from '../../tests/fixtures/publication'
import { jsonValueSchema } from '@artificer-toolkit/schema/projections/identity'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { compilePublicationDocument, parsePublicationDocument } from './publicationDocument'
import { removeCatalogueMetadata, syncCatalogueMetadata } from './catalogueMetadata'

const summary = makeFunctionReference<
  'query',
  AuthoredCatalogueSummaryInput,
  AuthoredCatalogueSummary
>('content/catalogue:summary')

async function fixture() {
  return publicationFixture(
    import.meta.glob('/apps/apis/convex/**/*.*s'),
    import.meta.glob('../betterAuth/**/*.*s'),
    [[importedSubject({ subjectKind: 'BACKGROUND', ...acolyte, document: acolyte })]]
  )
}

async function classFixture() {
  const result = await publicationFixture(
    import.meta.glob('/apps/apis/convex/**/*.*s'),
    import.meta.glob('../betterAuth/**/*.*s'),
    [
      [
        importedSubject({ subjectKind: 'CLASS', ...fighter, document: fighter }),
        importedSubject({
          subjectKind: 'CLASS',
          ...championMartialArchetype,
          document: championMartialArchetype
        })
      ]
    ]
  )
  for (const subject of [fighter, championMartialArchetype]) {
    const parsed = parsePublicationDocument('CLASS', subject)
    await result.t.mutation(internal.content.import.syncClassDerived, {
      id: subject.id,
      checksum: checksumRuleDocument(subject),
      parentClassId: parsed.document.category === 'SUBCLASS' ? parsed.document.parentClassId : null,
      compilation: compilePublicationDocument(parsed)
    })
  }
  return result
}

describe('native catalogue summary', () => {
  it('returns global master totals to anonymous callers and combines only the current owner', async () => {
    const { t, first, second } = await fixture()
    expect(await t.query(summary, { subjectKind: 'BACKGROUND' })).toEqual({
      activeCount: 1,
      masterCount: 1,
      ownedCount: 0,
      totalCount: 1,
      categories: []
    })
    const firstDraft = await first.caller.mutation(api.content.drafts.duplicate, {
      subjectKind: 'BACKGROUND',
      subjectId: acolyte.id
    })
    const secondDraft = await second.caller.mutation(api.content.drafts.duplicate, {
      subjectKind: 'BACKGROUND',
      subjectId: acolyte.id
    })
    for (const [caller, draft] of [
      [first.caller, firstDraft],
      [second.caller, secondDraft]
    ] as const) {
      if (!draft.updatedAt) throw new Error('Missing draft revision')
      await caller.mutation(api.content.publication.publishDraft, {
        subjectKind: 'BACKGROUND',
        subjectId: draft.subjectId,
        expectedDraftUpdatedAt: draft.updatedAt
      })
    }
    expect(await first.caller.query(summary, { subjectKind: 'BACKGROUND' })).toEqual({
      activeCount: 2,
      masterCount: 1,
      ownedCount: 1,
      totalCount: 2,
      categories: []
    })
    expect(
      await first.caller.query(summary, { subjectKind: 'BACKGROUND', source: 'OWNED' })
    ).toEqual({ activeCount: 2, masterCount: 1, ownedCount: 1, totalCount: 1, categories: [] })
    expect(await t.query(summary, { subjectKind: 'BACKGROUND', source: 'OWNED' })).toEqual({
      activeCount: 1,
      masterCount: 1,
      ownedCount: 0,
      totalCount: 0,
      categories: []
    })
  })

  it('aggregates global master and owner totals across Systems', async () => {
    const { t, first } = await fixture()
    const otherSystemId = '10000000-0000-4000-8000-000000000102'
    const otherSourceId = '20000000-0000-4000-8000-000000000102'
    const otherCatalogueId = '30000000-0000-4000-8000-000000000102'
    const otherSubjectId = '40000000-0000-4000-8000-000000000102'
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
      contentSource: { ...SRD_CONTENT_SOURCE, id: otherSourceId, gameSystemId: otherSystemId },
      catalogue: { ...SRD_RULES_CATALOGUE, id: otherCatalogueId, gameSystemId: otherSystemId }
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
    expect(await t.query(summary, { subjectKind: 'BACKGROUND' })).toEqual({
      activeCount: 2,
      masterCount: 2,
      ownedCount: 0,
      totalCount: 2,
      categories: []
    })
    for (const subjectId of [acolyte.id, otherSubjectId]) {
      const draft = await first.caller.mutation(api.content.drafts.duplicate, {
        subjectKind: 'BACKGROUND',
        subjectId
      })
      if (!draft.updatedAt) throw new Error('Missing draft revision')
      await first.caller.mutation(api.content.publication.publishDraft, {
        subjectKind: 'BACKGROUND',
        subjectId: draft.subjectId,
        expectedDraftUpdatedAt: draft.updatedAt
      })
    }
    expect(await first.caller.query(summary, { subjectKind: 'BACKGROUND' })).toEqual({
      activeCount: 4,
      masterCount: 2,
      ownedCount: 2,
      totalCount: 4,
      categories: []
    })
  })

  it('keeps global counts and facets stable while source and Class category select totals', async () => {
    const { t, first } = await classFixture()
    const master = {
      activeCount: 2,
      masterCount: 2,
      ownedCount: 0,
      totalCount: 2,
      categories: ['BASE', 'SUBCLASS']
    }
    expect(await t.query(summary, { subjectKind: 'CLASS' })).toEqual(master)
    expect(await t.query(summary, { subjectKind: 'CLASS', source: 'OWNED' })).toEqual({
      ...master,
      totalCount: 0
    })
    expect(await t.query(summary, { subjectKind: 'CLASS', category: 'UNKNOWN' })).toEqual({
      ...master,
      totalCount: 0
    })
    const draft = await first.caller.mutation(api.content.drafts.duplicate, {
      subjectKind: 'CLASS',
      subjectId: fighter.id
    })
    if (!draft.updatedAt) throw new Error('Missing draft revision')
    await first.caller.action(api.content.classPublicationActions.publishDraft, {
      subjectKind: 'CLASS',
      subjectId: draft.subjectId,
      expectedDraftUpdatedAt: draft.updatedAt
    })
    const visible = {
      activeCount: 3,
      masterCount: 2,
      ownedCount: 1,
      categories: ['BASE', 'SUBCLASS']
    }
    expect(await first.caller.query(summary, { subjectKind: 'CLASS' })).toEqual({
      ...visible,
      totalCount: 3
    })
    expect(await first.caller.query(summary, { subjectKind: 'CLASS', source: 'MASTER' })).toEqual({
      ...visible,
      totalCount: 2
    })
    expect(await first.caller.query(summary, { subjectKind: 'CLASS', source: 'OWNED' })).toEqual({
      ...visible,
      totalCount: 1
    })
    expect(await first.caller.query(summary, { subjectKind: 'CLASS', category: 'BASE' })).toEqual({
      ...visible,
      totalCount: 2
    })
    expect(
      await first.caller.query(summary, { subjectKind: 'CLASS', category: 'SUBCLASS' })
    ).toEqual({
      ...visible,
      totalCount: 1
    })
    expect(
      await first.caller.query(summary, {
        subjectKind: 'CLASS',
        source: 'OWNED',
        category: 'SUBCLASS'
      })
    ).toEqual({ ...visible, totalCount: 0 })
  })

  it('keeps catalogue metadata counters idempotent and removes their final rows', async () => {
    const { t } = await classFixture()
    await t.run(async (ctx) => {
      const roots = await ctx.db
        .query('authoredRoots')
        .withIndex('by_system_kind_owner_name_id', (q) =>
          q.eq('systemId', fighter.systemId).eq('subjectKind', 'CLASS').eq('ownerUserId', undefined)
        )
        .collect()
      const base = roots.find((root) => root.id === fighter.id)
      if (!base?.catalogue) throw new Error('Missing base Class fixture')
      await syncCatalogueMetadata(ctx, base._id, base.catalogue)
      await syncCatalogueMetadata(ctx, base._id, { ...base.catalogue, category: 'SUBCLASS' })
      const owner = await ctx.db
        .query('authoredCatalogueOwnerCounts')
        .withIndex('by_subjectKind_ownerUserId', (q) =>
          q.eq('subjectKind', 'CLASS').eq('ownerUserId', undefined)
        )
        .unique()
      expect(owner).toMatchObject({
        count: 2,
        categories: [{ category: 'SUBCLASS', count: 2 }]
      })
      for (const root of roots) {
        const current = await ctx.db.get(root._id)
        if (!current) throw new Error('Missing Class root during removal')
        await removeCatalogueMetadata(ctx, current)
        await ctx.db.delete(current._id)
      }
      expect(
        await ctx.db
          .query('authoredCatalogueOwnerCounts')
          .withIndex('by_subjectKind_ownerUserId', (q) =>
            q.eq('subjectKind', 'CLASS').eq('ownerUserId', undefined)
          )
          .unique()
      ).toBeNull()
      expect(
        await ctx.db
          .query('authoredCatalogueCounts')
          .withIndex('by_source_kind', (q) =>
            q.eq('contentSourceId', base.contentSourceId).eq('subjectKind', 'CLASS')
          )
          .unique()
      ).toBeNull()
    })
    expect(await t.query(summary, { subjectKind: 'CLASS' })).toEqual({
      activeCount: 0,
      masterCount: 0,
      ownedCount: 0,
      totalCount: 0,
      categories: []
    })
  })

  it('rolls back late catalogue metadata changes', async () => {
    const { t } = await classFixture()
    const before = await t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', fighter.id))
        .unique()
      if (!root?.catalogue) throw new Error('Missing base Class fixture')
      const owner = await ctx.db
        .query('authoredCatalogueOwnerCounts')
        .withIndex('by_subjectKind_ownerUserId', (q) =>
          q.eq('subjectKind', 'CLASS').eq('ownerUserId', undefined)
        )
        .unique()
      const source = await ctx.db
        .query('authoredCatalogueCounts')
        .withIndex('by_source_kind', (q) =>
          q.eq('contentSourceId', root.contentSourceId).eq('subjectKind', 'CLASS')
        )
        .unique()
      return { root, owner, source }
    })
    await expect(
      t.run(async (ctx) => {
        await syncCatalogueMetadata(ctx, before.root._id, {
          ...before.root.catalogue!,
          category: 'SUBCLASS'
        })
        throw new Error('late transaction failure')
      })
    ).rejects.toThrow('late transaction failure')
    const after = await t.run(async (ctx) => ({
      root: await ctx.db.get(before.root._id),
      owner: await ctx.db.get(before.owner!._id),
      source: await ctx.db.get(before.source!._id)
    }))
    expect(after).toEqual(before)
  })

  it('fails closed for incomplete or missing visible master totals without consulting foreign owners', async () => {
    const { t } = await fixture()
    await t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', acolyte.id))
        .unique()
      if (!root?.catalogue) throw new Error('Missing master fixture')
      await ctx.db.patch(root._id, {
        catalogue: { ...root.catalogue, countsVersion: undefined }
      })
    })
    await expect(t.query(summary, { subjectKind: 'BACKGROUND' })).rejects.toThrow(
      'Catalogue owner totals backfill is incomplete.'
    )

    const isolated = await fixture()
    await isolated.t.run(async (ctx) => {
      const row = await ctx.db
        .query('authoredCatalogueOwnerCounts')
        .withIndex('by_subjectKind_ownerUserId', (q) =>
          q.eq('subjectKind', 'BACKGROUND').eq('ownerUserId', undefined)
        )
        .unique()
      if (!row) throw new Error('Missing master count fixture')
      await ctx.db.delete(row._id)
    })
    await expect(isolated.t.query(summary, { subjectKind: 'BACKGROUND' })).rejects.toThrow(
      'Catalogue owner count is missing.'
    )

    const foreign = await fixture()
    const foreignDraft = await foreign.second.caller.mutation(api.content.drafts.duplicate, {
      subjectKind: 'BACKGROUND',
      subjectId: acolyte.id
    })
    if (!foreignDraft.updatedAt) throw new Error('Missing draft revision')
    await foreign.second.caller.mutation(api.content.publication.publishDraft, {
      subjectKind: 'BACKGROUND',
      subjectId: foreignDraft.subjectId,
      expectedDraftUpdatedAt: foreignDraft.updatedAt
    })
    await foreign.t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', foreignDraft.subjectId))
        .unique()
      if (!root?.catalogue) throw new Error('Missing foreign fixture')
      await ctx.db.patch(root._id, { catalogue: { ...root.catalogue, countsVersion: undefined } })
    })
    expect(await foreign.first.caller.query(summary, { subjectKind: 'BACKGROUND' })).toEqual({
      activeCount: 1,
      masterCount: 1,
      ownedCount: 0,
      totalCount: 1,
      categories: []
    })
  })

  it.each([
    [
      [
        { category: 'B', count: 1 },
        { category: 'A', count: 1 }
      ]
    ],
    [[{ category: 'A', count: 2 }]],
    [
      [
        { category: 'A', count: 2 },
        { category: 'B', count: 2 }
      ]
    ]
  ])('fails closed for malformed visible owner categories', async (categories) => {
    const { t } = await fixture()
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query('authoredCatalogueOwnerCounts')
        .withIndex('by_subjectKind_ownerUserId', (q) =>
          q.eq('subjectKind', 'BACKGROUND').eq('ownerUserId', undefined)
        )
        .unique()
      if (!row) throw new Error('Missing master count fixture')
      await ctx.db.patch(row._id, { categories })
    })
    await expect(t.query(summary, { subjectKind: 'BACKGROUND' })).rejects.toThrow(
      'Catalogue owner count integrity mismatch.'
    )
  })

  it('fails closed when category totals exceed the visible owner total', async () => {
    const { t } = await fixture()
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query('authoredCatalogueOwnerCounts')
        .withIndex('by_subjectKind_ownerUserId', (q) =>
          q.eq('subjectKind', 'BACKGROUND').eq('ownerUserId', undefined)
        )
        .unique()
      if (!row) throw new Error('Missing master count fixture')
      await ctx.db.patch(row._id, {
        count: 3,
        categories: [
          { category: 'A', count: 2 },
          { category: 'B', count: 2 }
        ]
      })
    })
    await expect(t.query(summary, { subjectKind: 'BACKGROUND' })).rejects.toThrow(
      'Catalogue owner count integrity mismatch.'
    )
  })

  it('rejects unsupported Background category filtering', async () => {
    const { t } = await fixture()
    await expect(t.query(summary, { subjectKind: 'BACKGROUND', category: 'BASE' })).rejects.toThrow(
      'Catalogue category filtering is not supported for this subject kind.'
    )
  })
})
