import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import { fighter } from '@artificer-toolkit/source-data/srd/classes/fighter.js'
import { championMartialArchetype } from '@artificer-toolkit/source-data/srd/classes/champion.js'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { authoredPublishDraftInputSchema } from '@artificer-toolkit/schema/api/authoredPublication'
import type {
  AuthoredCataloguePage,
  AuthoredCatalogueReadInput,
  AuthoredCatalogueSearchBackfillResult
} from '@artificer-toolkit/schema/api/authoredCatalogue'
import { api, internal } from '../_generated/api'
import { importedSubject, publicationFixture } from '../../tests/fixtures/publication'
import { compilePublicationDocument, parsePublicationDocument } from './publicationDocument'

const ids = Array.from(
  { length: 6 },
  (_, index) => `40000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`
)
const parents = [
  { ...fighter, id: ids[0]!, label: 'Shared' },
  { ...fighter, id: ids[1]!, label: 'Shared' },
  { ...fighter, id: ids[2]!, label: 'Alpha' }
]
const children = [
  { ...championMartialArchetype, id: ids[3]!, label: 'Zulu', parentClassId: ids[0]! },
  { ...championMartialArchetype, id: ids[4]!, label: 'Alpha', parentClassId: ids[1]! },
  { ...championMartialArchetype, id: ids[5]!, label: 'Bravo', parentClassId: ids[0]! }
]
const subjects = [...parents, ...children].map((document) =>
  importedSubject({ subjectKind: 'CLASS', ...document, document })
)
const list = makeFunctionReference<'query', AuthoredCatalogueReadInput, AuthoredCataloguePage>(
  'content/catalogue:list'
)
const input = {
  subjectKind: 'CLASS',
  sort: 'family',
  paginationOpts: { cursor: null, numItems: 48 }
} satisfies AuthoredCatalogueReadInput

async function fixture() {
  const result = await publicationFixture(
    import.meta.glob('/apps/apis/convex/**/*.*s'),
    import.meta.glob('../betterAuth/**/*.*s'),
    [subjects.slice(0, 3), subjects.slice(3)]
  )
  for (const subject of subjects) {
    const parsed = parsePublicationDocument('CLASS', subject.document)
    await result.t.mutation(internal.content.import.syncClassDerived, {
      id: subject.id,
      checksum: subject.checksum,
      parentClassId: parsed.document.category === 'SUBCLASS' ? parsed.document.parentClassId : null,
      compilation: compilePublicationDocument(parsed)
    })
  }
  return result
}

describe('UUID-defined Class catalogue families', () => {
  it('keeps same-named parents separate and orders only siblings alphabetically through replayable pages', async () => {
    const { t } = await fixture()
    const expected = [ids[2], ids[0], ids[5], ids[3], ids[1], ids[4]]
    expect((await t.query(list, input)).page.map((row) => row.id)).toEqual(expected)
    const visited: string[] = []
    let cursor: string | null = null
    let done = false
    for (let index = 0; index < 8 && !done; index++) {
      const request: AuthoredCatalogueReadInput = {
        ...input,
        paginationOpts: { cursor, numItems: 1 }
      }
      const page = await t.query(list, request)
      expect(await t.query(list, request)).toEqual(page)
      expect(
        (
          await t.query(list, {
            ...request,
            paginationOpts: { ...request.paginationOpts, endCursor: page.continueCursor }
          })
        ).page
      ).toEqual(page.page)
      visited.push(...page.page.map((row) => row.id))
      cursor = page.continueCursor
      done = page.isDone
    }
    expect(done).toBe(true)
    expect(visited).toEqual(expected)
    for (const systemId of [undefined, fighter.systemId]) {
      const filtered = await t.query(list, { ...input, systemId, category: 'SUBCLASS' })
      expect(filtered.page.map((row) => row.id)).toEqual([ids[5], ids[3], ids[4]])
      expect(filtered.page.map((row) => row.parentClassId)).toEqual([ids[0], ids[0], ids[1]])
    }
    expect(
      (await t.query(list, { ...input, systemId: '10000000-0000-4000-8000-000000000001' })).page
    ).toEqual([])
    expect((await t.query(list, { ...input, source: 'OWNED' })).page).toEqual([])
    const ordinary = await t.query(list, { ...input, sort: 'name' })
    expect(ordinary.page.map((row) => row.label)).toEqual([
      'Alpha',
      'Alpha',
      'Bravo',
      'Shared',
      'Shared',
      'Zulu'
    ])
    await expect(t.query(list, { ...input, subjectKind: 'EQUIPMENT' })).rejects.toThrow(
      'family sorting is not supported'
    )
  })

  it('merges master and owned subclasses under the same UUID through one-item cursors', async () => {
    const { t, first, second } = await fixture()
    const draft = await first.caller.mutation(api.content.drafts.duplicate, {
      subjectKind: 'CLASS',
      subjectId: ids[5]!
    })
    const saved = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'CLASS',
      subjectId: draft.subjectId,
      systemId: draft.systemId,
      label: 'Delta',
      payload: draft.payload
    })
    await first.caller.action(api.content.classPublicationActions.publishDraft, {
      subjectKind: 'CLASS',
      subjectId: saved.subjectId,
      expectedDraftUpdatedAt: authoredPublishDraftInputSchema.shape.expectedDraftUpdatedAt.parse(
        saved.updatedAt
      )
    })
    for (const systemId of [undefined, fighter.systemId]) {
      const visited: string[] = []
      let cursor: string | null = null
      let done = false
      for (let index = 0; index < 9 && !done; index++) {
        const request: AuthoredCatalogueReadInput = {
          ...input,
          systemId,
          paginationOpts: { cursor, numItems: 1 }
        }
        const page: AuthoredCataloguePage = await first.caller.query(list, request)
        expect(await first.caller.query(list, request)).toEqual(page)
        visited.push(...page.page.map((row) => row.id))
        cursor = page.continueCursor
        done = page.isDone
      }
      expect(done).toBe(true)
      expect(visited).toEqual([ids[2], ids[0], ids[5], saved.subjectId, ids[3], ids[1], ids[4]])
      expect(
        (await first.caller.query(list, { ...input, systemId, source: 'OWNED' })).page
      ).toMatchObject([{ id: saved.subjectId, parentClassId: ids[0], parentClassLabel: 'Shared' }])
      expect(
        (await second.caller.query(list, { ...input, systemId })).page.map((row) => row.id)
      ).not.toContain(saved.subjectId)
      expect((await t.query(list, { ...input, systemId })).page.map((row) => row.id)).not.toContain(
        saved.subjectId
      )
    }
  })

  it('fails closed until exact family backfill, rejects name-only or wrong-ID keys, and preserves canonical replay', async () => {
    const { t } = await fixture()
    const root = await t.run((ctx) =>
      ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', ids[3]!))
        .unique()
    )
    if (!root) throw new Error('Missing subclass fixture')
    await t.run((ctx) => ctx.db.patch(root._id, { catalogueFamily: undefined }))
    await expect(t.query(list, input)).rejects.toThrow('family backfill is incomplete')
    for (const systemId of [undefined, fighter.systemId]) {
      expect(
        (await t.query(list, { ...input, systemId, category: 'BASE' })).page.map((row) => row.id)
      ).toEqual([ids[2], ids[0], ids[1]])
      await expect(t.query(list, { ...input, systemId, category: 'SUBCLASS' })).rejects.toThrow(
        'family backfill is incomplete'
      )
    }
    expect((await t.query(list, { ...input, sort: 'name' })).page).toHaveLength(6)
    let cursor: string | null = null
    let done = false
    for (let index = 0; index < 10 && !done; index++) {
      const result: AuthoredCatalogueSearchBackfillResult = await t.mutation(
        internal.content.catalogueSearchBackfill.backfill,
        {
          paginationOpts: { cursor, numItems: 2 }
        }
      )
      cursor = result.continueCursor
      done = result.isDone
    }
    expect(done).toBe(true)
    expect((await t.query(list, input)).page).toHaveLength(6)
    expect(
      await t.mutation(internal.content.import.importSubjects, {
        contentSourceId: SRD_CONTENT_SOURCE.id,
        subjects
      })
    ).toEqual({ inserted: 0, reused: 6 })
    await t.run((ctx) =>
      ctx.db.patch(root._id, { catalogueFamily: { id: ids[1]!, nameKey: 'shared' } })
    )
    await expect(t.query(list, input)).rejects.toThrow('family projection mismatch')
    await expect(
      t.mutation(internal.content.import.importSubjects, {
        contentSourceId: SRD_CONTENT_SOURCE.id,
        subjects
      })
    ).rejects.toThrow('Canonical content conflict')
    await t.run((ctx) =>
      ctx.db.patch(root._id, { catalogueFamily: { id: ids[0]!, nameKey: 'wrong' } })
    )
    await expect(t.query(list, input)).rejects.toThrow('family projection mismatch')
    expect(
      (
        await t.query(api.content.catalogue.search, {
          subjectKind: 'CLASS',
          source: 'MASTER',
          query: 'Zulu',
          paginationOpts: input.paginationOpts
        })
      ).page[0]?.parentClassId
    ).toBe(ids[0])
  })
})
